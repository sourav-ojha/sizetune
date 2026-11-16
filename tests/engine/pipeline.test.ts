import { describe, it, expect, vi } from 'vitest';
import { runPipeline } from '../../src/lib/engine/pipeline';
import { fakeEnv, base, jpg, png } from './fake-env';
import { EngineError } from '../../src/lib/engine/types';
import { webpVp8, asciiBytes } from './bytes';
import { resolveFormat, planDecode } from '../../src/lib/engine/plan';
import { resolveGeometry } from '../../src/lib/engine/dims';
import { DEFAULT_LIMITS } from '../../src/lib/engine/limits';

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
    expect(r.notes.join(' ')).toMatch(/opened at reduced size/);
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

describe('runPipeline: pixel-reduction disclosure (UX-3)', () => {
  it('says so when free dimensions shrank the picture to under half its size per side', async () => {
    const r = await runPipeline(jpg(4000, 3000), { ...base, maxKb: 5 }, fakeEnv().env);
    expect(r.status).toBe('ok');
    expect(r.width).toBeLessThan(2000);
    expect(r.notes.some((n) => /reduced from 4000×3000 px to \d+×\d+ px/i.test(n))).toBe(true);
  });
  it('stays quiet when the picture keeps most of its pixels, or the user chose the dimensions', async () => {
    const a = await runPipeline(jpg(1000, 800), { ...base, maxKb: 900 }, fakeEnv().env);
    expect(a.notes.some((n) => /reduced from/i.test(n))).toBe(false);
    const b = await runPipeline(jpg(4000, 3000), { ...base, width: 400, height: 300 }, fakeEnv().env);
    expect(b.notes.some((n) => /reduced from/i.test(n))).toBe(false);
  });
});

describe('runPipeline: shrunk note ignores a plain crop (review M1)', () => {
  it('a crop that is output at its own size is not "reduced"', async () => {
    const r = await runPipeline(jpg(4000, 3000), { ...base, crop: { x: 100, y: 100, width: 800, height: 300 } }, fakeEnv().env);
    expect(r.status).toBe('ok');
    expect(r.notes.some((n) => /reduced from/i.test(n))).toBe(false);
  });
});

describe('runPipeline: quality note (IMG-2)', () => {
  it('does not claim quality "had to go down" when the user chose the quality', async () => {
    const r = await runPipeline(jpg(1000, 800), { ...base, quality: 30 }, fakeEnv().env);
    expect(r.notes.some((n) => /had to go down/i.test(n))).toBe(false);
  });
});

describe('runPipeline: reduction note names its real cause (ST-002)', () => {
  const sizeLimitNote = (notes: string[]) => notes.some((n) => /to reach your size limit/i.test(n));
  it('no limit on a huge photo: working-size note only, never "size limit"', async () => {
    const r = await runPipeline(jpg(8000, 6000), { ...base }, fakeEnv().env);
    expect(r.width).toBeLessThan(4000);
    expect(sizeLimitNote(r.notes)).toBe(false);
    expect(r.notes.some((n) => /opened at reduced size/i.test(n))).toBe(true);
  });
  it('huge PNG that fits the limit anyway: memory-cap note, not "size limit"', async () => {
    const r = await runPipeline(png(7000, 6000), { ...base, maxKb: 30000 }, fakeEnv().env);
    expect(r.width).toBeLessThan(3500);
    expect(sizeLimitNote(r.notes)).toBe(false);
    expect(r.notes.some((n) => /opened at reduced size/i.test(n))).toBe(true);
  });
  it('max width 400: says it was the maximum width/height', async () => {
    const r = await runPipeline(jpg(4000, 3000), { ...base, maxWidth: 400 }, fakeEnv().env);
    expect(r.width).toBe(400);
    expect(sizeLimitNote(r.notes)).toBe(false);
    expect(r.notes.some((n) => /maximum width\/height/i.test(n))).toBe(true);
  });
  it('a size target that really forced the scaling still gets the size-limit note', async () => {
    const r = await runPipeline(jpg(3000, 2000), { ...base, maxKb: 30 }, fakeEnv({ complexity: 8 }).env);
    expect(r.status).toBe('ok');
    expect(sizeLimitNote(r.notes)).toBe(true);
  });
});

