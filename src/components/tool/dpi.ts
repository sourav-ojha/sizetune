/**
 * DPI tag writer (FEATURE-013 FR-2). A post-encode step in the UI layer: the engine contract is untouched.
 * JPEG: the JFIF density fields. PNG: a pHYs chunk. WebP has no standard DPI field here, so it is left as it is.
 */
import { crc32 } from '../../lib/zip';
import { processImage, type ProcessImage } from './engine';

const MAX_DPI = 65535;

function u16(b: Uint8Array, o: number) { return (b[o] << 8) | b[o + 1]; }
function u32(b: Uint8Array, o: number) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }

function isJfif(b: Uint8Array, o: number) { // o = start of an APP0 marker (FF E0)
  return b[o] === 0xff && b[o + 1] === 0xe0 && b[o + 4] === 0x4a && b[o + 5] === 0x46 && b[o + 6] === 0x49 && b[o + 7] === 0x46 && b[o + 8] === 0;
}

function stampJpeg(bytes: Uint8Array, dpi: number): Uint8Array | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  if (isJfif(bytes, 2)) {
    const out = bytes.slice();
    out[13] = 1; out[14] = dpi >> 8; out[15] = dpi & 255; out[16] = dpi >> 8; out[17] = dpi & 255; // units 1 = dots per inch
    return out;
  }
  const seg = new Uint8Array([0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1, dpi >> 8, dpi & 255, dpi >> 8, dpi & 255, 0, 0]);
  const out = new Uint8Array(bytes.length + seg.length);
  out.set(bytes.subarray(0, 2), 0); out.set(seg, 2); out.set(bytes.subarray(2), 2 + seg.length);
  return out;
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function stampPng(bytes: Uint8Array, dpi: number): Uint8Array | null {
  if (bytes.length < 33 || PNG_SIG.some((v, i) => bytes[i] !== v)) return null;
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  chunk.set([0, 0, 0, 9, 0x70, 0x48, 0x59, 0x73], 0);
  chunk[8] = ppm >>> 24; chunk[9] = (ppm >>> 16) & 255; chunk[10] = (ppm >>> 8) & 255; chunk[11] = ppm & 255;
  chunk[12] = chunk[8]; chunk[13] = chunk[9]; chunk[14] = chunk[10]; chunk[15] = chunk[11];
  chunk[16] = 1; // unit: metre
  const crc = crc32(chunk.subarray(4, 17));
  chunk[17] = crc >>> 24; chunk[18] = (crc >>> 16) & 255; chunk[19] = (crc >>> 8) & 255; chunk[20] = crc & 255;
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let o = 8; let placed = false;
  while (o + 12 <= bytes.length) {
    const len = u32(bytes, o);
    const type = String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7]);
    const end = o + 12 + len;
    if (end > bytes.length) return null;
    if (type === 'pHYs') { o = end; continue; } // dropped: replaced by ours
    if (type === 'IDAT' && !placed) { parts.push(chunk); placed = true; }
    parts.push(bytes.subarray(o, end));
    o = end;
  }
  if (!placed) return null;
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let w = 0; for (const p of parts) { out.set(p, w); w += p.length; }
  return out;
}

/** The input with its DPI set, or null when the format has no supported tag, the DPI is out of range or the bytes are not that format. */
export function stampDpi(bytes: Uint8Array, mime: string, dpi: number): Uint8Array | null {
  if (!Number.isInteger(dpi) || dpi < 1 || dpi > MAX_DPI) return null;
  if (mime === 'image/jpeg') return stampJpeg(bytes, dpi);
  if (mime === 'image/png') return stampPng(bytes, dpi);
  return null;
}

/** DPI stored in a file, or null (used by tests and for display). */
export function readDpi(bytes: Uint8Array, mime: string): number | null {
  if (mime === 'image/jpeg') {
    if (!isJfif(bytes, 2)) return null;
    const x = u16(bytes, 14);
    return bytes[13] === 1 ? x : bytes[13] === 2 ? Math.round(x * 2.54) : null;
  }
  if (mime === 'image/png') {
    let o = 8;
    while (o + 12 <= bytes.length) {
      const len = u32(bytes, o);
      if (String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7]) === 'pHYs') return bytes[o + 16] === 1 ? Math.round(u32(bytes, o + 8) * 0.0254) : null;
      o += 12 + len;
    }
  }
  return null;
}

/** The engine call with the DPI step after it. `dpi` rides in the options object; the engine never sees it. */
export const processWithDpi: ProcessImage = async (file, opts, hooks) => {
  const { dpi, ...rest } = opts as typeof opts & { dpi?: number };
  const result = await processImage(file, rest, hooks);
  if (dpi == null) return result;
  if (result.mime === 'image/webp') {
    return { ...result, notes: [...result.notes, 'DPI is not written to WebP files, so this file has no DPI tag. Choose JPEG or PNG to set a DPI.'] };
  }
  const stamped = stampDpi(new Uint8Array(await result.blob.arrayBuffer()), result.mime, dpi);
  if (!stamped) return { ...result, notes: [...result.notes, 'The DPI tag could not be written to this file.'] };
  const max = result.window.maxBytes;
  if (max != null && result.bytes <= max && stamped.length > max) {
    return { ...result, notes: [...result.notes, `The DPI tag was not written: it would push the file over your ${(max / 1000).toLocaleString('en-US')} KB limit.`] };
  }
  const blob = new Blob([stamped as BlobPart], { type: result.mime });
  return { ...result, blob, bytes: blob.size, notes: [...result.notes, `DPI set to ${dpi}. Some portals check pixels, not DPI.`] };
};
