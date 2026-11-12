import { describe, expect, it } from 'vitest';
import { EngineError } from '../../src/lib/engine/types';
import { ToolSession, type SessionDeps } from '../../src/components/tool/session';
import { makeResult, manualEngine, pngFile } from './fake-engine';

function setup(over: Partial<SessionDeps> = {}) {
  const eng = manualEngine();
  const live = new Set<string>();
  let n = 0;
  const deps: SessionDeps = {
    process: eng.process,
    createObjectURL: () => { const u = `blob:test/${++n}`; live.add(u); return u; },
    revokeObjectURL: (u) => { live.delete(u); },
    ...over,
  };
  return { s: new ToolSession(deps), eng, live };
}
const opts = { format: 'auto', strategy: 'quality-first', lockAspect: true, fit: 'contain', background: 'keep', maxKb: 20 } as const;
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('ToolSession (header checks, thumbnails, interruption)', () => {
  const big = { width: 20000, height: 20000 };
  it('rejects a huge-pixel image from its header BEFORE creating any URL or thumbnail', async () => {
    let thumbCalls = 0;
    const { s, live } = setup({
      maxPixels: 100_000_000,
      inspect: async () => big,
      makeThumbnail: async () => { thumbCalls++; return { kind: 'original', alpha: false }; },
    });
    await s.selectFile(pngFile('bomb.png'));
    const st = s.getSnapshot();
    expect(st.phase).toBe('empty');
    expect(st.file).toBeNull();
    expect(st.error?.code).toBe('too_many_pixels');
    expect(st.error?.message).toContain('20,000 × 20,000');
    expect(st.error?.message).toContain('400 megapixels');
    expect(live.size).toBe(0);
    expect(thumbCalls).toBe(0);
  });
  it('a header-checked file gets a thumbnail URL and an original URL, both revoked on reset; natural comes from the header', async () => {
    const { s, live } = setup({
      maxPixels: 100_000_000,
      inspect: async () => ({ width: 9000, height: 9000 }),
      makeThumbnail: async () => ({ kind: 'thumb', blob: new Blob(['t']), alpha: true }),
    });
    await s.selectFile(pngFile('a.png', 6)); // RGBA header: alpha possible, the thumbnail probe decides
    const st = s.getSnapshot();
    expect(st.natural).toEqual({ width: 9000, height: 9000 });
    expect(st.previewUrl).not.toBe(st.originalUrl);
    expect(st.alpha).toBe(true);
    expect(live.size).toBe(2);
    s.reset();
    expect(live.size).toBe(0);
  });
  it('a small image uses the file itself as the preview (one URL, revoked once)', async () => {
    const { s, live } = setup({ inspect: async () => ({ width: 100, height: 100 }), makeThumbnail: async () => ({ kind: 'original', alpha: false }) });
    await s.selectFile(pngFile());
    expect(s.getSnapshot().previewUrl).toBe(s.getSnapshot().originalUrl);
    expect(live.size).toBe(1);
    s.dispose();
    expect(live.size).toBe(0);
  });
  it('no preview kind: still ready, previewUrl null, original available', async () => {
    const { s } = setup({ inspect: async () => ({ width: 8000, height: 8000 }), makeThumbnail: async () => ({ kind: 'none', alpha: null }) });
    await s.selectFile(pngFile());
    expect(s.getSnapshot()).toMatchObject({ phase: 'ready', previewUrl: null });
    expect(s.getSnapshot().originalUrl).not.toBeNull();
  });
  it('a header error (corrupt) rejects without creating URLs', async () => {
    const { s, live } = setup({ inspect: async () => { throw new EngineError('corrupt', 'x'); } });
    await s.selectFile(pngFile());
    expect(s.getSnapshot().error?.code).toBe('corrupt');
    expect(live.size).toBe(0);
  });
  it('an engine "cancelled" that we did not ask for is shown with a retry, never swallowed', async () => {
    const { s, eng } = setup();
    await s.selectFile(pngFile());
    const p = s.run(opts);
    eng.calls[0].reject(new EngineError('cancelled', 'superseded inside the engine'));
    await p;
    expect(s.getSnapshot()).toMatchObject({ phase: 'ready', error: { action: 'retry' } });
    expect(s.getSnapshot().error?.message).toContain('interrupted');
  });
  it('Cancel keeps the file and returns to ready; a re-run works', async () => {
    const { s, eng } = setup();
    await s.selectFile(pngFile('keep.png'));
    void s.run(opts);
    s.cancel();
    expect(s.getSnapshot()).toMatchObject({ phase: 'ready', error: null });
    expect(s.getSnapshot().file?.name).toBe('keep.png');
    const p = s.run(opts);
    eng.calls[1].resolve(makeResult());
    await p;
    expect(s.getSnapshot().phase).toBe('done');
  });
  it('records the EXIF GPS flag reported by the header inspection', async () => {
    const { s } = setup({ inspect: async () => ({ width: 10, height: 10, hasGps: true }) });
    await s.selectFile(pngFile());
    expect(s.getSnapshot().gps).toBe(true);
    const t = setup({ inspect: async () => ({ width: 10, height: 10 }) });
    await t.s.selectFile(pngFile());
    expect(t.s.getSnapshot().gps).toBe(false);
  });
  it('uses width/height carried by an inspection error for the message', async () => {
    const { s } = setup({ inspect: async () => { throw Object.assign(new EngineError('too_many_pixels', 'x'), { width: 30000, height: 20000 }); } });
    await s.selectFile(pngFile());
    expect(s.getSnapshot().error?.message).toContain('30,000 × 20,000');
  });
});

