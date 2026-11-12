/** Regression tests for the independent engine review (F1–F12). Each was written to fail before its fix. */
import { describe, it, expect } from 'vitest';
import { runPipeline } from '../../src/lib/engine/pipeline';
import { normalizeOptions } from '../../src/lib/engine/options';
import { resolveFormat } from '../../src/lib/engine/plan';
import { DEFAULT_LIMITS, MAX_OUTPUT_PIXELS } from '../../src/lib/engine/limits';
import { fitSearch, type SearchEncoder } from '../../src/lib/engine/search';
import { buildMessage } from '../../src/lib/engine/messages';
import { stripIccProfile, iccIsSrgb } from '../../src/lib/engine/jpeg';
import { fakeEnv, base, jpg, png, MAGIC } from './fake-env';
import { jpegBytes, iccProfile, app2Icc } from './bytes';
import type { ProcessOptions } from '../../src/lib/engine/types';

describe('F1/F3: output limits apply to the RESOLVED geometry', () => {
  it('default output cap is 16 MP (iOS canvas ceiling), a named constant', () => {
    expect(MAX_OUTPUT_PIXELS).toBe(16_000_000);
    expect(DEFAULT_LIMITS.maxOutputPixels).toBe(MAX_OUTPUT_PIXELS);
  });
  it('one side given with a derived other side above maxSide -> invalid_options before decoding', async () => {
    const f = fakeEnv();
    // 100×10000 source, width 16384 => derived height 1,638,400 px
    await expect(runPipeline(jpg(100, 10000), { ...base, width: 16384 }, f.env)).rejects.toMatchObject({ code: 'invalid_options' });
    expect(f.images.length).toBe(0);
  });
  it('derived product above 16 MP -> invalid_options with a clear message', async () => {
    const e = await runPipeline(jpg(4000, 3000), { ...base, width: 8000 }, fakeEnv().env).catch((x) => x); // 8000×6000 = 48 MP
    expect(e.code).toBe('invalid_options');
    expect(e.message).toBe("This browser can't safely create images this big; the maximum is 16 megapixels (16384 px per side).");
  });
  it('lockAspect:false keeps the other source side: still checked', async () => {
    await expect(runPipeline(jpg(5000, 5000), { ...base, width: 5000, lockAspect: false, height: undefined }, fakeEnv().env)).rejects.toMatchObject({ code: 'invalid_options' });
  });
  it('a 16 MP request is accepted', async () => {
    const r = await runPipeline(jpg(4000, 4000), { ...base, width: 4000 }, fakeEnv().env);
    expect([r.width, r.height]).toEqual([4000, 4000]);
  });
});

describe('F2: abort arriving after the search completes', () => {
  it('rejects cancelled instead of resolving (final checks are guarded)', async () => {
    const ac = new AbortController();
    let slices = 0;
    const f = fakeEnv({
      renderHook: ({ blob }) => {
        const orig = blob.slice.bind(blob);
        // slice #1 = per-attempt magic check (during search); slice #2 = final check AFTER the search
        (blob as Blob & { slice: Blob['slice'] }).slice = ((...a: Parameters<Blob['slice']>) => { if (++slices === 2) ac.abort(); return orig(...a); }) as Blob['slice'];
        return blob;
      },
    });
    await expect(runPipeline(jpg(300, 200), base, f.env, { signal: ac.signal })).rejects.toMatchObject({ code: 'cancelled' });
    expect(slices).toBe(2);
    expect(f.images.every((i) => i.closed)).toBe(true);
  });
});

