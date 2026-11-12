/** Pure search logic: find the highest JPEG quality (and least downscale) whose output fits targetBytes.
 *  `encode` is injected so this runs in a worker, on the main thread, or under test with a fake encoder. */
export interface CompressResult {
  blob: Blob;
  quality: number;
  scale: number;
  fits: boolean;
  attempts: number;
}
export type Encoder = (scale: number, quality: number) => Promise<Blob>;

export const SCALE_LADDER = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3];
const Q_MIN = 0.4; // quality floor: prefer shrinking dimensions over very ugly JPEGs
const Q_LAST_RESORT = 0.05;
/** Aim slightly under the limit: portals count KB differently (1000 vs 1024) and re-encode. */
export const SAFETY = 0.97;
const Q_MAX = 0.95;
const ITERATIONS = 8;

export async function compressToTarget(encode: Encoder, requestedBytes: number): Promise<CompressResult> {
  const targetBytes = Math.floor(requestedBytes * SAFETY);
  let attempts = 0;
  let smallest: CompressResult | null = null;
  for (const scale of SCALE_LADDER) {
    // If even the lowest quality at this scale is too big, go to the next scale.
    attempts++;
    const floor = await encode(scale, Q_MIN);
    const floorRes: CompressResult = { blob: floor, quality: Q_MIN, scale, fits: floor.size <= targetBytes, attempts };
    if (!smallest || floor.size < smallest.blob.size) smallest = floorRes;
    if (floor.size > targetBytes) continue;
    // Binary search for the best quality that still fits.
    let lo = Q_MIN;
    let hi = Q_MAX;
    let best = floorRes;
    for (let i = 0; i < ITERATIONS; i++) {
      const mid = (lo + hi) / 2;
      attempts++;
      const b = await encode(scale, mid);
      if (b.size <= targetBytes) {
        best = { blob: b, quality: mid, scale, fits: true, attempts };
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return { ...best, attempts };
  }
  // Last resort: smallest scale at very low quality (ugly, but better than failing silently).
  const lastScale = SCALE_LADDER[SCALE_LADDER.length - 1];
  attempts++;
  const b = await encode(lastScale, Q_LAST_RESORT);
  const res: CompressResult = { blob: b, quality: Q_LAST_RESORT, scale: lastScale, fits: b.size <= targetBytes, attempts };
  const best = !smallest || b.size < smallest.blob.size ? res : smallest;
  return { ...best, fits: best.blob.size <= targetBytes, attempts };
}
