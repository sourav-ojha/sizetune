// Pure helpers for the signature maker (FEATURE-020): stroke bookkeeping and curve smoothing. No DOM here, so they are unit tested.

export interface Pt { x: number; y: number }
export type Stroke = Pt[];
export type PathCmd = ['M', number, number] | ['L', number, number] | ['Q', number, number, number, number];

/** Logical size of the drawing area. The canvas is shown scaled to the page width. */
export const DRAW_W = 900;
export const DRAW_H = 300;
/** Pen width in drawing-area units. */
export const LINE = 6;
/** Space kept around the ink when the signature is exported. */
export const EXPORT_PAD = 16;

export const FONTS = [
  { id: 'caveat', label: 'Caveat', family: 'Caveat' },
  { id: 'dancing', label: 'Dancing Script', family: 'Dancing Script' },
  { id: 'apple', label: 'Homemade Apple', family: 'Homemade Apple' },
] as const;
export type FontId = (typeof FONTS)[number]['id'];

export const INKS = [
  { id: 'black', label: 'Black', value: '#111827' },
  { id: 'blue', label: 'Blue', value: '#1e40af' },
] as const;
export type InkId = (typeof INKS)[number]['id'];

export interface Box { x: number; y: number; w: number; h: number }

/** The box around all drawn points, grown by `pad` on every side but never starting before the origin. Null when nothing is drawn. */
export function strokeBounds(strokes: Stroke[], pad: number): Box | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) for (const p of s) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (minX === Infinity) return null;
  const x = Math.max(0, minX - pad), y = Math.max(0, minY - pad);
  return { x, y, w: Math.max(1, maxX + pad - x), h: Math.max(1, maxY + pad - y) };
}

/** Everything but the last stroke. The input is not changed. */
export function undoStroke(strokes: Stroke[]): Stroke[] {
  return strokes.slice(0, -1);
}

/** A single tap: a zero-length line, which a round pen draws as a dot. */
export function dot(p: Pt): PathCmd[] {
  return [['M', p.x, p.y], ['L', p.x, p.y]].map((c) => c as PathCmd);
}

/** Path commands for a stroke: quadratic curves through the midpoints of the sampled points, which removes the corners of a mouse or finger path. */
export function smoothPath(points: Stroke): PathCmd[] {
  if (points.length === 0) return [];
  if (points.length === 1) return dot(points[0]);
  const out: PathCmd[] = [['M', points[0].x, points[0].y]];
  if (points.length === 2) { out.push(['L', points[1].x, points[1].y]); return out; }
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2, my = (points[i].y + points[i + 1].y) / 2;
    out.push(['Q', points[i].x, points[i].y, mx, my]);
  }
  const last = points[points.length - 1];
  out.push(['L', last.x, last.y]);
  return out;
}
