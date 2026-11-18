// Pure geometry for the crop workbench (FEATURE-025): ratios, crop windows, padding, corner radius and freehand paths. No DOM, so it is unit tested.

export interface Ratio { w: number; h: number }
export interface Size { w: number; h: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }

export const RATIO_PRESETS = [
  { value: '1:1', label: 'Square 1:1' },
  { value: '4:5', label: 'Portrait 4:5' },
  { value: '3:4', label: 'Portrait 3:4' },
  { value: '2:3', label: 'Portrait 2:3' },
  { value: '4:3', label: 'Landscape 4:3' },
  { value: '3:2', label: 'Landscape 3:2' },
  { value: '16:9', label: 'Wide 16:9' },
] as const;

/** Reads "4:5", "16/9" or "4 5" style ratios. Null unless both numbers are positive. */
export function parseRatio(text: string): Ratio | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)\s*$/.exec(text);
  if (!m) return null;
  const w = Number(m[1]), h = Number(m[2]);
  return w > 0 && h > 0 ? { w, h } : null;
}

const unit = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);

/** The largest window of the picture with the target shape. `fx` and `fy` (0 to 1) slide the window along the picture; 0.5 centres it. */
export function ratioCrop(src: Size, ratio: Ratio, fx = 0.5, fy = 0.5): Rect {
  const target = ratio.w / ratio.h;
  let w = src.w, h = src.h;
  if (src.w / src.h > target) w = Math.max(1, Math.round(src.h * target)); // picture is wider than the target: trim the sides
  else h = Math.max(1, Math.round(src.w / target)); // picture is taller than the target: trim top and bottom
  return { x: Math.round((src.w - w) * unit(fx)), y: Math.round((src.h - h) * unit(fy)), w, h };
}

/** A canvas at the target shape that holds the whole picture at its own size, centred. The picture is never scaled, so it cannot be stretched. */
export function ratioPad(src: Size, ratio: Ratio): { canvas: Size; image: Rect } {
  const target = ratio.w / ratio.h;
  let cw = src.w, ch = src.h;
  if (src.w / src.h > target) ch = Math.round(src.w / target); // picture is wider: add space above and below
  else cw = Math.round(src.h * target); // picture is taller: add space left and right
  cw = Math.max(cw, src.w); ch = Math.max(ch, src.h);
  return { canvas: { w: cw, h: ch }, image: { x: Math.round((cw - src.w) / 2), y: Math.round((ch - src.h) / 2), w: src.w, h: src.h } };
}

/** The corner radius is a share of the shorter side, never more than half of it (a full circle on a square). */
export const MAX_RADIUS_PCT = 50;
export function radiusPx(w: number, h: number, pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Math.round((Math.min(w, h) * Math.min(MAX_RADIUS_PCT, pct)) / 100);
}

/** The box around a drawn path, or null for no points. */
export function pathBounds(points: Pt[]): Rect | null {
  if (points.length === 0) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Drops sampled points that are closer than `spacing` to the last kept one, keeping the first and the last point. */
export function thinPath(points: Pt[], spacing: number): Pt[] {
  if (points.length < 3) return points.slice();
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const last = out[out.length - 1];
    if (Math.hypot(points[i].x - last.x, points[i].y - last.y) >= spacing) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}
