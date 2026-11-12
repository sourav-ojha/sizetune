import { describe, it, expect } from 'vitest';
import { fitSearch, type SearchParams, type SearchEncoder } from '../../src/lib/engine/search';
import { byteWindow } from '../../src/lib/engine/window';
import { EngineError } from '../../src/lib/engine/types';

/** Deterministic PRNG for property tests. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

interface Model { complexity?: number; overhead?: number; jump444?: number; dipAt?: number; quantum?: number; exp?: number }
/** JPEG-like fake: bytes ~ (pixels^exp) * bpp(q) * complexity + overhead; optional 4:4:4 jump at q=100, a non-monotone dip, quantisation. */
function fake(m: Model = {}) {
  const calls: Array<{ w: number; h: number; q: number | null }> = [];
  const enc: SearchEncoder<{ n: number }> = async (w, h, q) => {
    calls.push({ w, h, q });
    const qq = q ?? 100;
    let bpp = 0.03 + 0.5 * Math.pow(qq / 100, 3.5);
    if (q === 100 && m.jump444) bpp *= m.jump444;
    if (m.dipAt !== undefined && q === m.dipAt) bpp *= 0.9; // one monotonicity violation
    if (q === null) bpp = 1.2; // "PNG"
    let bytes = (m.overhead ?? 600) + Math.pow(w * h, m.exp ?? 0.95) * bpp * (m.complexity ?? 1);
    if (m.quantum) bytes = Math.ceil(bytes / m.quantum) * m.quantum;
    bytes = Math.round(bytes);
    return { blob: { n: bytes }, bytes };
  };
  return { enc, calls };
}

const P = (o: Partial<SearchParams> & { minKb?: number; maxKb?: number }): SearchParams => {
  const w = byteWindow(o.minKb, o.maxKb);
  return {
    baseWidth: 3000, baseHeight: 2000, fixed: false, lossy: true, lo: w.lo, hi: w.hi,
    hasTarget: o.minKb !== undefined || o.maxKb !== undefined, strategy: 'quality-first', maxEncodes: 20, minSide: 64,
    ...o,
  };
};

describe('fitSearch: basic statuses', () => {
  it('no target: one encode at the given quality', async () => {
    const f = fake();
    const r = await fitSearch(P({ fixedQuality: 85 }), f.enc);
    expect(r.status).toBe('ok');
    expect(r.attempts).toBe(1);
    expect(f.calls).toEqual([{ w: 3000, h: 2000, q: 85 }]);
  });
  it('quality-only fit at full dims (Phase A): highest integer q under max', async () => {
    const f = fake({ complexity: 0.1 });
    const r = await fitSearch(P({ maxKb: 100 }), f.enc);
    expect(r.status).toBe('ok');
    expect(r.best.width).toBe(3000);
    expect(r.best.bytes).toBeLessThanOrEqual(100_000);
    expect(f.calls.every((c) => c.q === null || Number.isInteger(c.q))).toBe(true);
    // the next quality step must exceed the max (or the best is the cap 95)
    if (r.best.quality! < 95) {
      const next = await f.enc(3000, 2000, r.best.quality! + 1);
      expect(next.bytes).toBeGreaterThan(100_000);
    }
  });
  it('q95 already in the window: ok immediately, never above 95 without a minimum', async () => {
    const f = fake({ complexity: 0.001 });
    const r = await fitSearch(P({ maxKb: 500 }), f.enc);
    expect(r).toMatchObject({ status: 'ok', attempts: 1 });
    expect(r.best.quality).toBe(95);
  });
  it('needs downscale (Phase B): continuous scale, high fill, <= 20 encodes, no q below 40', async () => {
    const f = fake();
    const r = await fitSearch(P({ maxKb: 50 }), f.enc);
    expect(r.status).toBe('ok');
    expect(r.best.bytes).toBeLessThanOrEqual(50_000);
    expect(r.best.bytes / 50_000).toBeGreaterThan(0.93);
    expect(r.best.width).toBeLessThan(3000);
    expect(r.best.quality).toBeGreaterThanOrEqual(40);
    expect(r.attempts).toBeLessThanOrEqual(20);
    // continuous: widths are not limited to a 0.1 ladder
    const widths = new Set(f.calls.map((c) => c.w));
    expect([...widths].some((w) => (w / 3000) * 10 % 1 > 0.01)).toBe(true);
  });
  it('dimensions-first keeps the quality and shrinks pixels', async () => {
    const f = fake();
    const r = await fitSearch(P({ maxKb: 50, strategy: 'dimensions-first', fixedQuality: 85 }), f.enc);
    expect(r.status).toBe('ok');
    expect(r.best.quality).toBe(85);
    expect(r.best.bytes / 50_000).toBeGreaterThan(0.9);
  });
});

