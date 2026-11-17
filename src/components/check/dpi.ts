export interface Dpi { x: number; y: number }

const u16 = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const ascii = (b: Uint8Array, at: number, s: string): boolean => {
  if (b.length < at + s.length) return false;
  for (let i = 0; i < s.length; i++) if (b[at + i] !== s.charCodeAt(i)) return false;
  return true;
};

/** Densities below this are placeholders (1 x 1 and the like), not a real print resolution. */
const MEANINGFUL = 10;
const clean = (d: Dpi | null): Dpi | null => (d && d.x >= MEANINGFUL && d.y >= MEANINGFUL ? d : null);

/** EXIF XResolution / YResolution / ResolutionUnit from the IFD0 of the TIFF block at [t, end). Bounds-checked; null on anything odd. */
function exifDpi(b: Uint8Array, t: number, end: number): Dpi | null {
  if (end > b.length || end - t < 8) return null;
  const le = b[t] === 0x49 && b[t + 1] === 0x49;
  if (!le && !(b[t] === 0x4d && b[t + 1] === 0x4d)) return null;
  const r16 = (o: number) => (o < t || o + 2 > end ? -1 : le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const r32 = (o: number) => (o < t || o + 4 > end ? -1 : le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
  if (r16(t + 2) !== 42) return null;
  const ifd = r32(t + 4);
  const n = r16(t + ifd);
  if (ifd < 8 || n < 0 || n > 200) return null;
  let x: number | null = null;
  let y: number | null = null;
  let unit = 2;
  const rational = (off: number) => { const num = r32(t + off); const den = r32(t + off + 4); return num > 0 && den > 0 ? num / den : null; };
  for (let k = 0; k < n; k++) {
    const e = t + ifd + 2 + 12 * k;
    if (e + 12 > end) return null;
    const tag = r16(e);
    if (tag === 0x11a && r16(e + 2) === 5) x = rational(r32(e + 8));
    else if (tag === 0x11b && r16(e + 2) === 5) y = rational(r32(e + 8));
    else if (tag === 0x128 && r16(e + 2) === 3) unit = r16(e + 8);
  }
  if (x === null || y === null || (unit !== 2 && unit !== 3)) return null;
  const f = unit === 3 ? 2.54 : 1;
  return { x: Math.round(x * f), y: Math.round(y * f) };
}

/** JPEG: JFIF density first, then EXIF resolution (where most phone photos keep it). */
function jpegDpi(b: Uint8Array): Dpi | null {
  let found: Dpi | null = null;
  let p = 2;
  while (p + 4 <= b.length && b[p] === 0xff) {
    const marker = b[p + 1];
    if (marker === 0xda || marker === 0xd9) break; // start of scan: no header density beyond this point
    const len = u16(b, p + 2);
    if (marker === 0xe0 && ascii(b, p + 4, 'JFIF\0') && p + 16 <= b.length) {
      const units = b[p + 11];
      const x = u16(b, p + 12);
      const y = u16(b, p + 14);
      if (x && y && units === 1) found = clean({ x, y }); // units 0 means "aspect ratio only": no resolution
      else if (x && y && units === 2) found = clean({ x: Math.round(x * 2.54), y: Math.round(y * 2.54) });
      if (found) return found;
    } else if (marker === 0xe1 && ascii(b, p + 4, 'Exif\0\0')) {
      const d = clean(exifDpi(b, p + 10, Math.min(b.length, p + 2 + len)));
      if (d) return d;
    }
    if (len < 2) break;
    p += 2 + len;
  }
  return null;
}

function pngPhys(b: Uint8Array): Dpi | null {
  let p = 8;
  while (p + 8 <= b.length) {
    const len = u32(b, p);
    if (ascii(b, p + 4, 'IDAT')) return null;
    if (ascii(b, p + 4, 'pHYs') && len >= 9 && p + 17 <= b.length) {
      const x = u32(b, p + 8);
      const y = u32(b, p + 12);
      if (b[p + 16] !== 1 || !x || !y) return null; // unit 0 is a ratio, not a resolution
      return clean({ x: Math.round(x * 0.0254), y: Math.round(y * 0.0254) });
    }
    p += 12 + len;
  }
  return null;
}

/**
 * Print resolution recorded in the file header: JFIF density or EXIF resolution for JPEG, pHYs for PNG. Returns null when the file does not carry one.
 * It never guesses, and it does not read WebP, so null means "not found in these places".
 */
export function readDpi(head: Uint8Array): Dpi | null {
  if (head.length > 3 && head[0] === 0xff && head[1] === 0xd8) return jpegDpi(head);
  if (head.length > 8 && head[0] === 0x89 && ascii(head, 1, 'PNG')) return pngPhys(head);
  return null;
}
