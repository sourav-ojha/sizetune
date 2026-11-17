import { describe, it, expect } from 'vitest';
import { evaluate, parseRules, resizerHref, type Facts } from '../src/components/check/rules';
import { readDpi } from '../src/components/check/dpi';
import { realType } from '../src/components/check/type';

const facts = (over: Partial<Facts> = {}): Facts => ({ kind: 'jpeg', bytes: 30 * 1000, width: 600, height: 800, ...over });
const rules = (f: Record<string, string>, types: string[] = []) => {
  const r = parseRules({ minKb: '', maxKb: '', minW: '', maxW: '', minH: '', maxH: '', ...f }, types as never);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.rules;
};

describe('real file type from bytes (FEATURE-008 AC-1)', () => {
  it('reports the contents, not the extension', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    expect(realType(jpeg)).toEqual({ kind: 'jpeg', label: 'JPEG' });
    expect(realType(new TextEncoder().encode('GIF89a......')).label).toBe('GIF');
    expect(realType(new TextEncoder().encode('%PDF-1.7 ....')).label).toBe('PDF');
    expect(realType(new Uint8Array([1, 2, 3, 4])).kind).toBeNull();
  });
});

describe('rule evaluation (AC-3)', () => {
  it('20 to 50 KB: a 30 KB file passes, a 60 KB file fails with the measured value', () => {
    const r = rules({ minKb: '20', maxKb: '50' });
    expect(evaluate(facts({ bytes: 30 * 1000 }), r).every((x) => x.status === 'pass')).toBe(true);
    const bad = evaluate(facts({ bytes: 60 * 1000 }), r).find((x) => x.id === 'max-size')!;
    expect(bad.status).toBe('fail');
    expect(bad.measured).toMatch(/58\.6 KB|60,000 bytes/);
  });

  it('a file between 1,000 and 1,024 bytes per KB is borderline, not a silent pass', () => {
    const r = rules({ maxKb: '50' });
    expect(evaluate(facts({ bytes: 50_500 }), r)[0].status).toBe('borderline');
    expect(evaluate(facts({ bytes: 50_001 }), r)[0].status).toBe('borderline');
    expect(evaluate(facts({ bytes: 51_300 }), r)[0].status).toBe('fail');
  });

  it('pixel ranges and accepted types are checked', () => {
    const r = rules({ minW: '300', maxW: '500', maxH: '1000' }, ['png']);
    const out = evaluate(facts(), r);
    expect(out.find((x) => x.id === 'max-width')!.status).toBe('fail');
    expect(out.find((x) => x.id === 'type')!.status).toBe('fail');
    expect(out.find((x) => x.id === 'max-height')!.status).toBe('pass');
  });

  it('no rules entered gives no verdict rows', () => {
    expect(evaluate(facts(), rules({}))).toEqual([]);
  });

  it('rejects nonsense input', () => {
    expect(parseRules({ minKb: 'abc', maxKb: '', minW: '', maxW: '', minH: '', maxH: '' }, []).ok).toBe(false);
    expect(parseRules({ minKb: '60', maxKb: '50', minW: '', maxW: '', minH: '', maxH: '' }, []).ok).toBe(false);
  });
});

describe('resizer hand-off (AC-4)', () => {
  it('carries the size target to the home page tool', () => {
    expect(resizerHref(rules({ minKb: '20', maxKb: '50' }))).toBe('/?max=50&min=20');
    expect(resizerHref(rules({ maxKb: '50' }))).toBe('/?max=50');
    expect(resizerHref(rules({ maxW: '500' }))).toBe('/');
  });
});

const jfif = (units: number, x: number, y: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, units, x >> 8, x & 255, y >> 8, y & 255, 0, 0]);
const png = (unit: number, ppx: number, ppy: number) => {
  const b: number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 0, 0, 0, 0];
  const be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  return new Uint8Array([...b, 0, 0, 0, 9, 0x70, 0x48, 0x59, 0x73, ...be(ppx), ...be(ppy), unit, 0, 0, 0, 0, 0, 0, 0, 0, 0x49, 0x44, 0x41, 0x54]);
};

describe('DPI reading (AC-6)', () => {
  it('reads JFIF dots per inch and per centimetre', () => {
    expect(readDpi(jfif(1, 72, 72))).toEqual({ x: 72, y: 72 });
    expect(readDpi(jfif(2, 118, 118))).toEqual({ x: 300, y: 300 });
  });
  it('treats JFIF aspect-ratio-only density as not present', () => {
    expect(readDpi(jfif(0, 1, 1))).toBeNull();
  });
  it('reads PNG pHYs in pixels per metre', () => {
    expect(readDpi(png(1, 11811, 11811))).toEqual({ x: 300, y: 300 });
  });
  it('returns null when the file carries no density, never a guess', () => {
    expect(readDpi(new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 3, 0]))).toBeNull();
    expect(readDpi(png(0, 100, 100))).toBeNull();
  });
});
