import { describe, it, expect } from 'vitest';
import { toPixels, UNITS } from '../src/components/tool/units';
import { buildOptions, defaultForm } from '../src/components/tool/options';

describe('print units (FEATURE-013)', () => {
  it('AC-1: 35 x 45 mm at 300 DPI is about 413 x 531 px', () => {
    expect(toPixels(35, 'mm', 300)).toBe(413);
    expect(toPixels(45, 'mm', 300)).toBe(531);
  });
  it('converts cm and inch and leaves px alone', () => {
    expect(toPixels(3.5, 'cm', 300)).toBe(413);
    expect(toPixels(2, 'in', 300)).toBe(600);
    expect(toPixels(600, 'px', 300)).toBe(600);
  });
  it('never returns less than 1 pixel', () => { expect(toPixels(0.001, 'mm', 72)).toBe(1); });
  it('lists the four units', () => { expect(UNITS.map((u) => u.value)).toEqual(['px', 'cm', 'mm', 'in']); });

  it('buildOptions converts width and height to pixels and carries the DPI', () => {
    const r = buildOptions(defaultForm({ unit: 'mm', dpi: '300', width: '35', height: '45' }));
    expect(r.ok && r.options).toMatchObject({ width: 413, height: 531, dpi: 300 });
  });
  it('accepts decimals in print units but still rejects them in px', () => {
    expect(buildOptions(defaultForm({ unit: 'cm', dpi: '300', width: '3.5' })).ok).toBe(true);
    const bad = buildOptions(defaultForm({ unit: 'px', width: '3.5' }));
    expect(bad.ok).toBe(false);
  });
  it('AC-4: px with no DPI behaves as before (no dpi option, same pixels)', () => {
    const r = buildOptions(defaultForm({ width: '600' }));
    expect(r.ok && r.options).toMatchObject({ width: 600 });
    expect(r.ok && 'dpi' in r.options).toBe(false);
  });
  it('px with a DPI typed writes only the tag', () => {
    const r = buildOptions(defaultForm({ width: '600', dpi: '200' }));
    expect(r.ok && r.options).toMatchObject({ width: 600, dpi: 200 });
  });
  it('a print unit needs a valid DPI; px with a bad DPI is an error too', () => {
    const a = buildOptions(defaultForm({ unit: 'cm', dpi: '', width: '3' }));
    expect(!a.ok && a.errors.dpi).toBeTruthy();
    const b = buildOptions(defaultForm({ unit: 'px', dpi: '0' }));
    expect(!b.ok && b.errors.dpi).toBeTruthy();
    const c = buildOptions(defaultForm({ unit: 'px', dpi: '99999' }));
    expect(!c.ok && c.errors.dpi).toBeTruthy();
  });
  it('a converted size over the engine side limit is a field error', () => {
    const r = buildOptions(defaultForm({ unit: 'in', dpi: '600', width: '40' }));
    expect(!r.ok && r.errors.width).toBeTruthy();
  });
});
