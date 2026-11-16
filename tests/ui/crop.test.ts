import { describe, expect, it } from 'vitest';
import { aspectOf, clampRect, displayToSource, fullRect, isFullRect, moveRect, nudgeRect, padRect, pointToSource, rectToPercent, resizeRect, setRectField } from '../../src/components/tool/crop';
import { findInkBounds, scaleRect } from '../../src/components/tool/trim';

const B = { width: 1000, height: 500 };

describe('display <-> source mapping', () => {
  it('scales CSS pixels to source pixels', () => {
    expect(displayToSource(100, 3000, 300)).toBe(1000); // 3000px source shown at 300 css px: 1 css px = 10 src px
    expect(displayToSource(10, 500, 1000)).toBe(5);
    expect(displayToSource(10, 500, 0)).toBe(0);
  });
  it('maps pointer positions and clamps to the image', () => {
    expect(pointToSource(150, 75, { width: 300, height: 150 }, { width: 3000, height: 1500 })).toEqual({ x: 1500, y: 750 });
    expect(pointToSource(-20, 999, { width: 300, height: 150 }, { width: 3000, height: 1500 })).toEqual({ x: 0, y: 1500 });
  });
  it('rectToPercent', () => {
    expect(rectToPercent({ x: 100, y: 50, width: 500, height: 250 }, B)).toEqual({ left: 10, top: 10, width: 50, height: 50 });
  });
});

describe('clamp / move', () => {
  it('keeps the rect inside the bounds with integer sizes', () => {
    expect(clampRect({ x: -5, y: -5, width: 2000, height: 2000 }, B)).toEqual({ x: 0, y: 0, width: 1000, height: 500 });
    expect(clampRect({ x: 990, y: 495, width: 50.4, height: 20.6 }, B)).toEqual({ x: 950, y: 479, width: 50, height: 21 });
    expect(clampRect({ x: 5, y: 5, width: 0, height: -3 }, B, 10)).toMatchObject({ width: 10, height: 10 });
  });
  it('moves without leaving or resizing', () => {
    const r = { x: 100, y: 100, width: 200, height: 100 };
    expect(moveRect(r, 50, -300, B)).toEqual({ x: 150, y: 0, width: 200, height: 100 });
    expect(moveRect(r, 5000, 5000, B)).toEqual({ x: 800, y: 400, width: 200, height: 100 });
  });
  it('fullRect / isFullRect', () => {
    expect(isFullRect(fullRect(B), B)).toBe(true);
    expect(isFullRect({ x: 0, y: 0, width: 999, height: 500 }, B)).toBe(false);
  });
});

