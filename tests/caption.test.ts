import { describe, it, expect } from 'vitest';
import { formatDate, captionLines, layoutCaption, fitFont, DATE_STYLES, STRIP_RANGE, TEXT_RANGE } from '../src/lib/caption';

describe('formatDate', () => {
  it('formats a picked date in each style', () => {
    expect(formatDate('2024-03-07', 'dmy-slash')).toBe('07/03/2024');
    expect(formatDate('2024-03-07', 'dmy-dash')).toBe('07-03-2024');
    expect(formatDate('2024-03-07', 'mdy-slash')).toBe('03/07/2024');
    expect(formatDate('2024-03-07', 'd-mon-y')).toBe('07 Mar 2024');
    expect(formatDate('2024-03-07', 'iso')).toBe('2024-03-07');
  });
  it('keeps a leap day and rejects an impossible or empty date', () => {
    expect(formatDate('2024-02-29', 'dmy-slash')).toBe('29/02/2024');
    expect(formatDate('2023-02-29', 'dmy-slash')).toBe('');
    expect(formatDate('', 'iso')).toBe('');
    expect(formatDate('not a date', 'dmy-dash')).toBe('');
  });
  it('typed style uses the text exactly as typed, trimmed', () => {
    expect(formatDate('  Spring 2024 ', 'typed')).toBe('Spring 2024');
  });
  it('every style has a label and an example', () => {
    for (const s of DATE_STYLES) { expect(s.label.length).toBeGreaterThan(2); expect(s.id).toBeTruthy(); }
  });
});

describe('captionLines', () => {
  it('joins name and date on one line or stacks them, skipping an empty field', () => {
    expect(captionLines('Asha Rao', '07/03/2024', 'one')).toEqual(['Asha Rao   07/03/2024']);
    expect(captionLines('Asha Rao', '07/03/2024', 'two')).toEqual(['Asha Rao', '07/03/2024']);
    expect(captionLines('Asha Rao', '', 'two')).toEqual(['Asha Rao']);
    expect(captionLines('', '07/03/2024', 'one')).toEqual(['07/03/2024']);
    expect(captionLines('  ', '', 'one')).toEqual([]);
  });
});

describe('layoutCaption', () => {
  it('below: the strip is added under the photo, so the canvas grows by the strip height', () => {
    const l = layoutCaption({ photoW: 1200, photoH: 800, placement: 'below', stripPct: 15, textPct: 6, lines: 1 });
    expect(l.stripH).toBe(120);
    expect(l.canvasW).toBe(1200);
    expect(l.canvasH).toBe(920);
    expect(l.stripY).toBe(800);
  });
  it('over: the canvas is the photo and the strip sits on its bottom edge', () => {
    const l = layoutCaption({ photoW: 1200, photoH: 800, placement: 'over', stripPct: 15, textPct: 6, lines: 1 });
    expect(l.canvasH).toBe(800);
    expect(l.stripY).toBe(680);
  });
  it('clamps silly percentages into the allowed ranges', () => {
    const lo = layoutCaption({ photoW: 1000, photoH: 1000, placement: 'below', stripPct: -5, textPct: 0, lines: 1 });
    const hi = layoutCaption({ photoW: 1000, photoH: 1000, placement: 'below', stripPct: 900, textPct: 900, lines: 1 });
    expect(lo.stripH).toBe(Math.round(1000 * STRIP_RANGE[0] / 100));
    expect(hi.stripH).toBe(Math.round(1000 * STRIP_RANGE[1] / 100));
    expect(lo.fontPx).toBeGreaterThanOrEqual(1000 * TEXT_RANGE[0] / 100 - 1);
    expect(hi.fontPx).toBeLessThanOrEqual(1000 * TEXT_RANGE[1] / 100 + 1);
  });
  it('the wanted font size grows with the percentage (the live-update rule)', () => {
    const a = layoutCaption({ photoW: 1200, photoH: 800, placement: 'below', stripPct: 20, textPct: 4, lines: 1 });
    const b = layoutCaption({ photoW: 1200, photoH: 800, placement: 'below', stripPct: 20, textPct: 8, lines: 1 });
    expect(b.fontPx).toBeGreaterThan(a.fontPx);
  });
});

describe('fitFont', () => {
  const measure = (px: number) => px * 10; // pretend the text is 10 times as wide as the font is tall
  it('keeps the wanted size when it fits and shrinks it when it does not', () => {
    expect(fitFont(measure, 1000, 50)).toBe(50);
    expect(fitFont(measure, 300, 50)).toBe(30);
  });
  it('never goes below the minimum', () => {
    expect(fitFont(measure, 10, 50, 12)).toBe(12);
  });
});