describe('fitSearch: minimum (legitimate means only)', () => {
  it('raises quality above 95 to reach the minimum (status raised)', async () => {
    // 200x230 fixed; q95 below min, q100 above
    const f = fake({ complexity: 1 });
    const q95 = (await f.enc(200, 230, 95)).bytes;
    const q100 = (await f.enc(200, 230, 100)).bytes;
    const minKb = Math.ceil((q95 + (q100 - q95) * 0.4) / 1024);
    const r = await fitSearch(P({ baseWidth: 200, baseHeight: 230, fixed: true, minKb, maxKb: Math.ceil(q100 / 1000) + 50 }), f.enc);
    expect(r.status).toBe('raised');
    expect(r.best.quality).toBeGreaterThan(95);
    expect(r.best.bytes).toBeGreaterThanOrEqual(minKb * 1024);
    // D11: the smallest honest raise — one quality step lower would miss the minimum (even though q100 also fits)
    expect(r.best.quality).toBeLessThan(100);
    expect((await f.enc(200, 230, r.best.quality! - 1)).bytes).toBeLessThan(minKb * 1024);
  });
  it('4:4:4 jump at q100: bisects 96–99 instead of jumping past the max', async () => {
    const f = fake({ jump444: 3 });
    const q95 = (await f.enc(200, 230, 95)).bytes;
    const q99 = (await f.enc(200, 230, 99)).bytes;
    const lo = Math.ceil((q95 + 1) / 1024);
    const hi = Math.floor(q99 / 1000) + 1; // q100 (x3) is far above
    const r = await fitSearch(P({ baseWidth: 200, baseHeight: 230, fixed: true, minKb: lo, maxKb: hi }), f.enc);
    expect(r.status).toBe('raised');
    expect(r.best.quality).toBeGreaterThan(95);
    expect(r.best.quality).toBeLessThan(100);
    expect(r.best.bytes).toBeLessThanOrEqual(hi * 1000);
  });
  it('impossible minimum at fixed dims: below_min with the max-quality result and reason', async () => {
    const f = fake();
    const r = await fitSearch(P({ baseWidth: 140, baseHeight: 60, fixed: true, minKb: 10, maxKb: 20 }), f.enc);
    expect(r.status).toBe('below_min');
    expect(r.reason).toBe('min_unreachable');
    expect(r.best.quality).toBe(100);
    expect(r.best.bytes).toBeLessThan(10 * 1024);
    expect(r.best.width).toBe(140);
  });
  it('free dims without allowEnlarge never upscales; with allowEnlarge reaches min by more pixels', async () => {
    const f = fake();
    const r = await fitSearch(P({ baseWidth: 140, baseHeight: 60, minKb: 20 }), f.enc);
    expect(r.status).toBe('below_min');
    expect(Math.max(...f.calls.map((c) => c.w))).toBe(140);
    const g = fake();
    const e = await fitSearch(P({ baseWidth: 140, baseHeight: 60, minKb: 20, maxKb: 40, allowEnlarge: true, maxEnlargePixels: 4_000_000 }), g.enc);
    expect(e.status).toBe('raised');
    expect(e.best.enlarged).toBe(true);
    expect(e.best.width).toBeGreaterThan(140);
    expect(e.best.bytes).toBeGreaterThanOrEqual(20 * 1024);
    expect(e.best.bytes).toBeLessThanOrEqual(40_000);
  });
  it('window gap at fixed dims: below_min/window_gap, returns the result under the max', async () => {
    // stepped encoder: at full size q<=70 gives 40 KB-ish, q>=71 jumps to 60 KB-ish; bytes ~ pixels
    const stepped: SearchEncoder<null> = async (w, h, q) => {
      const perPx = (q! <= 70 ? 0.08 + q! * 0.0001 : 0.12 + q! * 0.0001) ;
      const bytes = Math.round(w * h * perPx);
      return { blob: null, bytes };
    };
    const at70 = (await stepped(800, 600, 70)).bytes, at71 = (await stepped(800, 600, 71)).bytes;
    const lo = at70 + 3000, hi = at71 - 3000;
    const r = await fitSearch({ ...P({ baseWidth: 800, baseHeight: 600, fixed: true }), lo, hi, hasTarget: true }, stepped);
    expect(r.status).toBe('below_min');
    expect(r.reason).toBe('window_gap');
    expect(r.best.bytes).toBeLessThanOrEqual(hi);
    expect(r.best.quality).toBe(70);
    expect(r.gapAbove?.bytes).toBeGreaterThan(hi);
    // same window with free dims: the scale search shrinks the next step into the window
    const g = await fitSearch({ ...P({ baseWidth: 800, baseHeight: 600, fixed: false }), lo, hi, hasTarget: true }, stepped);
    expect(g.status).toBe('ok');
    expect(g.best.bytes).toBeGreaterThanOrEqual(lo);
    expect(g.best.bytes).toBeLessThanOrEqual(hi);
  });
});

