/** Pure geometry for the rotator. A result is "flip in the source frame, then rotate clockwise by `turns` quarter turns". */
export interface Op { turns: 0 | 1 | 2 | 3; flipH: boolean; flipV: boolean }
/** Canvas 2D affine matrix [a, b, c, d, e, f]: x' = a*x + c*y + e, y' = b*x + d*y + f. */
export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Op = { turns: 0, flipH: false, flipV: false };

export function outputSize(width: number, height: number, turns: number): { width: number; height: number } {
  return turns % 2 === 0 ? { width, height } : { width: height, height: width };
}

/** Rotate the picture as shown on screen by a quarter turn. */
export function rotateDisplay(op: Op, dir: 'cw' | 'ccw'): Op {
  return { ...op, turns: ((op.turns + (dir === 'cw' ? 1 : 3)) % 4) as Op['turns'] };
}

/** Mirror the picture as shown on screen. After an odd number of quarter turns the screen axes are swapped in the source frame. */
export function flipDisplay(op: Op, axis: 'h' | 'v'): Op {
  const swapped = op.turns % 2 === 1;
  const horizontalInSource = (axis === 'h') !== swapped;
  return horizontalInSource ? { ...op, flipH: !op.flipH } : { ...op, flipV: !op.flipV };
}

const then = (m2: Matrix, m1: Matrix): Matrix => [
  m2[0] * m1[0] + m2[2] * m1[1], m2[1] * m1[0] + m2[3] * m1[1],
  m2[0] * m1[2] + m2[2] * m1[3], m2[1] * m1[2] + m2[3] * m1[3],
  m2[0] * m1[4] + m2[2] * m1[5] + m2[4], m2[1] * m1[4] + m2[3] * m1[5] + m2[5],
];

/** Matrix taking source pixel coordinates (width x height) to output coordinates. */
export function matrixFor(op: Op, width: number, height: number): Matrix {
  let m: Matrix = [op.flipH ? -1 : 1, 0, 0, op.flipV ? -1 : 1, op.flipH ? width : 0, op.flipV ? height : 0];
  let w = width;
  let h = height;
  for (let i = 0; i < op.turns; i++) {
    m = then([0, 1, -1, 0, h, 0], m); // (x, y) -> (h - y, x) for a w x h box, giving an h x w box
    [w, h] = [h, w];
  }
  return m;
}
