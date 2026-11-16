import { describe, expect, it } from 'vitest';
import { activePreset, backgroundFor, buildOptions, defaultForm, derivedDimension, needsFlattenChoice, parseNumber } from '../../src/components/tool/options';

const ok = (r: ReturnType<typeof buildOptions>) => { if (!r.ok) throw new Error(JSON.stringify(r.errors)); return r.options; };

describe('buildOptions', () => {
  it('builds the default options without inventing dimensions or padding', () => {
    const o = ok(buildOptions(defaultForm({ maxKb: '20' })));
    expect(o).toEqual({ format: 'auto', strategy: 'quality-first', lockAspect: true, fit: 'contain', background: 'keep', maxKb: 20 });
    expect('width' in o || 'height' in o || 'allowPadding' in o || 'quality' in o).toBe(false);
  });
  it('never asks to flatten unless JPEG is chosen', () => {
    for (const format of ['auto', 'png', 'webp'] as const) expect(ok(buildOptions(defaultForm({ format }))).background).toBe('keep');
    expect(ok(buildOptions(defaultForm({ format: 'jpeg' }))).background).toBe('white');
    expect(ok(buildOptions(defaultForm({ format: 'jpeg', bg: 'black' }))).background).toBe('black');
    expect(ok(buildOptions(defaultForm({ format: 'jpeg', bg: 'custom', bgCustom: '#AA00FF' }))).background).toBe('#aa00ff');
  });
  it('rejects a bad custom colour only when it matters', () => {
    expect(buildOptions(defaultForm({ format: 'jpeg', bg: 'custom', bgCustom: 'nope' }))).toMatchObject({ ok: false, errors: { bgCustom: expect.any(String) } });
    expect(buildOptions(defaultForm({ format: 'png', bg: 'custom', bgCustom: 'nope' })).ok).toBe(true);
    expect(backgroundFor({ bg: 'custom', bgCustom: 'x' })).toBeNull();
  });
  it('validates the maximum KB', () => {
    for (const bad of ['0', '-5', 'abc', '1e3', '50001', '0.5']) expect(buildOptions(defaultForm({ maxKb: bad })), bad).toMatchObject({ ok: false, errors: { maxKb: expect.any(String) } });
    expect(ok(buildOptions(defaultForm({ maxKb: '12.5' }))).maxKb).toBe(12.5);
    expect(ok(buildOptions(defaultForm({ maxKb: '1' }))).maxKb).toBe(1);
  });
  it('requires a maximum unless "No limit" is chosen, then sends the fixed quality', () => {
    expect(buildOptions(defaultForm({ maxKb: '' }))).toMatchObject({ ok: false, errors: { maxKb: expect.stringContaining('No limit') } });
    const o = ok(buildOptions(defaultForm({ noLimit: true, quality: 70 })));
    expect(o.maxKb).toBeUndefined();
    expect(o.quality).toBe(70);
    expect(ok(buildOptions(defaultForm({ noLimit: true, format: 'png' }))).quality).toBeUndefined();
    expect(ok(buildOptions(defaultForm({ maxKb: '20', quality: 70 }))).quality).toBeUndefined();
    expect(buildOptions(defaultForm({ noLimit: true, quality: 0 }))).toMatchObject({ ok: false, errors: { quality: expect.any(String) } });
  });
  it('validates the min-max range including the 1000/1024 window', () => {
    expect(ok(buildOptions(defaultForm({ maxKb: '50', minKb: '20' })))).toMatchObject({ minKb: 20, maxKb: 50 });
    expect(buildOptions(defaultForm({ maxKb: '20', minKb: '20' }))).toMatchObject({ ok: false, errors: { minKb: expect.stringContaining('smaller') } });
    expect(buildOptions(defaultForm({ maxKb: '20', minKb: '30' })).ok).toBe(false);
    // 49 KB -> 50,176 bytes > 50 KB -> 50,000 bytes: an empty window
    expect(buildOptions(defaultForm({ maxKb: '50', minKb: '49' }))).toMatchObject({ ok: false, errors: { minKb: expect.stringContaining('50,176') } });
    expect(buildOptions(defaultForm({ maxKb: '50', minKb: '48' })).ok).toBe(true);
    expect(ok(buildOptions(defaultForm({ noLimit: true, minKb: '10' }))).minKb).toBe(10);
  });
  it('validates pixel fields and their consistency', () => {
    expect(buildOptions(defaultForm({ width: '0' }))).toMatchObject({ ok: false, errors: { width: expect.any(String) } });
    expect(buildOptions(defaultForm({ height: '10.5' }))).toMatchObject({ ok: false, errors: { height: expect.any(String) } });
    expect(buildOptions(defaultForm({ maxWidth: '99999' }))).toMatchObject({ ok: false, errors: { maxWidth: expect.any(String) } });
    expect(buildOptions(defaultForm({ width: '800', maxWidth: '600' }))).toMatchObject({ ok: false, errors: { width: expect.any(String) } });
    expect(buildOptions(defaultForm({ height: '800', maxHeight: '600' }))).toMatchObject({ ok: false, errors: { height: expect.any(String) } });
    expect(ok(buildOptions(defaultForm({ width: '400', maxHeight: '300' })))).toMatchObject({ width: 400, maxHeight: 300 });
  });
  it('accepts separators and units, and rejects guesses', () => {
    expect(ok(buildOptions(defaultForm({ maxKb: '20 KB' }))).maxKb).toBe(20);
    expect(ok(buildOptions(defaultForm({ maxKb: '20kb' }))).maxKb).toBe(20);
    expect(ok(buildOptions(defaultForm({ maxKb: '1,000' }))).maxKb).toBe(1000);
    expect(ok(buildOptions(defaultForm({ maxKb: '1 000 KB' }))).maxKb).toBe(1000);
    expect(ok(buildOptions(defaultForm({ width: '1,200 px' }))).width).toBe(1200);
    expect(ok(buildOptions(defaultForm({ width: '300PX' }))).width).toBe(300);
    for (const bad of ['1,5', '20 MB', 'KB', '1,00', '2,0000', '20 px']) expect(buildOptions(defaultForm({ maxKb: bad })), bad).toMatchObject({ ok: false });
    expect(buildOptions(defaultForm({ width: '20 KB' }))).toMatchObject({ ok: false, errors: { width: expect.stringContaining('whole number') } });
    expect(buildOptions(defaultForm({ maxKb: 'abc' }))).toMatchObject({ errors: { maxKb: expect.stringContaining('“20 KB”') } });
    expect(parseNumber('1,000', null)).toEqual({ kind: 'ok', value: 1000 });
    expect(activePreset('50 KB')).toBe(50);
  });
  it('maps fit/aspect: fit only matters with both dimensions', () => {
    expect(ok(buildOptions(defaultForm({ width: '400', height: '300', fit: 'cover' })))).toMatchObject({ fit: 'cover', lockAspect: true });
    expect(ok(buildOptions(defaultForm({ width: '400', height: '300', fit: 'cover', lockAspect: false })))).toMatchObject({ fit: 'stretch', lockAspect: false });
    expect(ok(buildOptions(defaultForm({ width: '400', fit: 'cover' }))).fit).toBe('contain');
  });
  it('passes strategy and crop through (copying the crop)', () => {
    const crop = { x: 1, y: 2, width: 30, height: 40 };
    const o = ok(buildOptions(defaultForm({ strategy: 'dimensions-first' }), { crop }));
    expect(o.strategy).toBe('dimensions-first');
    expect(o.crop).toEqual(crop);
    expect(o.crop).not.toBe(crop);
  });
  it('sends allowEnlarge only with a minimum and free dimensions', () => {
    expect(ok(buildOptions(defaultForm({ minKb: '10', maxKb: '50', allowEnlarge: true }))).allowEnlarge).toBe(true);
    expect(ok(buildOptions(defaultForm({ maxKb: '50', allowEnlarge: true }))).allowEnlarge).toBeUndefined();
    expect(ok(buildOptions(defaultForm({ minKb: '10', maxKb: '50', allowEnlarge: true, width: '300' }))).allowEnlarge).toBeUndefined();
  });
  it('collects every error at once', () => {
    const r = buildOptions(defaultForm({ maxKb: 'x', width: '-1', height: '0' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['height', 'maxKb', 'width']);
  });
});

describe('helpers', () => {
  it('parseNumber', () => {
    expect(parseNumber('')).toEqual({ kind: 'empty' });
    expect(parseNumber(' 12.5 ')).toEqual({ kind: 'ok', value: 12.5 });
    expect(parseNumber('1e3')).toEqual({ kind: 'bad' });
    expect(parseNumber('-1')).toEqual({ kind: 'bad' });
  });
  it('activePreset', () => {
    expect(activePreset('20')).toBe(20);
    expect(activePreset('20.0')).toBe(20);
    expect(activePreset('25')).toBeNull();
    expect(activePreset('')).toBeNull();
  });
  it('derivedDimension keeps the source ratio', () => {
    expect(derivedDimension('300', 600, 400, 'height')).toBe(200);
    expect(derivedDimension('200', 600, 400, 'width')).toBe(300);
    expect(derivedDimension('', 600, 400, 'height')).toBeNull();
    expect(derivedDimension('5', 0, 400, 'height')).toBeNull();
    expect(derivedDimension('1', 1000, 1, 'height')).toBe(1);
  });
  it('flatten choice only for JPEG with alpha', () => {
    expect(needsFlattenChoice('jpeg', true)).toBe(true);
    expect(needsFlattenChoice('jpeg', false)).toBe(false);
    expect(needsFlattenChoice('jpeg', null)).toBe(false);
    expect(needsFlattenChoice('auto', true)).toBe(false);
    expect(needsFlattenChoice('png', true)).toBe(false);
  });
});
