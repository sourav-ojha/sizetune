import { describe, it, expect, vi } from 'vitest';
import { runPipeline } from '../../src/lib/engine/pipeline';
import type { Env, DecodedImage } from '../../src/lib/engine/env';
import { EngineError, type ProcessOptions } from '../../src/lib/engine/types';
import { jpegBytes, pngBytes, webpVp8, asciiBytes } from './bytes';
import { resolveFormat, planDecode } from '../../src/lib/engine/plan';
import { resolveGeometry } from '../../src/lib/engine/dims';
import { DEFAULT_LIMITS } from '../../src/lib/engine/limits';

const MAGIC: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff, 0xe0],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/webp': [...asciiBytes('RIFF'), 0, 0, 0, 0, ...asciiBytes('WEBP')],
};

interface FakeImg extends DecodedImage { closed: boolean; id: number }
interface FakeOpts { alpha?: boolean; webp?: boolean; complexity?: number; decodeDelay?: number; renderDelay?: number; swapOrientation?: boolean; wrongMagic?: boolean; decodeFails?: unknown }

function fakeEnv(o: FakeOpts = {}) {
  const images: FakeImg[] = [];
  const renders: Array<{ w: number; h: number; q?: number; mime: string; fill: string | null; src: { x: number; y: number; width: number; height: number } }> = [];
  let released = 0;
  let decodeArgs: Array<number | undefined> = [];
  const env: Env<FakeImg> = {
    async decode(blob, resizeWidth) {
      decodeArgs.push(resizeWidth);
      if (o.decodeFails) throw o.decodeFails;
      if (o.decodeDelay) await new Promise((r) => setTimeout(r, o.decodeDelay));
      const { readHeader } = await import('../../src/lib/engine/header');
      const h = await readHeader(blob);
      let [w, hh] = o.swapOrientation ? [h.storedWidth, h.storedHeight] : [h.width, h.height];
      if (resizeWidth) { hh = Math.round((hh * resizeWidth) / w); w = resizeWidth; }
      const img: FakeImg = { width: w, height: hh, closed: false, id: images.length, close() { this.closed = true; } };
      images.push(img);
      return img;
    },
    async render(img, src, w, h, fill, mime, quality) {
      if (img.closed) throw new Error('render on closed image');
      renders.push({ w, h, q: quality, mime, fill, src });
      if (o.renderDelay) await new Promise((r) => setTimeout(r, o.renderDelay));
      const q = quality ?? 1;
      const bpp = mime === 'image/png' ? 1.5 : 0.03 + 0.5 * Math.pow(q, 3.5);
      const n = Math.max(20, Math.round(400 + w * h * bpp * (o.complexity ?? 1)));
      const bytes = new Uint8Array(n);
      bytes.set(o.wrongMagic ? MAGIC['image/png'] : MAGIC[mime]);
      return new Blob([bytes], { type: o.wrongMagic ? 'image/png' : mime });
    },
    async hasAlpha() { return !!o.alpha; },
    async canEncode(mime) { return mime === 'image/webp' ? !!o.webp : true; },
    release() { released++; },
  };
  return { env, images, renders, get released() { return released; }, decodeArgs };
}

const base: ProcessOptions = { format: 'jpeg', strategy: 'quality-first', lockAspect: true, fit: 'contain', background: 'white' };
const jpg = (w: number, h: number, extra: Parameters<typeof jpegBytes>[0] | object = {}) => new Blob([jpegBytes({ width: w, height: h, ...extra }) as BlobPart], { type: 'image/jpeg' });
const png = (w: number, h: number, colorType = 6) => new Blob([pngBytes({ width: w, height: h, colorType }) as BlobPart], { type: 'image/png' });

