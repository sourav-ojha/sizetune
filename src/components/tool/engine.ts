/**
 * The ONE seam between the UI and the compression engine (src/lib/engine). Nothing else in src/components imports the engine.
 */
import { canEncode, DEFAULT_LIMITS, EngineError, processImage as engineProcessImage, type EngineLimits, type ProcessImage, type ProcessOptions, type ProcessResult } from '../../lib/engine';

export { EngineError };
export type { ProcessOptions, ProcessResult };

export const processImage: ProcessImage = (file, opts, hooks) => engineProcessImage(file, opts, hooks);

/** Engine limits (file size cap etc.). */
export function getLimits(): EngineLimits { return DEFAULT_LIMITS; }

/** Whether this browser can encode WebP (engine probe: tiny encode + magic-byte check, cached). */
export function canEncodeWebp(): Promise<boolean> { return canEncode('webp'); }
