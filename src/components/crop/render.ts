import { pathBounds, ratioCrop, ratioPad, radiusPx, type Pt, type Ratio } from '../../lib/crop-geometry';

export type PadColor = 'transparent' | '#ffffff' | '#111827';

function make(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d');
  return ctx ? { c, ctx } : null;
}

/** A rounded rectangle path (arcTo, which every browser has). */
function roundedRect(ctx: CanvasRenderingContext2D, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(w, 0, w, h, r);
  ctx.arcTo(w, h, 0, h, r);
  ctx.arcTo(0, h, 0, 0, r);
  ctx.arcTo(0, 0, w, 0, r);
  ctx.closePath();
}

/** Square (or the whole picture) with rounded corners. Corners are transparent. */
export function renderShape(bmp: ImageBitmap, square: boolean, radiusPct: number): HTMLCanvasElement | null {
  const r = square ? ratioCrop({ w: bmp.width, h: bmp.height }, { w: 1, h: 1 }, 0.5, 0.5) : { x: 0, y: 0, w: bmp.width, h: bmp.height };
  const m = make(r.w, r.h);
  if (!m) return null;
  const rad = radiusPx(r.w, r.h, radiusPct);
  if (rad > 0) { roundedRect(m.ctx, r.w, r.h, rad); m.ctx.clip(); }
  m.ctx.drawImage(bmp, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  return m.c;
}

/** Changes the shape of the picture to a ratio: by cropping a window out of it, or by adding space around it without scaling it. */
export function renderRatio(bmp: ImageBitmap, ratio: Ratio, method: 'crop' | 'pad', fx: number, fy: number, pad: PadColor): HTMLCanvasElement | null {
  const src = { w: bmp.width, h: bmp.height };
  if (method === 'crop') {
    const r = ratioCrop(src, ratio, fx, fy);
    const m = make(r.w, r.h);
    m?.ctx.drawImage(bmp, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    return m?.c ?? null;
  }
  const p = ratioPad(src, ratio);
  const m = make(p.canvas.w, p.canvas.h);
  if (!m) return null;
  if (pad !== 'transparent') { m.ctx.fillStyle = pad; m.ctx.fillRect(0, 0, p.canvas.w, p.canvas.h); }
  m.ctx.drawImage(bmp, p.image.x, p.image.y, p.image.w, p.image.h);
  return m.c;
}

/** The picture cut out along a drawn path (points in picture pixels), cropped to the path's box. Everything outside the path is transparent. */
export function renderFreehand(bmp: ImageBitmap, path: Pt[]): HTMLCanvasElement | null {
  const b = pathBounds(path);
  if (!b || path.length < 3 || b.w < 4 || b.h < 4) return null;
  const x0 = Math.max(0, Math.floor(b.x)), y0 = Math.max(0, Math.floor(b.y));
  const x1 = Math.min(bmp.width, Math.ceil(b.x + b.w)), y1 = Math.min(bmp.height, Math.ceil(b.y + b.h));
  const m = make(x1 - x0, y1 - y0);
  if (!m) return null;
  m.ctx.beginPath();
  path.forEach((p, i) => (i === 0 ? m.ctx.moveTo(p.x - x0, p.y - y0) : m.ctx.lineTo(p.x - x0, p.y - y0)));
  m.ctx.closePath();
  m.ctx.clip();
  m.ctx.drawImage(bmp, -x0, -y0);
  return m.c;
}

/** The picture drawn on a white canvas, for a JPG (which has no transparency). */
export function onWhite(src: HTMLCanvasElement): HTMLCanvasElement {
  const m = make(src.width, src.height)!;
  m.ctx.fillStyle = '#ffffff';
  m.ctx.fillRect(0, 0, src.width, src.height);
  m.ctx.drawImage(src, 0, 0);
  return m.c;
}

export function saveBlob(canvas: HTMLCanvasElement, kind: 'png' | 'jpg'): Promise<Blob | null> {
  const c = kind === 'jpg' ? onWhite(canvas) : canvas;
  return new Promise((resolve) => c.toBlob((b) => resolve(b), kind === 'jpg' ? 'image/jpeg' : 'image/png', kind === 'jpg' ? 0.92 : undefined));
}
