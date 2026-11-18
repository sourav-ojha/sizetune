// File-size unit conversion (FEATURE-030). Pure functions: no DOM, no network, no storage.
// Two conventions are always calculated side by side: 1 KB = 1,000 bytes (storage makers, the SI prefixes) and 1 KB = 1,024 bytes (what most
// operating systems and upload forms count).

export type Unit = 'B' | 'KB' | 'MB' | 'GB';
export const UNITS: readonly Unit[] = ['B', 'KB', 'MB', 'GB'];

/** The largest size, in bytes, either column may reach. Above it a number is no longer exact in a double. */
export const MAX_BYTES = Number.MAX_SAFE_INTEGER;

/** Largest KB figure the resizer link is offered for (100 MB): well past any form limit. */
const MAX_LINK_KB = 100_000;

export type Parsed = { ok: true; value: number } | { ok: false; reason: 'empty' | 'invalid' };

/** Reads what a person typed: digits with an optional decimal point, and optional thousands commas in groups of three. */
export function parseAmount(text: string): Parsed {
  const t = text.trim();
  if (t === '') return { ok: false, reason: 'empty' };
  const grouped = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t);
  if (!grouped && !/^(\d+(\.\d+)?|\.\d+)$/.test(t)) return { ok: false, reason: 'invalid' };
  const value = Number(grouped ? t.replace(/,/g, '') : t);
  return Number.isFinite(value) ? { ok: true, value } : { ok: false, reason: 'invalid' };
}

export interface Figure { /** The amount in the chosen unit. */ value: number; /** The same size in bytes. */ bytes: number }
export type Converted = { ok: true; decimal: Figure; binary: Figure } | { ok: false; reason: 'too-large' };

const power = (unit: Unit): number => UNITS.indexOf(unit);
/** Removes binary floating-point noise (100.00000000000001 becomes 100) without losing real digits. */
const clean = (n: number): number => Number(n.toPrecision(15));

/** Converts `value` of `from` into `to` in both conventions. */
export function convert(value: number, from: Unit, to: Unit): Converted {
  const side = (base: number): Figure => {
    const bytes = clean(value * base ** power(from));
    return { bytes, value: clean(bytes / base ** power(to)) };
  };
  const decimal = side(1000), binary = side(1024);
  if (!(decimal.bytes <= MAX_BYTES) || !(binary.bytes <= MAX_BYTES)) return { ok: false, reason: 'too-large' };
  return { ok: true, decimal, binary };
}

/** Digits grouped by thousands, at most six decimal places, no trailing zeros, never exponent form. */
export function formatAmount(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 6, useGrouping: true });
}

/** Link to the resizer with the size filled in, as whole KB of 1,000 bytes (rounded down). Null when it would be under 1 KB or unreasonably large. */
export function resizerHref(bytes: number): string | null {
  const kb = Math.floor(bytes / 1000);
  return kb >= 1 && kb <= MAX_LINK_KB ? `/?max=${kb}` : null;
}
