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
  const r = Math.max(0.5, radius), r2 = r * r;
  const stamp = (a: Pt, b: Pt) => {
    const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - r)), x1 = Math.min(w - 1, Math.ceil(Math.max(a.x, b.x) + r));
    const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) - r)), y1 = Math.min(h - 1, Math.ceil(Math.max(a.y, b.y) + r));
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2)); // nearest point on the segment
      const ex = x - (a.x + t * dx), ey = y - (a.y + t * dy);
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

/** Replaces the masked pixels by flat `block` x `block` squares holding the average colour of the masked pixels under each square. Squares start at the region's top-left. */
export function pixelate(img: Pixels, m: Mask, block: number): void {
  const b = Math.round(block);
  const box = maskBounds(m);
  if (!box || !(b > 1)) return;
  const { width: W } = img;
  for (let by = box.y; by < box.y + box.h; by += b) for (let bx = box.x; bx < box.x + box.w; bx += b) {
    const xe = Math.min(bx + b, box.x + box.w), ye = Math.min(by + b, box.y + box.h);
    let r = 0, g = 0, bl = 0, a = 0, n = 0;
    for (let y = by; y < ye; y++) for (let x = bx; x < xe; x++) if (m.data[y * W + x]) { const o = (y * W + x) * 4; r += img.data[o]; g += img.data[o + 1]; bl += img.data[o + 2]; a += img.data[o + 3]; n++; }
    if (!n) continue;
    const R = Math.round(r / n), G = Math.round(g / n), B = Math.round(bl / n), A = Math.round(a / n);
    for (let y = by; y < ye; y++) for (let x = bx; x < xe; x++) if (m.data[y * W + x]) { const o = (y * W + x) * 4; img.data[o] = R; img.data[o + 1] = G; img.data[o + 2] = B; img.data[o + 3] = A; }
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
  let src = new Float32Array(w * h * 4), tmp = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = ((y + y0) * img.width + x + x0) * 4, p = (y * w + x) * 4; for (let c = 0; c < 4; c++) src[p + c] = img.data[o + c]; }
  const pass = (from: Float32Array, to: Float32Array, horizontal: boolean) => {
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
    for (let c = 0; c < 4; c++) img.data[o + c] = Math.round(src[p + c]);
  }
}

/** The pixelate block size for a strength level (1 to 30), scaled to the picture so the effect looks the same on a small and a large photo. */
export function levelToBlock(level: number, w: number, h: number): number {
  const l = Number.isFinite(level) ? Math.min(30, Math.max(1, level)) : 5;
  return Math.max(3, Math.round((l * Math.max(w, h)) / 300));
}