describe('F4: mutation-proof checks', () => {
  it('(a) PNG/WebP output with a background colour and alpha input discloses the flatten', () => {
    expect(resolveFormat('png', 'image/png', true, 'white', true)).toMatchObject({ mime: 'image/png', fill: '#ffffff', notes: ['Transparent areas were filled with white.'] });
    expect(resolveFormat('webp', 'image/png', true, '#123456', true)).toMatchObject({ mime: 'image/webp', fill: '#123456', notes: ['Transparent areas were filled with the colour #123456.'] });
    expect(resolveFormat('png', 'image/png', false, 'white', true)).toMatchObject({ fill: null, notes: [] });
  });
  it('(b1) per-attempt magic check: a wrong-format candidate mid-search is fatal even if a later one would be fine', async () => {
    // only the first attempt (q95 at full size, far above the max, never the final pick) comes back as PNG
    const f = fakeEnv({ renderHook: ({ n, blob }) => (n === 1 ? new Blob([new Uint8Array([...MAGIC['image/png'], ...new Uint8Array(blob.size - 8)])]) : undefined) });
    await expect(runPipeline(jpg(3000, 2000), { ...base, maxKb: 50 }, f.env)).rejects.toMatchObject({ code: 'encode_unsupported' });
  });
  it('(b2) final magic check is independent: bytes that change after the per-attempt check are caught', async () => {
    let calls = 0;
    const f = fakeEnv({
      renderHook: ({ blob }) => {
        const bad = new Blob([new Uint8Array([...MAGIC['image/png'], 0, 0, 0, 0, 0, 0, 0, 0])]);
        (blob as Blob & { slice: Blob['slice'] }).slice = ((...a: Parameters<Blob['slice']>) => (++calls === 1 ? Blob.prototype.slice.apply(blob, a) : bad.slice(...a))) as Blob['slice'];
        return blob;
      },
    });
    await expect(runPipeline(jpg(300, 200), base, f.env)).rejects.toMatchObject({ code: 'encode_unsupported' });
    expect(calls).toBe(2);
  });
});

describe('F5: search retains few Blobs', () => {
  it('keeps at most 4 Blobs alive (best in window, best under max, smallest above max, max-quality probe)', async () => {
    let live = 0, peak = 0;
    const reg = new Set<object>();
    const enc: SearchEncoder<{ id: number }> = async (w, h, q) => {
      const blob = { id: reg.size };
      reg.add(blob);
      return { blob, bytes: Math.round(500 + w * h * (0.03 + 0.5 * ((q ?? 100) / 100) ** 3.5)) };
    };
    for (const [maxKb, minKb, fixed] of [[50, undefined, false], [100, 60, false], [0.5, undefined, false], [5, 4, true], [undefined, 400, false]] as const) {
      const r = await fitSearch({ baseWidth: 3000, baseHeight: 2000, fixed, lossy: true, lo: minKb ? minKb * 1024 : 0, hi: maxKb ? maxKb * 1000 : Infinity, hasTarget: true, strategy: 'quality-first', maxEncodes: 20, minSide: 64 }, enc);
      expect(r.peakRetained).toBeLessThanOrEqual(4);
      expect(r.best.blob).toBeTruthy();
      expect(r.candidates.every((c) => !('blob' in c))).toBe(true);
      live = r.peakRetained; peak = Math.max(peak, live);
    }
    expect(peak).toBeGreaterThan(0);
  });
});

describe('F6: raised message mentions reduced dimensions', () => {
  it('scale < 1 raised result says the image was reduced', () => {
    const m = buildMessage({ status: 'raised', reason: 'in_window', mime: 'image/jpeg', lossless: false, fixed: false, allowEnlarge: false, minKb: 20, maxKb: 21, lo: 20480, hi: 21000, maxEncodes: 20, best: { bytes: 20800, width: 780, height: 520, quality: 97, enlarged: false, scale: 0.97 } });
    expect(m).toBe('Your minimum is 20 KB. We raised JPEG quality to 97% and reduced the image to 780×520 px to land at 20.3 KB inside your range. The picture keeps its look; the file just stores more detail.');
  });
});

describe('F7: reduced-decode disclosure whenever the effective source scale < 1', () => {
  it('crop of a large source with fixed output dims notes the reduced decode', async () => {
    const r = await runPipeline(jpg(8000, 6000), { ...base, crop: { x: 0, y: 0, width: 2000, height: 1500 }, width: 2000, height: 1500 }, fakeEnv().env);
    expect([r.width, r.height]).toEqual([2000, 1500]);
    expect(r.notes.some((n) => /opened at reduced size/.test(n))).toBe(true);
  });
  it('no note when the source was decoded at full size', async () => {
    const r = await runPipeline(jpg(3000, 2000), { ...base, crop: { x: 0, y: 0, width: 1000, height: 500 } }, fakeEnv().env);
    expect(r.notes.some((n) => /reduced size/.test(n))).toBe(false);
  });
});

