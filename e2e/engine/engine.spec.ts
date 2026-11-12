import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openHarness, run, BASE, browserRssMb, ORIGIN } from './harness';

/** Measurements are appended here and summarised in docs/engine/ENGINE.md (not committed: .tmp is ignored). */
const MEASURE = path.resolve(import.meta.dirname, '../../.tmp/engine-e2e-measurements.jsonl');
const record = (name: string, data: unknown) => fs.appendFileSync(MEASURE, JSON.stringify({ name, ...((data as object) ?? {}) }) + '\n');
const pixels = (page: Page, pts: number[][]) => page.evaluate((p) => (window as unknown as { pixels: (p: number[][]) => Promise<number[][]> }).pixels(p), pts);
const close = (a: number[], b: number[], tol = 6) => a.slice(0, 3).every((v, i) => Math.abs(v - b[i]) <= tol);

test.describe('engine in real Chrome (worker path)', () => {
  test.beforeEach(async ({ page, context }) => { await openHarness(page, context); });

  test('JPEG in, max 50 KB: ok, real bytes <= 50,000, JPEG magic, decodes, worker mode, no network', async ({ page, context }) => {
    const reqs: string[] = [];
    context.on('request', (r) => reqs.push(`${r.method()} ${r.url()}`));
    const r = await run(page, 'photo-1200x800.jpg', { ...BASE, maxKb: 50 });
    expect(r.ok, r.message).toBe(true);
    expect(r.status).toBe('ok');
    expect(r.bytes).toBe(r.blobSize);
    expect(r.bytes).toBeLessThanOrEqual(50_000);
    expect(r.bytes / 50_000).toBeGreaterThan(0.85);
    expect(r.magic.startsWith('ffd8ff')).toBe(true);
    expect(r.decoded).toEqual({ w: r.width, h: r.height });
    expect(r.mode).toBe('worker');
    expect(r.attempts).toBeLessThanOrEqual(20);
    expect(reqs.every((x) => x.startsWith('GET ' + ORIGIN))).toBe(true);
    record('jpeg-max50', { bytes: r.bytes, q: r.quality, w: r.width, h: r.height, attempts: r.attempts, ms: r.elapsedMs });
  });

  test('PNG in: auto stays PNG (lossless, pixels only) and JPEG output reaches 20 KB', async ({ page }) => {
    const a = await run(page, 'signature-1200x400.png', { ...BASE, format: 'auto', maxKb: 8 });
    expect(a.ok, a.message).toBe(true);
    expect(a.mime).toBe('image/png');
    expect(a.magic.startsWith('89504e47')).toBe(true);
    expect(a.quality).toBeNull();
    expect(a.bytes).toBeLessThanOrEqual(8000);
    if (a.width < 1200) expect(a.message).toMatch(/lossless/);
    const j = await run(page, 'signature-1200x400.png', { ...BASE, maxKb: 20 });
    expect(j.status).toBe('ok');
    expect(j.mime).toBe('image/jpeg');
    expect(j.bytes).toBeLessThanOrEqual(20_000);
  });

  test('WebP in: auto keeps WebP (Chrome can encode it), verified by RIFF/WEBP magic', async ({ page }) => {
    const r = await run(page, 'photo-800x600.webp', { ...BASE, format: 'auto', maxKb: 30 });
    expect(r.ok, r.message).toBe(true);
    expect(r.mime).toBe('image/webp');
    expect(r.magic.slice(0, 8)).toBe('52494646');
    expect(r.magic.slice(16, 24)).toBe('57454250');
    expect(r.bytes).toBeLessThanOrEqual(30_000);
    const w = await run(page, 'photo-1200x800.jpg', { ...BASE, format: 'webp', maxKb: 40 });
    expect(w.mime).toBe('image/webp');
    expect(w.status).toBe('ok');
  });

  test('transparent PNG: auto keeps alpha; JPEG fills white/black/#hex with disclosure', async ({ page }) => {
    const keep = await run(page, 'transparent.png', { ...BASE, format: 'auto', background: 'keep' });
    expect(keep.mime).toBe('image/png');
    expect(keep.source.hasAlpha).toBe(true);
    const [corner, disc] = await pixels(page, [[10, 10], [560, 390]]);
    expect(corner[3]).toBe(0);
    expect(Math.abs(disc[3] - 128)).toBeLessThanOrEqual(2);
    expect(keep.notes.some((n) => /filled/.test(n))).toBe(false);

    for (const [bg, rgb, word] of [['white', [255, 255, 255], 'white'], ['black', [0, 0, 0], 'black'], ['#ccff00', [204, 255, 0], 'the colour #ccff00']] as const) {
      const r = await run(page, 'transparent.png', { ...BASE, format: 'jpeg', background: bg });
      expect(r.mime).toBe('image/jpeg');
      expect(r.notes).toContain(`Transparent areas were filled with ${word}.`);
      const [c] = await pixels(page, [[10, 10]]);
      expect(close(c, [...rgb]), `${bg}: ${c}`).toBe(true);
    }
    const bad = await run(page, 'transparent.png', { ...BASE, format: 'jpeg', background: 'keep' });
    expect(bad).toMatchObject({ ok: false, code: 'invalid_options' });
  });

  test('alpha WebP in, auto: keeps WebP with alpha', async ({ page }) => {
    const r = await run(page, 'alpha-400x300.webp', { ...BASE, format: 'auto', background: 'keep' });
    expect(r.mime).toBe('image/webp');
    expect(r.source.hasAlpha).toBe(true);
    const [c] = await pixels(page, [[5, 5]]);
    expect(c[3]).toBe(0);
  });

  test('tiny files (1×1 PNG, 8×8 JPEG) work', async ({ page }) => {
    const a = await run(page, 'tiny-1x1.png', { ...BASE, format: 'jpeg', maxKb: 5 });
    expect(a).toMatchObject({ ok: true, status: 'ok', width: 1, height: 1 });
    const b = await run(page, 'tiny-8x8.jpg', { ...BASE });
    expect(b).toMatchObject({ ok: true, status: 'ok', width: 8, height: 8 });
  });

  test('corrupt and unsupported files fail with typed errors (by magic bytes, not name/MIME)', async ({ page }) => {
    expect(await run(page, 'corrupt-garbage.jpg', BASE)).toMatchObject({ ok: false, code: 'corrupt' });
    expect(await run(page, 'svg-renamed.png', BASE)).toMatchObject({ ok: false, code: 'unsupported_type' });
    expect(await run(page, 'gif-renamed.jpg', BASE)).toMatchObject({ ok: false, code: 'unsupported_type' });
    expect(await run(page, 'heic-header.heic', BASE)).toMatchObject({ ok: false, code: 'unsupported_type' });
    // Truncated files are refused before decoding (Safari would otherwise paint the missing part grey).
    for (const n of ['corrupt-truncated.jpg', 'corrupt-truncated.png', 'corrupt-truncated.webp']) {
      const t = await run(page, n, { ...BASE, maxKb: 10 });
      expect(t, n).toMatchObject({ ok: false, code: 'corrupt' });
      expect(t.message).toMatch(/incomplete/);
    }
    // Legit files with data after the end marker are accepted; the re-encode drops the tail.
    const g = await run(page, 'trailing-garbage.jpg', { ...BASE });
    expect(g).toMatchObject({ ok: true, status: 'ok', width: 200, height: 230 });
    const m = await run(page, 'motion-photo-like.jpg', { ...BASE });
    expect(m).toMatchObject({ ok: true, status: 'ok' });
    expect(await page.evaluate(async () => new TextDecoder('latin1').decode(await (window as unknown as { last: Blob }).last.arrayBuffer()).includes('ftypmp42'))).toBe(false);
  });

  test('EXIF orientation 6 (permanent regression): 300×400 output, red band at the top', async ({ page }) => {
    const r = await run(page, 'exif6-gps.jpg', { ...BASE });
    expect(r.source).toMatchObject({ width: 300, height: 400, orientationApplied: true });
    expect([r.width, r.height]).toEqual([300, 400]);
    const [top, bottom] = await pixels(page, [[150, 20], [150, 380]]);
    expect(top[0]).toBeGreaterThan(180); expect(top[2]).toBeLessThan(80); // red
    expect(bottom[2]).toBeGreaterThan(150); expect(bottom[0]).toBeLessThan(80); // blue
    // also with reduced decode + resize (width-only)
    const s = await run(page, 'exif6-gps.jpg', { ...BASE, width: 150 });
    expect([s.width, s.height]).toEqual([150, 200]);
  });

  test('GPS/Make/Model are not copied into the output', async ({ page }) => {
    for (const format of ['jpeg', 'webp', 'png']) {
      const r = await run(page, 'exif6-gps.jpg', { ...BASE, format, maxKb: 50 });
      expect(r.ok, r.message).toBe(true);
      expect(r.hasTestCam, format).toBe(false);
      expect(r.hasModel9, format).toBe(false);
      if (format === 'jpeg') expect(r.hasExifApp1).toBe(false);
    }
  });

  test('range 20–50 KB on a 12 MP photo: in window, continuous scale, <= 20 encodes', async ({ page }) => {
    const r = await run(page, '.generated/photo-12mp.jpg', { ...BASE, minKb: 20, maxKb: 50 });
    expect(r.ok, r.message).toBe(true);
    expect(r.status).toBe('ok');
    expect(r.bytes).toBeGreaterThanOrEqual(20 * 1024);
    expect(r.bytes).toBeLessThanOrEqual(50_000);
    expect(r.attempts).toBeLessThanOrEqual(20);
    expect(r.message).toMatch(/within 20–50 KB/);
    record('12mp-range-20-50', { bytes: r.bytes, q: r.quality, w: r.width, h: r.height, attempts: r.attempts, ms: r.elapsedMs });
    const narrow = await run(page, '.generated/photo-12mp.jpg', { ...BASE, minKb: 19, maxKb: 20 });
    expect(narrow.status).toBe('ok');
    expect(narrow.bytes).toBeGreaterThanOrEqual(19 * 1024);
    expect(narrow.bytes).toBeLessThanOrEqual(20_000);
    record('12mp-range-19-20', { bytes: narrow.bytes, q: narrow.quality, w: narrow.width, attempts: narrow.attempts, ms: narrow.elapsedMs });
  });

  test('minimum reached by raising quality (fixed 200×230)', async ({ page }) => {
    const probe = await run(page, 'photo-1200x800.jpg', { ...BASE, width: 200, height: 230, fit: 'cover', quality: 95 });
    const q95 = probe.bytes;
    const minKb = Math.ceil((q95 * 1.12) / 1024);
    const r = await run(page, 'photo-1200x800.jpg', { ...BASE, width: 200, height: 230, fit: 'cover', minKb, maxKb: minKb * 3 });
    expect(r.ok, r.message).toBe(true);
    expect(r.status, r.message).toBe('raised');
    expect(r.quality!).toBeGreaterThan(95);
    expect(r.bytes).toBeGreaterThanOrEqual(minKb * 1024);
    expect([r.width, r.height]).toEqual([200, 230]);
    expect(r.message).toMatch(/We raised JPEG quality to \d+%/);
    record('raise-200x230', { q95, minKb, bytes: r.bytes, q: r.quality, attempts: r.attempts });
  });

  test('below_min on a tiny 140×60 signature: honest message, no padding', async ({ page }) => {
    const r = await run(page, 'signature-140x60.png', { ...BASE, width: 140, height: 60, minKb: 10, maxKb: 20 });
    expect(r.ok, r.message).toBe(true);
    expect(r.status).toBe('below_min');
    expect(r.bytes).toBeLessThan(10 * 1024);
    expect(r.quality).toBe(100);
    expect(r.message).toMatch(/^At 140×60 px this image is at most [\d.]+ KB \([\d,]+ bytes\) even at maximum quality, so the 10 KB minimum \(10,240 bytes\) cannot be met/);
    // the file is a plain JPEG: no COM/APP padding segments
    const segs = await page.evaluate(async () => {
      const u = new Uint8Array(await (window as unknown as { last: Blob }).last.arrayBuffer());
      const out: string[] = []; let i = 2;
      while (i < u.length) { const m = u[i + 1]; out.push(m.toString(16)); if (m === 0xda) break; i += 2 + ((u[i + 2] << 8) | u[i + 3]); }
      return out;
    });
    expect(segs.includes('fe')).toBe(false);
    record('signature-below-min', { bytes: r.bytes, message: r.message });
    const p = await run(page, 'signature-140x60.png', { ...BASE, width: 140, height: 60, minKb: 10, allowPadding: true });
    expect(p).toMatchObject({ ok: false, code: 'invalid_options' });
  });

  test('impossible maximum: above_max (free) and above_max_fixed (fixed) return the smallest with the number', async ({ page }) => {
    const free = await run(page, 'noise-256.png', { ...BASE, maxKb: 0.5 });
    expect(free.status).toBe('above_max');
    expect(free.bytes).toBeGreaterThan(500);
    expect(Math.min(free.width, free.height)).toBe(64);
    expect(free.message).toMatch(/^Cannot go below ([\d.]+ KB \([\d,]+ bytes\)|\d+ bytes) for this image \(smallest result: \d+×64 px at quality \d+%\), which is above your 0.5 KB limit \(500 bytes\)/);
    const fixed = await run(page, 'noise-256.png', { ...BASE, width: 256, height: 256, maxKb: 0.5 });
    expect(fixed.status).toBe('above_max_fixed');
    expect(fixed.quality).toBe(1);
    expect(fixed.message).toMatch(/^At 256×256 px the smallest JPEG is/);
    const png = await run(page, 'noise-256.png', { ...BASE, format: 'png', width: 256, maxKb: 50 });
    expect(png.status).toBe('above_max_fixed');
    expect(png.message).toMatch(/PNG is lossless/);
    record('impossible-max', { free: [free.bytes, free.width, free.height, free.quality], fixed: [fixed.bytes, fixed.quality] });
  });

  test('dimension-only: width 300, no size target, never upscales without explicit dims', async ({ page }) => {
    const r = await run(page, 'photo-1200x800.jpg', { ...BASE, width: 300 });
    expect(r).toMatchObject({ status: 'ok', width: 300, height: 200, quality: 85, attempts: 1 });
    const m = await run(page, 'photo-200x230.jpg', { ...BASE, maxWidth: 1000 });
    expect([m.width, m.height]).toEqual([200, 230]);
    const up = await run(page, 'signature-140x60.png', { ...BASE, width: 280 });
    expect([up.width, up.height]).toEqual([280, 120]);
    expect(up.notes.join(' ')).toMatch(/enlarged/);
  });

  test('crop rect (signature tool) in oriented source pixels', async ({ page }) => {
    const r = await run(page, 'exif6-gps.jpg', { ...BASE, crop: { x: 0, y: 0, width: 300, height: 100 } });
    expect([r.width, r.height]).toEqual([300, 100]);
    const [mid] = await pixels(page, [[150, 50]]);
    expect(mid[0]).toBeGreaterThan(180); // the crop is the red band of the ORIENTED image
  });

  test('stripIcc removes the ICC profile, stays decodable, pixel-identical', async ({ page }) => {
    const a = await run(page, 'photo-200x230.jpg', { ...BASE, quality: 80 });
    const pa = await pixels(page, [[10, 10], [100, 100], [190, 220]]);
    const b = await run(page, 'photo-200x230.jpg', { ...BASE, quality: 80, stripIcc: true });
    const pb = await pixels(page, [[10, 10], [100, 100], [190, 220]]);
    record('icc', { withIcc: a.bytes, stripped: b.bytes, hadIcc: a.hasIcc });
    if (a.hasIcc) {
      expect(b.hasIcc).toBe(false);
      expect(a.bytes - b.bytes).toBeGreaterThan(400);
    }
    expect(b.decoded).toEqual({ w: 200, h: 230 });
    expect(pb).toEqual(pa);
  });

  test('large 36 MP image (generated on the fly): reduced decode, max 50 KB, time and memory recorded', async ({ page, browser }) => {
    const gen = await page.evaluate(async () => { const f = await (window as unknown as { makeLarge: (w: number, h: number) => Promise<File> }).makeLarge(6000, 6000); (window as unknown as { big: File }).big = f; return f.size; });
    const base = await browserRssMb(browser);
    let peak = base;
    let sampling = true;
    const sampler = (async () => { while (sampling) { try { peak = Math.max(peak, await browserRssMb(browser)); } catch { /* ps hiccup */ } await new Promise((r) => setTimeout(r, 100)); } })();
    const r = await page.evaluate((o) => { const w = window as unknown as { run: (f: File, o: unknown) => Promise<{ ok: boolean }>; big: File }; return w.run(w.big, o); }, { ...BASE, maxKb: 50 }) as Awaited<ReturnType<typeof run>>;
    sampling = false;
    await sampler;
    expect(r.ok, r.message).toBe(true);
    expect(r.status).toBe('ok');
    expect(r.bytes).toBeLessThanOrEqual(50_000);
    expect(r.source).toMatchObject({ width: 6000, height: 6000 });
    expect(r.wallMs).toBeLessThan(5000);
    expect(peak - base).toBeLessThan(600);
    record('36mp-max50', { inputBytes: gen, bytes: r.bytes, q: r.quality, w: r.width, h: r.height, attempts: r.attempts, ms: r.elapsedMs, wallMs: r.wallMs, rssBaseMb: Math.round(base), rssPeakDeltaMb: Math.round(peak - base) });
  });

  test('output limits on the resolved geometry (review F1): derived side / lockAspect:false rejected, not out_of_memory', async ({ page }) => {
    const tall = await run(page, { large: [100, 10000] }, { ...BASE, width: 16384 });
    expect(tall).toMatchObject({ ok: false, code: 'invalid_options' });
    expect(tall.message).toBe("This browser can't safely create images this big; the maximum is 16 megapixels (16384 px per side).");
    const stretch = await run(page, { large: [5000, 5000] }, { ...BASE, width: 5000, lockAspect: false });
    expect(stretch).toMatchObject({ ok: false, code: 'invalid_options' });
    const okBig = await run(page, { large: [4000, 4000] }, { ...BASE, width: 4000 });
    expect(okBig).toMatchObject({ ok: true, width: 4000, height: 4000 });
  });

  test('too many pixels by header (no decode) and too many bytes', async ({ page }) => {
    const r = await page.evaluate(async () => {
      // 12000x9000 header-only JPEG: SOI, SOF0, EOI. Must be rejected from the header without decoding.
      const b = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0x23, 0x28, 0x2e, 0xe0, 3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0, 0xff, 0xd9]);
      const w = window as unknown as { run: (f: File, o: unknown) => Promise<unknown> };
      return w.run(new File([b], 'x.jpg'), { format: 'jpeg', strategy: 'quality-first', lockAspect: true, fit: 'contain', background: 'white' });
    });
    expect(r).toMatchObject({ ok: false, code: 'too_many_pixels' });
    const big = await page.evaluate(async () => {
      const w = window as unknown as { run: (f: File, o: unknown) => Promise<unknown> };
      const head = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
      return w.run(new File([head, new Uint8Array(26 * 1024 * 1024)], 'big.jpg'), { format: 'jpeg', strategy: 'quality-first', lockAspect: true, fit: 'contain', background: 'white' });
    });
    expect(big).toMatchObject({ ok: false, code: 'too_large_bytes' });
  });
});

