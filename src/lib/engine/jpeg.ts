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
  const icc = s.segs.filter((g) => g.marker === 0xe2 && g.end - g.start >= 4 + ICC_ID.length + 2 && ICC_ID.every((v, k) => b[g.start + 4 + k] === v));
  if (!icc.length) return null;
  // Only a complete single-chunk sRGB profile is removed (decoders assume sRGB without one). Any other profile is kept.
  if (icc.length !== 1) return null;
  const g0 = icc[0];
  const seq = b[g0.start + 4 + ICC_ID.length], count = b[g0.start + 5 + ICC_ID.length];
  if (seq !== 1 || count !== 1 || !iccIsSrgb(b.subarray(g0.start + 6 + ICC_ID.length, g0.end))) return null;
  const drop = icc;
  const out = new Uint8Array(b.length - drop.reduce((n, g) => n + (g.end - g.start), 0));
  let o = 0, i = 0;
  for (const g of drop) {
    out.set(b.subarray(i, g.start), o); o += g.start - i; i = g.end;
  }
  out.set(b.subarray(i), o);
  return isStructurallyValidJpeg(out) ? out : null;
}

/** True when an ICC profile is an RGB profile whose description (v2 'desc' or v4 'mluc') names sRGB. Bounds-checked. */
export function iccIsSrgb(p: Uint8Array): boolean {
  if (p.length < 132) return false;
  const r32 = (o: number) => (o + 4 > p.length ? -1 : ((p[o] << 24) | (p[o + 1] << 16) | (p[o + 2] << 8) | p[o + 3]) >>> 0);
  const tag = (o: number) => String.fromCharCode(p[o], p[o + 1], p[o + 2], p[o + 3]);
  if (tag(16) !== 'RGB ' || tag(36) !== 'acsp') return false;
  const n = r32(128);
  if (n < 0 || n > 200) return false;
  for (let k = 0; k < n; k++) {
    const e = 132 + 12 * k;
    if (e + 12 > p.length) return false;
    if (tag(e) !== 'desc') continue;
    const off = r32(e + 4), size = r32(e + 8);
    if (off < 0 || size < 12 || off + size > p.length) return false;
    let text = '';
    if (tag(off) === 'desc') {
      const len = Math.min(r32(off + 8), size - 12);
      for (let i = 0; i < len; i++) text += String.fromCharCode(p[off + 12 + i]);
    } else if (tag(off) === 'mluc') {
      const recs = Math.min(r32(off + 8), 50);
      for (let r = 0; r < recs; r++) {
        const re = off + 16 + 12 * r;
        const len = r32(re + 4), so = r32(re + 8);
        if (len < 0 || so < 0 || off + so + len > off + size) return false;
        for (let i = 0; i + 1 < len; i += 2) text += String.fromCharCode((p[off + so + i] << 8) | p[off + so + i + 1]);
      }
    } else return false;
    return /^sRGB\b|\bsRGB IEC61966/.test(text.replace(/\0/g, '').trim());
  }
  return false;
}
