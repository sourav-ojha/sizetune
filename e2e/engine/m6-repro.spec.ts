/**
 * UI review M6 investigation: a 140×60 JPEG with a 10 KB minimum intermittently reported out_of_memory.
 * TEST-ONLY instrumentation: the worker prelude wraps the browser primitives the engine uses and logs any RAW error
 * to the console (captured here). Product code never logs.
 */
import { test, expect } from '@playwright/test';
import { openHarness } from './harness';

const PRELUDE = `
  const tag = (where, e) => console.error('RAWERR ' + where + ' ' + (e && e.name) + ': ' + (e && e.message));
  const wrapP = (obj, key, where) => { const o = obj[key]; obj[key] = function (...a) { try { const r = o.apply(this, a); return r && r.then ? r.catch((e) => { tag(where, e); throw e; }) : r; } catch (e) { tag(where, e); throw e; } }; };
  wrapP(OffscreenCanvas.prototype, 'convertToBlob', 'convertToBlob');
  wrapP(OffscreenCanvas.prototype, 'getContext', 'getContext');
  wrapP(OffscreenCanvasRenderingContext2D.prototype, 'drawImage', 'drawImage');
  wrapP(self, 'createImageBitmap', 'createImageBitmap');
  const gc = OffscreenCanvas.prototype.getContext;
  OffscreenCanvas.prototype.getContext = function (...a) { const c = gc.apply(this, a); if (!c) console.error('RAWERR getContext returned null ' + this.width + 'x' + this.height); return c; };
`;

const SIG = { format: 'jpeg', strategy: 'quality-first', lockAspect: true, fit: 'cover', background: 'white', width: 140, height: 60, minKb: 10, maxKb: 20 };

test('M6: 140×60 JPEG, min 10 KB — sequential, rapid supersede, cancel+new, crop+fixed, reuse', async ({ page, context }) => {
  test.setTimeout(240_000);
  const raw: string[] = [];
  page.on('console', (m) => { if (m.text().startsWith('RAWERR')) raw.push(m.text()); });
  await openHarness(page, context, { workerPrelude: PRELUDE });
  const tally = await page.evaluate(async (SIG) => {
    const w = window as unknown as { E: { processImage: (f: File, o: unknown, h?: unknown) => Promise<{ status: string }> }; makeLarge: (w: number, h: number, q?: number) => Promise<File> };
    const f = await w.makeLarge(140, 60, 0.9);
    const big = await w.makeLarge(1200, 400, 0.9);
    const t: Record<string, number> = {};
    const note = (k: string) => { t[k] = (t[k] ?? 0) + 1; };
    const outcome = (p: Promise<{ status: string }>) => p.then((r) => r.status, (e) => 'ERR:' + e.code);
    // 1. sequential (worker is reused: small source)
    for (let i = 0; i < 60; i++) note('seq ' + await outcome(w.E.processImage(f, SIG)));
    // 2. rapid supersede: two calls back to back (first must be cancelled, second must succeed)
    for (let i = 0; i < 40; i++) {
      const a = outcome(w.E.processImage(f, SIG));
      const b = outcome(w.E.processImage(f, SIG));
      note('rapidA ' + await a); note('rapidB ' + await b);
    }
    // 3. abort at a random point, immediately start a new job
    for (let i = 0; i < 40; i++) {
      const ac = new AbortController();
      const a = outcome(w.E.processImage(big, { ...SIG, crop: { x: 10, y: 10, width: 700, height: 300 } }, { signal: ac.signal }));
      await new Promise((r) => setTimeout(r, i % 7));
      ac.abort();
      note('cancelA ' + await a);
      note('afterCancel ' + await outcome(w.E.processImage(f, SIG)));
    }
    // 4. crop + fixed dims on a larger source, fractional crop
    for (let i = 0; i < 30; i++) note('crop ' + await outcome(w.E.processImage(big, { ...SIG, crop: { x: 0.4 + i, y: 0.3, width: 699.7, height: 299.9 } })));
    // 5. many supersedes in a burst (UI re-renders), only the last should land
    for (let i = 0; i < 20; i++) {
      const ps = Array.from({ length: 5 }, () => outcome(w.E.processImage(f, SIG)));
      const r = await Promise.all(ps);
      note('burstLast ' + r[4]); r.slice(0, 4).forEach((x) => note('burstEarly ' + x));
    }
    return t;
  }, SIG);
  console.log('M6 tally', JSON.stringify(tally));
  console.log('M6 raw errors', raw.length ? raw.slice(0, 20).join('\n') : 'none');
  const bad = Object.keys(tally).filter((k) => /out_of_memory|worker_failed|corrupt/.test(k));
  expect(bad, JSON.stringify(tally)).toEqual([]);
});

