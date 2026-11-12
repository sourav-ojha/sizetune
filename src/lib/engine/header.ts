/**
 * Header-only dimension reader (no decoding): JPEG SOFn (+ EXIF orientation), PNG IHDR (+ tRNS/acTL), WebP VP8/VP8L/VP8X.
 * Every read is bounds-checked; malformed or truncated input yields { ok:false, reason:'corrupt' } instead of throwing.
 */
import { EngineError } from './types';
import { sniffType, describeUnsupported, type ImageMime } from './sniff';

export interface HeaderInfo {
  mime: ImageMime;
  /** Dimensions as stored in the file. */
  storedWidth: number;
  storedHeight: number;
  /** Display dimensions after EXIF orientation (5–8 swap width/height). */
  width: number;
  height: number;
  /** EXIF orientation 1–8 (JPEG only; 1 for others). */
  orientation: number;
  /** False only when the format guarantees there is no alpha channel (then no alpha scan is needed). */
  alphaPossible: boolean;
  animated: boolean;
}

export type HeaderParse =
  | { ok: true; info: HeaderInfo }
  | { ok: false; reason: 'need_more'; needBytes: number }
  | { ok: false; reason: 'corrupt'; detail: string }
  | { ok: false; reason: 'unsupported' };

const MAX_DIM = 0x7fffffff;
const corrupt = (detail: string): HeaderParse => ({ ok: false, reason: 'corrupt', detail });

/**
 * Parse a header from the first `bytes.length` bytes of a file whose real size is `totalSize`.
 * Returns need_more when the answer lies beyond the provided bytes but within the file.
 */
export interface ParseOptions {
  /** PNG only: if the bytes run out before IDAT, return the header with alphaPossible=true (conservative) instead of need_more. */
  pngAssumeAlphaIfShort?: boolean;
}

export function parseHeader(bytes: Uint8Array, totalSize: number, opts: ParseOptions = {}): HeaderParse {
  const mime = sniffType(bytes);
  if (!mime) {
    // A file that is only a few bytes long may be a truncated JPEG/PNG/WebP; still not an image we can use.
    return { ok: false, reason: 'unsupported' };
  }
  const truncated = (need: number): HeaderParse =>
    need > bytes.length && bytes.length < totalSize ? { ok: false, reason: 'need_more', needBytes: Math.min(totalSize, Math.max(need, bytes.length * 2)) } : corrupt('truncated header');
  try {
    if (mime === 'image/jpeg') return parseJpeg(bytes, truncated);
    if (mime === 'image/png') return parsePng(bytes, truncated, !!opts.pngAssumeAlphaIfShort);
    return parseWebp(bytes, truncated);
  } catch {
    return corrupt('header parse error');
  }
}

type Trunc = (need: number) => HeaderParse;
const orient = (w: number, h: number, o: number) => (o >= 5 && o <= 8 ? [h, w] : [w, h]);

/** libjpeg skips stray non-FF bytes before a marker ("extraneous bytes"); we mirror it, bounded in total. */
export const JPEG_EXTRANEOUS_MAX = 64 * 1024;

