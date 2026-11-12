import type { EngineLimits } from './types';

/** Full limit set used internally. `EngineLimits` (types.ts) is the public subset. */
export interface FullLimits extends EngineLimits {
  /** Default cap for the decoded working size when the source is above `maxWorkingPixels` and the user did not ask for bigger dimensions. */
  workingCapPixels: number;
  /** Largest output canvas we will allocate (explicit width/height requests above this are rejected). */
  maxOutputPixels: number;
  /** Largest output side in px. */
  maxSide: number;
  /** Smallest side (px) the free-dimension search will shrink to. */
  minSide: number;
}

/**
 * Largest OUTPUT canvas for every browser: iOS Safari refuses/blanks canvases above 16,777,216 px (4096²), so 16 MP is the
 * portable ceiling. Explicit width/height (or one side with a derived other side) above this are rejected up front.
 */
export const MAX_OUTPUT_PIXELS = 16_000_000;
/** Largest source by header. 100 MP covers 48/50/64 MP phone sensors with headroom; 108/200 MP full-resolution captures
 *  are refused with a clear message (decode memory, even at reduced size, is not bounded on every browser). */
export const MAX_SOURCE_PIXELS = 100_000_000;

export const DEFAULT_LIMITS: Readonly<FullLimits> = Object.freeze({
  maxFileBytes: 25 * 1024 * 1024, // 25 MiB
  maxPixels: MAX_SOURCE_PIXELS, // read from the file header before decoding
  maxWorkingPixels: 12_000_000, // above this, decode at reduced size (createImageBitmap resize)
  timeoutMs: 60_000,
  maxEncodes: 20,
  workingCapPixels: 6_000_000,
  maxOutputPixels: MAX_OUTPUT_PIXELS,
  maxSide: 16_384,
  minSide: 64,
});

export function resolveLimits(partial?: Partial<FullLimits>): FullLimits {
  const l = { ...DEFAULT_LIMITS, ...(partial ?? {}) };
  for (const [k, v] of Object.entries(l)) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) throw new TypeError(`invalid limit ${k}`);
  }
  return l;
}