describe('runPipeline: validation before decoding', () => {
  it('rejects by magic bytes, not MIME (SVG labelled image/png)', async () => {
    const f = fakeEnv();
    const svg = new File([asciiBytes('<svg xmlns="http://www.w3.org/2000/svg"/>') as BlobPart], 'a.png', { type: 'image/png' });
    await expect(runPipeline(svg, base, f.env)).rejects.toMatchObject({ code: 'unsupported_type' });
    expect(f.images.length).toBe(0);
  });
  it('too_large_bytes and too_many_pixels are decided before any decode', async () => {
    const f = fakeEnv();
    await expect(runPipeline(jpg(100, 100), base, f.env, {}, { limits: { maxFileBytes: 10 } })).rejects.toMatchObject({ code: 'too_large_bytes' });
    await expect(runPipeline(jpg(12000, 9000), base, f.env)).rejects.toMatchObject({ code: 'too_many_pixels' });
    expect(f.images.length).toBe(0);
  });
  it('invalid options (padding) rejected', async () => {
    await expect(runPipeline(jpg(10, 10), { ...base, allowPadding: true as unknown as false }, fakeEnv().env)).rejects.toMatchObject({ code: 'invalid_options' });
  });
  it('maps decode failure to corrupt and RangeError to out_of_memory; releases resources', async () => {
    const a = fakeEnv({ decodeFails: new DOMException('The source image could not be decoded.', 'InvalidStateError') });
    await expect(runPipeline(jpg(10, 10), base, a.env)).rejects.toMatchObject({ code: 'corrupt' });
    expect(a.released).toBe(1);
    const b = fakeEnv({ decodeFails: new RangeError('Array buffer allocation failed') });
    await expect(runPipeline(jpg(10, 10), base, b.env)).rejects.toMatchObject({ code: 'out_of_memory' });
  });
});

