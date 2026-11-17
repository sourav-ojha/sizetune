import { describe, it, expect } from 'vitest';
import { unzipSync } from 'fflate';
import { BATCH_MAX_FILES, BATCH_MAX_TOTAL_BYTES, BatchRunner, buildBatchZip, outputName } from '../src/components/tool/batch';
import { EngineError } from '../src/lib/engine/types';
import type { ProcessOptions, ProcessResult } from '../src/lib/engine/types';

const OPTS: ProcessOptions = { format: 'auto', strategy: 'quality-first', lockAspect: true, fit: 'contain', background: 'white', maxKb: 50 };
const file = (name: string, bytes = 1000) => new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' });
const result = (over: Partial<ProcessResult> = {}): ProcessResult => ({
  status: 'ok', blob: new Blob([new Uint8Array(40)], { type: 'image/jpeg' }), mime: 'image/jpeg', width: 100, height: 80, bytes: 40, quality: 80, attempts: 1,
  window: { minBytes: null, maxBytes: 50_000 }, source: { bytes: 1000, width: 200, height: 160, mime: 'image/jpeg', hasAlpha: false, orientationApplied: true },
  notes: [], message: '', ...over,
});

/** A fake engine that records concurrency and lets a test decide how each call ends. */
function fake(decide: (f: File, i: number) => ProcessResult | EngineError | 'hang') {
  const calls: string[] = [];
  let live = 0;
  let maxLive = 0;
  const process = async (f: Blob, _o: ProcessOptions, hooks?: { signal?: AbortSignal }): Promise<ProcessResult> => {
    live++; maxLive = Math.max(maxLive, live);
    calls.push((f as File).name);
    try {
      const d = decide(f as File, calls.length - 1);
      if (d === 'hang') return await new Promise<ProcessResult>((_, rej) => hooks?.signal?.addEventListener('abort', () => rej(new EngineError('cancelled', 'Cancelled.'))));
      await Promise.resolve();
      if (d instanceof EngineError) throw d;
      return d;
    } finally { live--; }
  };
  const urls = new Set<string>();
  let n = 0;
  const runner = new BatchRunner({ process, createObjectURL: () => { const u = `blob:${++n}`; urls.add(u); return u; }, revokeObjectURL: (u) => urls.delete(u) });
  return { runner, calls, urls, maxLive: () => maxLive };
}
const settle = async (r: BatchRunner) => { for (let i = 0; i < 50 && r.getSnapshot().running; i++) await new Promise((res) => setTimeout(res, 0)); };

describe('batch queue (FEATURE-005 AC-1, AC-2, AC-7)', () => {
  it('lists every added file as queued', () => {
    const { runner } = fake(() => result());
    runner.add([file('a.jpg'), file('b.jpg'), file('c.jpg')]);
    expect(runner.getSnapshot().rows.map((r) => [r.name, r.status])).toEqual([['a.jpg', 'queued'], ['b.jpg', 'queued'], ['c.jpg', 'queued']]);
  });
  it('processes one file at a time, in order, and each row shows its status', async () => {
    const { runner, calls, maxLive } = fake(() => result());
    runner.add([file('a.jpg'), file('b.jpg'), file('c.jpg')]);
    runner.start(OPTS);
    await settle(runner);
    expect(calls).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect(maxLive()).toBe(1);
    expect(runner.getSnapshot().rows.every((r) => r.status === 'reached' && r.url && r.bytes === 40)).toBe(true);
  });
  it('adds only what fits under the file cap and explains it; the excess is never processed', async () => {
    const { runner, calls } = fake(() => result());
    const many = Array.from({ length: BATCH_MAX_FILES + 3 }, (_, i) => file(`f${i}.jpg`));
    const out = runner.add(many);
    expect(out.added).toBe(BATCH_MAX_FILES);
    expect(out.message).toMatch(new RegExp(`${BATCH_MAX_FILES} files`));
    runner.start(OPTS);
    await settle(runner);
    expect(calls.length).toBe(BATCH_MAX_FILES);
  });
  it('also caps the total size', () => {
    const { runner } = fake(() => result());
    const big = BATCH_MAX_TOTAL_BYTES / 2 + 1;
    const out = runner.add([file('a.jpg', 10), { ...file('x', 1), size: big } as File, { ...file('y', 1), size: big } as File]);
    expect(out.added).toBeLessThan(3);
    expect(out.message).toMatch(/MB/);
  });
});

