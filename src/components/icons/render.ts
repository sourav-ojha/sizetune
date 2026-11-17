import { containRect, coverRect } from '../social/layout';

export type SquareFit = 'pad' | 'crop';

/** Android's adaptive icon keeps the logo inside a 66 by 66 area of the 108 by 108 layer. */
export function safeBox(size: number): { x: number; y: number; s: number } {
  const s = Math.round((size * 66) / 108);
  return { x: Math.round((size - s) / 2), y: Math.round((size - s) / 2), s };
}

export interface RenderOptions { fit: SquareFit; opaque: boolean; maskable: boolean; background: string }

/** One square icon. Transparent areas stay transparent unless `opaque`, which fills them with the background first. */
export function renderIcon(bmp: ImageBitmap, size: number, o: RenderOptions): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (o.opaque || o.maskable) { ctx.fillStyle = o.background; ctx.fillRect(0, 0, size, size); }
  const box = o.maskable ? safeBox(size) : { x: 0, y: 0, s: size };
  if (o.fit === 'crop') {
    const r = coverRect(bmp.width, bmp.height, box.s, box.s, 'center');
    ctx.drawImage(bmp, r.sx, r.sy, r.sw, r.sh, box.x, box.y, box.s, box.s);
  } else {
    const r = containRect(bmp.width, bmp.height, box.s, box.s);
    ctx.drawImage(bmp, 0, 0, bmp.width, bmp.height, box.x + r.dx, box.y + r.dy, r.dw, r.dh);
  }
  return c;
}
