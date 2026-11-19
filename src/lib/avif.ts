// Telling AVIF, HEIC and the formats the engine reads apart by their first bytes (FEATURE-031). Pure: no DOM, no network.

export type Kind = 'jpeg' | 'png' | 'webp' | 'avif' | 'avif-animated' | 'heic' | 'other';

const text = (b: Uint8Array, at: number, n: number): string => String.fromCharCode(...b.subarray(at, at + n));
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs']);

/**
 * The picture type from the first bytes of a file. A JFIF file is a JPEG, so it is `jpeg`. AVIF is an ISO file whose `ftyp` box names `avif`
 * or `avis` (an image sequence, which may be animated) as the main brand or among the compatible ones. Needs about 12 bytes; shorter input is `other`.
 */
export function detectKind(b: Uint8Array): Kind {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 8 && b[0] === 0x89 && text(b, 1, 3) === 'PNG') return 'png';
  if (b.length >= 12 && text(b, 0, 4) === 'RIFF' && text(b, 8, 4) === 'WEBP') return 'webp';
  if (b.length >= 12 && text(b, 4, 4) === 'ftyp') {
    const size = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    const end = Math.min(b.length, size >= 16 ? size : 12);
    const brands = [text(b, 8, 4)];
    for (let p = 16; p + 4 <= end; p += 4) brands.push(text(b, p, 4)); // skip the 4-byte minor version
    if (brands.some((x) => HEIC_BRANDS.has(x))) return 'heic';
    if (brands.includes('avis')) return 'avif-animated';
    if (brands.includes('avif')) return 'avif';
  }
  return 'other';
}