describe('runPipeline: failed enlarge message matches the downloadable file (ST-007)', () => {
  it('reports the enlarged output size, not the 1x probe', async () => {
    const r = await runPipeline(jpg(120, 80), { ...base, minKb: 20, allowEnlarge: true }, fakeEnv({ complexity: 0.02 }).env);
    expect(r.status).toBe('below_min');
    expect(r.width).toBeGreaterThan(120);
    expect(r.message).toContain(`${r.width}×${r.height} px`);
    expect(r.message).toContain(r.bytes.toLocaleString('en-US'));
    expect(r.message).toMatch(/enlarg/i);
    expect(r.message).not.toContain('120×80');
  });
});

describe('runPipeline: combined causes (ST-002 verifier follow-up)', () => {
  it('max width + size target: max-dims note first, size-limit note measured from the post-cap size, no contradiction', async () => {
    const r = await runPipeline(jpg(4000, 3000), { ...base, maxWidth: 800, maxKb: 8 }, fakeEnv({ complexity: 8 }).env);
    const iMax = r.notes.findIndex((n) => /maximum width\/height/.test(n));
    const iSize = r.notes.findIndex((n) => /to reach your size limit/.test(n));
    expect(iMax).toBeGreaterThanOrEqual(0);
    expect(iSize).toBeGreaterThan(iMax);
    expect(r.notes[iSize]).toContain('from 800×600 px');
  });
  it('a huge PNG shrunk far below the working size by the target: size-limit note quotes the original, no memory note (ST-016)', async () => {
    const r = await runPipeline(png(7000, 6000), { ...base, maxKb: 200 }, fakeEnv().env);
    expect(r.notes.some((n) => /opened at reduced size/i.test(n))).toBe(false);
    expect(r.notes.some((n) => /reduced from 7000×6000 px/i.test(n))).toBe(true);
  });
});

describe('runPipeline: max width on a huge photo (ST-002 re-verification)', () => {
  it('names the maximum width even when the decode was also reduced', async () => {
    const r = await runPipeline(jpg(8000, 6000), { ...base, maxWidth: 400 }, fakeEnv().env);
    expect(r.width).toBe(400);
    expect(r.notes.some((n) => /maximum width\/height/i.test(n))).toBe(true);
  });
});

describe('runPipeline: failed enlarge message for lossless output (ST-007 re-verification)', () => {
  it('PNG: reports actual dimensions and bytes AND says it was enlarged', async () => {
    const r = await runPipeline(png(120, 80), { ...base, format: 'png', minKb: 20, allowEnlarge: true }, fakeEnv({ complexity: 0.02 }).env);
    expect(r.status).toBe('below_min');
    expect(r.mime).toBe('image/png');
    expect(r.width).toBeGreaterThan(120);
    expect(r.message).toContain(`${r.width}×${r.height} px`);
    expect(r.message).toContain(r.bytes.toLocaleString('en-US'));
    expect(r.message).toMatch(/enlarg/i);
    expect(r.message).not.toContain('120×80');
  });
  it('PNG without enlarging: message unchanged (no enlarge wording, hint kept)', async () => {
    const r = await runPipeline(png(120, 80), { ...base, format: 'png', minKb: 20 }, fakeEnv({ complexity: 0.02 }).env);
    expect(r.status).toBe('below_min');
    expect(r.message).toMatch(/is lossless, so its size depends only on the pixels: at 120×80 px/);
    expect(r.message).toMatch(/allow enlarging/);
    expect(r.message).not.toMatch(/Even after enlarging/);
  });
  it('JPEG without enlarging: message unchanged', async () => {
    const r = await runPipeline(jpg(120, 80), { ...base, minKb: 20 }, fakeEnv({ complexity: 0.02 }).env);
    expect(r.message).toMatch(/at most .* even at maximum quality/);
    expect(r.message).not.toMatch(/enlarg(ed|ing the image to)/);
  });
});

