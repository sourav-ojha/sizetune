/**
 * Narrow mapping of raw browser errors to EngineError (UI review M6).
 * out_of_memory is reported ONLY for genuine allocation failures (RangeError, "out of memory"/"failed to allocate"
 * DOMExceptions, QuotaExceededError) or when a LARGE canvas cannot be created/encoded (Safari returns null there).
 * Everything else is typed by stage: decode -> corrupt, canvas/encode -> encode_failed. Raw browser text is never echoed.
 */
import { EngineError } from './types';

/** Below this, a canvas that cannot be created/encoded is not plausibly a memory problem. */
export const LARGE_CANVAS_PIXELS = 4_000_000;

const ALLOC = /out of memory|allocation failed|failed to allocate|cannot allocate|could not allocate|insufficient memory/i;

export function isAllocationFailure(e: unknown): boolean {
  if (e instanceof RangeError) return true;
  if (!e || typeof e !== 'object') return false;
  const { name, message } = e as { name?: unknown; message?: unknown };
  if (name === 'QuotaExceededError') return true;
  return typeof message === 'string' && ALLOC.test(message);
}

export type FailureStage = 'decode' | 'canvas' | 'encode';

const OOM_DECODE = 'The browser ran out of memory while opening this image. Try a smaller image or close other tabs.';
const OOM_CANVAS = 'The browser could not allocate memory for an image this large. Try a smaller image or close other tabs.';

/** `e` is the raw error (null when the browser signalled failure by returning null). `pixels` = canvas/decode size. */
export function classifyBrowserError(e: unknown, stage: FailureStage, pixels: number): EngineError {
  if (e instanceof EngineError) return e;
  const alloc = isAllocationFailure(e);
  if (stage === 'decode') return alloc ? new EngineError('out_of_memory', OOM_DECODE) : new EngineError('corrupt', 'This image could not be opened. The file may be damaged.');
  if (alloc || (e === null && pixels >= LARGE_CANVAS_PIXELS)) return new EngineError('out_of_memory', OOM_CANVAS);
  return stage === 'canvas'
    ? new EngineError('encode_failed', 'The browser could not prepare the image this time. Please try again.')
    : new EngineError('encode_failed', 'The browser could not save the image this time. Please try again.');
}
