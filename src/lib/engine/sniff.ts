/** Magic-byte type detection. The declared MIME type and file extension are never trusted. */
export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

const at = (b: Uint8Array, off: number, s: string) => {
  if (b.length < off + s.length) return false;
  for (let i = 0; i < s.length; i++) if (b[off + i] !== s.charCodeAt(i)) return false;
  return true;
};

/** Returns the image type for JPEG/PNG/WebP, or null for anything else (SVG, GIF, HEIC, AVIF, BMP, ...). Needs >= 12 bytes for WebP. */
export function sniffType(b: Uint8Array): ImageMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && at(b, 1, 'PNG') && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (at(b, 0, 'RIFF') && at(b, 8, 'WEBP')) return 'image/webp';
  return null;
}

/** Best-effort name for a rejected type, used only to make the error message friendlier. */
export function describeUnsupported(b: Uint8Array): string | null {
  if (at(b, 0, 'GIF8')) return 'GIF';
  if (at(b, 4, 'ftyp')) {
    const brand = String.fromCharCode(...b.slice(8, 12));
    if (/^(avif|avis)$/.test(brand)) return 'AVIF';
    if (/^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand)) return 'HEIC';
    return null;
  }
  if (at(b, 0, 'BM')) return 'BMP';
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a)) return 'TIFF';
  const head = String.fromCharCode(...b.slice(0, 256)).trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg')) || head.startsWith('<!doctype svg')) return 'SVG';
  if (head.startsWith('<?xml')) return 'SVG';
  return null;
}

/** True when `b` begins with the magic bytes of `mime`. Used to verify every encoded candidate. */
export function hasMagic(b: Uint8Array, mime: ImageMime): boolean {
  return sniffType(b) === mime;
}
