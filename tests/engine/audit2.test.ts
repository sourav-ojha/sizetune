/** Second final audit: A4 (inspectFile completeness), A5 (libjpeg-style extraneous bytes), A2 (alpha detection). */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseHeader, readHeader } from '../../src/lib/engine/header';
import { assertComplete } from '../../src/lib/engine/complete';
import { inspectFile } from '../../src/lib/engine/inspect';
import { runPipeline } from '../../src/lib/engine/pipeline';
import { NOTES } from '../../src/lib/engine/messages';
import { jpegBytes, pngBytes } from './bytes';
import { fakeEnv, base, jpg, png } from './fake-env';

const FIX = path.join(import.meta.dirname, '../fixtures');
const mkBlob = (parts: unknown[]) => new Blob(parts as BlobPart[]);
const fix = (n: string) => mkBlob([fs.readFileSync(path.join(FIX, n))]);
const INCOMPLETE = 'This image file is incomplete; it may have been cut off while downloading or copying. Please use the original file.';

/** Insert `extra` bytes right after SOI+APP0 (offset 20) of a synthetic JPEG. */
const withExtra = (extra: number[]) => { const j = jpegBytes({ width: 640, height: 480 }); return new Uint8Array([...j.slice(0, 20), ...extra, ...j.slice(20)]); };

describe('A5: extraneous bytes between JPEG segments (libjpeg tolerance), bounded', () => {
  it('skips zero / non-FF bytes and extra FF fill bytes before the next marker', () => {
    for (const extra of [[0, 0, 0, 0], [0x20, 0x0d, 0x0a], [0xff, 0xff, 0xff], [0, 0, 0xff, 0xff]]) {
      const r = parseHeader(withExtra(extra), withExtra(extra).length);
      expect(r.ok, JSON.stringify(extra)).toBe(true);
      if (r.ok) expect([r.info.width, r.info.height]).toEqual([640, 480]);
    }
  });
  it('the committed fixture (4 zero bytes between segments) parses, is complete and inspects', async () => {
    const f = fix('jpeg-extraneous-bytes.jpg');
    const h = await readHeader(f);
    expect([h.width, h.height]).toEqual([200, 230]);
    await expect(assertComplete(f, h)).resolves.toBeUndefined();
    expect(await inspectFile(f)).toMatchObject({ width: 200, height: 230, hasGps: false });
  });
  it('still rejects garbage: > 64 KB of junk between segments, or no marker at all', () => {
    const big = withExtra(new Array(70 * 1024).fill(0));
    expect(parseHeader(big, big.length)).toMatchObject({ ok: false, reason: 'corrupt' });
    const junk = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 1, 2, ...new Array(200).fill(0x41)]);
    expect(parseHeader(junk, junk.length).ok).toBe(false);
  });
});

describe('A4: inspectFile refuses incomplete files at pick (same friendly error)', () => {
  it.each(['corrupt-truncated.jpg', 'corrupt-truncated.png', 'corrupt-truncated.webp', 'jpeg-no-eoi.jpg', 'progressive-truncated-70.jpg'])('%s', async (n) => {
    await expect(inspectFile(fix(n))).rejects.toMatchObject({ code: 'corrupt', message: INCOMPLETE });
  });
  it('complete files with trailers still inspect fine', async () => {
    expect(await inspectFile(fix('motion-photo-like.jpg'))).toMatchObject({ width: 200, height: 230 });
    expect(await inspectFile(fix('trailing-garbage.jpg'))).toMatchObject({ width: 200, height: 230 });
  });
  it('a large truncated JPEG (synthetic, 6 MB of scan data, cut at 90%) is detected', async () => {
    const j = jpegBytes({ width: 4000, height: 4000 });
    const sos = j.findIndex((v, i) => v === 0xff && j[i + 1] === 0xda);
    const scan = new Uint8Array(6 * 1024 * 1024).fill(0x55);
    const full = mkBlob([j.slice(0, sos + 10), scan, new Uint8Array([0xff, 0xd9])]);
    expect(await inspectFile(full)).toMatchObject({ width: 4000 });
    await expect(inspectFile(full.slice(0, Math.floor(full.size * 0.9)))).rejects.toMatchObject({ code: 'corrupt' });
  });
});

describe('A2a: PNG alpha hint from the chunk walk', () => {
  /** PNG with `n` tiny tEXt chunks before PLTE/tRNS/IDAT. */
  function manyChunks(n: number, colorType: number, trns: boolean) {
    const p = pngBytes({ width: 4, height: 4, colorType, tRNS: trns });
    const text = [0, 0, 0, 1, 0x74, 0x45, 0x58, 0x74, 0x41, 0, 0, 0, 0]; // len 1 'tEXt' 'A' crc
    const pre: number[] = [];
    for (let k = 0; k < n; k++) pre.push(...text);
    return new Uint8Array([...p.slice(0, 33), ...pre, ...p.slice(33)]);
  }
  it('palette PNG with tRNS after 20,000 ancillary chunks: alpha possible', async () => {
    expect((await readHeader(mkBlob([manyChunks(20_000, 3, true)]))).alphaPossible).toBe(true);
    expect((await readHeader(mkBlob([manyChunks(20_000, 2, false)]))).alphaPossible).toBe(false);
  });
  it('if the walk cannot reach IDAT within the read cap, alpha is assumed possible (conservative), not corrupt', async () => {
    const b = mkBlob([manyChunks(30_000, 2, false)]);
    const h = await readHeader(b, { maxRead: 64 * 1024 });
    expect(h).toMatchObject({ width: 4, height: 4, alphaPossible: true });
  });
});

describe('A2b: full-resolution alpha scan and the honest note', () => {
  it('<= 12 MP: the probe misses a sub-pixel hole, the full strip scan finds it -> flatten is disclosed', async () => {
    const f = fakeEnv({ alphaSubpixel: true });
    const r = await runPipeline(png(3000, 2000), { ...base, format: 'jpeg' }, f.env);
    expect(f.alphaCalls).toEqual(['probe', 'full']);
    expect(r.source.hasAlpha).toBe(true);
    expect(r.notes).toContain('Transparent areas were filled with white.');
  });
  it('> 12 MP (reduced decode): cannot see sub-pixel holes -> note only for JPEG output', async () => {
    const f = fakeEnv({ alphaSubpixel: true });
    const r = await runPipeline(png(5000, 4000), { ...base, format: 'jpeg' }, f.env);
    expect(f.alphaCalls).toEqual(['probe']);
    expect(r.notes).toContain(NOTES.alphaMaybeMissed);
    expect(NOTES.alphaMaybeMissed).toBe('Very small transparent areas in very large images may be filled with the background colour.');
    const p = await runPipeline(png(5000, 4000), { ...base, format: 'png' }, fakeEnv({ alphaSubpixel: true }).env);
    expect(p.notes).not.toContain(NOTES.alphaMaybeMissed);
  });
  it('no full scan when the header rules out alpha or the probe already found it', async () => {
    const a = fakeEnv({ alphaSubpixel: true });
    await runPipeline(jpg(3000, 2000), base, a.env);
    expect(a.alphaCalls).toEqual([]);
    const b = fakeEnv({ alpha: true });
    await runPipeline(png(3000, 2000), { ...base, format: 'jpeg' }, b.env);
    expect(b.alphaCalls).toEqual(['probe']);
  });
});