function parseJpeg(b: Uint8Array, truncated: Trunc): HeaderParse {
  let i = 2;
  let orientation = 1;
  let sawExif = false;
  let extraneous = 0;
  for (let guard = 0; guard < 100_000; guard++) {
    if (i + 2 > b.length) return truncated(i + 4);
    if (b[i] !== 0xff) {
      let j = i;
      while (j < b.length && b[j] !== 0xff && extraneous + (j - i) <= JPEG_EXTRANEOUS_MAX) j++;
      extraneous += j - i;
      if (extraneous > JPEG_EXTRANEOUS_MAX) return corrupt('too many extraneous bytes');
      if (j >= b.length) return truncated(j + 4);
      i = j;
      continue;
    }
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; } // fill byte
    // libjpeg next_marker(): "FF 00" is not a marker but 2 junk bytes; keep looking (same stray budget).
    if (m === 0x00) { extraneous += 2; if (extraneous > JPEG_EXTRANEOUS_MAX) return corrupt('too many extraneous bytes'); i += 2; continue; }
    if (m >= 0x02 && m <= 0xbf) return corrupt('unknown marker'); // reserved: libjpeg stops with JERR_UNKNOWN_MARKER
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; } // standalone markers
    if (m === 0xd8) return corrupt('nested SOI');
    if (m === 0xd9) return corrupt('EOI before frame header');
    if (m === 0xda) return corrupt('scan before frame header');
    if (i + 4 > b.length) return truncated(i + 4);
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2) return corrupt('bad segment length');
    const segEnd = i + 2 + len;
    const isSof = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
    if (isSof) {
      if (len < 8) return corrupt('short SOF');
      if (segEnd > b.length) return truncated(segEnd);
      const h = (b[i + 5] << 8) | b[i + 6];
      const w = (b[i + 7] << 8) | b[i + 8];
      const nc = b[i + 9];
      if (w === 0 || h === 0) return corrupt('zero dimension');
      if (nc < 1 || nc > 4 || len < 8 + 3 * nc) return corrupt('bad component count');
      const [dw, dh] = orient(w, h, orientation);
      return { ok: true, info: { mime: 'image/jpeg', storedWidth: w, storedHeight: h, width: dw, height: dh, orientation, alphaPossible: false, animated: false } };
    }
    if (m === 0xe1 && !sawExif) {
      if (segEnd > b.length) return truncated(segEnd);
      const o = exifOrientation(b, i + 4, segEnd);
      if (o !== null) { orientation = o; sawExif = true; }
    }
    i = segEnd;
  }
  return corrupt('too many segments');
}