describe('resize handles', () => {
  const r = { x: 100, y: 100, width: 400, height: 200 };
  it('resizes each edge freely', () => {
    expect(resizeRect(r, 'e', 50, 0, B)).toEqual({ x: 100, y: 100, width: 450, height: 200 });
    expect(resizeRect(r, 'w', 50, 0, B)).toEqual({ x: 150, y: 100, width: 350, height: 200 });
    expect(resizeRect(r, 'n', 0, -40, B)).toEqual({ x: 100, y: 60, width: 400, height: 240 });
    expect(resizeRect(r, 's', 0, 40, B)).toEqual({ x: 100, y: 100, width: 400, height: 240 });
    expect(resizeRect(r, 'se', 10, 20, B)).toEqual({ x: 100, y: 100, width: 410, height: 220 });
    expect(resizeRect(r, 'nw', -10, -20, B)).toEqual({ x: 90, y: 80, width: 410, height: 220 });
  });
  it('never exceeds bounds or inverts', () => {
    expect(resizeRect(r, 'e', 5000, 0, B).width).toBe(900);
    expect(resizeRect(r, 'w', -5000, 0, B)).toMatchObject({ x: 0, width: 500 });
    expect(resizeRect(r, 'e', -5000, 0, B, { minSize: 20 }).width).toBe(20);
    expect(resizeRect(r, 'w', 5000, 0, B, { minSize: 20 })).toMatchObject({ x: 480, width: 20 });
    expect(resizeRect(r, 's', 0, 9999, B).height).toBe(400);
  });
  it('keeps aspect on corner drags', () => {
    const a = aspectOf(r); // 2
    const out = resizeRect(r, 'se', 100, 0, B, { aspect: a });
    expect(out).toMatchObject({ x: 100, y: 100, width: 500, height: 250 });
    const nw = resizeRect(r, 'nw', -50, 0, B, { aspect: a });
    expect(nw).toMatchObject({ x: 50, y: 75, width: 450, height: 225 });
    expect(out.width / out.height).toBeCloseTo(2, 1);
  });
  it('keeps aspect against bounds (corner at the edge)', () => {
    const out = resizeRect(r, 'se', 5000, 5000, B, { aspect: 2 });
    expect(out.x + out.width).toBeLessThanOrEqual(1000);
    expect(out.y + out.height).toBeLessThanOrEqual(500);
    expect(out.width / out.height).toBeCloseTo(2, 1);
    expect(out).toMatchObject({ width: 800, height: 400 });
  });
  it('keeps aspect on edge drags, centred on the other axis', () => {
    const out = resizeRect(r, 'e', 100, 0, B, { aspect: 2 });
    expect(out).toMatchObject({ x: 100, width: 500, height: 250, y: 75 });
    const s = resizeRect(r, 's', 0, 50, B, { aspect: 2 });
    expect(s).toMatchObject({ height: 250, width: 500, y: 100, x: 50 });
  });
});

describe('keyboard nudging', () => {
  const r = { x: 100, y: 100, width: 400, height: 200 };
  it('moves by the step', () => {
    expect(nudgeRect(r, 'ArrowLeft', 1, B, 'move')).toMatchObject({ x: 99, y: 100 });
    expect(nudgeRect(r, 'ArrowDown', 10, B, 'move')).toMatchObject({ x: 100, y: 110 });
    expect(nudgeRect({ ...r, x: 0 }, 'ArrowLeft', 10, B, 'move').x).toBe(0);
  });
  it('resizes the right/bottom edge, optionally with aspect lock', () => {
    expect(nudgeRect(r, 'ArrowRight', 5, B, 'resize')).toMatchObject({ width: 405, height: 200 });
    expect(nudgeRect(r, 'ArrowUp', 5, B, 'resize')).toMatchObject({ width: 400, height: 195 });
    const l = nudgeRect(r, 'ArrowRight', 10, B, 'resize', 2);
    expect(l).toMatchObject({ width: 410, height: 205 });
    const sh = nudgeRect(r, 'ArrowLeft', 10, B, 'resize', 2);
    expect(sh).toMatchObject({ width: 390, height: 195 });
  });
});

describe('numeric fields', () => {
  const r = { x: 100, y: 100, width: 400, height: 200 };
  it('clamps x/y so the box stays inside', () => {
    expect(setRectField(r, 'x', 900, B)).toMatchObject({ x: 900, width: 100 }); // shrinks to fit instead of snapping
    expect(setRectField(r, 'x', 5000, B)).toMatchObject({ x: 999, width: 1 });
    expect(setRectField(r, 'y', -5, B).y).toBe(0);
    expect(setRectField(r, 'x', NaN, B)).toBe(r);
  });
  it('clamps width/height to the room left', () => {
    expect(setRectField(r, 'width', 5000, B)).toMatchObject({ width: 900 });
    expect(setRectField(r, 'height', 0, B).height).toBe(1);
  });
  it('typing Left, Top, Width, Height in tab order on a full-size box yields the exact region', () => {
    const B2 = { width: 1200, height: 400 };
    let c = fullRect(B2);
    c = setRectField(c, 'x', 290, B2);
    c = setRectField(c, 'y', 90, B2);
    c = setRectField(c, 'width', 2, B2); c = setRectField(c, 'width', 22, B2); c = setRectField(c, 'width', 220, B2);
    c = setRectField(c, 'height', 7, B2); c = setRectField(c, 'height', 70, B2);
    expect(c).toEqual({ x: 290, y: 90, width: 220, height: 70 });
  });
  it('locks aspect on width/height edits', () => {
    expect(setRectField(r, 'width', 600, B, true)).toMatchObject({ width: 600, height: 300 });
    expect(setRectField(r, 'height', 100, B, true)).toMatchObject({ width: 200, height: 100 });
    const big = setRectField(r, 'width', 900, B, true); // height would be 450, y=100 -> 550 > 500
    expect(big.y + big.height).toBeLessThanOrEqual(500);
    expect(big.width / big.height).toBeCloseTo(2, 1);
  });
});

