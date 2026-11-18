import { describe, it, expect } from 'vitest';
import { layoutJoin, MAX_IMAGES, OUTPUT_WIDTH_RANGE, GAP_RANGE_PCT, moveItem } from '../src/lib/join-layout';

type Box = { x: number; y: number; w: number; h: number };
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (b: Box, W: number, H: number) => b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H;
const three = [{ w: 400, h: 300 }, { w: 300, h: 300 }, { w: 200, h: 400 }];

function noOverlapAndInside(l: ReturnType<typeof layoutJoin>) {
  for (let i = 0; i < l.boxes.length; i++) {
    expect(inside(l.boxes[i], l.canvasW, l.canvasH), `box ${i} inside`).toBe(true);
    for (let j = i + 1; j < l.boxes.length; j++) expect(overlap(l.boxes[i], l.boxes[j]), `${i} vs ${j}`).toBe(false);
  }
}

describe('row (AC-1): three images joined left to right, in order', () => {
  const l = layoutJoin({ sizes: three, mode: 'row', outputWidth: 1000, gapPct: 0, columns: 2 });
  it('puts them on one row at the same height, in the order given, filling the width', () => {
    expect(l.boxes).toHaveLength(3);
    expect(new Set(l.boxes.map((b) => b.h)).size).toBe(1);
    expect(new Set(l.boxes.map((b) => b.y)).size).toBe(1);
    expect(l.boxes[0].x).toBeLessThan(l.boxes[1].x);
    expect(l.boxes[1].x).toBeLessThan(l.boxes[2].x);
    expect(l.canvasW).toBe(1000);
    const last = l.boxes[2];
    expect(last.x + last.w).toBeLessThanOrEqual(1000);
    expect(1000 - (last.x + last.w)).toBeLessThan(4); // rounding only
  });
  it('keeps each picture\'s shape and never overlaps', () => {
    l.boxes.forEach((b, i) => expect(Math.abs(b.w / b.h - three[i].w / three[i].h)).toBeLessThan(0.03));
    noOverlapAndInside(l);
  });
  it('leaves the requested gap between neighbours', () => {
    const g = layoutJoin({ sizes: three, mode: 'row', outputWidth: 1000, gapPct: 5, columns: 2 });
    const gap = Math.round(1000 * 5 / 100);
    expect(g.boxes[1].x - (g.boxes[0].x + g.boxes[0].w)).toBe(gap);
    noOverlapAndInside(g);
  });
});

describe('column', () => {
  const l = layoutJoin({ sizes: three, mode: 'column', outputWidth: 600, gapPct: 2, columns: 2 });
  it('stacks them top to bottom at the same width, in order', () => {
    expect(new Set(l.boxes.map((b) => b.w)).size).toBe(1);
    expect(l.boxes[0].w).toBe(600);
    expect(l.boxes[0].y).toBeLessThan(l.boxes[1].y);
    expect(l.boxes[1].y).toBeLessThan(l.boxes[2].y);
    noOverlapAndInside(l);
  });
  it('keeps each picture\'s shape', () => {
    l.boxes.forEach((b, i) => expect(Math.abs(b.w / b.h - three[i].w / three[i].h)).toBeLessThan(0.03));
  });
});

describe('grid', () => {
  const five = [...three, { w: 500, h: 250 }, { w: 250, h: 500 }];
  const l = layoutJoin({ sizes: five, mode: 'grid', outputWidth: 900, gapPct: 2, columns: 3 });
  it('fills rows left to right then top to bottom, in order, in equal cells', () => {
    expect(l.boxes).toHaveLength(5);
    const cell = l.cell!;
    expect(cell.w).toBe(cell.h); // square cells
    // order: row 0 has images 0,1,2; row 1 has 3,4
    expect(l.cells![0].y).toBe(l.cells![1].y);
    expect(l.cells![0].x).toBeLessThan(l.cells![1].x);
    expect(l.cells![3].y).toBeGreaterThan(l.cells![0].y);
    expect(l.cells![3].x).toBe(l.cells![0].x);
  });
  it('fits each picture inside its cell without stretching, centred', () => {
    l.boxes.forEach((b, i) => {
      const c = l.cells![i];
      expect(b.x).toBeGreaterThanOrEqual(c.x); expect(b.y).toBeGreaterThanOrEqual(c.y);
      expect(b.x + b.w).toBeLessThanOrEqual(c.x + c.w); expect(b.y + b.h).toBeLessThanOrEqual(c.y + c.h);
      expect(Math.abs(b.w / b.h - five[i].w / five[i].h)).toBeLessThan(0.03);
    });
    noOverlapAndInside(l);
  });
  it('more columns than images collapses to the number of images', () => {
    const one = layoutJoin({ sizes: three.slice(0, 2), mode: 'grid', outputWidth: 800, gapPct: 0, columns: 6 });
    expect(one.cells!.length).toBe(2);
    expect(one.canvasH).toBe(one.cell!.h); // a single row
  });
});

describe('limits and helpers', () => {
  it('clamps width and gap, and allows a single picture', () => {
    expect(layoutJoin({ sizes: three, mode: 'row', outputWidth: 1, gapPct: 0, columns: 2 }).canvasW).toBe(OUTPUT_WIDTH_RANGE[0]);
    expect(layoutJoin({ sizes: three, mode: 'row', outputWidth: 99999, gapPct: 0, columns: 2 }).canvasW).toBe(OUTPUT_WIDTH_RANGE[1]);
    const g = layoutJoin({ sizes: three, mode: 'row', outputWidth: 1000, gapPct: 999, columns: 2 });
    expect(g.boxes[1].x - (g.boxes[0].x + g.boxes[0].w)).toBe(Math.round((1000 * GAP_RANGE_PCT[1]) / 100));
    const one = layoutJoin({ sizes: [three[0]], mode: 'row', outputWidth: 500, gapPct: 3, columns: 2 });
    expect(one.boxes).toHaveLength(1);
    expect(one.boxes[0].w).toBe(500);
  });
  it('extreme shapes never give a zero-size box', () => {
    for (const mode of ['row', 'column', 'grid'] as const) {
      const l = layoutJoin({ sizes: [{ w: 5000, h: 5 }, { w: 5, h: 5000 }, { w: 100, h: 100 }], mode, outputWidth: 400, gapPct: 2, columns: 2 });
      for (const b of l.boxes) { expect(b.w).toBeGreaterThanOrEqual(1); expect(b.h).toBeGreaterThanOrEqual(1); }
    }
  });
  it('MAX_IMAGES is a sensible small number', () => {
    expect(MAX_IMAGES).toBeGreaterThanOrEqual(6);
    expect(MAX_IMAGES).toBeLessThanOrEqual(20);
  });
  it('moveItem swaps neighbours, stays in range and does not change its input', () => {
    const a = ['a', 'b', 'c'];
    expect(moveItem(a, 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(a, 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(a, 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(a, 2, 1)).toEqual(['a', 'b', 'c']);
    expect(a).toEqual(['a', 'b', 'c']);
  });
});
