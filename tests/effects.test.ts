import { describe, it, expect } from 'vitest';
import { grayscale, blackAndWhite, posterize, pixelArt, borderedSize, logoBox, BORDER_MAX_PX, LOGO_SIZE_RANGE_PCT, type Pixels } from '../src/lib/effects';

function colourful(w: number, h: number): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; data[o] = (x * 37 + y * 11) % 256; data[o + 1] = (x * 5 + y * 53) % 256; data[o + 2] = (x * 91 + y * 7) % 256; data[o + 3] = 255; }
  return { width: w, height: h, data };
}
const clone = (p: Pixels): Pixels => ({ width: p.width, height: p.height, data: new Uint8ClampedArray(p.data) });

describe('grayscale (AC-2)', () => {
  it('makes every pixel grey: red, green and blue are equal', () => {
    const img = colourful(30, 20);
    grayscale(img);
    for (let i = 0; i < img.data.length; i += 4) { expect(img.data[i]).toBe(img.data[i + 1]); expect(img.data[i + 1]).toBe(img.data[i + 2]); expect(img.data[i + 3]).toBe(255); }
  });
  it('keeps brightness order: green is lighter than blue, white stays white and black stays black', () => {
    const img: Pixels = { width: 4, height: 1, data: new Uint8ClampedArray([0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255]) };
    grayscale(img);
    expect(img.data[0]).toBeGreaterThan(img.data[4]);
    expect(img.data[8]).toBe(255);
    expect(img.data[12]).toBe(0);
  });
  it('leaves transparency alone', () => {
    const img: Pixels = { width: 1, height: 1, data: new Uint8ClampedArray([200, 10, 10, 77]) };
    grayscale(img);
    expect(img.data[3]).toBe(77);
  });
});

describe('blackAndWhite (AC-2)', () => {
  it('leaves only pure black and pure white, split at the threshold', () => {
    const img = colourful(40, 30);
    blackAndWhite(img, 128);
    const seen = new Set<number>();
    for (let i = 0; i < img.data.length; i += 4) { seen.add(img.data[i]); expect(img.data[i]).toBe(img.data[i + 1]); expect(img.data[i]).toBe(img.data[i + 2]); }
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 255]);
  });
  it('a higher threshold makes more of the picture black', () => {
    const count = (t: number) => { const img = colourful(40, 30); blackAndWhite(img, t); let n = 0; for (let i = 0; i < img.data.length; i += 4) if (img.data[i] === 0) n++; return n; };
    expect(count(60)).toBeLessThan(count(128));
    expect(count(128)).toBeLessThan(count(200));
    expect(count(0)).toBeLessThanOrEqual(1); // only a pixel that is already pure black stays black at threshold 0
    expect(count(256)).toBe(40 * 30);
  });
});

describe('posterize and pixelArt', () => {
  it('posterize limits each channel to the given number of levels', () => {
    const img = colourful(30, 20);
    posterize(img, 4);
    const seen = new Set<number>();
    for (let i = 0; i < img.data.length; i += 4) { seen.add(img.data[i]); seen.add(img.data[i + 1]); seen.add(img.data[i + 2]); }
    expect(seen.size).toBeLessThanOrEqual(4);
    expect(seen.has(0) && seen.has(255)).toBe(true);
  });
  it('pixelArt makes flat blocks over the whole picture and limits the colours', () => {
    const img = colourful(40, 30);
    pixelArt(img, 10, 4);
    for (const [bx, by] of [[0, 0], [10, 0], [30, 20]]) {
      const first = img.data.slice((by * 40 + bx) * 4, (by * 40 + bx) * 4 + 4).join(',');
      for (let y = by; y < by + 10; y++) for (let x = bx; x < bx + 10; x++) expect(img.data.slice((y * 40 + x) * 4, (y * 40 + x) * 4 + 4).join(',')).toBe(first);
    }
    const seen = new Set<number>();
    for (let i = 0; i < img.data.length; i += 4) { seen.add(img.data[i]); seen.add(img.data[i + 1]); seen.add(img.data[i + 2]); }
    expect(seen.size).toBeLessThanOrEqual(4);
  });
  it('a block size of 1 and levels of 256 change nothing', () => {
    const img = colourful(20, 20), before = clone(img);
    pixelArt(img, 1, 256);
    expect(img.data).toEqual(before.data);
  });
});

describe('borderedSize (AC-1)', () => {
  it('grows the picture by the border on every side', () => {
    expect(borderedSize(400, 300, 20)).toEqual({ w: 440, h: 340, b: 20 });
    expect(borderedSize(400, 300, 0)).toEqual({ w: 400, h: 300, b: 0 });
  });
  it('clamps a negative, fractional, huge or invalid border', () => {
    expect(borderedSize(400, 300, -5).b).toBe(0);
    expect(borderedSize(400, 300, 12.6).b).toBe(13);
    expect(borderedSize(400, 300, 99999).b).toBe(BORDER_MAX_PX);
    expect(borderedSize(400, 300, Number.NaN).b).toBe(0);
  });
});

describe('logoBox (AC-3)', () => {
  const canvas = { w: 1000, h: 800 }, logo = { w: 200, h: 100 };
  it('is the chosen share of the canvas width, at the logo\'s own shape', () => {
    const b = logoBox({ canvas, logo, position: 'center', sizePct: 20, marginPct: 2 });
    expect(b.w).toBe(200);
    expect(b.h).toBe(100);
  });
  it('sits in each corner with the margin, and in the middle for centre', () => {
    const m = Math.round(800 * 0.02); // margin is a share of the shorter side
    const tl = logoBox({ canvas, logo, position: 'tl', sizePct: 20, marginPct: 2 });
    const tr = logoBox({ canvas, logo, position: 'tr', sizePct: 20, marginPct: 2 });
    const bl = logoBox({ canvas, logo, position: 'bl', sizePct: 20, marginPct: 2 });
    const br = logoBox({ canvas, logo, position: 'br', sizePct: 20, marginPct: 2 });
    const c = logoBox({ canvas, logo, position: 'center', sizePct: 20, marginPct: 2 });
    expect([tl.x, tl.y]).toEqual([m, m]);
    expect([tr.x, tr.y]).toEqual([1000 - 200 - m, m]);
    expect([bl.x, bl.y]).toEqual([m, 800 - 100 - m]);
    expect([br.x, br.y]).toEqual([1000 - 200 - m, 800 - 100 - m]);
    expect([c.x, c.y]).toEqual([400, 350]);
  });
  it('always stays inside the canvas, even for huge sizes, huge margins and extreme shapes', () => {
    for (const position of ['tl', 'tr', 'bl', 'br', 'center'] as const) for (const sizePct of [1, 5, 60, 999]) for (const marginPct of [0, 10, 99]) for (const lg of [{ w: 10, h: 4000 }, { w: 4000, h: 10 }, { w: 200, h: 100 }]) {
      const b = logoBox({ canvas, logo: lg, position, sizePct, marginPct });
      expect(b.x, `${position} ${sizePct} ${marginPct}`).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(1000);
      expect(b.y + b.h).toBeLessThanOrEqual(800);
      expect(b.w).toBeGreaterThanOrEqual(1);
      expect(b.h).toBeGreaterThanOrEqual(1);
    }
  });
  it('size is limited to the allowed range', () => {
    expect(logoBox({ canvas, logo, position: 'center', sizePct: 1, marginPct: 0 }).w).toBe(Math.round(1000 * LOGO_SIZE_RANGE_PCT[0] / 100));
  });
});
