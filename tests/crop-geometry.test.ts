import { describe, it, expect } from 'vitest';
import { parseRatio, ratioCrop, ratioPad, radiusPx, pathBounds, thinPath, RATIO_PRESETS, MAX_RADIUS_PCT } from '../src/lib/crop-geometry';

describe('parseRatio', () => {
  it('reads W:H, W/H and plain pairs, and rejects nonsense', () => {
    expect(parseRatio('4:5')).toEqual({ w: 4, h: 5 });
    expect(parseRatio(' 16 / 9 ')).toEqual({ w: 16, h: 9 });
    expect(parseRatio('1.5:1')).toEqual({ w: 1.5, h: 1 });
    for (const bad of ['', '0:1', '1:0', '-1:2', 'a:b', '3', '1:2:3']) expect(parseRatio(bad), bad).toBeNull();
  });
  it('every preset parses', () => {
    for (const p of RATIO_PRESETS) expect(parseRatio(p.value), p.value).not.toBeNull();
  });
});

describe('ratioCrop (AC-3, crop method)', () => {
  const src = { w: 1200, h: 800 };
  it('a square crop of a landscape picture is centred by default and as tall as the picture', () => {
    expect(ratioCrop(src, { w: 1, h: 1 }, 0.5, 0.5)).toEqual({ x: 200, y: 0, w: 800, h: 800 });
  });
  it('the focus point slides the crop window across the picture', () => {
    expect(ratioCrop(src, { w: 1, h: 1 }, 0, 0.5).x).toBe(0);
    expect(ratioCrop(src, { w: 1, h: 1 }, 1, 0.5).x).toBe(400);
  });
  it('a wide ratio on a square picture crops the height', () => {
    expect(ratioCrop({ w: 800, h: 800 }, { w: 16, h: 9 }, 0.5, 0.5)).toEqual({ x: 0, y: 175, w: 800, h: 450 });
  });
  it('never leaves the picture, for any focus value including out-of-range ones', () => {
    for (const f of [-3, 0, 0.3, 1, 7, Number.NaN]) {
      const c = ratioCrop(src, { w: 3, h: 4 }, f, f);
      expect(c.x).toBeGreaterThanOrEqual(0); expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(1200); expect(c.y + c.h).toBeLessThanOrEqual(800);
    }
  });
  it('the crop has the requested shape, within a pixel of rounding', () => {
    const c = ratioCrop(src, { w: 4, h: 5 }, 0.5, 0.5);
    expect(Math.abs(c.w / c.h - 4 / 5)).toBeLessThan(0.01);
  });
});

describe('ratioPad (AC-3, padding method: the image is not stretched)', () => {
  it('pads a landscape picture to a square by adding space above and below', () => {
    const p = ratioPad({ w: 1200, h: 800 }, { w: 1, h: 1 });
    expect(p.canvas).toEqual({ w: 1200, h: 1200 });
    expect(p.image).toEqual({ x: 0, y: 200, w: 1200, h: 800 });
  });
  it('pads a landscape picture to a wider ratio by adding space left and right', () => {
    const p = ratioPad({ w: 1200, h: 800 }, { w: 2, h: 1 });
    expect(p.canvas).toEqual({ w: 1600, h: 800 });
    expect(p.image).toEqual({ x: 200, y: 0, w: 1200, h: 800 });
  });
  it('always keeps the picture at its own size and shape, centred, with the canvas at the target ratio', () => {
    for (const [sw, sh, rw, rh] of [[640, 480, 16, 9], [480, 640, 1, 1], [1000, 1000, 4, 5], [333, 777, 3, 2]] as const) {
      const p = ratioPad({ w: sw, h: sh }, { w: rw, h: rh });
      expect(p.image.w).toBe(sw); expect(p.image.h).toBe(sh); // not scaled, so not stretched
      expect(Math.abs(p.canvas.w / p.canvas.h - rw / rh)).toBeLessThan(0.01);
      expect(p.image.x).toBeGreaterThanOrEqual(0); expect(p.image.y).toBeGreaterThanOrEqual(0);
      expect(p.image.x + p.image.w).toBeLessThanOrEqual(p.canvas.w); expect(p.image.y + p.image.h).toBeLessThanOrEqual(p.canvas.h);
    }
  });
  it('a picture already at the ratio gets no padding', () => {
    const p = ratioPad({ w: 800, h: 800 }, { w: 1, h: 1 });
    expect(p.canvas).toEqual({ w: 800, h: 800 });
    expect(p.image).toEqual({ x: 0, y: 0, w: 800, h: 800 });
  });
});

describe('radiusPx (AC-2)', () => {
  it('is a percentage of the shorter side, limited to half of it (a circle on a square)', () => {
    expect(radiusPx(800, 800, 10)).toBe(80);
    expect(radiusPx(800, 800, 50)).toBe(400);
    expect(radiusPx(800, 800, 90)).toBe(400);
    expect(radiusPx(1200, 800, 25)).toBe(200);
    expect(MAX_RADIUS_PCT).toBe(50);
  });
  it('is zero for no radius, a negative one or something that is not a number', () => {
    for (const v of [0, -5, Number.NaN]) expect(radiusPx(800, 800, v)).toBe(0);
  });
});

describe('freehand path helpers (AC-1)', () => {
  it('pathBounds covers every point, or is null for no points', () => {
    expect(pathBounds([])).toBeNull();
    expect(pathBounds([{ x: 10, y: 20 }, { x: 50, y: 5 }, { x: 30, y: 90 }])).toEqual({ x: 10, y: 5, w: 40, h: 85 });
  });
  it('thinPath drops points that are closer than the spacing, but keeps the first and last', () => {
    const pts = Array.from({ length: 100 }, (_, i) => ({ x: i, y: 0 }));
    const t = thinPath(pts, 10);
    expect(t[0]).toEqual({ x: 0, y: 0 });
    expect(t[t.length - 1]).toEqual({ x: 99, y: 0 });
    expect(t.length).toBeLessThan(15);
    expect(thinPath([{ x: 1, y: 1 }], 10)).toEqual([{ x: 1, y: 1 }]);
    expect(thinPath([], 10)).toEqual([]);
  });
});
