import { describe, it, expect } from 'vitest';
import { baselineY, wrapText, paginate, pageGeometry, ruleYs, unsupportedChars, sizeFor, MAX_CHARS, MAX_PAGES, PAGE_W, PAGE_H } from '../src/lib/handwriting';

const mono = (s: string) => s.length * 10; // every character 10 px wide

describe('wrapText', () => {
  it('breaks at spaces so no line is wider than the limit', () => {
    expect(wrapText('the quick brown fox jumps', mono, 120)).toEqual(['the quick', 'brown fox', 'jumps']);
    for (const l of wrapText('one two three four five six seven eight nine ten', mono, 100)) expect(mono(l)).toBeLessThanOrEqual(100);
  });
  it('keeps the author’s line breaks and blank lines', () => {
    expect(wrapText('first\n\nsecond', mono, 200)).toEqual(['first', '', 'second']);
    expect(wrapText('a\r\nb', mono, 200)).toEqual(['a', 'b']);
  });
  it('splits a word longer than a line instead of running off the page', () => {
    const lines = wrapText('abcdefghijklmnopqrstuvwxyz', mono, 100);
    expect(lines).toEqual(['abcdefghij', 'klmnopqrst', 'uvwxyz']);
  });
  it('collapses runs of spaces inside a line and drops trailing spaces', () => {
    expect(wrapText('a    b   ', mono, 200)).toEqual(['a b']);
  });
  it('returns one empty line for empty text, and never loops on zero width', () => {
    expect(wrapText('', mono, 100)).toEqual(['']);
    expect(wrapText('abc', mono, 0).join('')).toBe('abc');
  });
  it('does not split a surrogate pair (an emoji) when breaking a long word', () => {
    const lines = wrapText('😀😀😀😀😀😀', (s) => [...s].length * 10, 30);
    expect(lines.every((l) => [...l].every((c) => c === '😀'))).toBe(true);
    expect(lines.join('')).toBe('😀😀😀😀😀😀');
  });
});

describe('paginate (AC-2)', () => {
  const lines = Array.from({ length: 25 }, (_, i) => `line ${i}`);
  it('fills each page, then starts the next', () => {
    const r = paginate(lines, 10);
    expect(r.pages.map((p) => p.length)).toEqual([10, 10, 5]);
    expect(r.truncated).toBe(false);
    expect(r.pages.flat()).toEqual(lines);
  });
  it('always makes at least one page', () => {
    expect(paginate([''], 10).pages).toEqual([['']]);
  });
  it('stops at the page cap and says so', () => {
    const many = Array.from({ length: 10 * (MAX_PAGES + 3) }, (_, i) => `l${i}`);
    const r = paginate(many, 10);
    expect(r.pages).toHaveLength(MAX_PAGES);
    expect(r.truncated).toBe(true);
  });
  it('drops blank lines that would start a page', () => {
    const r = paginate(['a', 'b', '', 'c'], 2);
    expect(r.pages).toEqual([['a', 'b'], ['c']]);
  });
});

describe('page geometry', () => {
  it('fits a whole number of lines between the margins', () => {
    const g = pageGeometry(sizeFor('medium'));
    expect(g.lineH).toBeGreaterThan(g.fontPx);
    expect(g.left + g.textW + g.right).toBe(PAGE_W);
    expect(g.top + g.perPage * g.lineH).toBeLessThanOrEqual(PAGE_H - g.bottomMin);
    expect(g.perPage).toBeGreaterThan(20);
  });
  it('a larger size gives fewer lines per page', () => {
    expect(pageGeometry(sizeFor('large')).perPage).toBeLessThan(pageGeometry(sizeFor('small')).perPage);
  });
  it('ruled lines sit under each text baseline, one per line of the page', () => {
    const g = pageGeometry(sizeFor('medium'));
    const ys = ruleYs(g);
    expect(ys).toHaveLength(g.perPage);
    expect(ys[0]).toBe(baselineY(g, 0));
    expect(ys[0]).toBeGreaterThan(g.top);
    expect(ys[0]).toBeLessThan(g.top + g.lineH); // the first rule sits inside the first line
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBe(g.lineH);
  });
});

describe('unsupportedChars', () => {
  it('accepts Latin letters with accents, digits and common punctuation', () => {
    expect(unsupportedChars('Hello, Zoë! Café 123 – “quoted” €5 ™')).toEqual([]);
  });
  it('lists characters the fonts do not cover, once each, in order', () => {
    expect(unsupportedChars('नमस्ते hello 你好 你')).toEqual(['न', 'म', 'स', '्', 'त', 'े', '你', '好']);
  });
  it('ignores line breaks and tabs', () => {
    expect(unsupportedChars('a\nb\tc\r')).toEqual([]);
  });
});

describe('limits', () => {
  it('the text cap is a sane figure', () => {
    expect(MAX_CHARS).toBeGreaterThanOrEqual(2000);
    expect(MAX_PAGES).toBeGreaterThanOrEqual(5);
  });
});
