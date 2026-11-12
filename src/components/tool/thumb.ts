import { hasTransparentPixel } from './alpha';

/** Longest side of the preview image. Previews, the alpha probe and the "before" half of the comparison all come from this, never from a full-size decode. */
export const PREVIEW_SIDE = 1024;
/** Sources up to this many pixels are tiny to decode: the file itself is used as the preview (full fidelity). */
export const SMALL_PIXELS = 1_500_000;
/** Beyond this the preview is skipped altogether (lossless formats must be decoded in full before they can be scaled down). */
export const PREVIEW_DECODE_MAX_PIXELS = 36_000_000;

export type Thumb =
  | { kind: 'original'; alpha: boolean | null }
  | { kind: 'thumb'; blob: Blob; alpha: boolean | null }
  | { kind: 'none'; alpha: boolean | null; /** 'too-large': above the preview decode limit; 'failed': the reduced decode failed (file may be incomplete or damaged). */ reason: 'too-large' | 'failed' };

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob | null>((res) => c.toBlob(res, type, q));

/**
 * Builds the preview for a picked file from a REDUCED decode: createImageBitmap(file, {resizeWidth/Height}) (EXIF orientation applied),
 * drawn on a small canvas. Also answers "does it really have transparent pixels?" from that small canvas.
 * `w`/`h` are the display dimensions from the file header (after EXIF orientation). `alphaPossible` false skips the scan.
 */
export async function makeThumbnail(file: Blob, w: number, h: number, alphaPossible: boolean): Promise<Thumb> {
  const pixels = w * h;
  const unknownAlpha = alphaPossible ? null : false;
  if (pixels > PREVIEW_DECODE_MAX_PIXELS) return { kind: 'none', alpha: unknownAlpha, reason: 'too-large' };
  // The thumbnail size is PLANNED here and the canvas is always that size: a browser that ignores the resize options
  // (returning a full-size bitmap) must never make us allocate or read a full-size canvas.
  const k = Math.min(1, PREVIEW_SIDE / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * k)), th = Math.max(1, Math.round(h * k));
  let bmp: ImageBitmap | null = null;
  try {
    bmp = k < 1 ? await createImageBitmap(file, { resizeWidth: tw, resizeHeight: th, resizeQuality: 'medium' }) : await createImageBitmap(file);
    const c = document.createElement('canvas');
    c.width = tw; c.height = th;
    const ctx = c.getContext('2d', { willReadFrequently: alphaPossible });
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bmp, 0, 0, tw, th);
    bmp.close(); // release the (possibly oversized) bitmap before reading pixels or encoding
    bmp = null;
    const alpha = alphaPossible ? hasTransparentPixel(ctx.getImageData(0, 0, tw, th).data) : false;
    if (pixels <= SMALL_PIXELS) { c.width = 0; c.height = 0; return { kind: 'original', alpha }; }
    const blob = await toBlob(c, alpha ? 'image/png' : 'image/jpeg', 0.9);
    c.width = 0; c.height = 0;
    if (!blob) throw new Error('no blob');
    return { kind: 'thumb', blob, alpha };
  } catch {
    // reduced decode failed: only a small source may be shown from the file itself
    return pixels <= SMALL_PIXELS * 8 ? { kind: 'original', alpha: unknownAlpha } : { kind: 'none', alpha: unknownAlpha, reason: 'failed' };
  } finally {
    bmp?.close();
  }
}
