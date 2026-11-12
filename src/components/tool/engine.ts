/**
 * The ONE seam between the UI and the compression engine (src/lib/engine). Nothing else in src/components imports the engine.
 */
import { DEFAULT_LIMITS, EngineError, processImage as engineProcessImage, type EngineLimits, type ProcessImage, type ProcessOptions, type ProcessResult } from '../../lib/engine';

export { EngineError };
export type { ProcessOptions, ProcessResult };

export const processImage: ProcessImage = (file, opts, hooks) => engineProcessImage(file, opts, hooks);

/** Engine limits (file size cap etc.). */
export function getLimits(): EngineLimits { return DEFAULT_LIMITS; }

let webpProbe: Promise<boolean> | null = null;

/** Whether this browser can encode WebP (Safari silently returns PNG, so check the blob type). The engine exposes no probe. */
export function canEncodeWebp(): Promise<boolean> {
  webpProbe ??= (async () => {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 2;
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/webp', 0.8));
      return blob?.type === 'image/webp';
    } catch { return false; }
  })();
  return webpProbe;
}