describe('fitSearch: impossible maximum', () => {
  it('free dims: above_max at the 64 px floor, returns the smallest', async () => {
    const f = fake({ overhead: 3000 });
    const r = await fitSearch(P({ maxKb: 1.5 }), f.enc);
    expect(r.status).toBe('above_max');
    expect(Math.min(r.best.width, r.best.height)).toBe(64);
    expect(r.best.bytes).toBe(Math.min(...r.candidates.map((c) => c.bytes)));
    expect(r.best.bytes).toBeGreaterThan(1500);
  });
  it('fixed dims: above_max_fixed after trying down to q1', async () => {
    const f = fake();
    const r = await fitSearch(P({ baseWidth: 200, baseHeight: 230, fixed: true, maxKb: 0.5 }), f.enc);
    expect(r.status).toBe('above_max_fixed');
    expect(r.best.quality).toBe(1);
  });
  it('fixed dims, reachable only below q40: ok with low quality (caller must disclose)', async () => {
    const f = fake();
    const q40 = (await f.enc(1000, 1000, 40)).bytes;
    const q10 = (await f.enc(1000, 1000, 10)).bytes;
    const r = await fitSearch({ ...P({ baseWidth: 1000, baseHeight: 1000, fixed: true }), lo: 0, hi: Math.round((q40 + q10) / 2), hasTarget: true }, f.enc);
    expect(r.status).toBe('ok');
    expect(r.best.quality).toBeLessThan(40);
  });
});

describe('fitSearch: lossless (PNG) — pixels only', () => {
  it('shrinks pixels to fit; quality stays null', async () => {
    const f = fake();
    const r = await fitSearch(P({ lossy: false, maxKb: 200 }), f.enc);
    expect(r.status).toBe('ok');
    expect(r.best.quality).toBeNull();
    expect(r.best.width).toBeLessThan(3000);
    expect(f.calls.every((c) => c.q === null)).toBe(true);
  });
  it('fixed dims above max -> above_max_fixed; below min -> below_min', async () => {
    expect((await fitSearch(P({ lossy: false, fixed: true, maxKb: 200 }), fake().enc)).status).toBe('above_max_fixed');
    const r = await fitSearch(P({ lossy: false, baseWidth: 50, baseHeight: 50, minKb: 100 }), fake().enc);
    expect(r).toMatchObject({ status: 'below_min', reason: 'min_unreachable' });
  });
});

