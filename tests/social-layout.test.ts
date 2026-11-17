import { describe, it, expect } from 'vitest';
import { containRect, coverRect, decodeSize } from '../src/components/social/layout';

describe('cover (crop) layout (FEATURE-009 AC-1)', () => {
  it('a wide source cropped to a square keeps full height and centres by default', () => {
    expect(coverRect(2000, 1000, 1080, 1080, 'center')).toEqual({ sx: 500, sy: 0, sw: 1000, sh: 1000 });
  });
  it('focus moves the crop window along the long side only', () => {
    expect(coverRect(2000, 1000, 1080, 1080, 'left')).toMatchObject({ sx: 0, sw: 1000 });
    expect(coverRect(2000, 1000, 1080, 1080, 'right')).toMatchObject({ sx: 1000, sw: 1000 });
    expect(coverRect(1000, 2000, 1080, 1080, 'top')).toMatchObject({ sy: 0, sh: 1000 });
    expect(coverRect(1000, 2000, 1080, 1080, 'bottom')).toMatchObject({ sy: 1000, sh: 1000 });
    // the other axis is already fully used, so a focus along it changes nothing
    expect(coverRect(2000, 1000, 1080, 1080, 'top')).toEqual(coverRect(2000, 1000, 1080, 1080, 'center'));
  });
  it('a source with the target ratio is used whole', () => {
    expect(coverRect(1600, 900, 1280, 720, 'center')).toEqual({ sx: 0, sy: 0, sw: 1600, sh: 900 });
  });
});

describe('contain (pad / blur) layout (AC-2)', () => {
  it('a wide source in a square is letterboxed, fully visible and centred', () => {
    expect(containRect(2000, 1000, 1080, 1080)).toEqual({ dx: 0, dy: 270, dw: 1080, dh: 540 });
  });
  it('a tall source in a wide frame is pillarboxed', () => {
    expect(containRect(1000, 2000, 1920, 1080)).toEqual({ dx: 690, dy: 0, dw: 540, dh: 1080 });
  });
  it('a smaller source is enlarged to fit (no extra detail)', () => {
    expect(containRect(100, 100, 1080, 1080)).toEqual({ dx: 0, dy: 0, dw: 1080, dh: 1080 });
  });
});

describe('decode size keeps memory bounded for huge sources', () => {
  it('does not shrink a source that is already small enough', () => {
    expect(decodeSize(3000, 2000, 1080, 1080)).toBeNull();
  });
  it('shrinks a very large source to a little above what the output needs, keeping the ratio', () => {
    const d = decodeSize(12000, 8000, 1080, 1080)!;
    expect(d.height).toBeGreaterThanOrEqual(1080);
    expect(d.width).toBeLessThan(12000);
    expect(Math.abs(d.width / d.height - 1.5)).toBeLessThan(0.01);
  });
});
