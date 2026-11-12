import { describe, it, expect } from 'vitest';
import { byteWindow } from '../../src/lib/engine/window';
import { resolveGeometry } from '../../src/lib/engine/dims';
import { normalizeOptions } from '../../src/lib/engine/options';
import { DEFAULT_LIMITS } from '../../src/lib/engine/limits';
import type { ProcessOptions } from '../../src/lib/engine/types';

const base: ProcessOptions = { format: 'jpeg', strategy: 'quality-first', lockAspect: true, fit: 'contain', background: 'white' };

describe('byteWindow: [min*1024, max*1000]', () => {
  it('converts so both KB readings are satisfied', () => {
    expect(byteWindow(20, 50)).toEqual({ lo: 20 * 1024, hi: 50 * 1000, conflict: false });
    expect(byteWindow(undefined, 50)).toEqual({ lo: 0, hi: 50_000, conflict: false });
    expect(byteWindow(20, undefined)).toEqual({ lo: 20_480, hi: Infinity, conflict: false });
    expect(byteWindow(undefined, undefined)).toEqual({ lo: 0, hi: Infinity, conflict: false });
  });
  it('a result inside the window passes both the 1000 and the 1024 reading', () => {
    for (const [mn, mx] of [[20, 50], [10, 20], [100, 200], [1, 2]]) {
      const w = byteWindow(mn, mx);
      for (const bytes of [w.lo, w.hi, Math.round((w.lo + w.hi) / 2)]) {
        expect(bytes / 1000).toBeGreaterThanOrEqual(mn);
        expect(bytes / 1024).toBeGreaterThanOrEqual(mn);
        expect(bytes / 1000).toBeLessThanOrEqual(mx);
        expect(bytes / 1024).toBeLessThanOrEqual(mx);
      }
    }
  });
  it('flags a conflict when min*1024 > max*1000 (e.g. 10–10 KB) and falls back to min*1000', () => {
    expect(byteWindow(10, 10)).toEqual({ lo: 10_000, hi: 10_000, conflict: true });
    expect(byteWindow(49, 50)).toEqual({ lo: 49_000, hi: 50_000, conflict: true }); // 50176 > 50000
    expect(byteWindow(48, 50).conflict).toBe(false); // 49152 <= 50000
  });
});