test.describe('robustness: browser ignores createImageBitmap resize options (review F6), inspectFile', () => {
  test('36 MP job still succeeds when resizeWidth is ignored: redrawn at the working size, not "corrupt"', async ({ page, context }) => {
    const STUB = `const cib = self.createImageBitmap; self.createImageBitmap = (src) => cib(src);`; // drops all options
    await openHarness(page, context, { workerPrelude: STUB });
    const r = await run(page, { large: [6000, 6000] }, { ...BASE, maxKb: 50 });
    expect(r, r.message).toMatchObject({ ok: true, status: 'ok' });
    expect(r.bytes).toBeLessThanOrEqual(50_000);
    expect(r.source).toMatchObject({ width: 6000, height: 6000 });
    record('36mp-resize-ignored', { bytes: r.bytes, w: r.width, h: r.height, ms: r.elapsedMs });
  });
  test('inspectFile: header facts incl. GPS, same errors as processImage, no decode', async ({ page, context }) => {
    await openHarness(page, context);
    const r = await page.evaluate(async () => {
      const w = window as unknown as { E: { inspectFile: (f: Blob) => Promise<unknown> }; fixture: (n: string) => Promise<File> };
      const out: Record<string, unknown> = {};
      for (const n of ['exif6-gps.jpg', 'photo-200x230.jpg', 'transparent.png', 'svg-renamed.png']) {
        try { out[n] = await w.E.inspectFile(await w.fixture(n)); } catch (e) { out[n] = 'ERR:' + (e as { code: string }).code; }
      }
      return out;
    });
    expect(r).toEqual({
      'exif6-gps.jpg': { mime: 'image/jpeg', width: 300, height: 400, orientation: 6, alphaPossible: false, hasGps: true },
      'photo-200x230.jpg': { mime: 'image/jpeg', width: 200, height: 230, orientation: 1, alphaPossible: false, hasGps: false },
      'transparent.png': { mime: 'image/png', width: 800, height: 600, orientation: 1, alphaPossible: true, hasGps: false },
      'svg-renamed.png': 'ERR:unsupported_type',
    });
  });
});