describe('fitSearch: budget, cancellation, robustness', () => {
  it('stops at maxEncodes and stays honest', async () => {
    for (const maxEncodes of [1, 2, 3, 5]) {
      const f = fake();
      const r = await fitSearch(P({ maxKb: 50, maxEncodes }), f.enc);
      expect(f.calls.length).toBeLessThanOrEqual(maxEncodes);
      if (r.status === 'ok') expect(r.best.bytes).toBeLessThanOrEqual(50_000);
      else expect(['above_max']).toContain(r.status);
      if (r.status === 'above_max') expect(r.reason === 'budget_exhausted' || r.reason === 'max_unreachable').toBe(true);
    }
  });
  it('propagates cancellation thrown by the encoder mid-search', async () => {
    let n = 0;
    const enc: SearchEncoder<null> = async (w, h) => {
      if (++n === 4) throw new EngineError('cancelled', 'cancelled');
      return { blob: null, bytes: w * h };
    };
    await expect(fitSearch(P({ maxKb: 50 }), enc)).rejects.toMatchObject({ code: 'cancelled' });
    expect(n).toBe(4);
  });
  it('does not re-encode an identical candidate (cache)', async () => {
    const f = fake();
    await fitSearch(P({ maxKb: 50 }), f.enc);
    const keys = f.calls.map((c) => `${c.w}x${c.h}@${c.q}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('non-monotone encoder (one dip) still never claims success wrongly', async () => {
    for (let dip = 41; dip < 95; dip += 3) {
      const f = fake({ dipAt: dip, complexity: 0.08 });
      const r = await fitSearch(P({ maxKb: 100, minKb: 60 }), f.enc);
      if (r.status === 'ok' || r.status === 'raised') {
        expect(r.best.bytes).toBeGreaterThanOrEqual(60 * 1024);
        expect(r.best.bytes).toBeLessThanOrEqual(100_000);
      }
    }
  });
});

describe('fitSearch: properties over random encoders and windows', () => {
  it('never claims ok/raised outside [lo,hi]; statuses consistent; <= maxEncodes; integer q', async () => {
    const R = rng(12345);
    for (let i = 0; i < 600; i++) {
      const W = 16 + Math.floor(R() * 6000), H = 16 + Math.floor(R() * 6000);
      const m: Model = { complexity: 0.05 + R() * 3, overhead: 200 + R() * 2000, jump444: R() < 0.5 ? 1 + R() * 3 : undefined, dipAt: R() < 0.3 ? 40 + Math.floor(R() * 60) : undefined, quantum: R() < 0.2 ? 1 + Math.floor(R() * 5000) : undefined, exp: 0.85 + R() * 0.15 };
      const f = fake(m);
      const maxKb = R() < 0.9 ? 1 + R() * 2000 : undefined;
      const minKb = R() < 0.4 ? (maxKb ?? 3000) * R() : undefined;
      const fixed = R() < 0.35;
      const lossy = R() < 0.85;
      const strategy = R() < 0.3 ? 'dimensions-first' : 'quality-first';
      const p = P({ baseWidth: W, baseHeight: H, fixed, lossy, maxKb, minKb, strategy, allowEnlarge: R() < 0.2, maxEnlargePixels: 40_000_000, fixedQuality: 85 });
      const r = await fitSearch(p, f.enc);
      const ctx = JSON.stringify({ i, W, H, m, maxKb, minKb, fixed, lossy, strategy, status: r.status, bytes: r.best.bytes, lo: p.lo, hi: p.hi });
      expect(f.calls.length, ctx).toBeLessThanOrEqual(20);
      expect(r.attempts, ctx).toBe(f.calls.length);
      expect(r.best.bytes, ctx).toBe(r.best.blob.n);
      for (const c of f.calls) {
        if (c.q !== null) expect(Number.isInteger(c.q) && c.q >= 1 && c.q <= 100, ctx).toBe(true);
        if (!p.allowEnlarge || fixed) expect(c.w <= W && c.h <= H, ctx).toBe(true);
      }
      if (r.status === 'ok' || r.status === 'raised') {
        expect(r.best.bytes >= p.lo && r.best.bytes <= p.hi, ctx).toBe(true);
      } else if (r.status === 'below_min') {
        expect(r.best.bytes < p.lo, ctx).toBe(true);
        expect(r.best.bytes <= p.hi, ctx).toBe(true);
      } else {
        expect(r.best.bytes > p.hi, ctx).toBe(true);
        expect(r.status === 'above_max_fixed').toBe(fixed);
        expect(r.candidates.every((c) => c.bytes > p.hi), ctx).toBe(true);
      }
      // if ANY encoded candidate was inside the window, the result must be a success
      if (r.candidates.some((c) => c.bytes >= p.lo && c.bytes <= p.hi)) expect(['ok', 'raised'], ctx).toContain(r.status);
    }
  });
  it('fill >= 90% (median >= 95%) on 200 reachable max-only targets with free dims', async () => {
    const R = rng(777);
    const fills: number[] = [];
    for (let i = 0; i < 200; i++) {
      const W = 800 + Math.floor(R() * 5000), H = 600 + Math.floor(R() * 4000);
      const f = fake({ complexity: 0.3 + R() * 2, exp: 0.9 + R() * 0.1 });
      const full = (await f.enc(W, H, 40)).bytes;
      const maxKb = Math.max(8, (full / 1000) * (0.02 + R() * 0.9)); // below q40 at full size -> Phase B
      const r2 = await fitSearch(P({ baseWidth: W, baseHeight: H, maxKb }), f.enc);
      expect(r2.status).toBe('ok');
      fills.push(r2.best.bytes / (maxKb * 1000));
    }
    fills.sort((a, b) => a - b);
    expect(fills[0]).toBeGreaterThan(0.9);
    expect(fills[100]).toBeGreaterThan(0.95);
  });
});
