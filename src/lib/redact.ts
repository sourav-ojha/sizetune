// Pixel operations for the redaction tool (FEATURE-027): masks, black-out, pixelate and blur. Pure functions on plain pixel buffers (no DOM),
// so they are unit tested. All masks are BINARY (0 or 1): a pixel is either entirely inside a region or entirely outside it, so a black-out
// never leaves a half-covered edge pixel inside the region.

export interface Pixels { width: number; height: number; data: Uint8ClampedArray }
export interface Mask { width: number; height: number; data: Uint8Array }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }
export type Rgb = [number, number, number];

const emptyMask = (w: number, h: number): Mask => ({ width: w, height: h, data: new Uint8Array(w * h) });

/** The rectangle, clipped to the picture. */
export function rectMask(w: number, h: number, r: Rect): Mask {
  const m = emptyMask(w, h);
  const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y));
  const x1 = Math.min(w, Math.ceil(r.x + r.w)), y1 = Math.min(h, Math.ceil(r.y + r.h));
  for (let y = y0; y < y1; y++) m.data.fill(1, y * w + x0, y * w + Math.max(x0, x1));
  return m;
}

/** Every pixel within `radius` of the path (round pen, round ends). Exact distance test per pixel, so there are no soft edges. */
export function strokeMask(w: number, h: number, points: Pt[], radius: number): Mask {
  const m = emptyMask(w, h);
  if (points.length === 0) return m;
  // Cover every pixel the round pen touches at all, not only pixels whose centre is inside it: widen by half a pixel's diagonal. For a redaction tool
  // hiding a sliver too much is right and hiding a sliver too little is not.
  const r = Math.max(0.5, radius) + 0.71, r2 = r * r;
  const stamp = (a: Pt, b: Pt) => {
    const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - r) - 1), x1 = Math.min(w - 1, Math.ceil(Math.max(a.x, b.x) + r) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) - r) - 1), y1 = Math.min(h - 1, Math.ceil(Math.max(a.y, b.y) + r) + 1);
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const cx = x + 0.5, cy = y + 0.5; // test the pixel's centre, so the mask matches the round pen the user sees
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((cx - a.x) * dx + (cy - a.y) * dy) / len2)); // nearest point on the segment
      const ex = cx - (a.x + t * dx), ey = cy - (a.y + t * dy);
      if (ex * ex + ey * ey <= r2) m.data[y * w + x] = 1;
    }
  };
  if (points.length === 1) stamp(points[0], points[0]);
  for (let i = 1; i < points.length; i++) stamp(points[i - 1], points[i]);
  return m;
}

/** A pixel is in the result if it is in either mask. */
export function mergeMasks(a: Mask, b: Mask): Mask {
  const m = emptyMask(a.width, a.height);
  for (let i = 0; i < m.data.length; i++) m.data[i] = a.data[i] | b.data[i];
  return m;
}

