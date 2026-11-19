// Date and time calculations for the date workbench (FEATURE-016). Pure functions: no network, no storage, only Date and Intl.
// Calendar dates are plain {y, m, d} values and never go through the local time zone, so a result cannot shift by a day.

export interface Ymd { y: number; m: number; d: number }
export interface Age { years: number; months: number; days: number }

const MS_DAY = 86_400_000;
const MAX_MS = 8.64e15; // largest instant a JavaScript Date can hold

const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();
const dayNumber = (v: Ymd): number => Math.floor(Date.UTC(v.y, v.m - 1, v.d) / MS_DAY);
const cmp = (a: Ymd, b: Ymd): number => dayNumber(a) - dayNumber(b);

/** Parses a strict YYYY-MM-DD string. Returns null for malformed text or a date that does not exist (for example 2023-02-29). */
export function parseYmd(text: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  return { y, m: mo, d };
}

/** The date `months` months after `from`, with the day clamped to the end of a shorter month (31 Jan + 1 month = 28 or 29 Feb). */
function addMonths(from: Ymd, months: number): Ymd {
  const index = from.y * 12 + (from.m - 1) + months;
  const y = Math.floor(index / 12), m = (index % 12) + 1;
  return { y, m, d: Math.min(from.d, daysInMonth(y, m)) };
}

/**
 * Age in whole years, months and days from `birth` to `asOf`. Months are counted from the birth date with the day clamped to the end of a
 * shorter month, so a 29 February birthday is reached on 28 February in a common year. Null when the birth date is after `asOf`.
 */
export function ageBetween(birth: Ymd, asOf: Ymd): Age | null {
  if (cmp(birth, asOf) > 0) return null;
  let months = (asOf.y - birth.y) * 12 + (asOf.m - birth.m);
  if (cmp(addMonths(birth, months), asOf) > 0) months -= 1;
  const days = dayNumber(asOf) - dayNumber(addMonths(birth, months));
  return { years: Math.floor(months / 12), months: months % 12, days };
}

/** Signed number of days from `a` to `b` (negative when `b` is earlier). */
export function daysBetween(a: Ymd, b: Ymd): number {
  return dayNumber(b) - dayNumber(a);
}

export type Unit = 's' | 'ms';

/** Seconds or milliseconds? A 13 digit number is milliseconds; anything with fewer digits is read as seconds. */
export function detectUnit(value: number): Unit {
  return Math.abs(value) >= 1e11 ? 'ms' : 's';
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat | null {
  let f = formatterCache.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return null; } // unknown time zone name
    formatterCache.set(tz, f);
  }
  return f;
}

interface Wall { y: number; m: number; d: number; h: number; mi: number; s: number }
function wallTime(ms: number, tz: string): Wall | null {
  const f = formatter(tz);
  if (!f || !Number.isFinite(ms) || Math.abs(ms) > MAX_MS) return null;
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return { y: o.year, m: o.month, d: o.day, h: o.hour, mi: o.minute, s: o.second };
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** A timestamp as `YYYY-MM-DD HH:mm:ss` in the given IANA time zone (or 'UTC'). Null for a value or zone that cannot be shown. */
export function timestampToParts(value: number, unit: Unit, tz: string): string | null {
  const w = wallTime(unit === 's' ? value * 1000 : value, tz);
  if (!w || w.y < 0 || w.y > 9999) return null;
  return `${pad(w.y, 4)}-${pad(w.m)}-${pad(w.d)} ${pad(w.h)}:${pad(w.mi)}:${pad(w.s)}`;
}

const asUtcMs = (w: Wall): number => Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);

/**
 * Seconds since the epoch for a `YYYY-MM-DD HH:mm:ss` wall-clock time in a time zone. Null for malformed or impossible input.
 * A time skipped by a daylight-saving change is read with the offset in force before the change; a repeated time takes its first occurrence.
 */
export function partsToTimestamp(text: string, tz: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(text.trim());
  if (!m || !formatter(tz)) return null;
  const date = parseYmd(`${m[1]}-${m[2]}-${m[3]}`);
  const h = Number(m[4]), mi = Number(m[5]), s = Number(m[6]);
  if (!date || h > 23 || mi > 59 || s > 59) return null;
  const naive = Date.UTC(date.y, date.m - 1, date.d, h, mi, s);
  const offset = (at: number) => { const w = wallTime(at, tz); return w ? asUtcMs(w) - at : 0; };
  let guess = naive - offset(naive);
  const second = naive - offset(guess); // re-evaluate at the first guess; settles every real zone
  if (second !== guess) {
    // The two offsets disagree near a change. Prefer the earlier instant, which is the first occurrence of a repeated time.
    guess = Math.min(guess, second);
  }
  return Math.floor(guess / 1000);
}
