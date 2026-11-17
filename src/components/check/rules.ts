import type { SniffKind } from '../tool/sniff';
import { formatSize } from '../tool/format';

/** `kind` is null for a type SizeTune cannot measure (HEIC, PDF, ...): then `label` names it and the pixels are unknown. */
export interface Facts { kind: SniffKind | null; label?: string; bytes: number; width: number | null; height: number | null }
export interface Rules { minKb?: number; maxKb?: number; minW?: number; maxW?: number; minH?: number; maxH?: number; types: SniffKind[] }
export type RuleField = 'minKb' | 'maxKb' | 'minW' | 'maxW' | 'minH' | 'maxH';
export type RuleInput = Record<RuleField, string>;
export type Status = 'pass' | 'fail' | 'borderline';
export interface RuleResult { id: string; label: string; status: Status; measured: string; expected: string; note?: string }

const PLAIN = /^\d{1,6}(\.\d{1,2})?$/;
const LABEL: Record<SniffKind, string> = { jpeg: 'JPEG', png: 'PNG', webp: 'WebP' };

export function parseRules(raw: RuleInput, types: SniffKind[]): { ok: true; rules: Rules } | { ok: false; errors: Partial<Record<RuleField, string>> } {
  const errors: Partial<Record<RuleField, string>> = {};
  const num = (f: RuleField): number | undefined => {
    const t = raw[f].trim();
    if (t === '') return undefined;
    const n = Number(t);
    if (!PLAIN.test(t) || !Number.isFinite(n) || n <= 0) { errors[f] = 'Enter a plain number above zero, such as 50 or 35.5.'; return undefined; }
    return n;
  };
  const rules: Rules = { minKb: num('minKb'), maxKb: num('maxKb'), minW: num('minW'), maxW: num('maxW'), minH: num('minH'), maxH: num('maxH'), types };
  if (rules.minKb !== undefined && rules.maxKb !== undefined && rules.minKb > rules.maxKb) errors.minKb = 'The minimum is above the maximum.';
  if (rules.minW !== undefined && rules.maxW !== undefined && rules.minW > rules.maxW) errors.minW = 'The minimum is above the maximum.';
  if (rules.minH !== undefined && rules.maxH !== undefined && rules.minH > rules.maxH) errors.minH = 'The minimum is above the maximum.';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, rules };
}

const px = (n: number) => `${new Intl.NumberFormat('en-US').format(n)} px`;

/**
 * Pass or fail per rule the user entered. A kilobyte is 1,000 bytes on some portals and 1,024 on others, so a size that
 * passes under only one reading is reported as "borderline" instead of a silent pass.
 */
export function evaluate(f: Facts, r: Rules): RuleResult[] {
  const out: RuleResult[] = [];
  const kb = formatSize(f.bytes);
  const name = f.label ?? (f.kind ? LABEL[f.kind] : 'Unknown');
  if (r.types.length) {
    out.push({ id: 'type', label: 'File type', status: f.kind && r.types.includes(f.kind) ? 'pass' : 'fail', measured: name, expected: r.types.map((t) => LABEL[t]).join(' or ') });
  }
  if (r.minKb !== undefined) {
    const strict = r.minKb * 1024;
    const loose = r.minKb * 1000;
    out.push({ id: 'min-size', label: 'Minimum size', status: f.bytes >= strict ? 'pass' : f.bytes >= loose ? 'borderline' : 'fail', measured: kb, expected: `at least ${r.minKb} KB`, note: f.bytes < strict && f.bytes >= loose ? 'Passes if the portal counts 1 KB as 1,000 bytes, fails if it counts 1,024.' : undefined });
  }
  if (r.maxKb !== undefined) {
    const strict = r.maxKb * 1000;
    const loose = r.maxKb * 1024;
    out.push({ id: 'max-size', label: 'Maximum size', status: f.bytes <= strict ? 'pass' : f.bytes <= loose ? 'borderline' : 'fail', measured: kb, expected: `at most ${r.maxKb} KB`, note: f.bytes > strict && f.bytes <= loose ? 'Passes if the portal counts 1 KB as 1,024 bytes, fails if it counts 1,000.' : undefined });
  }
  const dim = (id: string, label: string, v: number, min: number | undefined, max: number | undefined) => {
    if (min !== undefined) out.push({ id: `min-${id}`, label: `Minimum ${label}`, status: v >= min ? 'pass' : 'fail', measured: px(v), expected: `at least ${px(min)}` });
    if (max !== undefined) out.push({ id: `max-${id}`, label: `Maximum ${label}`, status: v <= max ? 'pass' : 'fail', measured: px(v), expected: `at most ${px(max)}` });
  };
  if (f.width !== null && f.height !== null) {
    dim('width', 'width', f.width, r.minW, r.maxW);
    dim('height', 'height', f.height, r.minH, r.maxH);
  }
  return out;
}

/** Link into the resizer carrying the size target. The picture itself cannot travel between pages, and pixel rules are not carried. */
export function resizerHref(r: Rules): string {
  const q = new URLSearchParams();
  if (r.maxKb !== undefined) q.set('max', String(r.maxKb));
  if (r.minKb !== undefined) q.set('min', String(r.minKb));
  const s = q.toString();
  return s ? `/?${s}` : '/';
}