test.describe('second audit: A4 inspect completeness, A5 extraneous bytes, A2 alpha', () => {
  test.beforeEach(async ({ page, context }) => { await openHarness(page, context); });
  test('A5: JPEG with 4 stray zero bytes between segments decodes in Chrome and is accepted', async ({ page }) => {
    const r = await run(page, 'jpeg-extraneous-bytes.jpg', { ...BASE, maxKb: 30 });
    expect(r).toMatchObject({ ok: true, status: 'ok', width: 200, height: 230 });
  });
  test('A4: inspectFile refuses truncated files at pick, incl. a 16 MP JPEG cut at 90% (time recorded)', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const w = window as unknown as { E: { inspectFile: (f: Blob) => Promise<unknown> }; fixture: (n: string) => Promise<File> };
      const out: Record<string, unknown> = {};
      for (const n of ['corrupt-truncated.jpg', 'jpeg-no-eoi.jpg', 'progressive-truncated-70.jpg', '.generated/real-truncated-90.jpg', 'photo-1200x800.jpg']) {
        const f = await w.fixture(n);
        const t = performance.now();
        try { await w.E.inspectFile(f); out[n] = 'ok'; } catch (e) { out[n] = (e as { code: string }).code; }
        out[n + ' ms'] = Math.round(performance.now() - t);
      }
      return out;
    });
    expect(r).toMatchObject({ 'corrupt-truncated.jpg': 'corrupt', 'jpeg-no-eoi.jpg': 'corrupt', 'progressive-truncated-70.jpg': 'corrupt', '.generated/real-truncated-90.jpg': 'corrupt', 'photo-1200x800.jpg': 'ok' });
    expect(r['.generated/real-truncated-90.jpg ms'] as number).toBeLessThan(1000);
    record('inspect-truncated', r);
  });
  test('A2: a single near-opaque pixel is never flattened silently (full scan <= 12 MP; note above)', async ({ page }) => {
    const small = await run(page, { hole: [3500, 3400, 1234, 2345, 254] }, { ...BASE, format: 'jpeg' });
    expect(small.ok, small.message).toBe(true);
    expect(small.source.hasAlpha).toBe(true);
    expect(small.notes).toContain('Transparent areas were filled with white.');
    const big = await run(page, { hole: [4000, 3400, 1234, 2345, 254] }, { ...BASE, format: 'jpeg' });
    expect(big.ok, big.message).toBe(true);
    const disclosed = big.notes.includes('Transparent areas were filled with white.') || big.notes.includes('Very small transparent areas in very large images may be filled with the background colour.');
    expect(disclosed, JSON.stringify(big.notes)).toBe(true);
    record('alpha-hole', { smallMs: small.elapsedMs, smallHasAlpha: small.source.hasAlpha, bigHasAlpha: big.source.hasAlpha, bigNotes: big.notes });
  });
});

