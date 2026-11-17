export interface Dpi { x: number; y: number }

const u16 = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const ascii = (b: Uint8Array, at: number, s: string): boolean => {
  if (b.length < at + s.length) return false;
  for (let i = 0; i < s.length; i++) if (b[at + i] !== s.charCodeAt(i)) return false;
  return true;
};

function jfif(b: Uint8Array): Dpi | null {
  let p = 2;
  while (p + 4 <= b.length && b[p] === 0xff) {
    const marker = b[p + 1];
    if (marker === 0xda || marker === 0xd9) return null; // start of scan: no header density beyond this point
    const len = u16(b, p + 2);
    if (marker === 0xe0 && ascii(b, p + 4, 'JFIF\0') && p + 16 <= b.length) {
      const units = b[p + 11];
      const x = u16(b, p + 12);
      const y = u16(b, p + 14);
      if (!x || !y) return null;
      if (units === 1) return { x, y };
      if (units === 2) return { x: Math.round(x * 2.54), y: Math.round(y * 2.54) };
      return null; // units 0 means "aspect ratio only": no resolution
    }
    if (len < 2) return null;
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
      return { x: Math.round(x * 0.0254), y: Math.round(y * 0.0254) };
    }
    p += 12 + len;
  }
  return null;
}

/**
 * Print resolution recorded in the file header: JFIF density for JPEG, pHYs for PNG. Returns null when the file does not carry one.
 * It never guesses, and it does not read EXIF resolution tags or WebP, so null means "not found in these places".
 */
export function readDpi(head: Uint8Array): Dpi | null {
  if (head.length > 3 && head[0] === 0xff && head[1] === 0xd8) return jfif(head);
  if (head.length > 8 && head[0] === 0x89 && ascii(head, 1, 'PNG')) return pngPhys(head);
  return null;
}
