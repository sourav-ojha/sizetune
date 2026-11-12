/**
 * inspectFile(): header-only facts for the UI at file pick (before any object URL or decode).
 * Reads the leading bytes needed for the header (readHeader) plus a bounded metadata scan for an EXIF GPS IFD:
 * JPEG APP1 "Exif" (first 256 KB), PNG eXIf chunk (chunks up to IDAT in the first 256 KB), WebP EXIF chunk (chunk walk,
 * at most 64 chunk headers). Enforces the same byte/pixel limits as processImage. Throws only EngineError.
 * It does NOT check that the file is complete (processImage does that before decoding).
 */
import { EngineError } from './types';
import { readHeader, type HeaderInfo } from './header';
import { resolveLimits, type FullLimits } from './limits';
import type { ImageMime } from './sniff';

export interface FileInspection {
  mime: ImageMime;
  /** Display size (EXIF orientation applied for JPEG). */
  width: number;
  height: number;
  orientation: number;
  alphaPossible: boolean;
  /** The file carries an EXIF GPS block (location). Re-encoding removes it; keeping the original keeps it. */
  hasGps: boolean;
}

const META_READ = 256 * 1024;

/** True if the TIFF structure at [t, end) has an IFD0 GPSInfo (0x8825) pointer to a non-empty IFD. Bounds-checked. */
export function tiffHasGps(b: Uint8Array, t: number, end: number): boolean {
  if (t < 0 || end > b.length || end - t < 8) return false;
  const le = b[t] === 0x49 && b[t + 1] === 0x49;
  const be = b[t] === 0x4d && b[t + 1] === 0x4d;
  if (!le && !be) return false;
  const r16 = (o: number) => (o < t || o + 2 > end ? -1 : le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const r32 = (o: number) => (o < t || o + 4 > end ? -1 : le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
  if (r16(t + 2) !== 42) return false;
  const ifd = r32(t + 4);
  if (ifd < 8 || t + ifd + 2 > end) return false;
  const n = r16(t + ifd);
  if (n < 0 || n > 1000) return false;
  for (let k = 0; k < n; k++) {
    const e = t + ifd + 2 + 12 * k;
    if (e + 12 > end) return false;
    if (r16(e) === 0x8825) {
      const gps = r32(e + 8);
      if (gps < 8 || t + gps + 2 > end) return false;
      const count = r16(t + gps);
      return count > 0 && count <= 1000;
    }
  }
  return false;
}

const ascii = (b: Uint8Array, o: number, s: string) => o >= 0 && o + s.length <= b.length && [...s].every((c, i) => b[o + i] === c.charCodeAt(0));

function jpegGps(b: Uint8Array): boolean {
  let i = 2;
  for (let guard = 0; guard < 1000 && i + 4 <= b.length; guard++) {
    if (b[i] !== 0xff) return false;
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m === 0xda || m === 0xd9) return false;
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2) return false;
    if (m === 0xe1 && ascii(b, i + 4, 'Exif\0\0')) return tiffHasGps(b, i + 10, Math.min(b.length, i + 2 + len));
    i += 2 + len;
  }
  return false;
}

function pngGps(b: Uint8Array): boolean {
  let i = 8;
  for (let guard = 0; guard < 1000 && i + 8 <= b.length; guard++) {
    const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    if (ascii(b, i + 4, 'eXIf')) return tiffHasGps(b, i + 8, Math.min(b.length, i + 8 + len));
    if (ascii(b, i + 4, 'IDAT') || ascii(b, i + 4, 'IEND')) return false;
    i += 12 + len;
  }
  return false;
}

async function webpGps(blob: Blob): Promise<boolean> {
  let i = 12;
  for (let guard = 0; guard < 64 && i + 8 <= blob.size; guard++) {
    const h = new Uint8Array(await blob.slice(i, i + 8).arrayBuffer());
    const len = (h[4] | (h[5] << 8) | (h[6] << 16) | (h[7] << 24)) >>> 0;
    if (ascii(h, 0, 'EXIF')) {
      if (len > META_READ) return false;
      let d = new Uint8Array(await blob.slice(i + 8, i + 8 + len).arrayBuffer());
      if (ascii(d, 0, 'Exif\0\0')) d = d.subarray(6); // some writers keep the JPEG-style prefix
      return tiffHasGps(d, 0, d.length);
    }
    i += 8 + len + (len & 1);
  }
  return false;
}

async function hasGps(file: Blob, h: HeaderInfo): Promise<boolean> {
  try {
    if (h.mime === 'image/webp') return await webpGps(file);
    const b = new Uint8Array(await file.slice(0, Math.min(file.size, META_READ)).arrayBuffer());
    return h.mime === 'image/jpeg' ? jpegGps(b) : pngGps(b);
  } catch {
    return false; // metadata hint only: unreadable metadata never blocks the file
  }
}

export async function inspectFile(file: Blob, limitsIn?: Partial<FullLimits>): Promise<FileInspection> {
  const limits = resolveLimits(limitsIn);
  if (!(file instanceof Blob)) throw new EngineError('invalid_options', 'No file was given.');
  if (file.size > limits.maxFileBytes) throw new EngineError('too_large_bytes', `This file is larger than ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB. Please choose a smaller image.`);
  const h = await readHeader(file);
  const px = h.width * h.height;
  if (px > limits.maxPixels) throw new EngineError('too_many_pixels', `This image has ${(px / 1e6).toFixed(1)} megapixels; the limit is ${(limits.maxPixels / 1e6).toFixed(1)}. Please choose a smaller image.`);
  return { mime: h.mime, width: h.width, height: h.height, orientation: h.orientation, alphaPossible: h.alphaPossible, hasGps: await hasGps(file, h) };
}
