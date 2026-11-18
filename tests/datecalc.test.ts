import { describe, it, expect } from 'vitest';
import { ageBetween, daysBetween, parseYmd, timestampToParts, partsToTimestamp, detectUnit } from '../src/lib/datecalc';

const ymd = (s: string) => parseYmd(s)!;

describe('parseYmd', () => {
  it('accepts real dates and rejects impossible or malformed ones', () => {
    expect(parseYmd('2024-02-29')).toEqual({ y: 2024, m: 2, d: 29 });
    expect(parseYmd('2023-02-29')).toBeNull();
    expect(parseYmd('2023-13-01')).toBeNull();
    expect(parseYmd('2023-1-1')).toBeNull();
    expect(parseYmd('')).toBeNull();
  });
});

describe('ageBetween (AC-1)', () => {
  it('counts whole years, months and days', () => {
    expect(ageBetween(ymd('1990-05-15'), ymd('2024-08-20'))).toEqual({ years: 34, months: 3, days: 5 });
  });
  it('is exactly zero months and days on a birthday', () => {
    expect(ageBetween(ymd('2000-07-04'), ymd('2024-07-04'))).toEqual({ years: 24, months: 0, days: 0 });
  });
  it('borrows days from the month before the as-of date (month-end birth)', () => {
    // 31 Jan to 1 Mar of a non-leap year: 1 month and 1 day (Feb has 28 days).
    expect(ageBetween(ymd('2023-01-31'), ymd('2023-03-01'))).toEqual({ years: 0, months: 1, days: 1 });
  });
  it('handles a leap-day birth in a leap and a non-leap year', () => {
    expect(ageBetween(ymd('2000-02-29'), ymd('2024-02-29'))).toEqual({ years: 24, months: 0, days: 0 });
    expect(ageBetween(ymd('2000-02-29'), ymd('2023-03-01'))).toEqual({ years: 23, months: 0, days: 1 });
    // Rule: a 29 Feb birthday falls on 28 Feb in a non-leap year (month-end clamping).
    expect(ageBetween(ymd('2000-02-29'), ymd('2023-02-28'))).toEqual({ years: 23, months: 0, days: 0 });
    expect(ageBetween(ymd('2000-02-29'), ymd('2023-02-27'))).toEqual({ years: 22, months: 11, days: 29 });
  });
  it('returns null when the birth date is after the as-of date', () => {
    expect(ageBetween(ymd('2030-01-01'), ymd('2024-01-01'))).toBeNull();
  });
});

describe('daysBetween (AC-2)', () => {
  it('is the same size in both orders, with a sign for direction', () => {
    expect(daysBetween(ymd('2024-01-01'), ymd('2024-03-01'))).toBe(60); // leap year
    expect(daysBetween(ymd('2024-03-01'), ymd('2024-01-01'))).toBe(-60);
  });
  it('is zero for the same day and spans a leap day correctly', () => {
    expect(daysBetween(ymd('2024-05-05'), ymd('2024-05-05'))).toBe(0);
    expect(daysBetween(ymd('2023-02-28'), ymd('2023-03-01'))).toBe(1);
    expect(daysBetween(ymd('2024-02-28'), ymd('2024-03-01'))).toBe(2);
  });
});

describe('timestamps (AC-3)', () => {
  it('detects seconds versus milliseconds', () => {
    expect(detectUnit(1_700_000_000)).toBe('s');
    expect(detectUnit(1_700_000_000_000)).toBe('ms');
  });
  it('converts a timestamp to the date in the chosen zone', () => {
    // 1700000000 = 2023-11-14 22:13:20 UTC = 2023-11-15 03:43:20 in Asia/Kolkata (+05:30)
    expect(timestampToParts(1_700_000_000, 's', 'UTC')).toBe('2023-11-14 22:13:20');
    expect(timestampToParts(1_700_000_000, 's', 'Asia/Kolkata')).toBe('2023-11-15 03:43:20');
    expect(timestampToParts(1_700_000_000_000, 'ms', 'UTC')).toBe('2023-11-14 22:13:20');
  });
  it('round-trips: date in a zone back to the same timestamp', () => {
    for (const tz of ['UTC', 'Asia/Kolkata', 'America/New_York', 'Pacific/Auckland']) {
      const text = timestampToParts(1_700_000_000, 's', tz)!;
      expect(partsToTimestamp(text, tz)).toBe(1_700_000_000);
    }
  });
  it('resolves a time inside a daylight-saving gap or overlap without throwing', () => {
    // 2024-03-10 02:30 does not exist in New York; the overlap 2024-11-03 01:30 happens twice.
    expect(Number.isFinite(partsToTimestamp('2024-03-10 02:30:00', 'America/New_York'))).toBe(true);
    expect(Number.isFinite(partsToTimestamp('2024-11-03 01:30:00', 'America/New_York'))).toBe(true);
  });
  it('returns null for unusable input instead of throwing', () => {
    expect(timestampToParts(Number.NaN, 's', 'UTC')).toBeNull();
    expect(timestampToParts(1e20, 's', 'UTC')).toBeNull();
    expect(timestampToParts(0, 's', 'Not/AZone')).toBeNull();
    expect(partsToTimestamp('garbage', 'UTC')).toBeNull();
    expect(partsToTimestamp('2023-02-30 10:00:00', 'UTC')).toBeNull();
  });
});
