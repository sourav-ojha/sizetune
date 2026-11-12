/** Cheap magic-byte sniffing of the first bytes of a file. The engine remains the authority; this gives instant feedback and an alpha hint. */

export type SniffKind = 'jpeg' | 'png' | 'webp';
export interface Sniff { kind: SniffKind | null; /** true/false when known from the header, null when unknown. */ hasAlpha: boolean | null }

export const SNIFF_BYTES = 4096;

const ascii = (b: Uint8Array, at: number, s: string): boolean => {
  if (b.length < at + s.length) return false;
  for (let i = 0; i < s.length; i++) if (b[at + i] !== s.charCodeAt(i)) return false;
  return true;
};

function pngHasTrns(b: Uint8Array): boolean {
  // Walk chunks until IDAT; tRNS must precede it.
  let p = 8;
  while (p + 8 <= b.length) {
    const len = ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;
    if (ascii(b, p + 4, 'tRNS')) return true;
    if (ascii(b, p + 4, 'IDAT')) return false;
    p += 12 + len;
  }
  return false;
}

export function sniffImage(b: Uint8Array): Sniff {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: 'jpeg', hasAlpha: false };
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 'PNG') && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    if (b.length < 26) return { kind: 'png', hasAlpha: null };
    const colorType = b[25];
    if (colorType === 4 || colorType === 6) return { kind: 'png', hasAlpha: true };
    if (pngHasTrns(b)) return { kind: 'png', hasAlpha: true };
    return { kind: 'png', hasAlpha: false };
  }
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')) {
    if (ascii(b, 12, 'VP8X') && b.length > 20) return { kind: 'webp', hasAlpha: (b[20] & 0x10) !== 0 };
    if (ascii(b, 12, 'VP8L') && b.length > 24) {
      const v = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
      return { kind: 'webp', hasAlpha: ((v >>> 28) & 1) === 1 };
    }
    if (ascii(b, 12, 'VP8 ')) return { kind: 'webp', hasAlpha: false };
    return { kind: 'webp', hasAlpha: null };
  }
  return { kind: null, hasAlpha: null };
}