describe('statuses and failures (AC-4, edge cases)', () => {
  it('a file that cannot reach the target says so and keeps the achieved size', async () => {
    const { runner } = fake(() => result({ status: 'above_max', bytes: 70_000, blob: new Blob([new Uint8Array(70)]), message: 'Too detailed.' }));
    runner.add([file('a.jpg')]);
    runner.start(OPTS);
    await settle(runner);
    expect(runner.getSnapshot().rows[0]).toMatchObject({ status: 'not-reached', bytes: 70_000, message: 'Too detailed.' });
  });
  it('one failure does not stop the others and carries the engine message', async () => {
    const { runner } = fake((_f, i) => (i === 1 ? new EngineError('corrupt', 'This image file is incomplete.') : result()));
    runner.add([file('a.jpg'), file('b.jpg'), file('c.jpg')]);
    runner.start(OPTS);
    await settle(runner);
    expect(runner.getSnapshot().rows.map((r) => r.status)).toEqual(['reached', 'failed', 'reached']);
    expect(runner.getSnapshot().rows[1].message).toBe('This image file is incomplete.');
  });
});

describe('cancel (AC-8)', () => {
  it('stops the running file, marks the rest cancelled and keeps finished files downloadable', async () => {
    const { runner, calls } = fake((_f, i) => (i === 1 ? 'hang' : result()));
    runner.add([file('a.jpg'), file('b.jpg'), file('c.jpg')]);
    runner.start(OPTS);
    for (let i = 0; i < 20 && calls.length < 2; i++) await new Promise((r) => setTimeout(r, 0));
    runner.cancel();
    await settle(runner);
    const rows = runner.getSnapshot().rows;
    expect(rows.map((r) => r.status)).toEqual(['reached', 'cancelled', 'cancelled']);
    expect(rows[0].url).toBeTruthy();
    expect(calls).toEqual(['a.jpg', 'b.jpg']);
  });
});

describe('memory hygiene', () => {
  it('revokes every object URL on reset and dispose', async () => {
    const { runner, urls } = fake(() => result());
    runner.add([file('a.jpg'), file('b.jpg')]);
    runner.start(OPTS);
    await settle(runner);
    expect(urls.size).toBe(2);
    runner.reset();
    expect(urls.size).toBe(0);
    runner.add([file('c.jpg')]);
    runner.start(OPTS);
    await settle(runner);
    runner.dispose();
    expect(urls.size).toBe(0);
  });
});

describe('ZIP (AC-3)', () => {
  it('names outputs by the real result type and makes duplicate names unique', async () => {
    expect(outputName('photo.png', 'image/jpeg')).toBe('photo.jpg');
    expect(outputName('photo', 'image/webp')).toBe('photo.webp');
    const { runner } = fake(() => result());
    runner.add([file('photo.jpg'), file('photo.jpg'), file('photo.png')]);
    runner.start(OPTS);
    await settle(runner);
    const z = unzipSync(await buildBatchZip(runner.getSnapshot().rows));
    expect(Object.keys(z).sort()).toEqual(['SizeTune-report.txt', 'photo-2.jpg', 'photo-3.jpg', 'photo.jpg']);
  });
  it('holds every reached file, leaves out others, and lists every file in the report', async () => {
    const { runner } = fake((_f, i) => (i === 0 ? result() : i === 1 ? result({ status: 'above_max', bytes: 70_000 }) : new EngineError('corrupt', 'Incomplete.')));
    runner.add([file('ok.jpg'), file('big.jpg'), file('bad.jpg')]);
    runner.start(OPTS);
    await settle(runner);
    const z = unzipSync(await buildBatchZip(runner.getSnapshot().rows));
    expect(Object.keys(z).sort()).toEqual(['SizeTune-report.txt', 'ok.jpg']);
    const report = new TextDecoder().decode(z['SizeTune-report.txt']);
    expect(report).toMatch(/ok\.jpg.*reached/i);
    expect(report).toMatch(/big\.jpg.*not reached/i);
    expect(report).toMatch(/bad\.jpg.*failed.*Incomplete/i);
  });
});