test('M6 under pressure: 4 pages sharing one GPU process, 36 MP jobs interleaved with the 140×60 case', async ({ browser }) => {
  test.setTimeout(300_000);
  const raw: string[] = [];
  const pages = await Promise.all(Array.from({ length: 4 }, async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.text().startsWith('RAWERR')) raw.push(m.text()); });
    await openHarness(page, ctx, { workerPrelude: PRELUDE });
    return page;
  }));
  const tallies = await Promise.all(pages.map((page, idx) => page.evaluate(async ([SIG, idx]) => {
    const w = window as unknown as { E: { processImage: (f: File, o: unknown) => Promise<{ status: string }>; createEngine: (o: unknown) => { process: (f: File, o: unknown) => Promise<{ status: string }> } }; makeLarge: (w: number, h: number, q?: number) => Promise<File>; makeEngine: (l?: unknown) => { process: (f: File, o: unknown) => Promise<{ status: string }> } };
    const f = await w.makeLarge(140, 60, 0.9);
    const huge = idx % 2 === 0 ? await w.makeLarge(6000, 6000) : null;
    const side = w.makeEngine({}); // a second engine on the same page: parallel worker for the big jobs
    const t: Record<string, number> = {};
    const note = (k: string) => { t[k] = (t[k] ?? 0) + 1; };
    const outcome = (p: Promise<{ status: string }>) => p.then((r) => r.status, (e) => 'ERR:' + e.code);
    for (let i = 0; i < 40; i++) {
      const bigJob = huge && i % 4 === 0 ? outcome(side.process(huge, { ...SIG, width: undefined, height: undefined, minKb: undefined, maxKb: 50 })) : null;
      note('sig ' + await outcome(w.E.processImage(f, SIG)));
      if (bigJob) note('big ' + await bigJob);
    }
    return t;
  }, [SIG, idx] as const)));
  console.log('M6 pressure tallies', JSON.stringify(tallies));
  console.log('M6 pressure raw errors', raw.length ? raw.slice(0, 20).join('\n') : 'none');
  const bad = tallies.flatMap((t) => Object.keys(t)).filter((k) => /out_of_memory|worker_failed|corrupt/.test(k));
  expect(bad, JSON.stringify(tallies)).toEqual([]);
});

// ---- permanent regressions for the narrowed error mapping (failures injected only at width 141 / 142 / 143) ----
const INJECT = `
  const cb = OffscreenCanvas.prototype.convertToBlob;
  OffscreenCanvas.prototype.convertToBlob = function (o) {
    if (this.width === 141) return Promise.reject(new DOMException('Encoding failed.', 'EncodingError'));
    if (this.width === 142) return Promise.reject(new RangeError('Array buffer allocation failed'));
    return cb.call(this, o);
  };
  const gc = OffscreenCanvas.prototype.getContext;
  let nulled = false;
  OffscreenCanvas.prototype.getContext = function (...a) { if (this.width === 143 && !nulled) { nulled = true; return null; } return gc.apply(this, a); };
`;
test('narrow mapping in a real browser: encoder failure -> encode_failed, allocation -> out_of_memory, lost context rebuilt; next job unaffected', async ({ page, context }) => {
  await openHarness(page, context, { workerPrelude: INJECT });
  const r = await page.evaluate(async () => {
    const w = window as unknown as { E: { processImage: (f: File, o: unknown) => Promise<{ status: string; width: number }> }; makeLarge: (w: number, h: number, q?: number) => Promise<File> };
    const f = await w.makeLarge(300, 120, 0.9);
    const o = (width: number) => ({ format: 'jpeg', strategy: 'quality-first', lockAspect: true, fit: 'cover', background: 'white', width, height: 60 });
    const out = (p: Promise<{ status: string; width: number }>) => p.then((x) => `${x.status}:${x.width}`, (e) => `ERR:${e.code}`);
    return {
      encoderFail: await out(w.E.processImage(f, o(141))),
      next1: await out(w.E.processImage(f, o(140))),
      alloc: await out(w.E.processImage(f, o(142))),
      next2: await out(w.E.processImage(f, o(140))),
      lostContextRebuilt: await out(w.E.processImage(f, o(143))),
    };
  });
  expect(r).toEqual({ encoderFail: 'ERR:encode_failed', next1: 'ok:140', alloc: 'ERR:out_of_memory', next2: 'ok:140', lostContextRebuilt: 'ok:143' });
});
