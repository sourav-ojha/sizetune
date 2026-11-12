/** JPEG byte-level helpers: ICC APP2 removal and a structural validator. Pure. */

const ICC_ID = [0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46, 0x49, 0x4c, 0x45, 0x00]; // "ICC_PROFILE\0"

interface Seg { marker: number; start: number; end: number }

/** Segments from SOI up to and including SOS; null if malformed. */
function segments(b: Uint8Array): { segs: Seg[]; sos: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const segs: Seg[] = [];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m === 0xd8 || m === 0xd9 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) return null; // not expected before SOS
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2 || i + 2 + len > b.length) return null;
    segs.push({ marker: m, start: i, end: i + 2 + len });
    if (m === 0xda) return { segs, sos: i };
    i += 2 + len;
  }
  return null;
}

/** SOI, well-formed segments, a frame header, a scan, and EOI at the end. */
export function isStructurallyValidJpeg(b: Uint8Array): boolean {
  const s = segments(b);
  if (!s) return false;
  const hasSof = s.segs.some((g) => g.marker >= 0xc0 && g.marker <= 0xcf && g.marker !== 0xc4 && g.marker !== 0xc8 && g.marker !== 0xcc);
  return hasSof && b.length >= 2 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9;
}

/** Remove APP2 ICC_PROFILE segments located before SOS. Returns null when there is nothing to strip or the file is malformed. */
export function stripIccProfile(b: Uint8Array): Uint8Array | null {
  const s = segments(b);
  if (!s) return null;
  const drop = s.segs.filter((g) => g.marker === 0xe2 && g.end - g.start >= 4 + ICC_ID.length && ICC_ID.every((v, k) => b[g.start + 4 + k] === v));
  if (!drop.length) return null;
  const out = new Uint8Array(b.length - drop.reduce((n, g) => n + (g.end - g.start), 0));
  let o = 0, i = 0;
  for (const g of drop) {
    out.set(b.subarray(i, g.start), o); o += g.start - i; i = g.end;
  }
  out.set(b.subarray(i), o);
  return isStructurallyValidJpeg(out) ? out : null;
}
