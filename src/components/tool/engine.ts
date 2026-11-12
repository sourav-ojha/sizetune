/**
 * The ONE seam between the UI and the compression engine (src/lib/engine). Nothing else in src/components imports the engine.
 */
import { canEncode, DEFAULT_LIMITS, EngineError, processImage as engineProcessImage, inspectFile, readHeader, type EngineLimits, type ProcessImage, type ProcessOptions, type ProcessResult } from '../../lib/engine';

export { EngineError };
export type { ProcessOptions, ProcessResult };

/**
 * Static import on purpose. Lazy-loading the engine on first pick (dynamic import()) was tried and rejected: scripts/verify-privacy.mjs
 * and verify-html.mjs forbid 'dyn-import' on tool pages, and the saving is tiny (engine chunk ~11 KB gz; the worker is already loaded lazily).
 */
export const processImage: ProcessImage = (file, opts, hooks) => engineProcessImage(file, opts, hooks);

/** Engine limits (file size cap etc.). */
export function getLimits(): EngineLimits { return DEFAULT_LIMITS; }

/** Whether this browser can encode WebP (engine probe: tiny encode + magic-byte check, cached). */
export function canEncodeWebp(): Promise<boolean> { return canEncode('webp'); }

/**
 * Header-only inspection (no decode, no object URL): display size after EXIF orientation, EXIF GPS flag.
 * Enforces the engine's byte/pixel limits. Throws EngineError; for too_many_pixels the error also carries width/height for the message.
 */
export async function inspectSize(file: Blob): Promise<{ width: number; height: number; hasGps: boolean }> {
  try {
    const i = await inspectFile(file);
    return { width: i.width, height: i.height, hasGps: i.hasGps };
  } catch (e) {
    if (e instanceof EngineError && e.code === 'too_many_pixels') {
      try { const h = await readHeader(file); Object.assign(e, { width: h.width, height: h.height }); } catch { /* dimensions are only for the message */ }
    }
    throw e;
  }
}
