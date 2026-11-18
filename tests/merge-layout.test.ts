import { describe, it, expect } from 'vitest';
import { layoutMerge, OUTPUT_WIDTH_RANGE, GAP_PCT } from '../src/lib/merge';

type Box = { x: number; y: number; w: number; h: number };
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (b: Box, w: number, h: number) => b.x >= 0 && b.y >= 0 && b.x + b.w <= w && b.y + b.h <= h;

const photo = { w: 600, h: 800 }; // portrait photo
const sig = { w: 600, h: 200 };   // wide signature

describe('stacked layout', () => {
  const l = layoutMerge({ photo, signature: sig, layout: 'stacked', outputWidth: 600 });
  it('puts the photo above the signature, both as wide as the output', () => {
    expect(l.canvasW).toBe(600);
    expect(l.photo).toMatchObject({ x: 0, y: 0, w: 600, h: 800 });
    expect(l.signature.w).toBe(600);
    expect(l.signature.y).toBeGreaterThanOrEqual(l.photo.h);
  });
  it('does not overlap and stays inside the canvas (AC-1)', () => {
    expect(overlap(l.photo, l.signature)).toBe(false);
    expect(inside(l.photo, l.canvasW, l.canvasH)).toBe(true);
    expect(inside(l.signature, l.canvasW, l.canvasH)).toBe(true);
  });
  it('keeps each picture\'s shape (no stretching)', () => {
    expect(l.photo.w / l.photo.h).toBeCloseTo(600 / 800, 2);
    expect(l.signature.w / l.signature.h).toBeCloseTo(600 / 200, 1);
  });
  it('scales both pictures to the chosen output width', () => {
    const half = layoutMerge({ photo, signature: sig, layout: 'stacked', outputWidth: 300 });
    expect(half.canvasW).toBe(300);
    expect(half.photo.w).toBe(300);
    expect(half.canvasH).toBeLessThan(l.canvasH);
  });
});

describe('side by side layout', () => {
  const l = layoutMerge({ photo, signature: sig, layout: 'side', outputWidth: 1000 });
  it('puts both on one row at the same height, filling the output width', () => {
    expect(l.photo.h).toBe(l.signature.h);
    expect(l.photo.y).toBe(l.signature.y);
    expect(l.canvasW).toBe(1000);
    expect(l.signature.x).toBeGreaterThanOrEqual(l.photo.x + l.photo.w);
    expect(l.signature.x + l.signature.w).toBeLessThanOrEqual(1000);
  });
  it('does not overlap and stays inside the canvas (AC-1)', () => {
    expect(overlap(l.photo, l.signature)).toBe(false);
    expect(inside(l.photo, l.canvasW, l.canvasH)).toBe(true);
    expect(inside(l.signature, l.canvasW, l.canvasH)).toBe(true);
  });
  it('keeps each picture\'s shape', () => {
    expect(l.photo.w / l.photo.h).toBeCloseTo(600 / 800, 1);
    expect(l.signature.w / l.signature.h).toBeCloseTo(600 / 200, 1);
  });
});

describe('limits', () => {
  it('clamps the output width into the allowed range', () => {
    expect(layoutMerge({ photo, signature: sig, layout: 'stacked', outputWidth: 5 }).canvasW).toBe(OUTPUT_WIDTH_RANGE[0]);
    expect(layoutMerge({ photo, signature: sig, layout: 'stacked', outputWidth: 99999 }).canvasW).toBe(OUTPUT_WIDTH_RANGE[1]);
    expect(layoutMerge({ photo, signature: sig, layout: 'stacked', outputWidth: Number.NaN }).canvasW).toBe(OUTPUT_WIDTH_RANGE[0]);
  });
  it('a very wide and a very tall picture never produce a zero-size box', () => {
    for (const layout of ['stacked', 'side'] as const) {
      const l = layoutMerge({ photo: { w: 4000, h: 10 }, signature: { w: 10, h: 4000 }, layout, outputWidth: 400 });
      for (const b of [l.photo, l.signature]) { expect(b.w).toBeGreaterThanOrEqual(1); expect(b.h).toBeGreaterThanOrEqual(1); }
    }
  });
  it('the gap is a small fixed share of the output width', () => {
    const l = layoutMerge({ photo, signature: sig, layout: 'stacked', outputWidth: 1000 });
    expect(l.signature.y - (l.photo.y + l.photo.h)).toBe(Math.round((1000 * GAP_PCT) / 100));
  });
});