test.describe('lifecycle: repeated runs, cancellation, stale protection, timeout', () => {
  test.beforeEach(async ({ page, context }) => { await openHarness(page, context); });

  test('10 repeated 12 MP runs: no unbounded memory growth', async ({ page, browser }) => {
    const rss: number[] = [];
    const heap: number[] = [];
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await run(page, '.generated/photo-12mp.jpg', { ...BASE, maxKb: 100 }, { keep: false });
      expect(r.status).toBe('ok');
      times.push(r.elapsedMs);
      await page.waitForTimeout(300);
      rss.push(Math.round(await browserRssMb(browser)));
      heap.push(await page.evaluate(() => Math.round(((performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0) / 1048576)));
    }
    record('repeat-12mp-x10', { rssMb: rss, pageHeapMb: heap, ms: times });
    // growth between the 2nd and the 10th run must be bounded (a leak of one 12 MP bitmap per run would be ~48 MB/run)
    expect(rss[9] - rss[1]).toBeLessThan(150);
    expect(heap[9] - heap[1]).toBeLessThan(20);
    expect(Math.max(...times.slice(1))).toBeLessThan(Math.max(1500, 3 * Math.min(...times)));
  });

  test('cancellation mid-search: rejects cancelled quickly and terminates the worker', async ({ page }) => {
    const workers: string[] = [];
    const closed: string[] = [];
    page.on('worker', (w) => { workers.push(w.url()); w.on('close', () => closed.push(w.url())); });
    const r = await page.evaluate(async () => {
      const w = window as unknown as { E: { processImage: (f: File, o: unknown, h: unknown) => Promise<unknown> }; makeLarge: (w: number, h: number) => Promise<File> };
      const f = await w.makeLarge(6000, 6000);
      const ac = new AbortController();
      let attempt = 0;
      const t0 = performance.now();
      let tAbort = 0;
      const p = w.E.processImage(f, { format: 'jpeg', strategy: 'quality-first', lockAspect: true, fit: 'contain', background: 'white', maxKb: 50 }, {
        signal: ac.signal,
        onProgress: (x: { stage: string; attempt?: number }) => { if (x.stage === 'encoding') { attempt = x.attempt ?? 0; if (attempt === 2 && !tAbort) { tAbort = performance.now(); ac.abort(); } } },
      });
      try { await p; return { resolved: true }; } catch (e) { return { code: (e as { code: string }).code, afterAbortMs: Math.round(performance.now() - tAbort), totalMs: Math.round(performance.now() - t0), attempt }; }
    });
    expect(r).toMatchObject({ code: 'cancelled' });
    expect((r as { afterAbortMs: number }).afterAbortMs).toBeLessThan(100);
    await expect.poll(() => closed.length, { timeout: 5000 }).toBe(workers.length);
    expect(workers.length).toBeGreaterThan(0);
    record('cancel', r);
  });

  test('stale protection: a newer request supersedes the running one; only the newer result arrives', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const w = window as unknown as { E: { processImage: (f: File, o: unknown) => Promise<{ width: number }> }; makeLarge: (w: number, h: number) => Promise<File>; fixture: (n: string) => Promise<File> };
      const big = await w.makeLarge(6000, 6000);
      const small = await w.fixture('photo-200x230.jpg');
      const o = { format: 'jpeg', strategy: 'quality-first', lockAspect: true, fit: 'contain', background: 'white', maxKb: 50 };
      const a = w.E.processImage(big, o).then((x) => ({ w: x.width }), (e) => ({ code: e.code }));
      await new Promise((r) => setTimeout(r, 50));
      const b = w.E.processImage(small, o).then((x) => ({ w: x.width }), (e) => ({ code: e.code }));
      return { a: await a, b: await b };
    });
    expect(r.a).toEqual({ code: 'cancelled' });
    expect(r.b).toEqual({ w: 200 });
  });

  test('timeout limit: EngineError timeout and the worker is gone', async ({ page }) => {
    const closed: string[] = [];
    page.on('worker', (w) => w.on('close', () => closed.push(w.url())));
    const r = await page.evaluate(async () => {
      const w = window as unknown as { makeEngine: (l: unknown) => { process: (f: File, o: unknown) => Promise<unknown>; liveWorkers: number }; makeLarge: (w: number, h: number) => Promise<File> };
      const f = await w.makeLarge(6000, 6000);
      const eng = w.makeEngine({ timeoutMs: 150 });
      try { await eng.process(f, { format: 'jpeg', strategy: 'quality-first', lockAspect: true, fit: 'contain', background: 'white', maxKb: 50 }); return { resolved: true }; } catch (e) { return { code: (e as { code: string }).code, live: eng.liveWorkers }; }
    });
    expect(r).toEqual({ code: 'timeout', live: 0 });
    await expect.poll(() => closed.length, { timeout: 5000 }).toBeGreaterThan(0);
  });
});

