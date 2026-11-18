import { DRAW_H, DRAW_W, EXPORT_PAD, FONTS, LINE, smoothPath, strokeBounds, type FontId, type Stroke } from '../../lib/signature-maker';

type Ctx = CanvasRenderingContext2D;

/** Draws the strokes with a round pen. `scale` enlarges everything for export. */
export function paintStrokes(ctx: Ctx, strokes: Stroke[], color: string, scale = 1, dx = 0, dy = 0): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = LINE * scale;
  for (const s of strokes) {
    ctx.beginPath();
    for (const c of smoothPath(s)) {
      if (c[0] === 'M') ctx.moveTo((c[1] - dx) * scale, (c[2] - dy) * scale);
      else if (c[0] === 'L') ctx.lineTo((c[1] - dx) * scale, (c[2] - dy) * scale);
      else ctx.quadraticCurveTo((c[1] - dx) * scale, (c[2] - dy) * scale, (c[3] - dx) * scale, (c[4] - dy) * scale);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** The live drawing area: clear and repaint everything. */
export function repaint(canvas: HTMLCanvasElement, strokes: Stroke[], color: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, DRAW_W, DRAW_H);
  paintStrokes(ctx, strokes, color);
}

function canvasOf(w: number, h: number, background: string | null): { canvas: HTMLCanvasElement; ctx: Ctx } | null {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); } // otherwise left transparent
  return { canvas, ctx };
}

/** A drawn signature cropped to its ink (plus padding) at twice the drawing size. Transparent unless a background is given. Null when nothing is drawn. */
export function renderDrawn(strokes: Stroke[], color: string, background: string | null, scale = 2): HTMLCanvasElement | null {
  const box = strokeBounds(strokes, LINE / 2 + EXPORT_PAD);
  if (!box) return null;
  const made = canvasOf(box.w * scale, box.h * scale, background);
  if (!made) return null;
  paintStrokes(made.ctx, strokes, color, scale, box.x, box.y);
  return made.canvas;
}

const fontCss = (id: FontId, px: number) => `${px}px "${FONTS.find((f) => f.id === id)!.family}", cursive`;

/** Makes sure the web font is ready before it is drawn on a canvas, which does not wait for it by itself. */
export async function ensureFont(id: FontId): Promise<void> {
  try { await document.fonts.load(fontCss(id, 64), 'Abc'); } catch { /* the fallback cursive font is drawn instead */ }
}

/** Typed text in a handwriting font, cropped to the text plus padding. Transparent unless a background is given. Null for empty text. */
export function renderTyped(text: string, id: FontId, color: string, background: string | null, px = 140): HTMLCanvasElement | null {
  const t = text.trim();
  if (t === '') return null;
  const probe = canvasOf(10, 10, null);
  if (!probe) return null;
  probe.ctx.font = fontCss(id, px);
  const m = probe.ctx.measureText(t);
  const ascent = Math.ceil(m.actualBoundingBoxAscent || px * 0.8), descent = Math.ceil(m.actualBoundingBoxDescent || px * 0.3);
  const left = Math.ceil(m.actualBoundingBoxLeft || 0), right = Math.ceil(m.actualBoundingBoxRight || m.width);
  const pad = EXPORT_PAD * 2;
  const made = canvasOf(left + right + pad * 2, ascent + descent + pad * 2, background);
  if (!made) return null;
  made.ctx.font = fontCss(id, px);
  made.ctx.fillStyle = color;
  made.ctx.textBaseline = 'alphabetic';
  made.ctx.fillText(t, pad + left, pad + ascent);
  return made.canvas;
}

export function toBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg'): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, type === 'image/jpeg' ? 0.92 : undefined));
}
