// Pure layout for joining several pictures into one (FEATURE-026): a row, a column or a grid. No DOM, so it is unit tested.

export interface Size { w: number; h: number }
export interface Box { x: number; y: number; w: number; h: number }
export type JoinMode = 'row' | 'column' | 'grid';
export interface JoinIn { sizes: Size[]; mode: JoinMode; outputWidth: number; gapPct: number; columns: number }
export interface JoinOut { canvasW: number; canvasH: number; boxes: Box[]; /** grid only: the equal square cells and their size */ cells?: Box[]; cell?: Size }

/** Most pictures that can be joined at once. A starting value, to be confirmed on real phones. */
export const MAX_IMAGES = 12;
export const OUTPUT_WIDTH_RANGE: [number, number] = [200, 4000];
/** Space between pictures as a percentage of the output width. */
export const GAP_RANGE_PCT: [number, number] = [0, 10];

const clamp = (v: number, [lo, hi]: [number, number], fallback: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : fallback));
const one = (n: number) => Math.max(1, Math.round(n));
/** Rounded down, so a row of pictures can never be wider than the canvas. */
const down = (n: number) => Math.max(1, Math.floor(n));

/**
 * Where each picture goes. "row": same height, side by side, filling the width. "column": same width, one under another. "grid": equal square cells in
 * rows of `columns`, each picture fitted inside its cell at its own shape. Pictures keep their order and never overlap.
 */
export function layoutJoin(i: JoinIn): JoinOut {
  const W = Math.round(clamp(i.outputWidth, OUTPUT_WIDTH_RANGE, OUTPUT_WIDTH_RANGE[0]));
  const gap = Math.round((W * clamp(i.gapPct, GAP_RANGE_PCT, 0)) / 100);
  const n = i.sizes.length;
  if (n === 0) return { canvasW: W, canvasH: 1, boxes: [] };

  if (i.mode === 'row') {
    const aspects = i.sizes.map((s) => s.w / s.h);
    const H = down((W - gap * (n - 1)) / aspects.reduce((a, b) => a + b, 0));
    let x = 0;
    const boxes = aspects.map((a) => { const w = down(H * a); const b = { x, y: 0, w, h: H }; x += w + gap; return b; });
    return { canvasW: W, canvasH: H, boxes };
  }

  if (i.mode === 'column') {
    let y = 0;
    const boxes = i.sizes.map((s) => { const h = one((W * s.h) / s.w); const b = { x: 0, y, w: W, h }; y += h + gap; return b; });
    return { canvasW: W, canvasH: y - gap, boxes };
  }

  const cols = Math.max(1, Math.min(n, Math.round(Number.isFinite(i.columns) ? i.columns : 2)));
  const rows = Math.ceil(n / cols);
  const side = down((W - gap * (cols - 1)) / cols);
  const cells: Box[] = [], boxes: Box[] = [];
  i.sizes.forEach((s, k) => {
    const c = { x: (k % cols) * (side + gap), y: Math.floor(k / cols) * (side + gap), w: side, h: side };
    cells.push(c);
    const scale = Math.min(side / s.w, side / s.h);
    const w = Math.min(side, one(s.w * scale)), h = Math.min(side, one(s.h * scale));
    boxes.push({ x: c.x + Math.floor((side - w) / 2), y: c.y + Math.floor((side - h) / 2), w, h });
  });
  return { canvasW: cols * side + gap * (cols - 1), canvasH: rows * side + gap * (rows - 1), boxes, cells, cell: { w: side, h: side } };
}

/** A copy of the list with the item at `index` moved one place earlier (`dir` -1) or later (+1). Out-of-range moves leave it as it was. */
export function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list.slice();
  const out = list.slice();
  [out[index], out[to]] = [out[to], out[index]];
  return out;
}
