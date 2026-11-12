import { describe, it, expect } from 'vitest';
import { compressToTarget, SCALE_LADDER } from '../src/lib/compress';

// Fake encoder: size = base * scale^2 * (0.2 + quality). Monotonic like a real JPEG encoder.
const fake = (base: number) => async (scale: number, q: number) => new Blob([new Uint8Array(Math.round(base * scale * scale * (0.2 + q)))]);

describe('compressToTarget', () => {
  it('fits the target at full scale when quality alone is enough', async () => {
    const r = await compressToTarget(fake(150_000), 100_000);
    expect(r.fits).toBe(true);
    expect(r.scale).toBe(1);
    expect(r.blob.size).toBeLessThanOrEqual(100_000);
  });
  it('prefers the highest quality that fits (within search tolerance)', async () => {
    const r = await compressToTarget(fake(150_000), 100_000);
    expect(r.quality).toBeGreaterThan(0.4);
    expect(r.blob.size).toBeGreaterThan(88_000);
    expect(r.blob.size).toBeLessThanOrEqual(97_000); // safety margin: 3% under target
  });
  it('downscales when minimum quality at full scale is too big', async () => {
    const r = await compressToTarget(fake(1_000_000), 50_000);
    expect(r.fits).toBe(true);
    expect(r.scale).toBeLessThan(1);
  });
  it('reports fits=false and returns the smallest result when unreachable', async () => {
    const r = await compressToTarget(fake(2_000_000), 10);
    expect(r.fits).toBe(false);
    expect(r.scale).toBe(SCALE_LADDER[SCALE_LADDER.length - 1]);
    expect(r.quality).toBeLessThan(0.4); // last resort used
  });
  it('is bounded: attempts stay small', async () => {
    const r = await compressToTarget(fake(2_000_000), 50_000);
    expect(r.attempts).toBeLessThan(SCALE_LADDER.length * 10);
  });
});
