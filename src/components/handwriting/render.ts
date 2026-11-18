import { FONTS, type FontId } from '../../lib/signature-maker';
import { PAGE_H, PAGE_W, baselineY, pageGeometry, paginate, ruleYs, wrapText, type PaperId } from '../../lib/handwriting';

const fontCss = (id: FontId, px: number) => `${px}px "${FONTS.find((f) => f.id === id)!.family}", cursive`;

export interface Layout { pages: string[][]; truncated: boolean; perPage: number; fontPx: number }

let probe: CanvasRenderingContext2D | null = null;
/** Wraps and paginates text with the real font metrics, so lines break where they will be drawn. */
export function layoutText(text: string, id: FontId, fontPx: number): Layout {
  const g = pageGeometry(fontPx);
  probe ??= typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d'); // no canvas while the page is built on the server: estimate
  const ctx = probe;
  if (ctx) ctx.font = fontCss(id, fontPx);
  const measure = (s: string) => (ctx ? ctx.measureText(s).width : s.length * fontPx * 0.5);
  const { pages, truncated } = paginate(wrapText(text, measure, g.textW), g.perPage);
  return { pages, truncated, perPage: g.perPage, fontPx };
}

/** Paper colour and rulings, drawn under the text. */
function paintPaper(ctx: CanvasRenderingContext2D, paper: PaperId, fontPx: number): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  const g = pageGeometry(fontPx);
  if (paper === 'ruled') {
    ctx.strokeStyle = '#a9c1e8'; ctx.lineWidth = 2;
    for (const y of ruleYs(g)) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PAGE_W, y); ctx.stroke(); }
    ctx.strokeStyle = '#e8a3a3'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(g.left - 40, 0); ctx.lineTo(g.left - 40, PAGE_H); ctx.stroke();
  } else if (paper === 'grid') {
    const step = 40;
    ctx.strokeStyle = '#c9d7ee'; ctx.lineWidth = 1.5;
    for (let x = 0; x <= PAGE_W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, PAGE_H); ctx.stroke(); }
    for (let y = 0; y <= PAGE_H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PAGE_W, y); ctx.stroke(); }
  }
}

/** Draws one page of text in a handwriting font on the chosen paper. */
export function drawPage(canvas: HTMLCanvasElement, lines: string[], opts: { font: FontId; fontPx: number; ink: string; paper: PaperId }): void {
  canvas.width = PAGE_W; canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  paintPaper(ctx, opts.paper, opts.fontPx);
  const g = pageGeometry(opts.fontPx);
  ctx.font = fontCss(opts.font, opts.fontPx);
  ctx.fillStyle = opts.ink;
  ctx.textBaseline = 'alphabetic';
  lines.forEach((line, i) => { if (line !== '') ctx.fillText(line, g.left, baselineY(g, i)); });
}

/** Makes sure the web font is ready before it is drawn on a canvas, which does not wait for it by itself. */
export async function ensureFont(id: FontId): Promise<void> {
  try { await document.fonts.load(fontCss(id, 64), 'Abc'); } catch { /* the fallback cursive font is drawn instead */ }
}

export const blobOf = (canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg'): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, type === 'image/jpeg' ? 0.92 : undefined));