describe('F8: default background', () => {
  const lim = DEFAULT_LIMITS;
  it("'keep' for PNG/WebP/auto, 'white' for JPEG", () => {
    expect(normalizeOptions({ format: 'png' } as ProcessOptions, lim).background).toBe('keep');
    expect(normalizeOptions({ format: 'webp' } as ProcessOptions, lim).background).toBe('keep');
    expect(normalizeOptions({ format: 'auto' } as ProcessOptions, lim).background).toBe('keep');
    expect(normalizeOptions({ format: 'jpeg' } as ProcessOptions, lim).background).toBe('white');
  });
  it('PNG output of a transparent input with no background given keeps alpha', async () => {
    const f = fakeEnv({ alpha: true });
    const r = await runPipeline(png(80, 60), { format: 'png' } as ProcessOptions, f.env);
    expect(f.renders.every((x) => x.fill === null)).toBe(true);
    expect(r.notes).toEqual([]);
  });
});

describe('F9: decoded pixels must match the header', () => {
  it('a bitmap more than 1% larger than the header says -> corrupt; bitmap closed', async () => {
    const f = fakeEnv({ inflate: 2 });
    await expect(runPipeline(jpg(300, 200), base, f.env)).rejects.toMatchObject({ code: 'corrupt' });
    expect(f.images.every((i) => i.closed)).toBe(true);
  });
  it('reduced decode and orientation swap are not false positives', async () => {
    await expect(runPipeline(jpg(8000, 6000), base, fakeEnv().env)).resolves.toBeTruthy();
    await expect(runPipeline(jpg(400, 300, { orientation: 6 }), base, fakeEnv({ swapOrientation: true }).env)).resolves.toBeTruthy();
  });
});

describe('F11: empty window after the KB-conflict fallback', () => {
  it('fractional limits that leave lo > hi are invalid_options', async () => {
    await expect(runPipeline(jpg(30, 20), { ...base, minKb: 1.0005, maxKb: 1.0005 }, fakeEnv().env)).rejects.toMatchObject({ code: 'invalid_options' });
  });
});

describe('F12: messages and ICC', () => {
  it('pixel-limit message shows one decimal', async () => {
    const e = await runPipeline(jpg(12500, 8033), base, fakeEnv().env).catch((x) => x); // 100.4 MP
    expect(e.code).toBe('too_many_pixels');
    expect(e.message).toBe('This image has 100.4 megapixels; the limit is 100.0. Please choose a smaller image.');
  });
  const icc = iccProfile;
  const withProfile = (p: number[]) => { const j = jpegBytes({ width: 8, height: 8 }); return new Uint8Array([...j.slice(0, 20), ...app2Icc(p), ...j.slice(20)]); };
  it('iccIsSrgb recognises v4 mluc and v2 desc sRGB, rejects others', () => {
    expect(iccIsSrgb(new Uint8Array(icc('sRGB', 'mluc')))).toBe(true);
    expect(iccIsSrgb(new Uint8Array(icc('sRGB IEC61966-2.1', 'desc')))).toBe(true);
    expect(iccIsSrgb(new Uint8Array(icc('Display P3', 'mluc')))).toBe(false);
    expect(iccIsSrgb(new Uint8Array(icc('Adobe RGB (1998)', 'desc')))).toBe(false);
    expect(iccIsSrgb(new Uint8Array(10))).toBe(false);
  });
  it('stripIccProfile removes an sRGB profile but keeps a non-sRGB one', () => {
    expect(stripIccProfile(withProfile(icc('sRGB', 'mluc')))).not.toBeNull();
    expect(stripIccProfile(withProfile(icc('Display P3', 'mluc')))).toBeNull();
  });
});
