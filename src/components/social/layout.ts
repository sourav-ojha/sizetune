/** Pure layout maths for the social resizers. All sizes in pixels. */
export type Focus = 'center' | 'top' | 'bottom' | 'left' | 'right';

/** Part of the source that fills the whole target (crop mode). `focus` slides the window along the side that overflows. */
export function coverRect(sw: number, sh: number, dw: number, dh: number, focus: Focus): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(dw / sw, dh / sh);
  const vw = Math.min(sw, dw / scale);
  const vh = Math.min(sh, dh / scale);
  const slide = (room: number, low: boolean, high: boolean) => (low ? 0 : high ? room : room / 2);
  const sx = slide(sw - vw, focus === 'left', focus === 'right');
  const sy = slide(sh - vh, focus === 'top', focus === 'bottom');
  return { sx: Math.round(sx), sy: Math.round(sy), sw: Math.round(vw), sh: Math.round(vh) };
}

/** Where the whole source sits inside the target, centred (pad and blur modes). A small source is enlarged to fit. */
export function containRect(sw: number, sh: number, dw: number, dh: number): { dx: number; dy: number; dw: number; dh: number } {
  const scale = Math.min(dw / sw, dh / sh);
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  return { dx: Math.round((dw - w) / 2), dy: Math.round((dh - h) / 2), dw: w, dh: h };
}

const BIG_SOURCE_PIXELS = 24_000_000;

/** Size to decode a very large source at, so memory stays bounded; null when the source can be decoded whole. */
export function decodeSize(sw: number, sh: number, dw: number, dh: number): { width: number; height: number } | null {
  if (sw * sh <= BIG_SOURCE_PIXELS) return null;
  const need = Math.max(dw / sw, dh / sh);
  const scale = Math.min(1, need * 2); // twice what the output needs, so cropping and scaling stay sharp
  return { width: Math.max(1, Math.round(sw * scale)), height: Math.max(1, Math.round(sh * scale)) };
}