describe('padRect', () => {
  it('pads and clamps', () => {
    expect(padRect({ x: 10, y: 10, width: 100, height: 50 }, 0.05, B)).toEqual({ x: 5, y: 5, width: 110, height: 60 });
    expect(padRect({ x: 0, y: 0, width: 1000, height: 500 }, 0.1, B)).toEqual(fullRect(B));
  });
});

describe('auto-trim', () => {
  const make = (w: number, h: number, ink: Array<[number, number]>, bg = 255, inkVal = 20, alphaBg = 255) => {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = bg; d[i * 4 + 3] = alphaBg; }
    for (const [x, y] of ink) { const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = inkVal; d[i + 3] = 255; }
    return d;
  };
  it('finds the ink bounding box on white paper', () => {
    const ink: Array<[number, number]> = [];
    for (let x = 20; x < 60; x++) for (let y = 30; y < 34; y++) ink.push([x, y]);
    expect(findInkBounds(make(100, 80, ink), 100, 80)).toEqual({ x: 20, y: 30, width: 40, height: 4 });
  });
  it('ignores isolated specks and works on transparent backgrounds and grey paper', () => {
    const ink: Array<[number, number]> = [[2, 2]]; // dust
    for (let x = 40; x < 50; x++) for (let y = 40; y < 45; y++) ink.push([x, y]);
    expect(findInkBounds(make(100, 80, ink), 100, 80)).toEqual({ x: 40, y: 40, width: 10, height: 5 });
    expect(findInkBounds(make(100, 80, ink, 0, 20, 0), 100, 80)).toEqual({ x: 40, y: 40, width: 10, height: 5 }); // transparent bg
    expect(findInkBounds(make(100, 80, ink, 200, 60), 100, 80)).toEqual({ x: 40, y: 40, width: 10, height: 5 }); // grey paper
  });
  it('returns null for blank pages and bad input', () => {
    expect(findInkBounds(make(50, 50, []), 50, 50)).toBeNull();
    expect(findInkBounds(new Uint8ClampedArray(4), 0, 0)).toBeNull();
    expect(findInkBounds(new Uint8ClampedArray(4), 10, 10)).toBeNull();
  });
  it('scales a rect found on a thumbnail back to the source, within bounds', () => {
    expect(scaleRect({ x: 10, y: 5, width: 20, height: 10 }, 4, 4, { width: 400, height: 200 })).toEqual({ x: 40, y: 20, width: 80, height: 40 });
    expect(scaleRect({ x: 90, y: 40, width: 10, height: 10 }, 4.3, 4.3, { width: 430, height: 215 })).toMatchObject({ x: 387, y: 172, width: 43, height: 43 });
  });
});

import { hasTransparentPixel } from '../../src/components/tool/alpha';
describe('hasTransparentPixel', () => {
  it('distinguishes an opaque RGBA image from one with transparency', () => {
    expect(hasTransparentPixel(new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]))).toBe(false);
    expect(hasTransparentPixel(new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 254]))).toBe(true);
    expect(hasTransparentPixel(new Uint8ClampedArray([]))).toBe(false);
  });
});
