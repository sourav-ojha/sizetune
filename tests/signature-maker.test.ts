import { describe, it, expect } from 'vitest';
import { strokeBounds, undoStroke, smoothPath, dot, FONTS, INKS, EXPORT_PAD } from '../src/lib/signature-maker';

describe('strokeBounds', () => {
  it('is null when nothing is drawn', () => {
    expect(strokeBounds([], 10)).toBeNull();
    expect(strokeBounds([[]], 10)).toBeNull();
  });
  it('covers every point of every stroke plus the padding', () => {
    const b = strokeBounds([[{ x: 10, y: 20 }, { x: 50, y: 30 }], [{ x: 5, y: 80 }]], 4)!;
    expect(b).toEqual({ x: 1, y: 16, w: 53, h: 68 }); // x 5..50 and y 20..80, grown by 4
  });
  it('never starts before the origin, so the crop stays inside the canvas', () => {
    const b = strokeBounds([[{ x: 2, y: 2 }, { x: 40, y: 40 }]], 20)!;
    expect(b.x).toBe(0);
    expect(b.y).toBe(0);
    expect(b.w).toBe(60);
    expect(b.h).toBe(60);
  });
  it('a single dot still has a size', () => {
    const b = strokeBounds([[{ x: 100, y: 100 }]], EXPORT_PAD)!;
    expect(b.w).toBeGreaterThan(0);
    expect(b.h).toBeGreaterThan(0);
  });
});

describe('undoStroke', () => {
  it('removes only the last stroke and never mutates its input', () => {
    const s = [[{ x: 1, y: 1 }], [{ x: 2, y: 2 }]];
    const after = undoStroke(s);
    expect(after).toHaveLength(1);
    expect(s).toHaveLength(2);
    expect(undoStroke([])).toEqual([]);
  });
});

describe('smoothPath', () => {
  it('turns one point into a dot, two into a line, more into curves through the midpoints', () => {
    expect(smoothPath([{ x: 5, y: 5 }])).toEqual(dot({ x: 5, y: 5 }));
    expect(smoothPath([{ x: 0, y: 0 }, { x: 10, y: 10 }])).toEqual([['M', 0, 0], ['L', 10, 10]]);
    const p = smoothPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 10 }, { x: 30, y: 10 }]);
    expect(p[0]).toEqual(['M', 0, 0]);
    expect(p.slice(1).every((c) => c[0] === 'Q' || c[0] === 'L')).toBe(true);
    expect(p[p.length - 1]).toEqual(['L', 30, 10]); // ends exactly on the last point
  });
  it('an empty stroke draws nothing', () => {
    expect(smoothPath([])).toEqual([]);
  });
});

describe('fonts and inks', () => {
  it('every font has a CSS family and a label, ids are unique', () => {
    expect(new Set(FONTS.map((f) => f.id)).size).toBe(FONTS.length);
    for (const f of FONTS) { expect(f.family.length).toBeGreaterThan(2); expect(f.label.length).toBeGreaterThan(2); }
  });
  it('inks are dark enough to read on white', () => {
    for (const i of INKS) expect(i.value).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