describe('runPipeline: memory note only when the cap limited the output (ST-016)', () => {
  const reducedNote = (n: string[]) => n.some((x) => /opened at reduced size/i.test(x));
  it('8000x6000 JPEG, max width 400: maximum-width note, no memory note', async () => {
    const r = await runPipeline(jpg(8000, 6000), { ...base, maxWidth: 400, maxKb: 200 }, fakeEnv().env);
    expect(r.width).toBe(400);
    expect(r.notes.some((n) => /maximum width\/height/i.test(n))).toBe(true);
    expect(r.notes.some((n) => /reduced from 8000×6000 px to 400×300 px/i.test(n))).toBe(true);
    expect(reducedNote(r.notes)).toBe(false);
  });
  it('6000x4000 at 50 KB: size-limit note quotes the original, no memory note', async () => {
    const r = await runPipeline(jpg(6000, 4000), { ...base, maxKb: 50 }, fakeEnv({ complexity: 8 }).env);
    expect(r.status).toBe('ok');
    const n = r.notes.find((x) => /to reach your size limit/i.test(x));
    expect(n).toContain('reduced from 6000×4000 px');
    expect(reducedNote(r.notes)).toBe(false);
  });
  it('8000x6000 No limit: memory note present', async () => {
    const r = await runPipeline(jpg(8000, 6000), { ...base }, fakeEnv().env);
    expect(reducedNote(r.notes)).toBe(true);
    expect(r.notes.find((x) => /opened at reduced size/i.test(x))).toContain('original 8000×6000 px');
  });
  it('7000x6000 PNG at 200 KB where the output equals the decode size: memory note present', async () => {
    const r = await runPipeline(png(7000, 6000), { ...base, format: 'png', maxKb: 200 }, fakeEnv({ complexity: 0.01 }).env);
    expect(r.status).toBe('ok');
    expect(r.width * r.height).toBeGreaterThan(5_000_000);
    expect(reducedNote(r.notes)).toBe(true);
  });
});

describe('runPipeline: WebP below minimum, q100 is lossless and smaller than q95 (ST-017)', () => {
  const webpOpts = { ...base, format: 'webp' as const, minKb: 20 };
  // Flat image model: q1.0 is lossless and size-independent (520 B); lossy sizes grow with pixels (558 B at 120x80).
  const flatWebp = (n: number, w: number, h: number, q: number | undefined, mime: string) => {
    const size = q === 1 ? 520 : 400 + Math.round(w * h * 0.0165);
    const bytes = new Uint8Array(size);
    bytes.set([...asciiBytes('RIFF'), 0, 0, 0, 0, ...asciiBytes('WEBP')]);
    return new Blob([bytes], { type: mime });
  };
  const env = () => fakeEnv({ webp: true, renderHook: (i) => flatWebp(i.n, i.w, i.h, i.q, i.mime) });
  const webp = (w: number, h: number) => new Blob([webpVp8(w, h) as BlobPart], { type: 'image/webp' });

  it('without enlarge: message quotes the downloaded bytes, not the q100 probe', async () => {
    const r = await runPipeline(webp(120, 80), webpOpts, env().env);
    expect(r.status).toBe('below_min');
    expect([r.width, r.height, r.bytes]).toEqual([120, 80, 558]);
    expect(r.message).toContain('558 bytes');
    expect(r.message).not.toContain('520');
    expect(r.message).toContain('120×80 px');
    expect(r.message).not.toMatch(/even at maximum quality/);
  });
  it('with enlarge: enlarges at the quality used and the message describes the downloaded file', async () => {
    const r = await runPipeline(webp(120, 80), { ...webpOpts, allowEnlarge: true }, env().env);
    expect(r.status).toBe('below_min');
    expect(r.width).toBeGreaterThan(120);
    expect(r.message).toContain(`${r.width}×${r.height} px`);
    expect(r.message).toContain(r.bytes.toLocaleString('en-US'));
    expect(r.message).toMatch(/enlarging/i);
    expect(r.message).not.toContain('520');
  });
});