/** Orientation tag from an APP1 payload starting at `p` ("Exif\0\0" + TIFF). Returns null if this APP1 is not EXIF. */
export function exifOrientation(b: Uint8Array, p: number, end: number): number | null {
  if (end - p < 14) return null;
  if (!(b[p] === 0x45 && b[p + 1] === 0x78 && b[p + 2] === 0x69 && b[p + 3] === 0x66 && b[p + 4] === 0 && b[p + 5] === 0)) return null;
  const t = p + 6;
  const le = b[t] === 0x49 && b[t + 1] === 0x49;
  const be = b[t] === 0x4d && b[t + 1] === 0x4d;
  if (!le && !be) return 1;
  const r16 = (o: number) => (o + 2 > end ? -1 : le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const r32 = (o: number) => (o + 4 > end ? -1 : le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
  if (r16(t + 2) !== 42) return 1;
  const ifd = r32(t + 4);
  if (ifd < 8 || t + ifd + 2 > end) return 1;
  const n = r16(t + ifd);
  if (n < 0 || n > 1000) return 1;
  for (let k = 0; k < n; k++) {
    const e = t + ifd + 2 + 12 * k;
    if (e + 12 > end) return 1;
    if (r16(e) === 0x0112) {
      const type = r16(e + 2);
      const v = type === 3 ? r16(e + 8) : type === 4 ? r32(e + 8) : -1;
      return v >= 1 && v <= 8 ? v : 1;
    }
  }
  return 1;
}

function parsePng(b: Uint8Array, truncated: Trunc, assumeAlphaIfShort: boolean): HeaderParse {
  if (b.length < 33) return truncated(33);
  const r32 = (o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const type = (o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  if (r32(8) !== 13 || type(12) !== 'IHDR') return corrupt('missing IHDR');
  const w = r32(16);
  const h = r32(20);
  const colorType = b[25];
  if (w === 0 || h === 0 || w > MAX_DIM || h > MAX_DIM) return corrupt('bad dimension');
  if (![0, 2, 3, 4, 6].includes(colorType)) return corrupt('bad colour type');
  let alpha = colorType === 4 || colorType === 6;
  let animated = false;
  // Walk ancillary chunks up to the first IDAT looking for tRNS (palette/RGB/grey transparency) / acTL.
  // If the walk cannot finish (chunk cap or read cap), alpha is assumed possible: conservative, never "no alpha" by guess.
  const info = (a: boolean): HeaderParse => ({ ok: true, info: { mime: 'image/png', storedWidth: w, storedHeight: h, width: w, height: h, orientation: 1, alphaPossible: a, animated } });
  let i = 33;
  for (let guard = 0; ; guard++) {
    if (guard >= 200_000) return info(true);
    if (i + 8 > b.length) return assumeAlphaIfShort ? info(true) : truncated(i + 8);
    const len = r32(i);
    const t = type(i + 4);
    if (len > MAX_DIM) return corrupt('bad chunk length');
    if (t === 'IDAT') break;
    if (t === 'IEND') return corrupt('no image data');
    if (t === 'tRNS') alpha = true;
    if (t === 'acTL') animated = true;
    i += 12 + len;
  }
  return info(alpha);
}

function parseWebp(b: Uint8Array, truncated: Trunc): HeaderParse {
  if (b.length < 16) return truncated(30);
  const fourcc = String.fromCharCode(b[12], b[13], b[14], b[15]);
  const info = (w: number, h: number, alpha: boolean, animated: boolean): HeaderParse =>
    w > 0 && h > 0 ? { ok: true, info: { mime: 'image/webp', storedWidth: w, storedHeight: h, width: w, height: h, orientation: 1, alphaPossible: alpha, animated } } : corrupt('zero dimension');
  if (fourcc === 'VP8X') {
    if (b.length < 30) return truncated(30);
    const flags = b[20];
    const w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    const h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
    return info(w, h, (flags & 0x10) !== 0, (flags & 0x02) !== 0);
  }
  if (fourcc === 'VP8 ') {
    if (b.length < 30) return truncated(30);
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return corrupt('bad VP8 start code');
    const w = (b[26] | (b[27] << 8)) & 0x3fff;
    const h = (b[28] | (b[29] << 8)) & 0x3fff;
    return info(w, h, false, false);
  }
  if (fourcc === 'VP8L') {
    if (b.length < 25) return truncated(25);
    if (b[20] !== 0x2f) return corrupt('bad VP8L signature');
    const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
    const w = 1 + (bits & 0x3fff);
    const h = 1 + ((bits >>> 14) & 0x3fff);
    return info(w, h, ((bits >>> 28) & 1) === 1, false);
  }
  return corrupt('unknown WebP chunk');
}

const FIRST_READ = 64 * 1024;
const MAX_HEADER_READ = 8 * 1024 * 1024;

async function readSlice(blob: Blob, end: number): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(0, end).arrayBuffer());
}

/** Read and parse the header from a Blob/File, reading more of the file only when needed (at most `maxRead`). Throws EngineError. */
export async function readHeader(blob: Blob, opts: { maxRead?: number } = {}): Promise<HeaderInfo> {
  const cap = opts.maxRead ?? MAX_HEADER_READ;
  if (blob.size === 0) throw new EngineError('corrupt', 'The file is empty.');
  let n = Math.min(blob.size, FIRST_READ, cap);
  let bytes = await readSlice(blob, n);
  if (!sniffType(bytes)) {
    const kind = describeUnsupported(bytes);
    throw new EngineError('unsupported_type', kind ? `${kind} files are not supported. Please choose a JPEG, PNG or WebP image.` : 'This file is not a JPEG, PNG or WebP image.');
  }
  for (let round = 0; round < 12; round++) {
    const r = parseHeader(bytes, blob.size);
    if (r.ok) return r.info;
    if (r.reason === 'need_more' && r.needBytes > n && n < cap) {
      n = Math.min(blob.size, r.needBytes, cap);
      bytes = await readSlice(blob, n);
      continue;
    }
    if (r.reason === 'need_more') {
      // Read cap reached: PNG dimensions are known from IHDR; assume alpha is possible rather than failing.
      const last = parseHeader(bytes, blob.size, { pngAssumeAlphaIfShort: true });
      if (last.ok && last.info.mime === 'image/png') return last.info;
    }
    break;
  }
  throw new EngineError('corrupt', 'This image file is damaged or incomplete.');
}
