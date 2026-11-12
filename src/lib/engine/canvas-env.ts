/** Real browser Env: createImageBitmap + one reused canvas (OffscreenCanvas in workers, <canvas> on the main-thread fallback). */
import type { Env } from './env';
import { sniffType } from './sniff';
import { classifyBrowserError } from './errors';

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type Ctx2D = (OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D) & { isContextLost?: () => boolean };

export function createCanvasEnv(kind: 'offscreen' | 'dom'): Env<ImageBitmap> {
  const make = (w: number, h: number): AnyCanvas => {
    if (kind === 'offscreen') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };
  const encode = (c: AnyCanvas, type: string, quality?: number): Promise<Blob> => {
    if ('convertToBlob' in c) return c.convertToBlob({ type, quality });
    return new Promise((resolve, reject) => (c as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(classifyBrowserError(null, 'encode', c.width * c.height))), type, quality));
  };
  let canvas: AnyCanvas | null = null;
  let ctx: Ctx2D | null = null;
  const webpCache = new Map<string, boolean>();

  return {
    async decode(blob, resizeWidth) {
      return resizeWidth ? createImageBitmap(blob, { resizeWidth, resizeQuality: 'high' }) : createImageBitmap(blob);
    },
    async render(img, src, w, h, fill, mime, quality) {
      // One reused canvas. A lost/unusable context (GPU reset, failed resize) is rebuilt ONCE on a fresh canvas;
      // if that also fails it is out_of_memory only for large canvases, otherwise encode_failed (errors.ts).
      for (let attempt = 0; ; attempt++) {
        try {
          if (!canvas) { canvas = make(w, h); ctx = null; } else { canvas.width = w; canvas.height = h; } // resizing clears to transparent
          ctx ??= canvas.getContext('2d') as Ctx2D | null;
        } catch (e) {
          canvas = null; ctx = null;
          if (attempt === 0) continue;
          throw classifyBrowserError(e, 'canvas', w * h);
        }
        if (ctx && !ctx.isContextLost?.() && canvas.width === w && canvas.height === h) break;
        if (canvas) { canvas.width = 0; canvas.height = 0; }
        canvas = null; ctx = null;
        if (attempt > 0) throw classifyBrowserError(null, 'canvas', w * h);
      }
      if (!canvas || !ctx) throw classifyBrowserError(null, 'canvas', w * h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (fill) { ctx.fillStyle = fill; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(img, src.x, src.y, src.width, src.height, 0, 0, w, h);
      try {
        return await encode(canvas, mime, quality);
      } catch (e) {
        throw classifyBrowserError(e, 'encode', w * h);
      }
    },
    async hasAlpha(img) {
      const k = Math.min(1, Math.sqrt(1_000_000 / (img.width * img.height)));
      const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
      const c = make(w, h);
      try {
        const x = c.getContext('2d', { willReadFrequently: true }) as Ctx2D | null;
        if (!x) throw classifyBrowserError(null, 'canvas', w * h);
        x.imageSmoothingEnabled = true;
        x.imageSmoothingQuality = 'high';
        x.drawImage(img, 0, 0, w, h);
        const d = x.getImageData(0, 0, w, h).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
        return false;
      } finally {
        c.width = 0; c.height = 0;
      }
    },
    async canEncode(mime) {
      const hit = webpCache.get(mime);
      if (hit !== undefined) return hit;
      const c = make(2, 2);
      let ok = false;
      try {
        const x = c.getContext('2d') as Ctx2D | null;
        if (x) {
          x.fillStyle = '#808080'; x.fillRect(0, 0, 2, 2);
          const b = await encode(c, mime, 0.8);
          ok = sniffType(new Uint8Array(await b.slice(0, 16).arrayBuffer())) === mime;
        }
      } catch { ok = false; } finally { c.width = 0; c.height = 0; }
      webpCache.set(mime, ok);
      return ok;
    },
    release() {
      if (canvas) { canvas.width = 0; canvas.height = 0; }
      canvas = null; ctx = null;
    },
    yieldToEventLoop: kind === 'dom' ? () => new Promise<void>((r) => setTimeout(r, 0)) : undefined,
  };
}
