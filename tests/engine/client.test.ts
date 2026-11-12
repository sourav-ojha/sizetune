import { describe, it, expect, vi, afterEach } from 'vitest';
import { createWorkerClient, createEngine, type WorkerLike } from '../../src/lib/engine/client';
import { supportsWorkerEngine } from '../../src/lib/engine/support';
import type { FromWorker, ToWorker } from '../../src/lib/engine/protocol';
import type { ProcessOptions, ProcessResult } from '../../src/lib/engine/types';

const opts: ProcessOptions = { format: 'jpeg', strategy: 'quality-first', lockAspect: true, fit: 'contain', background: 'white', maxKb: 50 };
const result = (px = 1000): ProcessResult => ({
  status: 'ok', blob: new Blob([new Uint8Array(10)]), mime: 'image/jpeg', width: 10, height: 10, bytes: 10, quality: 80, attempts: 1,
  window: { minBytes: null, maxBytes: 50_000 }, source: { bytes: 100, width: px, height: 1, mime: 'image/jpeg', hasAlpha: false, orientationApplied: true },
  notes: [], message: 'ok', mode: 'worker',
});

type Behaviour = (m: Extract<ToWorker, { type: 'process' }>, w: FakeWorker) => void;
class FakeWorker implements WorkerLike {
  static all: FakeWorker[] = [];
  onmessage: ((e: MessageEvent<FromWorker>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  onmessageerror: ((e: MessageEvent) => void) | null = null;
  terminated = false;
  received: ToWorker[] = [];
  constructor(private behaviour: Behaviour) { FakeWorker.all.push(this); }
  postMessage(m: ToWorker) {
    this.received.push(m);
    if (m.type === 'process') this.behaviour(m, this);
  }
  terminate() { this.terminated = true; }
  emit(m: FromWorker) { if (!this.terminated) this.onmessage?.({ data: m } as MessageEvent<FromWorker>); }
}

const replyAfter = (ms: number, px = 1000): Behaviour => (m, w) => {
  setTimeout(() => w.emit({ type: 'progress', id: m.id, p: { stage: 'encoding', attempt: 1, total: 20 } }), ms / 2);
  setTimeout(() => w.emit({ type: 'result', id: m.id, result: result(px) }), ms);
};

afterEach(() => { FakeWorker.all = []; vi.useRealTimers(); });

describe('worker client', () => {
  it('resolves, forwards progress, reuses the worker for small jobs, terminates after idle', async () => {
    vi.useFakeTimers();
    const c = createWorkerClient({ createWorker: () => new FakeWorker(replyAfter(10)), idleMs: 1000 });
    const prog = vi.fn();
    const p1 = c.process(new Blob(['x']), opts, { onProgress: prog });
    await vi.advanceTimersByTimeAsync(20);
    await expect(p1).resolves.toMatchObject({ status: 'ok' });
    expect(prog).toHaveBeenCalledWith({ stage: 'encoding', attempt: 1, total: 20 });
    const p2 = c.process(new Blob(['x']), opts);
    await vi.advanceTimersByTimeAsync(20);
    await p2;
    expect(FakeWorker.all.length).toBe(1); // reused
    expect(c.liveWorkers).toBe(1);
    await vi.advanceTimersByTimeAsync(1500);
    expect(FakeWorker.all[0].terminated).toBe(true);
    expect(c.liveWorkers).toBe(0);
  });
  it('terminates right after a job with a large source (memory release)', async () => {
    vi.useFakeTimers();
    const c = createWorkerClient({ createWorker: () => new FakeWorker(replyAfter(10, 36_000_000)) });
    const p = c.process(new Blob(['x']), opts);
    await vi.advanceTimersByTimeAsync(20);
    await p;
    expect(FakeWorker.all[0].terminated).toBe(true);
  });
  it('stale protection: a new request cancels the running one (rejects cancelled, worker terminated)', async () => {
    vi.useFakeTimers();
    const c = createWorkerClient({ createWorker: () => new FakeWorker(replyAfter(100)) });
    const first = c.process(new Blob(['a']), opts);
    const firstErr = first.catch((e) => e);
    await vi.advanceTimersByTimeAsync(10);
    const second = c.process(new Blob(['b']), opts);
    expect(await firstErr).toMatchObject({ code: 'cancelled' });
    expect(FakeWorker.all[0].terminated).toBe(true);
    await vi.advanceTimersByTimeAsync(200);
    await expect(second).resolves.toMatchObject({ status: 'ok' });
    expect(FakeWorker.all.length).toBe(2);
  });
  it('ignores messages carrying another job id', async () => {
    vi.useFakeTimers();
    const c = createWorkerClient({
      createWorker: () => new FakeWorker((m, w) => {
        setTimeout(() => w.emit({ type: 'result', id: m.id + 99, result: { ...result(), message: 'stale' } }), 5);
        setTimeout(() => w.emit({ type: 'result', id: m.id, result: result() }), 10);
      }),
    });
    const p = c.process(new Blob(['a']), opts);
    await vi.advanceTimersByTimeAsync(20);
    expect((await p).message).toBe('ok');
  });
  it('AbortSignal: rejects cancelled at once, posts cancel, terminates the worker', async () => {
    vi.useFakeTimers();
    const c = createWorkerClient({ createWorker: () => new FakeWorker(replyAfter(1000)) });
    const ac = new AbortController();
    const p = c.process(new Blob(['a']), opts, { signal: ac.signal }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(5);
    ac.abort();
    expect(await p).toMatchObject({ code: 'cancelled' });
    const w = FakeWorker.all[0];
    expect(w.received.some((m) => m.type === 'cancel')).toBe(true);
    expect(w.terminated).toBe(true);
    expect(c.liveWorkers).toBe(0);
    // pre-aborted
    await expect(c.process(new Blob(['a']), opts, { signal: ac.signal })).rejects.toMatchObject({ code: 'cancelled' });
    expect(FakeWorker.all.length).toBe(1);
  });
  it('timeout: rejects timeout and terminates a hung worker', async () => {
    vi.useFakeTimers();
    const c = createWorkerClient({ createWorker: () => new FakeWorker(() => {}), limits: { timeoutMs: 1000 }, graceMs: 100 });
    const p = c.process(new Blob(['a']), opts).catch((e) => e);
    await vi.advanceTimersByTimeAsync(1200);
    expect(await p).toMatchObject({ code: 'timeout' });
    expect(FakeWorker.all[0].terminated).toBe(true);
  });
  it('engine errors from the worker keep their code; a crash is worker_failed', async () => {
    const c = createWorkerClient({ createWorker: () => new FakeWorker((m, w) => setTimeout(() => w.emit({ type: 'error', id: m.id, code: 'corrupt', message: 'bad' }), 1)) });
    await expect(c.process(new Blob(['a']), opts)).rejects.toMatchObject({ code: 'corrupt', message: 'bad' });
    const d = createWorkerClient({ createWorker: () => new FakeWorker((_m, w) => setTimeout(() => w.onerror?.({ preventDefault() {} } as ErrorEvent), 1)) });
    await expect(d.process(new Blob(['a']), opts)).rejects.toMatchObject({ code: 'worker_failed' });
    const e = createWorkerClient({ createWorker: () => { throw new Error('no workers'); } });
    await expect(e.process(new Blob(['a']), opts)).rejects.toMatchObject({ code: 'worker_failed' });
  });
  it('dispose cancels and terminates', async () => {
    const c = createWorkerClient({ createWorker: () => new FakeWorker(() => {}) });
    const p = c.process(new Blob(['a']), opts).catch((e) => e);
    c.dispose();
    expect(await p).toMatchObject({ code: 'cancelled' });
    expect(FakeWorker.all[0].terminated).toBe(true);
  });
});

describe('createEngine: fallback chosen by feature detection only', () => {
  it('node has no OffscreenCanvas/Worker: detection says unsupported', () => {
    expect(supportsWorkerEngine()).toBe(false);
  });
  it('mode follows detection; worker errors are NOT retried on the main thread', async () => {
    expect(createEngine({ createWorker: () => new FakeWorker(() => {}), supportsWorker: () => false }).mode).toBe('main-thread');
    const e = createEngine({ createWorker: () => new FakeWorker((_m, w) => setTimeout(() => w.onerror?.({} as ErrorEvent), 1)), supportsWorker: () => true });
    expect(e.mode).toBe('worker');
    await expect(e.process(new Blob(['a']), opts)).rejects.toMatchObject({ code: 'worker_failed' });
  });
});
