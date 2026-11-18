import { describe, it, expect } from 'vitest';
import { parseAmount, convert, formatAmount, resizerHref, MAX_BYTES } from '../src/lib/sizeconv';

describe('parseAmount (edge cases and errors)', () => {
  it('accepts plain, decimal and thousands-grouped numbers', () => {
    expect(parseAmount('2')).toEqual({ ok: true, value: 2 });
    expect(parseAmount(' 1.5 ')).toEqual({ ok: true, value: 1.5 });
    expect(parseAmount('.5')).toEqual({ ok: true, value: 0.5 });
    expect(parseAmount('1,500')).toEqual({ ok: true, value: 1500 });
    expect(parseAmount('12,345,678.25')).toEqual({ ok: true, value: 12345678.25 });
    expect(parseAmount('0')).toEqual({ ok: true, value: 0 });
  });
  it('gives no result, not an error, for an empty box', () => {
    expect(parseAmount('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseAmount('   ')).toEqual({ ok: false, reason: 'empty' });
  });
  it('rejects negatives, letters, exponents, a stray comma and several dots', () => {
    for (const bad of ['-5', '+5', 'abc', '1e3', '2,5', '1,50', '1..2', '1.2.3', '١٢', 'Infinity', 'NaN', '0x10']) {
      expect(parseAmount(bad), bad).toEqual({ ok: false, reason: 'invalid' });
    }
  });
});

describe('convert (AC-1)', () => {
  it('2 MB is 2000 KB in the 1000 convention and 2048 KB in the 1024 convention', () => {
    const r = convert(2, 'MB', 'KB');
    expect(r).toMatchObject({ ok: true });
    if (r.ok) {
      expect(r.decimal.value).toBe(2000);
      expect(r.binary.value).toBe(2048);
      expect(r.decimal.bytes).toBe(2_000_000);
      expect(r.binary.bytes).toBe(2_097_152);
    }
  });
  it('covers every pair of units both ways', () => {
    const units = ['B', 'KB', 'MB', 'GB'] as const;
    for (const a of units) for (const b of units) {
      const r = convert(1, a, b);
      expect(r.ok).toBe(true);
      if (r.ok) {
        const i = units.indexOf(a) - units.indexOf(b);
        expect(r.decimal.value).toBeCloseTo(1000 ** i, 9);
        expect(r.binary.value).toBeCloseTo(1024 ** i, 9);
      }
    }
  });
  it('removes floating-point noise (0.1 MB is exactly 100 KB; 1.1 KB is 1100 B)', () => {
    const a = convert(0.1, 'MB', 'KB');
    if (a.ok) expect(a.decimal.value).toBe(100);
    const b = convert(1.1, 'KB', 'B');
    if (b.ok) expect(b.decimal.value).toBe(1100);
  });
  it('keeps small fractions', () => {
    const r = convert(1, 'B', 'MB');
    if (r.ok) { expect(r.decimal.value).toBe(0.000001); expect(r.binary.value).toBeCloseTo(1 / 1_048_576, 12); }
  });
  it('zero converts to zero', () => {
    const r = convert(0, 'GB', 'B');
    if (r.ok) { expect(r.decimal.value).toBe(0); expect(r.binary.value).toBe(0); }
  });
  it('refuses a size too large to count exactly, in either convention, instead of overflowing', () => {
    expect(convert(1e12, 'GB', 'B')).toEqual({ ok: false, reason: 'too-large' });
    // Fits in decimal bytes but not in binary bytes: the binary column would be inexact, so the whole input is refused.
    const edge = Math.floor(MAX_BYTES / 1000 ** 3);
    expect(convert(edge, 'GB', 'B')).toEqual({ ok: false, reason: 'too-large' });
    expect(convert(1000, 'GB', 'B')).toMatchObject({ ok: true });
  });
});

describe('formatAmount', () => {
  it('groups digits and trims trailing zeros, up to six places', () => {
    expect(formatAmount(2048)).toBe('2,048');
    expect(formatAmount(1234567.5)).toBe('1,234,567.5');
    expect(formatAmount(0.000001)).toBe('0.000001');
    expect(formatAmount(1 / 3)).toBe('0.333333');
    expect(formatAmount(0)).toBe('0');
  });
  it('writes a large exact integer in full, never in exponent form', () => {
    expect(formatAmount(9_000_000_000_000_000)).toBe('9,000,000,000,000,000');
  });
});

describe('resizerHref (FR-2)', () => {
  it('links the resizer with the whole-KB figure of the 1000 convention', () => {
    expect(resizerHref(2_000_000)).toBe('/?max=2000');
    expect(resizerHref(204_800)).toBe('/?max=204'); // rounds down so the limit is never exceeded
  });
  it('gives no link below 1 KB or above what a browser tool should take', () => {
    expect(resizerHref(999)).toBeNull();
    expect(resizerHref(0)).toBeNull();
    expect(resizerHref(500_000_000)).toBeNull();
  });
});
