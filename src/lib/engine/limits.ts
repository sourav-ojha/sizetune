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

export const DEFAULT_LIMITS: Readonly<FullLimits> = Object.freeze({
  maxFileBytes: 25 * 1024 * 1024, // 25 MiB
  maxPixels: 100_000_000, // 100 MP, read from the file header before decoding
  maxWorkingPixels: 12_000_000, // above this, decode at reduced size (createImageBitmap resize)
  timeoutMs: 60_000,
  maxEncodes: 20,
  workingCapPixels: 6_000_000,
  maxOutputPixels: 40_000_000,
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
