import { containRect, coverRect, type Focus } from './layout';

export type Fit = 'crop' | 'pad' | 'blur';

const draw = (ctx: CanvasRenderingContext2D, src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) => {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
};

const canvas = (w: number, h: number): HTMLCanvasElement => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/**
 * Lays the picture out on a canvas of exactly w x h pixels.
 * crop: fills the frame (the overflow is cut off, `focus` picks which part stays).
 * pad: the whole picture on a flat colour.
 * blur: the whole picture over a blurred, enlarged copy of itself. The blur is made by shrinking then enlarging, which works in
 * every browser (canvas `filter` is not available everywhere).
 */
export function compose(bmp: ImageBitmap, w: number, h: number, fit: Fit, focus: Focus, background: string): HTMLCanvasElement {
  const out = canvas(w, h);
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  // JPEG has no transparency: fill first in every mode so see-through areas take the chosen colour, never black
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, w, h);
  if (fit === 'crop') {
    const r = coverRect(bmp.width, bmp.height, w, h, focus);
    draw(ctx, bmp, r.sx, r.sy, r.sw, r.sh, 0, 0, w, h);
    return out;
  }
  if (fit === 'blur') {
    const c = coverRect(bmp.width, bmp.height, w, h, 'center');
    const small = canvas(Math.max(2, Math.round(w / 40)), Math.max(2, Math.round(h / 40)));
    draw(small.getContext('2d')!, bmp, c.sx, c.sy, c.sw, c.sh, 0, 0, small.width, small.height);
    const mid = canvas(Math.max(2, Math.round(w / 10)), Math.max(2, Math.round(h / 10)));
    draw(mid.getContext('2d')!, small, 0, 0, small.width, small.height, 0, 0, mid.width, mid.height);
    draw(ctx, mid, 0, 0, mid.width, mid.height, 0, 0, w, h);
  }
  const r = containRect(bmp.width, bmp.height, w, h);
  draw(ctx, bmp, 0, 0, bmp.width, bmp.height, r.dx, r.dy, r.dw, r.dh);
  return out;
}