describe('ToolSession (rejection, settings change)', () => {
  it('a wrong-type pick over a loaded image keeps the file, the result and its URLs, and reports the error', async () => {
    const { s, eng, live } = setup();
    await s.selectFile(pngFile('keep.png'));
    const p = s.run(opts);
    eng.calls[0].resolve(makeResult());
    await p;
    await s.selectFile(new File(['<svg></svg>'], 'x.svg', { type: 'image/svg+xml' }));
    const st = s.getSnapshot();
    expect(st.file?.name).toBe('keep.png');
    expect(st.phase).toBe('done');
    expect(st.result).not.toBeNull();
    expect(st.error?.code).toBe('unsupported_type');
    expect(live.size).toBe(2);
  });
  it('an oversized pick over a loaded image is also rejected without losing the current one', async () => {
    const { s } = setup({ maxFileBytes: 100 });
    await s.selectFile(pngFile('small.png'));
    await s.selectFile(new File([new Uint8Array(500)], 'big.png'));
    expect(s.getSnapshot().file?.name).toBe('small.png');
    expect(s.getSnapshot().error?.code).toBe('too_large_bytes');
  });
  it('changing settings during a run cancels it and says so', async () => {
    const { s, eng } = setup();
    await s.selectFile(pngFile());
    const p = s.run(opts);
    s.clearResult();
    expect(eng.calls[0].hooks!.signal!.aborted).toBe(true);
    expect(s.getSnapshot()).toMatchObject({ phase: 'ready', notice: expect.stringContaining('cancelled') });
    eng.calls[0].resolve(makeResult());
    await p;
    expect(s.getSnapshot().result).toBeNull();
    void s.run(opts); // starting again clears the notice
    expect(s.getSnapshot().notice).toBeNull();
  });
});

