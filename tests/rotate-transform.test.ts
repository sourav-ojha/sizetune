import { describe, it, expect } from 'vitest';
import { IDENTITY, flipDisplay, matrixFor, outputSize, rotateDisplay, type Op } from '../src/components/rotate/transform';

const apply = (m: readonly number[], x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

describe('rotate transform (FEATURE-007 AC-1, AC-2)', () => {
  it('a quarter turn swaps width and height; a half turn keeps them', () => {
    expect(outputSize(400, 300, 1)).toEqual({ width: 300, height: 400 });
    expect(outputSize(400, 300, 3)).toEqual({ width: 300, height: 400 });
    expect(outputSize(400, 300, 2)).toEqual({ width: 400, height: 300 });
  });

  it('clockwise quarter turn sends the top-left corner to the top-right', () => {
    const m = matrixFor({ turns: 1, flipH: false, flipV: false }, 400, 300);
    expect(apply(m, 0, 0)).toEqual([300, 0]);
    expect(apply(m, 400, 0)).toEqual([300, 400]);
  });

  it('half turn and three-quarter turn map corners correctly', () => {
    expect(apply(matrixFor({ turns: 2, flipH: false, flipV: false }, 400, 300), 0, 0)).toEqual([400, 300]);
    expect(apply(matrixFor({ turns: 3, flipH: false, flipV: false }, 400, 300), 0, 0)).toEqual([0, 400]);
  });

  it('horizontal flip mirrors left to right; vertical flip mirrors top to bottom', () => {
    expect(apply(matrixFor({ turns: 0, flipH: true, flipV: false }, 400, 300), 0, 10)).toEqual([400, 10]);
    expect(apply(matrixFor({ turns: 0, flipH: false, flipV: true }, 400, 300), 10, 0)).toEqual([10, 300]);
  });

  it('a display flip after a quarter turn still mirrors what the user sees', () => {
    // source top-left pixel is shown top-right after one clockwise turn; flipping the display horizontally moves it to top-left
    const op = flipDisplay(rotateDisplay(IDENTITY, 'cw'), 'h');
    expect(apply(matrixFor(op, 400, 300), 0, 0)).toEqual([0, 0]);
  });

  it('four clockwise turns return to the identity; flipping twice cancels', () => {
    let op: Op = IDENTITY;
    for (let i = 0; i < 4; i++) op = rotateDisplay(op, 'cw');
    expect(op).toEqual(IDENTITY);
    expect(flipDisplay(flipDisplay(IDENTITY, 'v'), 'v')).toEqual(IDENTITY);
    expect(rotateDisplay(IDENTITY, 'ccw').turns).toBe(3);
  });

  it('rotate left then flip horizontally mirrors what is on screen', () => {
    // after a left turn the source top-left pixel is shown bottom-left; flipping the display horizontally moves it to bottom-right
    const op = flipDisplay(rotateDisplay(IDENTITY, 'ccw'), 'h');
    expect(apply(matrixFor(op, 400, 300), 0, 0)).toEqual([300, 400]);
  });
});