test.describe('WebP unsupported (Safari behaviour simulated: encoder silently returns PNG)', () => {
  const STUB = `
    const orig = OffscreenCanvas.prototype.convertToBlob;
    OffscreenCanvas.prototype.convertToBlob = function (o) { return orig.call(this, o && o.type === 'image/webp' ? { type: 'image/png' } : o); };
  `;
  test('worker path: format webp -> encode_unsupported; auto with WebP input -> JPEG/PNG with disclosure', async ({ page, context }) => {
    await openHarness(page, context, { workerPrelude: STUB });
    expect(await run(page, 'photo-1200x800.jpg', { ...BASE, format: 'webp', maxKb: 50 })).toMatchObject({ ok: false, code: 'encode_unsupported' });
    const a = await run(page, 'photo-800x600.webp', { ...BASE, format: 'auto', maxKb: 50 });
    expect(a).toMatchObject({ ok: true, mime: 'image/jpeg' });
    expect(a.magic.startsWith('ffd8ff')).toBe(true);
    expect(a.notes).toContain("WebP can't be saved in this browser, so the result is JPEG.");
    const b = await run(page, 'alpha-400x300.webp', { ...BASE, format: 'auto', background: 'keep' });
    expect(b).toMatchObject({ ok: true, mime: 'image/png' });
    expect(b.notes).toContain("WebP can't be saved in this browser, so the result is PNG.");
  });
});

