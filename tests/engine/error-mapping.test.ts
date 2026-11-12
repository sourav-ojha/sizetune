/** UI review M6: only genuine allocation failures may become out_of_memory; a failed job never poisons the next. */
import { describe, it, expect } from 'vitest';
import { classifyBrowserError, isAllocationFailure, LARGE_CANVAS_PIXELS } from '../../src/lib/engine/errors';
import { runPipeline } from '../../src/lib/engine/pipeline';
import { createWorkerClient, type WorkerLike } from '../../src/lib/engine/client';
import type { FromWorker, ToWorker } from '../../src/lib/engine/protocol';
import { fakeEnv, base, jpg } from './fake-env';

describe('isAllocationFailure', () => {
  it('true only for real allocation signals', () => {
    expect(isAllocationFailure(new RangeError('Array buffer allocation failed'))).toBe(true);
    expect(isAllocationFailure(new RangeError('Invalid typed array length: 4294967296'))).toBe(true);
    expect(isAllocationFailure(new DOMException('Out of memory', 'UnknownError'))).toBe(true);
    expect(isAllocationFailure(new Error('Failed to allocate the canvas buffer'))).toBe(true);
    expect(isAllocationFailure(new DOMException('', 'QuotaExceededError'))).toBe(true);
    for (const e of [
      new DOMException('The source image could not be decoded.', 'InvalidStateError'),
      new DOMException('Encoding failed.', 'EncodingError'),
      new Error('memory'), // a bare word is not evidence
      new Error('value too large'),
      new TypeError('x is not a function'),
      'string', null, undefined,
    ]) expect(isAllocationFailure(e), String(e)).toBe(false);
  });
});

describe('classifyBrowserError', () => {
  it('decode: allocation -> out_of_memory, anything else -> corrupt', () => {
    expect(classifyBrowserError(new RangeError('Array buffer allocation failed'), 'decode', 100).code).toBe('out_of_memory');
    expect(classifyBrowserError(new DOMException('The source image could not be decoded.', 'InvalidStateError'), 'decode', 100).code).toBe('corrupt');
    expect(classifyBrowserError(new Error('image too large maybe'), 'decode', 100).code).toBe('corrupt');
  });
  it('canvas unusable: out_of_memory only for large canvases, otherwise encode_failed', () => {
    expect(classifyBrowserError(null, 'canvas', 140 * 60).code).toBe('encode_failed');
    expect(classifyBrowserError(null, 'canvas', LARGE_CANVAS_PIXELS).code).toBe('out_of_memory');
  });
  it('encode: allocation -> out_of_memory; generic rejection -> encode_failed; null toBlob on a large canvas -> out_of_memory', () => {
    expect(classifyBrowserError(new DOMException('Encoding failed.', 'EncodingError'), 'encode', 140 * 60).code).toBe('encode_failed');
    expect(classifyBrowserError(new DOMException('Encoding failed.', 'EncodingError'), 'encode', 20_000_000).code).toBe('encode_failed');
    expect(classifyBrowserError(new RangeError('Array buffer allocation failed'), 'encode', 140 * 60).code).toBe('out_of_memory');
    expect(classifyBrowserError(null, 'encode', 140 * 60).code).toBe('encode_failed');
    expect(classifyBrowserError(null, 'encode', LARGE_CANVAS_PIXELS).code).toBe('out_of_memory');
  });
  it('messages are user-safe and never echo the raw browser text', () => {
    const e = classifyBrowserError(new Error('secret raw detail /Users/x'), 'encode', 10);
    expect(e.message).not.toMatch(/secret|Users/);
    expect(e.message).toBe('The browser could not save the image this time. Please try again.');
  });
});

describe('pipeline uses the narrow mapping', () => {
  it('a decode error whose text merely contains "memory"/"too large" is corrupt, not out_of_memory', async () => {
    await expect(runPipeline(jpg(140, 60), base, fakeEnv({ decodeFails: new Error('decoder: memory region too large for header') }).env)).rejects.toMatchObject({ code: 'corrupt' });
    await expect(runPipeline(jpg(140, 60), base, fakeEnv({ decodeFails: new RangeError('Array buffer allocation failed') }).env)).rejects.toMatchObject({ code: 'out_of_memory' });
  });
});

describe('worker reuse: a failed or aborted job never poisons the next', () => {
  class W implements WorkerLike {
    static made = 0;
    onmessage: ((e: MessageEvent<FromWorker>) => void) | null = null;
    onerror: ((e: ErrorEvent) => void) | null = null;
    onmessageerror: ((e: MessageEvent) => void) | null = null;
    terminated = false;
    readonly n = ++W.made;
    constructor(private failFirst: boolean) {}
    postMessage(m: ToWorker) {
      if (m.type !== 'process') return;
      setTimeout(() => {
        if (this.terminated) return;
        if (this.failFirst && this.n === 1) this.onmessage?.({ data: { type: 'error', id: m.id, code: 'encode_failed', message: 'x' } } as MessageEvent<FromWorker>);
        else this.onmessage?.({ data: { type: 'result', id: m.id, result: { status: 'ok', source: { width: 140, height: 60 } } } } as unknown as MessageEvent<FromWorker>);
      }, 5);
    }
    terminate() { this.terminated = true; }
  }
  it('error -> next job runs on a NEW worker and succeeds', async () => {
    W.made = 0;
    const workers: W[] = [];
    const c = createWorkerClient({ createWorker: () => { const w = new W(true); workers.push(w); return w; } });
    await expect(c.process(new Blob(['a']), base)).rejects.toMatchObject({ code: 'encode_failed' });
    expect(workers[0].terminated).toBe(true);
    await expect(c.process(new Blob(['a']), base)).resolves.toMatchObject({ status: 'ok' });
    expect(workers.length).toBe(2);
  });
  it('abort -> next job runs on a NEW worker; the aborted worker cannot deliver anything', async () => {
    W.made = 0;
    const workers: W[] = [];
    const c = createWorkerClient({ createWorker: () => { const w = new W(false); workers.push(w); return w; } });
    const ac = new AbortController();
    const a = c.process(new Blob(['a']), base, { signal: ac.signal });
    ac.abort();
    await expect(a).rejects.toMatchObject({ code: 'cancelled' });
    await expect(c.process(new Blob(['b']), base)).resolves.toMatchObject({ status: 'ok' });
    expect(workers.length).toBe(2);
    expect(workers[0].terminated).toBe(true);
  });
});
