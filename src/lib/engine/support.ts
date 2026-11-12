import { createCanvasEnv } from './canvas-env';
import type { Env } from './env';
/**
 * Feature detection for the worker path. The main-thread fallback is chosen ONLY when this returns false (never as an
 * error retry). No URL is constructed here (the HTML/privacy verifier forbids URL-like strings in tool JS).
 *
 * Module-worker support is not probed separately: every engine that has a working OffscreenCanvas 2D context
 * (Chrome 69+, Firefox 105+, Safari 16.4+) also supports module workers (Safari 15+). If a module worker still fails to
 * load, the client rejects with EngineError('worker_failed') via the worker's error event; it does not retry silently.
 */
export function supportsWorkerEngine(): boolean {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return false;
  if (!('convertToBlob' in OffscreenCanvas.prototype)) return false;
  try {
    return !!new OffscreenCanvas(1, 1).getContext('2d');
  } catch {
    return false;
  }
}


const MIMES = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
let probeEnv: Env<ImageBitmap> | null = null;
const probeCache = new Map<string, Promise<boolean>>();

/**
 * Capability probe for the UI: can this browser really SAVE `format`? Encodes a tiny canvas and checks the magic bytes
 * (Safari returns PNG for WebP). Cached per page. Resolves false where no canvas exists.
 */
export function canEncode(format: 'jpeg' | 'png' | 'webp'): Promise<boolean> {
  const mime = MIMES[format];
  if (!mime) return Promise.resolve(false);
  let p = probeCache.get(mime);
  if (!p) {
    const hasOffscreen = typeof OffscreenCanvas !== 'undefined' && 'convertToBlob' in OffscreenCanvas.prototype;
    if (!hasOffscreen && typeof document === 'undefined') return Promise.resolve(false);
    probeEnv ??= createCanvasEnv(hasOffscreen ? 'offscreen' : 'dom');
    p = probeEnv.canEncode(mime);
    probeCache.set(mime, p);
  }
  return p;
}
