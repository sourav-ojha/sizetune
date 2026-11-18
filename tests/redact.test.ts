import { describe, it, expect } from 'vitest';
import { rectMask, strokeMask, blackout, pixelate, boxBlur, levelToBlock, mergeMasks, maskBounds, type Pixels } from '../src/lib/redact';

/** A picture of seeded noise: every pixel different, so any leak of the original shows. */
function noise(w: number, h: number, seed = 1): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  let s = seed;
  for (let i = 0; i < data.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; data[i] = (s >>> 24) & 255; }
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { width: w, height: h, data };
}
const clone = (p: Pixels): Pixels => ({ width: p.width, height: p.height, data: new Uint8ClampedArray(p.data) });
const at = (p: Pixels, x: number, y: number) => { const o = (y * p.width + x) * 4; return [p.data[o], p.data[o + 1], p.data[o + 2], p.data[o + 3]]; };

describe('masks', () => {
  it('rectMask is binary, exactly the rectangle, clipped to the picture', () => {
    const m = rectMask(10, 8, { x: 2, y: 1, w: 4, h: 3 });
    expect(new Set(m.data)).toEqual(new Set([0, 1]));
    expect(m.data.reduce((a, b) => a + b, 0)).toBe(12);
    const clipped = rectMask(10, 8, { x: -3, y: 6, w: 20, h: 20 });
    expect(clipped.data.reduce((a, b) => a + b, 0)).toBe(10 * 2);
  });
  it('strokeMask covers the whole path including its end caps, is binary, and stays inside the picture', () => {
    const m = strokeMask(60, 40, [{ x: 10, y: 20 }, { x: 50, y: 20 }], 6);
    expect(new Set(m.data)).toEqual(new Set([0, 1]));
    for (const x of [8, 10, 30, 50, 52]) expect(m.data[20 * 60 + x], `x=${x}`).toBe(1); // inside the line and its round ends
    expect(m.data[5 * 60 + 30]).toBe(0);
    expect(m.data[20 * 60 + 58]).toBe(0);
    const edge = strokeMask(20, 20, [{ x: 0, y: 0 }, { x: 19, y: 19 }], 40); // a huge pen near the corners must not throw or leave the picture
    expect(edge.data.length).toBe(400);
  });
  it('a single tap makes a round dot, and no points make nothing', () => {
    const dot = strokeMask(30, 30, [{ x: 15, y: 15 }], 5);
    expect(dot.data[15 * 30 + 15]).toBe(1);
    expect(dot.data[15 * 30 + 25]).toBe(0);
    expect(strokeMask(30, 30, [], 5).data.some((v) => v === 1)).toBe(false);
  });
  it('mergeMasks is the union, and maskBounds is the tight box around it', () => {
    const a = rectMask(20, 20, { x: 2, y: 2, w: 3, h: 3 }), b = rectMask(20, 20, { x: 10, y: 12, w: 4, h: 2 });
    const u = mergeMasks(a, b);
    expect(u.data.reduce((s, v) => s + v, 0)).toBe(9 + 8);
    expect(maskBounds(u)).toEqual({ x: 2, y: 2, w: 12, h: 12 });
    expect(maskBounds(rectMask(5, 5, { x: 0, y: 0, w: 0, h: 0 }))).toBeNull();
  });
});

describe('blackout (AC-2): no recoverable detail', () => {
  it('every pixel inside the region becomes exactly the fill colour, whatever the picture held', () => {
    for (const seed of [1, 2, 3]) {
      const img = noise(40, 30, seed);
      const m = rectMask(40, 30, { x: 5, y: 4, w: 20, h: 15 });
      blackout(img, m, [0, 0, 0]);
      const seen = new Set<string>();
      for (let y = 4; y < 19; y++) for (let x = 5; x < 25; x++) seen.add(at(img, x, y).join(','));
      expect([...seen], `seed ${seed}`).toEqual(['0,0,0,255']);
    }
  });
  it('two different pictures give byte-identical regions, so the region carries no information about the original', () => {
    const a = noise(40, 30, 11), b = noise(40, 30, 99);
    const m = rectMask(40, 30, { x: 5, y: 4, w: 20, h: 15 });
    blackout(a, m, [0, 0, 0]); blackout(b, m, [0, 0, 0]);
    for (let y = 4; y < 19; y++) for (let x = 5; x < 25; x++) expect(at(a, x, y)).toEqual(at(b, x, y));
  });
  it('leaves every pixel outside the region untouched (AC-1)', () => {
    const img = noise(40, 30), before = clone(img);
    const m = rectMask(40, 30, { x: 5, y: 4, w: 20, h: 15 });
    blackout(img, m, [255, 0, 0]);
    for (let y = 0; y < 30; y++) for (let x = 0; x < 40; x++) {
      const inside = x >= 5 && x < 25 && y >= 4 && y < 19;
      if (!inside) expect(at(img, x, y)).toEqual(at(before, x, y));
    }
  });
  it('works for a brush mask too, with no pixel of the stroke left over', () => {
    const img = noise(80, 40, 5);
    const m = strokeMask(80, 40, [{ x: 10, y: 20 }, { x: 40, y: 10 }, { x: 70, y: 30 }], 8);
    blackout(img, m, [0, 0, 0]);
    for (let i = 0; i < m.data.length; i++) if (m.data[i]) expect(img.data.slice(i * 4, i * 4 + 4).join(','), `pixel ${i}`).toBe('0,0,0,255');
  });
});

