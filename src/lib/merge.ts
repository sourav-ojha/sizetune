// Pure layout for merging a photo and a signature onto one canvas (FEATURE-024). No DOM, so it is unit tested.

export interface Size { w: number; h: number }
export interface Box { x: number; y: number; w: number; h: number }
export type MergeLayout = 'stacked' | 'side';
export interface MergeIn { photo: Size; signature: Size; layout: MergeLayout; outputWidth: number }
export interface MergeOut { canvasW: number; canvasH: number; photo: Box; signature: Box }

/** Allowed output width in pixels, and the space between the two pictures as a percentage of that width. */
export const OUTPUT_WIDTH_RANGE: [number, number] = [200, 4000];
export const GAP_PCT = 2;

const clampW = (v: number) => Math.round(Math.min(OUTPUT_WIDTH_RANGE[1], Math.max(OUTPUT_WIDTH_RANGE[0], Number.isFinite(v) ? v : OUTPUT_WIDTH_RANGE[0])));
const atLeast1 = (n: number) => Math.max(1, Math.round(n));

/**
 * Where each picture goes. "stacked": photo on top, signature below, both scaled to the output width. "side": both on one row at the same height, the
 * pair filling the output width. Pictures keep their shape, never overlap, and a gap separates them.
 */
export function layoutMerge(i: MergeIn): MergeOut {
  const W = clampW(i.outputWidth);
  const gap = Math.round((W * GAP_PCT) / 100);
  if (i.layout === 'stacked') {
    const ph = atLeast1((W * i.photo.h) / i.photo.w), sh = atLeast1((W * i.signature.h) / i.signature.w);
    return { canvasW: W, canvasH: ph + gap + sh, photo: { x: 0, y: 0, w: W, h: ph }, signature: { x: 0, y: ph + gap, w: W, h: sh } };
  }
  const ra = i.photo.w / i.photo.h, rb = i.signature.w / i.signature.h;
  const H = atLeast1((W - gap) / (ra + rb));
  const pw = atLeast1(H * ra), sw = Math.max(1, W - gap - pw);
  return { canvasW: W, canvasH: H, photo: { x: 0, y: 0, w: pw, h: H }, signature: { x: pw + gap, y: 0, w: sw, h: H } };
}