test.describe('main-thread fallback (only when feature detection fails)', () => {
  const NO_OFFSCREEN = `delete globalThis.OffscreenCanvas;`;
  test('no OffscreenCanvas: runs on the main thread with the same results contract', async ({ page, context }) => {
    const workers: string[] = [];
    page.on('worker', (w) => workers.push(w.url()));
    await openHarness(page, context, { pageInit: NO_OFFSCREEN });
    expect(await page.evaluate(() => (window as unknown as { E: { engineMode: () => string } }).E.engineMode())).toBe('main-thread');
    const r = await run(page, 'photo-1200x800.jpg', { ...BASE, maxKb: 50 });
    expect(r).toMatchObject({ ok: true, status: 'ok', mode: 'main-thread' });
    expect(r.bytes).toBeLessThanOrEqual(50_000);
    const o = await run(page, 'exif6-gps.jpg', { ...BASE });
    expect([o.width, o.height]).toEqual([300, 400]);
    expect(workers).toEqual([]);
    // cancellation on the main thread
    const c = await page.evaluate(async () => {
      const w = window as unknown as { E: { processImage: (f: File, o: unknown, h: unknown) => Promise<unknown> }; fixture: (n: string) => Promise<File> };
      const f = await w.fixture('.generated/photo-12mp.jpg');
      const ac = new AbortController();
      const p = w.E.processImage(f, { format: 'jpeg', strategy: 'quality-first', lockAspect: true, fit: 'contain', background: 'white', maxKb: 50 }, { signal: ac.signal, onProgress: (x: { attempt?: number }) => { if (x.attempt === 2) ac.abort(); } });
      try { await p; return 'resolved'; } catch (e) { return (e as { code: string }).code; }
    });
    expect(c).toBe('cancelled');
  });
  test('main thread + WebP unsupported (toBlob returns PNG): encode_unsupported', async ({ page, context }) => {
    const stub = NO_OFFSCREEN + `
      const orig = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (cb, type, q) { return orig.call(this, cb, type === 'image/webp' ? 'image/png' : type, q); };`;
    await openHarness(page, context, { pageInit: stub });
    expect(await run(page, 'photo-1200x800.jpg', { ...BASE, format: 'webp' })).toMatchObject({ ok: false, code: 'encode_unsupported' });
  });
});