describe('runPipeline: results', () => {
  it('max target: ok, bytes === blob.size, window reported, bitmap closed, canvas released', async () => {
    const f = fakeEnv();
    const r = await runPipeline(jpg(3000, 2000), { ...base, maxKb: 50 }, f.env);
    expect(r.status).toBe('ok');
    expect(r.bytes).toBe(r.blob.size);
    expect(r.bytes).toBeLessThanOrEqual(50_000);
    expect(r.window).toEqual({ minBytes: null, maxBytes: 50_000 });
    expect(r.mime).toBe('image/jpeg');
    expect(r.attempts).toBeLessThanOrEqual(20);
    expect(f.images.every((i) => i.closed)).toBe(true);
    expect(f.released).toBe(1);
    expect(r.message).toMatch(/under the 50 KB limit/);
  });
  it('EXIF orientation 6: source dims swapped (header), output portrait', async () => {
    const f = fakeEnv();
    const r = await runPipeline(jpg(400, 300, { orientation: 6 }), { ...base }, f.env);
    expect(r.source).toMatchObject({ width: 300, height: 400, orientationApplied: true });
    expect([r.width, r.height]).toEqual([300, 400]);
  });
  it('browser that does not apply orientation: trusts the bitmap and discloses', async () => {
    const f = fakeEnv({ swapOrientation: true });
    const r = await runPipeline(jpg(400, 300, { orientation: 6 }), { ...base }, f.env);
    expect(r.source.orientationApplied).toBe(false);
    expect([r.width, r.height]).toEqual([400, 300]);
    expect(r.notes.join(' ')).toMatch(/rotation/);
  });
  it('large source decodes at reduced size (resizeWidth only, aspect kept) and discloses when dims stay at working size', async () => {
    const f = fakeEnv();
    const r = await runPipeline(jpg(8000, 6000), { ...base }, f.env);
    expect(f.decodeArgs[0]).toBeDefined();
    const [w, h] = [r.width, r.height];
    expect(w * h).toBeLessThanOrEqual(6_000_000 * 1.01);
    expect(Math.abs(w / h - 8000 / 6000)).toBeLessThan(0.01);
    expect(r.notes.join(' ')).toMatch(/processed at/);
    // small source: full decode
    const g = fakeEnv();
    await runPipeline(jpg(3000, 2000), { ...base }, g.env);
    expect(g.decodeArgs[0]).toBeUndefined();
  });
  it('alpha input + JPEG: fills with chosen background and adds a disclosure note', async () => {
    const f = fakeEnv({ alpha: true });
    const r = await runPipeline(png(800, 600), { ...base, background: '#ccff00' }, f.env);
    expect(r.mime).toBe('image/jpeg');
    expect(f.renders.every((x) => x.fill === '#ccff00')).toBe(true);
    expect(r.notes).toContain('Transparent areas were filled with the colour #ccff00.');
    expect(r.source.hasAlpha).toBe(true);
  });
  it('alpha input + auto: keeps PNG and transparency (no fill)', async () => {
    const f = fakeEnv({ alpha: true });
    const r = await runPipeline(png(800, 600), { ...base, format: 'auto', background: 'keep', maxKb: 200 }, f.env);
    expect(r.mime).toBe('image/png');
    expect(r.quality).toBeNull();
    expect(f.renders.every((x) => x.fill === null)).toBe(true);
    expect(r.notes.some((n) => /filled/.test(n))).toBe(false);
    expect(r.message).toMatch(/lossless/);
  });
  it('opaque PNG + auto + size target: stays PNG, message says pixels shrink, note suggests JPEG', async () => {
    const r = await runPipeline(png(1200, 800, 2), { ...base, format: 'auto', maxKb: 100 }, fakeEnv().env);
    expect(r.mime).toBe('image/png');
    expect(r.width).toBeLessThan(1200);
    expect(r.message).toMatch(/lossless, so the size was reached by reducing the pixel dimensions only/);
    expect(r.notes).toContain('PNG is lossless, so only the pixel dimensions could shrink. JPEG would keep more pixels at this size.');
    const alpha = await runPipeline(png(1200, 800, 6), { ...base, format: 'auto', background: 'keep', maxKb: 100 }, fakeEnv({ alpha: true }).env);
    expect(alpha.notes.some((n) => /JPEG would keep/.test(n))).toBe(false); // JPEG would lose transparency: no hint
  });
  it('opaque PNG (colour type 2): no alpha scan needed', async () => {
    const f = fakeEnv({ alpha: true });
    const spy = vi.spyOn(f.env, 'hasAlpha');
    const r = await runPipeline(png(80, 60, 2), base, f.env);
    expect(spy).not.toHaveBeenCalled();
    expect(r.source.hasAlpha).toBe(false);
  });
  it('WebP requested but unsupported -> encode_unsupported; auto with WebP input falls back with a note', async () => {
    await expect(runPipeline(jpg(100, 100), { ...base, format: 'webp' }, fakeEnv({ webp: false }).env)).rejects.toMatchObject({ code: 'encode_unsupported' });
    const r = await runPipeline(new Blob([webpVp8(100, 100) as BlobPart]), { ...base, format: 'auto' }, fakeEnv({ webp: false }).env);
    expect(r.mime).toBe('image/jpeg');
    expect(r.notes.join(' ')).toMatch(/WebP can't be saved in this browser/);
    const ok = await runPipeline(new Blob([webpVp8(100, 100) as BlobPart]), { ...base, format: 'auto' }, fakeEnv({ webp: true }).env);
    expect(ok.mime).toBe('image/webp');
  });
  it('encoder returning the wrong format (magic mismatch) -> encode_unsupported, never a mislabelled result', async () => {
    await expect(runPipeline(jpg(100, 100), base, fakeEnv({ wrongMagic: true }).env)).rejects.toMatchObject({ code: 'encode_unsupported' });
  });
  it('crop: source rect in oriented pixels mapped to the bitmap', async () => {
    const f = fakeEnv();
    const r = await runPipeline(jpg(1200, 800), { ...base, crop: { x: 100, y: 50, width: 600, height: 200 } }, f.env);
    expect([r.width, r.height]).toEqual([600, 200]);
    expect(f.renders[0].src).toEqual({ x: 100, y: 50, width: 600, height: 200 });
  });
  it('below_min with a real explanation; raised quality message', async () => {
    const tiny = await runPipeline(png(140, 60, 2), { ...base, width: 140, height: 60, minKb: 10, maxKb: 20 }, fakeEnv({ complexity: 0.05 }).env);
    expect(tiny.status).toBe('below_min');
    expect(tiny.message).toMatch(/^At 140×60 px this image is at most .* even at maximum quality, so the 10 KB minimum \(10,240 bytes\) cannot be met at these dimensions\./);
  });
  it('progress hooks report reading/decoding/encoding with attempt counts', async () => {
    const stages: string[] = [];
    await runPipeline(jpg(3000, 2000), { ...base, maxKb: 50 }, fakeEnv().env, { onProgress: (p) => stages.push(p.stage + (p.attempt ?? '')) });
    expect(stages[0]).toBe('reading');
    expect(stages[1]).toBe('decoding');
    expect(stages[2]).toBe('encoding1');
  });
});

describe('runPipeline: cancellation and timeout', () => {
  it('abort mid-search rejects cancelled promptly and closes the bitmap', async () => {
    const f = fakeEnv({ renderDelay: 30 });
    const ac = new AbortController();
    const p = runPipeline(jpg(3000, 2000), { ...base, maxKb: 50 }, f.env, { signal: ac.signal, onProgress: (x) => { if (x.attempt === 3) setTimeout(() => ac.abort(), 5); } });
    const t = Date.now();
    await expect(p).rejects.toMatchObject({ code: 'cancelled' });
    expect(Date.now() - t).toBeLessThan(1000);
    expect(f.renders.length).toBeLessThanOrEqual(4);
    expect(f.images.every((i) => i.closed)).toBe(true);
    expect(f.released).toBe(1);
  });
  it('abort during a slow decode: rejects at once; the late bitmap is closed when it arrives', async () => {
    const f = fakeEnv({ decodeDelay: 80 });
    const ac = new AbortController();
    const p = runPipeline(jpg(300, 200), base, f.env, { signal: ac.signal });
    setTimeout(() => ac.abort(), 10);
    await expect(p).rejects.toBeInstanceOf(EngineError);
    await new Promise((r) => setTimeout(r, 120));
    expect(f.images.length).toBe(1);
    expect(f.images[0].closed).toBe(true);
  });
  it('already-aborted signal rejects without decoding', async () => {
    const f = fakeEnv();
    const ac = new AbortController(); ac.abort();
    await expect(runPipeline(jpg(30, 20), base, f.env, { signal: ac.signal })).rejects.toMatchObject({ code: 'cancelled' });
    expect(f.images.length).toBe(0);
  });
  it('timeout -> EngineError timeout', async () => {
    const f = fakeEnv({ renderDelay: 50 });
    await expect(runPipeline(jpg(3000, 2000), { ...base, maxKb: 50 }, f.env, {}, { limits: { timeoutMs: 120 } })).rejects.toMatchObject({ code: 'timeout' });
    expect(f.images.every((i) => i.closed)).toBe(true);
  });
});

describe('plan: format resolution', () => {
  it('auto keeps input format; alpha keeps alpha; JPEG+alpha discloses', () => {
    expect(resolveFormat('auto', 'image/jpeg', false, 'white', true).mime).toBe('image/jpeg');
    expect(resolveFormat('auto', 'image/png', true, 'white', true)).toMatchObject({ mime: 'image/png', fill: null, notes: [] });
    expect(resolveFormat('auto', 'image/webp', true, 'white', false)).toMatchObject({ mime: 'image/png', fill: null });
    expect(resolveFormat('auto', 'image/webp', false, 'white', false).mime).toBe('image/jpeg');
    expect(resolveFormat('auto', 'image/png', false, 'white', true).mime).toBe('image/png'); // auto never picks WebP for PNG input
    expect(resolveFormat('jpeg', 'image/png', true, 'black', true)).toMatchObject({ mime: 'image/jpeg', fill: '#000000', notes: ['Transparent areas were filled with black.'] });
    expect(resolveFormat('jpeg', 'image/png', false, 'white', true).notes).toEqual([]);
    expect(resolveFormat('png', 'image/png', true, 'keep', true)).toMatchObject({ fill: null, notes: [] });
    expect(() => resolveFormat('webp', 'image/png', true, 'keep', false)).toThrow(EngineError);
  });
});

describe('plan: decode size', () => {
  const g = (w: number, h: number, o = {}) => resolveGeometry(w, h, { lockAspect: true, fit: 'contain', ...o });
  it('<= 12 MP: full decode', () => {
    expect(planDecode(4000, 3000, g(4000, 3000), 0, 50_000, DEFAULT_LIMITS).reduced).toBe(false);
  });
  it('36 MP, 50 KB target: reduced to the goal (between 2 and 6 MP)', () => {
    const p = planDecode(6000, 6000, g(6000, 6000), 0, 50_000, DEFAULT_LIMITS);
    expect(p.reduced).toBe(true);
    expect(p.width * p.height).toBeGreaterThanOrEqual(1_990_000);
    expect(p.width * p.height).toBeLessThanOrEqual(6_000_000);
  });
  it('48 MP, no target: capped at 6 MP', () => {
    const p = planDecode(8000, 6000, g(8000, 6000), 0, Infinity, DEFAULT_LIMITS);
    expect(p.width * p.height).toBeLessThanOrEqual(6_000_000);
    expect(p.width * p.height).toBeGreaterThan(5_900_000);
  });
  it('fixed dims: enough pixels for the requested output, not more', () => {
    const p = planDecode(8000, 6000, g(8000, 6000, { width: 200, height: 150 }), 0, Infinity, DEFAULT_LIMITS);
    expect(p.width).toBe(200);
    const big = planDecode(8000, 6000, g(8000, 6000, { width: 6000 }), 0, Infinity, DEFAULT_LIMITS);
    expect(big.width).toBe(6000); // user asked for 27 MP: allowed above the 6 MP cap
  });
});
