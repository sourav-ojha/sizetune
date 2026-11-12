/**
 * Truncation check before decoding (final audit F2). Some browsers (Safari) decode a cut-off JPEG and paint the rest
 * grey; we refuse incomplete files instead.
 * - JPEG: an EOI (FFD9) must follow the first SOS of the main image. Fast path: last 64 KB. Otherwise a bounded forward
 *   scan from SOS in 1 MB windows (motion photos append video after EOI). In entropy-coded data FF is always followed by
 *   00 or RSTn, so FFD9 there means EOI; an EOI inside an EXIF thumbnail (before SOS) does not count.
 * - PNG: an IEND chunk (tail search, else a bounded chunk walk). Data after IEND is allowed.
 * - WebP: the RIFF size must fit in the file (trailing data allowed).
 * Never throws anything but EngineError('corrupt').
 */
import { EngineError } from './types';
import { JPEG_EXTRANEOUS_MAX, type HeaderInfo } from './header';

const TAIL = 64 * 1024;
const WINDOW = 1024 * 1024;
const incomplete = () => new EngineError('corrupt', 'This image file is incomplete; it may have been cut off while downloading or copying. Please use the original file.');

/** Reads a Blob through a sliding window so walks/scans do not await per byte. */
class Reader {
  private start = 0;
  private buf = new Uint8Array(0);
  constructor(private readonly blob: Blob) {}
  get size() { return this.blob.size; }
  /** Ensure [off, off+len) is buffered (clipped to the file). Returns false if it lies past the end. */
  async ensure(off: number, len: number): Promise<boolean> {
    if (off < 0 || off + len > this.blob.size) return false;
    if (off >= this.start && off + len <= this.start + this.buf.length) return true;
    this.start = off;
    this.buf = new Uint8Array(await this.blob.slice(off, Math.min(this.blob.size, off + Math.max(len, WINDOW))).arrayBuffer());
    return true;
  }
  at(off: number) { return this.buf[off - this.start]; }
  window() { return { start: this.start, bytes: this.buf }; }
}

async function tail(blob: Blob): Promise<{ start: number; bytes: Uint8Array }> {
  const start = Math.max(0, blob.size - TAIL);
  return { start, bytes: new Uint8Array(await blob.slice(start).arrayBuffer()) };
}

async function jpegFirstSos(r: Reader): Promise<number> {
  let i = 2;
  let extraneous = 0;
  for (let guard = 0; guard < 200_000; guard++) {
    if (!(await r.ensure(i, 4))) return -1;
    if (r.at(i) !== 0xff) { if (++extraneous > JPEG_EXTRANEOUS_MAX) return -1; i++; continue; } // libjpeg-style stray bytes
    const m = r.at(i + 1);
    if (m === 0xff) { i++; continue; }
    if (m === 0x00) { extraneous += 2; if (extraneous > JPEG_EXTRANEOUS_MAX) return -1; i += 2; continue; } // libjpeg: FF00 is junk
    if (m >= 0x02 && m <= 0xbf) return -1; // reserved marker: not a JPEG we accept
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    if (m === 0xda) return i;
    if (m === 0xd8 || m === 0xd9) return -1;
    i += 2 + ((r.at(i + 2) << 8) | r.at(i + 3));
  }
  return -1;
}

async function jpegComplete(blob: Blob): Promise<boolean> {
  const r = new Reader(blob);
  const sos = await jpegFirstSos(r);
  if (sos < 0) return false;
  const t = await tail(blob);
  for (let k = t.bytes.length - 2; k >= 0; k--) {
    if (t.bytes[k] === 0xff && t.bytes[k + 1] === 0xd9) { if (t.start + k > sos) return true; break; }
  }
  // Bounded forward scan from SOS (the whole file is <= maxFileBytes).
  for (let off = sos + 2; off < blob.size - 1; off += WINDOW - 1) {
    await r.ensure(off, Math.min(WINDOW, blob.size - off));
    const { start, bytes } = r.window();
    for (let k = off - start; k + 1 < bytes.length; k++) if (bytes[k] === 0xff && bytes[k + 1] === 0xd9) return true;
  }
  return false;
}

const isIend = (b: Uint8Array, k: number) => b[k] === 0x49 && b[k + 1] === 0x45 && b[k + 2] === 0x4e && b[k + 3] === 0x44;

async function pngComplete(blob: Blob): Promise<boolean> {
  const t = await tail(blob);
  for (let k = t.bytes.length - 4; k >= 4; k--) {
    if (isIend(t.bytes, k) && t.bytes[k - 4] === 0 && t.bytes[k - 3] === 0 && t.bytes[k - 2] === 0 && t.bytes[k - 1] === 0 && t.start + k >= 12) return true;
  }
  const r = new Reader(blob);
  let i = 8;
  for (let guard = 0; guard < 200_000; guard++) {
    if (!(await r.ensure(i, 8))) return false;
    const len = ((r.at(i) << 24) | (r.at(i + 1) << 16) | (r.at(i + 2) << 8) | r.at(i + 3)) >>> 0;
    if (r.at(i + 4) === 0x49 && r.at(i + 5) === 0x45 && r.at(i + 6) === 0x4e && r.at(i + 7) === 0x44) return i + 12 <= blob.size;
    i += 12 + len;
    if (i > blob.size) return false;
  }
  return false;
}

async function webpComplete(blob: Blob): Promise<boolean> {
  if (blob.size < 12) return false;
  const h = new Uint8Array(await blob.slice(4, 8).arrayBuffer());
  const riff = (h[0] | (h[1] << 8) | (h[2] << 16) | (h[3] << 24)) >>> 0;
  return 8 + riff <= blob.size;
}

export async function assertComplete(blob: Blob, info: Pick<HeaderInfo, 'mime'>): Promise<void> {
  let ok: boolean;
  try {
    ok = info.mime === 'image/jpeg' ? await jpegComplete(blob) : info.mime === 'image/png' ? await pngComplete(blob) : await webpComplete(blob);
  } catch {
    ok = false;
  }
  if (!ok) throw incomplete();
}