/** The tight box around the masked pixels, or null when the mask is empty. */
export function maskBounds(m: Mask): Rect | null {
  let x0 = m.width, y0 = m.height, x1 = -1, y1 = -1;
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (m.data[y * m.width + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Sets every masked pixel to one colour, fully opaque. Nothing of the original is kept inside the region. */
export function blackout(img: Pixels, m: Mask, rgb: Rgb): void {
  for (let i = 0; i < m.data.length; i++) if (m.data[i]) { const o = i * 4; img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255; }
}

/** Block edges along one axis: every `size`, but a leftover shorter than half a block joins the block before it, so no block is ever tiny. */
function edges(length: number, size: number): number[] {
  const e = [0];
  for (let p = size; p < length; p += size) e.push(p);
  if (e.length > 1 && length - e[e.length - 1] < size / 2) e.pop();
  e.push(length);
  return e;
}

/**
 * Replaces the masked pixels by flat squares. The squares are laid on a fixed grid over the whole picture, and each holds the average of ALL the pixels
 * in its square (masked or not), so a masked pixel can never keep its own value: the smallest square is at least half a block wide and tall (never one
 * pixel), and it is written only to the masked pixels. Pixels outside the mask are not changed.
 */
export function pixelate(img: Pixels, m: Mask, block: number): void {
  const b = Math.round(block);
  const box = maskBounds(m);
  if (!box || !(b > 1)) return;
  const { width: W, height: H } = img;
  const xs = edges(W, b), ys = edges(H, b);
  const bx0 = Math.max(0, xs.findIndex((_e, i) => i + 1 < xs.length && xs[i + 1] > box.x)), by0 = Math.max(0, ys.findIndex((_e, i) => i + 1 < ys.length && ys[i + 1] > box.y));
  for (let yi = by0; yi + 1 < ys.length && ys[yi] < box.y + box.h; yi++) for (let xi = bx0; xi + 1 < xs.length && xs[xi] < box.x + box.w; xi++) {
    const xa = xs[xi], xb = xs[xi + 1], ya = ys[yi], yb = ys[yi + 1];
    let any = false;
    for (let y = ya; y < yb && !any; y++) for (let x = xa; x < xb; x++) if (m.data[y * W + x]) { any = true; break; }
    if (!any) continue;
    let r = 0, g = 0, bl = 0, a = 0;
    const n = (xb - xa) * (yb - ya);
    for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) { const o = (y * W + x) * 4; r += img.data[o]; g += img.data[o + 1]; bl += img.data[o + 2]; a += img.data[o + 3]; }
    const R = Math.round(r / n), G = Math.round(g / n), B = Math.round(bl / n), A = Math.round(a / n);
    for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) if (m.data[y * W + x]) { const o = (y * W + x) * 4; img.data[o] = R; img.data[o + 1] = G; img.data[o + 2] = B; img.data[o + 3] = A; }
  }
}

/** Blurs the masked pixels with three passes of a box blur (close to a Gaussian). The source for each pixel may come from outside the mask, but only masked pixels change. */
export function boxBlur(img: Pixels, m: Mask, radius: number): void {
  const r = Math.round(radius);
  const box = maskBounds(m);
  if (!box || r < 1) return;
  const x0 = Math.max(0, box.x - r * 3), y0 = Math.max(0, box.y - r * 3);
  const x1 = Math.min(img.width, box.x + box.w + r * 3), y1 = Math.min(img.height, box.y + box.h + r * 3);
  const w = x1 - x0, h = y1 - y0;
  // 8-bit buffers: a quarter of the memory of floats, which matters for a 16 MP picture on a phone. Three passes round slightly; that is not visible.
  let src = new Uint8ClampedArray(w * h * 4), tmp = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = ((y + y0) * img.width + x + x0) * 4, p = (y * w + x) * 4; for (let c = 0; c < 4; c++) src[p + c] = img.data[o + c]; }
  const pass = (from: Uint8ClampedArray, to: Uint8ClampedArray, horizontal: boolean) => {
    const len = horizontal ? w : h, lines = horizontal ? h : w, win = 2 * r + 1;
    for (let l = 0; l < lines; l++) for (let c = 0; c < 4; c++) {
      const idx = (i: number) => (horizontal ? (l * w + i) : (i * w + l)) * 4 + c;
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += from[idx(Math.min(len - 1, Math.max(0, i)))];
      for (let i = 0; i < len; i++) {
        to[idx(i)] = sum / win;
        sum += from[idx(Math.min(len - 1, i + r + 1))] - from[idx(Math.max(0, i - r))];
      }
    }
  };
  for (let k = 0; k < 3; k++) { pass(src, tmp, true); pass(tmp, src, false); }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m.data[(y + y0) * img.width + x + x0]) continue;
    const o = ((y + y0) * img.width + x + x0) * 4, p = (y * w + x) * 4;
    for (let c = 0; c < 4; c++) img.data[o + c] = src[p + c];
  }
}

/** The pixelate block size for a strength level (1 to 30), scaled to the picture so the effect looks the same on a small and a large photo. */
export function levelToBlock(level: number, w: number, h: number): number {
  const l = Number.isFinite(level) ? Math.min(30, Math.max(1, level)) : 5;
  // never below 6: with tiny squares a lone masked pixel could be worked out from its visible neighbours and the square's average
  return Math.max(6, Math.round((l * Math.max(w, h)) / 300));
}
