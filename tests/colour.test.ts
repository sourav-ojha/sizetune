import { describe, it, expect } from 'vitest';
import { toHex, toRgbText, toHslText, rgbToHsl, pixelAt, canvasPoint, moveByKey, pushRecent, MAX_RECENT, type Rgba } from '../src/lib/colour';

const c = (r: number, g: number, b: number, a = 255): Rgba => ({ r, g, b, a });

describe('formats (AC-1)', () => {
  it('writes HEX in upper case with two digits per channel', () => {
    expect(toHex(c(255, 0, 128))).toBe('#FF0080');
    expect(toHex(c(0, 5, 10))).toBe('#00050A');
  });
  it('adds the alpha pair to HEX only when the pixel is not opaque', () => {
    expect(toHex(c(1, 2, 3, 255))).toBe('#010203');
    expect(toHex(c(1, 2, 3, 128))).toBe('#01020380');
    expect(toHex(c(1, 2, 3, 0))).toBe('#01020300');
  });
  it('writes RGB and RGBA text', () => {
    expect(toRgbText(c(10, 20, 30))).toBe('rgb(10, 20, 30)');
    expect(toRgbText(c(10, 20, 30, 128))).toBe('rgba(10, 20, 30, 0.5)');
    expect(toRgbText(c(10, 20, 30, 0))).toBe('rgba(10, 20, 30, 0)');
  });
  it('converts RGB to HSL at known points', () => {
    expect(rgbToHsl(c(255, 0, 0))).toEqual({ h: 0, s: 100, l: 50 });
    expect(rgbToHsl(c(0, 255, 0))).toEqual({ h: 120, s: 100, l: 50 });
    expect(rgbToHsl(c(0, 0, 255))).toEqual({ h: 240, s: 100, l: 50 });
    expect(rgbToHsl(c(255, 255, 255))).toEqual({ h: 0, s: 0, l: 100 });
    expect(rgbToHsl(c(0, 0, 0))).toEqual({ h: 0, s: 0, l: 0 });
    expect(rgbToHsl(c(128, 128, 128))).toEqual({ h: 0, s: 0, l: 50 });
    expect(rgbToHsl(c(255, 128, 0))).toEqual({ h: 30, s: 100, l: 50 });
  });
  it('writes HSL and HSLA text', () => {
    expect(toHslText(c(0, 0, 255))).toBe('hsl(240, 100%, 50%)');
    expect(toHslText(c(0, 0, 255, 51))).toBe('hsla(240, 100%, 50%, 0.2)');
  });
});

describe('pixelAt', () => {
  const data = new Uint8ClampedArray([
    1, 2, 3, 255, 4, 5, 6, 255,
    7, 8, 9, 200, 10, 11, 12, 0,
  ]);
  it('reads the pixel at x, y of a 2 x 2 buffer', () => {
    expect(pixelAt(data, 2, 0, 0)).toEqual(c(1, 2, 3));
    expect(pixelAt(data, 2, 1, 0)).toEqual(c(4, 5, 6));
    expect(pixelAt(data, 2, 0, 1)).toEqual(c(7, 8, 9, 200));
    expect(pixelAt(data, 2, 1, 1)).toEqual(c(10, 11, 12, 0));
  });
});

describe('canvasPoint: shown position to the right pixel (high-DPI, scaling)', () => {
  it('maps a click on a canvas shown smaller than its pixels', () => {
    // 1000 x 500 picture shown 250 x 125 CSS px: every CSS pixel is 4 picture pixels.
    const rect = { left: 10, top: 20, width: 250, height: 125 };
    expect(canvasPoint(rect, 10, 20, 1000, 500)).toEqual({ x: 0, y: 0 });
    expect(canvasPoint(rect, 10 + 100, 20 + 50, 1000, 500)).toEqual({ x: 400, y: 200 });
    expect(canvasPoint(rect, 10 + 249.9, 20 + 124.9, 1000, 500)).toEqual({ x: 999, y: 499 });
  });
  it('clamps points on or past the edge into the picture', () => {
    const rect = { left: 0, top: 0, width: 100, height: 100 };
    expect(canvasPoint(rect, 100, 100, 200, 200)).toEqual({ x: 199, y: 199 });
    expect(canvasPoint(rect, -5, -5, 200, 200)).toEqual({ x: 0, y: 0 });
  });
  it('maps a canvas shown larger than its pixels (small image scaled up)', () => {
    const rect = { left: 0, top: 0, width: 400, height: 400 };
    expect(canvasPoint(rect, 399, 399, 4, 4)).toEqual({ x: 3, y: 3 });
    expect(canvasPoint(rect, 101, 0, 4, 4)).toEqual({ x: 1, y: 0 });
  });
  it('returns null for an unmeasured canvas instead of dividing by zero', () => {
    expect(canvasPoint({ left: 0, top: 0, width: 0, height: 0 }, 1, 1, 10, 10)).toBeNull();
  });
});

describe('moveByKey (keyboard picking)', () => {
  it('moves one pixel and ten with Shift, staying inside the picture', () => {
    expect(moveByKey({ x: 5, y: 5 }, 'ArrowRight', false, 20, 20)).toEqual({ x: 6, y: 5 });
    expect(moveByKey({ x: 5, y: 5 }, 'ArrowUp', true, 20, 20)).toEqual({ x: 5, y: 0 });
    expect(moveByKey({ x: 19, y: 19 }, 'ArrowDown', false, 20, 20)).toEqual({ x: 19, y: 19 });
    expect(moveByKey({ x: 0, y: 0 }, 'ArrowLeft', true, 20, 20)).toEqual({ x: 0, y: 0 });
  });
  it('ignores other keys', () => {
    expect(moveByKey({ x: 1, y: 1 }, 'a', false, 20, 20)).toBeNull();
  });
});

describe('pushRecent (FR-3)', () => {
  it('puts the newest first, skips an exact repeat and keeps the most recent few', () => {
    let list: Rgba[] = [];
    list = pushRecent(list, c(1, 1, 1));
    list = pushRecent(list, c(2, 2, 2));
    list = pushRecent(list, c(1, 1, 1)); // moves to the front, no duplicate
    expect(list.map((p) => p.r)).toEqual([1, 2]);
    for (let i = 10; i < 10 + MAX_RECENT + 3; i++) list = pushRecent(list, c(i, 0, 0));
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0].r).toBe(10 + MAX_RECENT + 2);
  });
  it('does not mutate the list it was given', () => {
    const a = [c(1, 1, 1)];
    pushRecent(a, c(2, 2, 2));
    expect(a).toHaveLength(1);
  });
});
