import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeThumbnail, PREVIEW_DECODE_MAX_PIXELS, PREVIEW_SIDE } from '../../src/components/tool/thumb';

/** Minimal browser fakes: a canvas that records its size and every pixel read, and a createImageBitmap that can IGNORE resize options. */
function fakes(opts: { honourResize: boolean; srcW: number; srcH: number; failDecode?: boolean }) {
  const log = { canvases: [] as Array<{ width: number; height: number }>, draws: [] as number[][], reads: [] as number[][], closed: 0, bitmapArgs: [] as unknown[] };
  vi.stubGlobal('createImageBitmap', async (_f: unknown, o?: { resizeWidth?: number; resizeHeight?: number }) => {
    log.bitmapArgs.push(o);
    if (opts.failDecode) throw new Error('decode failed');
    const w = opts.honourResize && o?.resizeWidth ? o.resizeWidth : opts.srcW;
    const h = opts.honourResize && o?.resizeHeight ? o.resizeHeight : opts.srcH;
    return { width: w, height: h, close: () => { log.closed++; } };
  });
  vi.stubGlobal('document', {
    createElement: () => {
      const c = {
        width: 0, height: 0,
        getContext: () => ({
          drawImage: (...a: number[]) => { log.draws.push(a.slice(1)); },
          getImageData: (_x: number, _y: number, w: number, h: number) => { log.reads.push([w, h]); return { data: new Uint8ClampedArray(Math.min(w * h * 4, 4096)).fill(255) }; },
        }),
        toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['x'])),
      };
      log.canvases.push(c);
      return c;
    },
  });
  return log;
}

afterEach(() => vi.unstubAllGlobals());

describe('makeThumbnail', () => {
  it('plans the thumbnail size and draws into a canvas of exactly that size', async () => {
    const log = fakes({ honourResize: true, srcW: 8000, srcH: 4000 });
    const t = await makeThumbnail(new Blob(['x']), 8000, 4000, true);
    expect(t.kind).toBe('thumb');
    expect(log.bitmapArgs[0]).toMatchObject({ resizeWidth: PREVIEW_SIDE, resizeHeight: 512 });
    expect(log.draws[0]).toEqual([0, 0, PREVIEW_SIDE, 512]);
    expect(log.reads).toEqual([[PREVIEW_SIDE, 512]]);
    expect(log.closed).toBe(1);
  });

  it('a browser that IGNORES the resize options never gets a full-size canvas, pixel read or encode', async () => {
    const log = fakes({ honourResize: false, srcW: 6000, srcH: 4000 });
    const t = await makeThumbnail(new Blob(['x']), 6000, 4000, true);
    expect(t.kind).toBe('thumb');
    // the bitmap came back 6000x4000, but nothing is sized from it
    for (const c of log.canvases) expect([c.width, c.height]).toEqual([0, 0]); // zeroed after use
    expect(log.draws[0]).toEqual([0, 0, PREVIEW_SIDE, 683]); // scaled into the planned size
    expect(log.reads).toEqual([[PREVIEW_SIDE, 683]]);
    expect(log.closed).toBe(1); // oversized bitmap released right after the draw
  });

  it('records the canvas size at allocation time, not just after cleanup', async () => {
    const sizes: number[][] = [];
    const log = fakes({ honourResize: false, srcW: 6000, srcH: 6000 });
    const orig = (document as unknown as { createElement: () => { width: number; height: number } }).createElement;
    vi.stubGlobal('document', { createElement: () => { const c = orig(); let w = 0, h = 0; return Object.defineProperties(c, { width: { get: () => w, set: (v) => { w = v; sizes.push([v, h]); } }, height: { get: () => h, set: (v) => { h = v; sizes.push([w, v]); } } }); } });
    await makeThumbnail(new Blob(['x']), 6000, 6000, false);
    expect(Math.max(...sizes.flat())).toBeLessThanOrEqual(PREVIEW_SIDE);
    expect(log.closed).toBeGreaterThan(0);
  });

  it('small images use the file itself (no re-encode) and still answer the alpha question', async () => {
    const log = fakes({ honourResize: true, srcW: 800, srcH: 600 });
    expect(await makeThumbnail(new Blob(['x']), 800, 600, true)).toEqual({ kind: 'original', alpha: false });
    expect(log.reads).toEqual([[800, 600]]);
  });

  it('skips the decode entirely above the preview limit', async () => {
    const log = fakes({ honourResize: true, srcW: 1, srcH: 1 });
    const side = Math.ceil(Math.sqrt(PREVIEW_DECODE_MAX_PIXELS)) + 1;
    expect(await makeThumbnail(new Blob(['x']), side, side, true)).toEqual({ kind: 'none', alpha: null, reason: 'too-large' });
    expect(log.bitmapArgs).toEqual([]);
  });

  it('a failed decode of a mid-size image is reported as "failed", not "very large"', async () => {
    fakes({ honourResize: true, srcW: 4000, srcH: 4000, failDecode: true });
    expect(await makeThumbnail(new Blob(['x']), 4000, 4000, false)).toEqual({ kind: 'none', alpha: false, reason: 'failed' });
  });

  it('a failed decode of a small image falls back to the file itself', async () => {
    fakes({ honourResize: true, srcW: 100, srcH: 100, failDecode: true });
    expect(await makeThumbnail(new Blob(['x']), 100, 100, true)).toEqual({ kind: 'original', alpha: null });
  });
});