describe('resolveGeometry', () => {
  it('free dims: source size, never upscaled, bounded by maxWidth/maxHeight', () => {
    expect(resolveGeometry(4000, 3000, { lockAspect: true, fit: 'contain' })).toMatchObject({ baseWidth: 4000, baseHeight: 3000, fixed: false });
    expect(resolveGeometry(4000, 3000, { lockAspect: true, fit: 'contain', maxWidth: 1000 })).toMatchObject({ baseWidth: 1000, baseHeight: 750, fixed: false });
    expect(resolveGeometry(4000, 3000, { lockAspect: true, fit: 'contain', maxWidth: 1000, maxHeight: 500 })).toMatchObject({ baseWidth: 667, baseHeight: 500 });
    expect(resolveGeometry(400, 300, { lockAspect: true, fit: 'contain', maxWidth: 1000 })).toMatchObject({ baseWidth: 400, baseHeight: 300, upscaled: false });
  });
  it('one side given: other derived with lockAspect, kept without', () => {
    expect(resolveGeometry(4000, 3000, { width: 200, lockAspect: true, fit: 'contain' })).toMatchObject({ baseWidth: 200, baseHeight: 150, fixed: true });
    expect(resolveGeometry(4000, 3000, { height: 300, lockAspect: true, fit: 'contain' })).toMatchObject({ baseWidth: 400, baseHeight: 300, fixed: true });
    expect(resolveGeometry(4000, 3000, { width: 200, lockAspect: false, fit: 'contain' })).toMatchObject({ baseWidth: 200, baseHeight: 3000 });
  });
  it('both sides: contain fits inside the box, cover crops centrally, stretch distorts', () => {
    const c = resolveGeometry(4000, 3000, { width: 200, height: 230, lockAspect: true, fit: 'contain' });
    expect(c).toMatchObject({ baseWidth: 200, baseHeight: 150, fixed: true });
    const cv = resolveGeometry(4000, 3000, { width: 200, height: 230, lockAspect: true, fit: 'cover' });
    expect(cv).toMatchObject({ baseWidth: 200, baseHeight: 230 });
    expect(cv.src.height).toBe(3000);
    expect(cv.src.width).toBeCloseTo(3000 * 200 / 230, 6);
    expect(cv.src.x).toBeCloseTo((4000 - 3000 * 200 / 230) / 2, 6);
    const st = resolveGeometry(4000, 3000, { width: 200, height: 230, lockAspect: false, fit: 'contain' });
    expect(st).toMatchObject({ baseWidth: 200, baseHeight: 230, src: { x: 0, y: 0, width: 4000, height: 3000 } });
    expect(resolveGeometry(4000, 3000, { width: 200, height: 230, lockAspect: true, fit: 'stretch' })).toMatchObject({ baseWidth: 200, baseHeight: 230 });
  });
  it('explicit width/height may upscale (flagged)', () => {
    expect(resolveGeometry(140, 60, { width: 280, lockAspect: true, fit: 'contain' })).toMatchObject({ baseWidth: 280, baseHeight: 120, upscaled: true });
  });
  it('crop is in oriented source pixels; dims apply to the crop', () => {
    const g = resolveGeometry(3000, 4000, { crop: { x: 100, y: 200, width: 1200, height: 400 }, lockAspect: true, fit: 'contain', maxWidth: 600 });
    expect(g).toMatchObject({ src: { x: 100, y: 200, width: 1200, height: 400 }, baseWidth: 600, baseHeight: 200, fixed: false });
  });
  it('rejects a crop outside the image', () => {
    expect(() => resolveGeometry(100, 100, { crop: { x: 50, y: 0, width: 60, height: 10 }, lockAspect: true, fit: 'contain' })).toThrow(/crop/i);
    expect(() => resolveGeometry(100, 100, { crop: { x: -1, y: 0, width: 10, height: 10 }, lockAspect: true, fit: 'contain' })).toThrow();
    expect(() => resolveGeometry(100, 100, { crop: { x: 0, y: 0, width: 0, height: 10 }, lockAspect: true, fit: 'contain' })).toThrow();
  });
});

describe('normalizeOptions', () => {
  const lim = DEFAULT_LIMITS;
  const bad = (o: Partial<ProcessOptions> | Record<string, unknown>) => {
    try { normalizeOptions({ ...base, ...o } as ProcessOptions, lim); } catch (e) { return (e as { code?: string }).code; }
    return 'no-throw';
  };
  it('accepts a sane option set', () => {
    expect(bad({ maxKb: 50, minKb: 20 })).toBe('no-throw');
    expect(bad({ format: 'png', background: 'keep' })).toBe('no-throw');
    expect(bad({ background: '#ccff00' })).toBe('no-throw');
    expect(bad({ background: '#abc' })).toBe('no-throw');
  });
  it('allowPadding:true is invalid (padding is never offered)', () => {
    expect(bad({ allowPadding: true as unknown as false })).toBe('invalid_options');
  });
  it('JPEG with background keep is invalid', () => {
    expect(bad({ format: 'jpeg', background: 'keep' })).toBe('invalid_options');
    expect(bad({ format: 'auto', background: 'keep' })).toBe('no-throw');
  });
  it('rejects bad numbers and enums', () => {
    for (const o of [
      { maxKb: 0 }, { maxKb: -1 }, { maxKb: NaN }, { maxKb: Infinity }, { minKb: 60, maxKb: 50 }, { minKb: -5 },
      { width: 0 }, { width: 1.5 }, { height: 99999 }, { maxWidth: -3 }, { quality: 0 }, { quality: 101 },
      { format: 'gif' }, { strategy: 'x' }, { fit: 'fill' }, { background: 'red' }, { background: '#12' },
      { width: 10000, height: 10000 }, // 100 MP output canvas
      { crop: { x: 0, y: 0, width: NaN, height: 1 } },
    ]) expect(bad(o as Partial<ProcessOptions>), JSON.stringify(o)).toBe('invalid_options');
  });
  it('fills defaults for loose JS callers', () => {
    const n = normalizeOptions({ format: 'jpeg' } as ProcessOptions, lim);
    expect(n).toMatchObject({ strategy: 'quality-first', lockAspect: true, fit: 'contain', background: 'white' });
  });
});