describe('ToolSession', () => {
  it('rejects non-image content by magic bytes without creating any URL', async () => {
    const { s, live } = setup();
    await s.selectFile(new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'evil.png', { type: 'image/png' }));
    const st = s.getSnapshot();
    expect(st.phase).toBe('empty');
    expect(st.file).toBeNull();
    expect(st.error?.code).toBe('unsupported_type');
    expect(st.error?.message).toContain('JPEG, PNG or WebP');
    expect(live.size).toBe(0);
  });
  it('rejects files over the cap before reading them', async () => {
    const { s } = setup({ maxFileBytes: 10 });
    await s.selectFile(pngFile());
    expect(s.getSnapshot().error?.code).toBe('too_large_bytes');
  });
  it('accepts an image, makes a preview and flags alpha hints', async () => {
    const { s, live } = setup();
    await s.selectFile(pngFile('a.png'));
    const st = s.getSnapshot();
    expect(st.phase).toBe('ready');
    expect(st.sniff).toEqual({ kind: 'png', hasAlpha: false });
    expect(live.size).toBe(1);
  });
  it('runs, shows progress and builds a result with a suggested filename', async () => {
    const { s, eng, live } = setup();
    await s.selectFile(pngFile('holiday.png'));
    const p = s.run(opts);
    expect(s.getSnapshot().phase).toBe('processing');
    eng.calls[0].hooks!.onProgress!({ stage: 'encoding', attempt: 2, total: 8 });
    expect(s.getSnapshot().progress).toEqual({ stage: 'encoding', attempt: 2, total: 8 });
    eng.calls[0].resolve(makeResult());
    await p;
    const st = s.getSnapshot();
    expect(st.phase).toBe('done');
    expect(st.result?.filename).toBe('holiday-sizetune.jpg');
    expect(st.result?.options).toEqual(opts);
    expect(live.size).toBe(2); // preview + result
  });
  it('drops the stale result when a new file is picked mid-run, and leaks no URL', async () => {
    const { s, eng, live } = setup();
    await s.selectFile(pngFile('a.png'));
    const p = s.run(opts);
    await s.selectFile(pngFile('b.png'));
    eng.calls[0].resolve(makeResult()); // late result for the old run
    await p;
    const st = s.getSnapshot();
    expect(st.phase).toBe('ready');
    expect(st.result).toBeNull();
    expect(st.file?.name).toBe('b.png');
    expect(live.size).toBe(1); // only the new preview
    expect(eng.calls[0].hooks!.signal!.aborted).toBe(true);
  });
  it('drops a result that resolves after Cancel, silently', async () => {
    const { s, eng, live } = setup();
    await s.selectFile(pngFile());
    const p = s.run(opts);
    s.cancel();
    expect(s.getSnapshot().phase).toBe('ready');
    eng.calls[0].resolve(makeResult());
    await p;
    expect(s.getSnapshot().result).toBeNull();
    expect(s.getSnapshot().error).toBeNull();
    expect(live.size).toBe(1);
  });
  it('treats the engine "cancelled" rejection that follows OUR abort as silent', async () => {
    const { s, eng } = setup();
    await s.selectFile(pngFile());
    const p = s.run(opts);
    s.cancel();
    eng.calls[0].reject(new EngineError('cancelled', 'x'));
    await p;
    expect(s.getSnapshot()).toMatchObject({ phase: 'ready', error: null });
  });
  it('maps engine failures to friendly errors and keeps the file for retry', async () => {
    const { s, eng } = setup();
    await s.selectFile(pngFile());
    const p = s.run({ ...opts, format: 'webp' });
    eng.calls[0].reject(new EngineError('encode_unsupported', 'no webp'));
    await p;
    const st = s.getSnapshot();
    expect(st.phase).toBe('ready');
    expect(st.file).not.toBeNull();
    expect(st.error).toMatchObject({ code: 'encode_unsupported', action: 'use-jpeg' });
  });
  it('a transient engine failure keeps the file and offers a retry', async () => {
    const { s, eng } = setup();
    await s.selectFile(pngFile());
    const p = s.run(opts);
    eng.calls[0].reject(new EngineError('encode_failed', 'x'));
    await p;
    expect(s.getSnapshot()).toMatchObject({ phase: 'ready', error: { code: 'encode_failed', action: 'retry' } });
    expect(s.getSnapshot().file).not.toBeNull();
  });
  it('a newer run supersedes an older one', async () => {
    const { s, eng } = setup();
    await s.selectFile(pngFile());
    const p1 = s.run(opts);
    const p2 = s.run({ ...opts, maxKb: 10 });
    eng.calls[0].resolve(makeResult({ width: 1 }));
    eng.calls[1].resolve(makeResult({ width: 2 }));
    await Promise.all([p1, p2]);
    expect(s.getSnapshot().result?.data.width).toBe(2);
  });
  it('clearResult revokes the result URL and returns to ready', async () => {
    const { s, eng, live } = setup();
    await s.selectFile(pngFile());
    const p = s.run(opts);
    eng.calls[0].resolve(makeResult());
    await p;
    s.clearResult();
    expect(s.getSnapshot()).toMatchObject({ phase: 'ready', result: null });
    expect(live.size).toBe(1);
  });
  it('reset and dispose revoke everything and abort', async () => {
    const { s, eng, live } = setup();
    await s.selectFile(pngFile());
    void s.run(opts);
    s.reset();
    await tick();
    expect(eng.calls[0].hooks!.signal!.aborted).toBe(true);
    expect(s.getSnapshot().phase).toBe('empty');
    expect(live.size).toBe(0);
    await s.selectFile(pngFile());
    const p = s.run(opts);
    eng.calls[1].resolve(makeResult());
    await p;
    expect(live.size).toBe(2);
    s.dispose();
    expect(live.size).toBe(0);
    expect(s.getSnapshot().phase).toBe('empty');
  });
  it('ignores an older file whose sniff finishes after a newer pick', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let first = true;
    const { s, live } = setup({
      readHead: async (f) => { if (first) { first = false; await gate; } return new Uint8Array(await f.slice(0, 64).arrayBuffer()); },
    });
    const p1 = s.selectFile(pngFile('old.png'));
    await s.selectFile(pngFile('new.png'));
    release();
    await p1;
    expect(s.getSnapshot().file?.name).toBe('new.png');
    expect(live.size).toBe(1);
  });
  it('does not run without a ready file', async () => {
    const { s, eng } = setup();
    await s.run(opts);
    expect(eng.calls.length).toBe(0);
  });
});