describe('pixelate (AC-1)', () => {
  it('turns the region into flat blocks, and leaves the rest of the picture as it was', () => {
    const img = noise(40, 30), before = clone(img);
    const m = rectMask(40, 30, { x: 8, y: 8, w: 16, h: 16 });
    pixelate(img, m, 8);
    // blocks are aligned to the region's own top-left, 8 px: 4 flat blocks
    for (const [bx, by] of [[8, 8], [16, 8], [8, 16], [16, 16]]) {
      const first = at(img, bx, by).join(',');
      for (let y = by; y < by + 8; y++) for (let x = bx; x < bx + 8; x++) expect(at(img, x, y).join(',')).toBe(first);
    }
    expect(at(img, 8, 8).join(',')).not.toBe(at(before, 8, 8).join(','));
    for (let y = 0; y < 30; y++) for (let x = 0; x < 40; x++) if (!(x >= 8 && x < 24 && y >= 8 && y < 24)) expect(at(img, x, y)).toEqual(at(before, x, y));
  });
  it('a block holds the average of what was under it', () => {
    const img: Pixels = { width: 4, height: 2, data: new Uint8ClampedArray(4 * 2 * 4) };
    [0, 100, 200, 100].forEach((v, i) => { img.data[i * 4] = v; img.data[i * 4 + 3] = 255; }); // row 0: 0 100 200 100
    [100, 0, 100, 200].forEach((v, i) => { img.data[(4 + i) * 4] = v; img.data[(4 + i) * 4 + 3] = 255; });
    pixelate(img, rectMask(4, 2, { x: 0, y: 0, w: 4, h: 2 }), 2);
    expect(at(img, 0, 0)[0]).toBe(50); // (0+100+100+0)/4
    expect(at(img, 3, 1)[0]).toBe(150); // (200+100+100+200)/4
  });
  it('a block size of 1 or less changes nothing', () => {
    const img = noise(10, 10), before = clone(img);
    pixelate(img, rectMask(10, 10, { x: 0, y: 0, w: 10, h: 10 }), 1);
    expect(img.data).toEqual(before.data);
  });
});

describe('boxBlur', () => {
  it('smooths the region (less spread between neighbours) and leaves the outside alone', () => {
    const img = noise(40, 30), before = clone(img);
    const m = rectMask(40, 30, { x: 8, y: 8, w: 20, h: 14 });
    boxBlur(img, m, 3);
    const spread = (p: Pixels) => { let s = 0; for (let y = 9; y < 20; y++) for (let x = 9; x < 26; x++) s += Math.abs(at(p, x, y)[0] - at(p, x + 1, y)[0]); return s; };
    expect(spread(img)).toBeLessThan(spread(before) / 3);
    for (let y = 0; y < 30; y++) for (let x = 0; x < 40; x++) if (!(x >= 8 && x < 28 && y >= 8 && y < 22)) expect(at(img, x, y)).toEqual(at(before, x, y));
  });
  it('radius 0 changes nothing', () => {
    const img = noise(12, 12), before = clone(img);
    boxBlur(img, rectMask(12, 12, { x: 0, y: 0, w: 12, h: 12 }), 0);
    expect(img.data).toEqual(before.data);
  });
  it('a flat colour stays that colour', () => {
    const img: Pixels = { width: 10, height: 10, data: new Uint8ClampedArray(400).fill(120) };
    for (let i = 3; i < 400; i += 4) img.data[i] = 255;
    boxBlur(img, rectMask(10, 10, { x: 0, y: 0, w: 10, h: 10 }), 4);
    expect(new Set(img.data)).toEqual(new Set([120, 255]));
  });
});

describe('levelToBlock', () => {
  it('grows with the level and with the picture size, and is never below 3', () => {
    expect(levelToBlock(1, 400, 300)).toBeGreaterThanOrEqual(3);
    expect(levelToBlock(10, 4000, 3000)).toBeGreaterThan(levelToBlock(10, 400, 300));
    expect(levelToBlock(20, 800, 600)).toBeGreaterThan(levelToBlock(5, 800, 600));
    expect(levelToBlock(Number.NaN, 800, 600)).toBeGreaterThanOrEqual(3);
  });
});
