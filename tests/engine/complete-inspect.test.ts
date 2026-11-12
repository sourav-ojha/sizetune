/** Final audit: F2 truncation detection, F6 resize-ignoring browsers, and the inspectFile() export. */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { assertComplete } from '../../src/lib/engine/complete';
import { readHeader } from '../../src/lib/engine/header';
import { inspectFile } from '../../src/lib/engine/inspect';
import { runPipeline } from '../../src/lib/engine/pipeline';
import { EngineError } from '../../src/lib/engine/types';
import { fakeEnv, base, jpg } from './fake-env';
import { jpegBytes, pngBytes, asciiBytes } from './bytes';

/** Typed Blob constructor for byte arrays (TS 6 lib: Uint8Array<ArrayBufferLike> is not a BlobPart). */
const mkBlob = (parts: unknown[]) => new Blob(parts as BlobPart[]);
const FIX = path.join(import.meta.dirname, '../fixtures');
const fix = (n: string) => mkBlob([fs.readFileSync(path.join(FIX, n))]);
const complete = async (b: Blob) => assertComplete(b, await readHeader(b)).then(() => true, (e) => { if (!(e instanceof EngineError)) throw e; expect(e.code).toBe('corrupt'); return false; });

describe('F2: truncated files are detected before decoding', () => {
  it.each([
    ['photo-200x230.jpg', true], ['progressive-640x480.jpg', true], ['exif6-gps.jpg', true], ['cmyk-300x200.jpg', true],
    ['trailing-garbage.jpg', true], ['motion-photo-like.jpg', true], ['corrupt-truncated.jpg', false],
    ['transparent.png', true], ['signature-1200x400.png', true], ['corrupt-truncated.png', false],
    ['photo-800x600.webp', true], ['alpha-400x300.webp', true], ['corrupt-truncated.webp', false],
  ])('%s complete=%s', async (n, want) => {
    expect(await complete(fix(n))).toBe(want);
  });
  it('JPEG: an EOI inside an EXIF thumbnail does not count for a truncated main image', async () => {
    const full = jpegBytes({ width: 64, height: 48 });
    const thumb = [0xff, 0xe1, 0x00, 0x0c, ...asciiBytes('Exif'), 0, 0, 0xff, 0xd8, 0xff, 0xd9]; // APP1 carrying "FFD8 FFD9"
    const sos = full.findIndex((v, i) => v === 0xff && full[i + 1] === 0xda);
    const cut = new Uint8Array([...full.slice(0, 2), ...thumb, ...full.slice(2, sos + 12)]); // SOS + a little data, no EOI
    expect(await complete(mkBlob([cut]))).toBe(false);
    expect(await complete(mkBlob([new Uint8Array([...full.slice(0, 2), ...thumb, ...full.slice(2)])]))).toBe(true);
  });
  it('JPEG: EOI far before the end (big trailer) is found by the bounded forward scan', async () => {
    const j = jpegBytes({ width: 8, height: 8 });
    const tail = new Uint8Array(300 * 1024).fill(0x41);
    expect(await complete(mkBlob([j, tail]))).toBe(true);
  });
  it('PNG: IEND beyond the tail window is found by the chunk walk; trailing data allowed', async () => {
    const p = pngBytes({ width: 4, height: 4 });
    expect(await complete(mkBlob([p, new Uint8Array(200 * 1024)]))).toBe(true);
    expect(await complete(mkBlob([p.slice(0, p.length - 12)]))).toBe(false); // IEND removed
  });
  it('pipeline rejects a truncated file as corrupt with a friendly message, without decoding', async () => {
    const f = fakeEnv();
    const e = await runPipeline(fix('corrupt-truncated.jpg'), base, f.env).catch((x) => x);
    expect(e).toMatchObject({ code: 'corrupt', message: 'This image file is incomplete; it may have been cut off while downloading or copying. Please use the original file.' });
    expect(f.images.length).toBe(0);
  });
});

describe('F6: a browser that ignores resizeWidth is not punished', () => {
  it('bitmap larger than planned but within the header: downscaled on a canvas, job succeeds, all bitmaps closed', async () => {
    const f = fakeEnv({ ignoreResize: true });
    const r = await runPipeline(jpg(8000, 6000), { ...base, maxKb: 200 }, f.env);
    expect(r.status).toBe('ok');
    expect(f.downscales.length).toBe(1);
    expect(f.downscales[0].w * f.downscales[0].h).toBeLessThanOrEqual(6_000_000 * 1.01);
    expect(f.images.every((i) => i.closed)).toBe(true);
    expect(r.width * r.height).toBeLessThanOrEqual(6_000_000 * 1.01);
  });
  it('decoded larger than the header still -> corrupt', async () => {
    await expect(runPipeline(jpg(3000, 2000), base, fakeEnv({ inflate: 1.5 }).env)).rejects.toMatchObject({ code: 'corrupt' });
    await expect(runPipeline(jpg(8000, 6000), base, fakeEnv({ ignoreResize: true, inflate: 1.2 }).env)).rejects.toMatchObject({ code: 'corrupt' });
  });
});

/** TIFF with IFD0 { GPSInfo -> GPS IFD with 1 entry } (big-endian). */
function tiffWithGps(withGps: boolean): number[] {
  const be16 = (n: number) => [(n >> 8) & 255, n & 255];
  const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const t = [0x4d, 0x4d, ...be16(42), ...be32(8), ...be16(1)];
  if (withGps) t.push(...be16(0x8825), ...be16(4), ...be32(1), ...be32(26));
  else t.push(...be16(0x0112), ...be16(3), ...be32(1), ...be16(1), 0, 0);
  t.push(...be32(0));
  t.push(...be16(1), ...be16(1), ...be16(2), ...be32(2), 0x4e, 0, 0, 0, ...be32(0)); // GPS IFD @26: LatitudeRef 'N'
  return t;
}

describe('inspectFile (header-only, for the UI at file pick)', () => {
  it('JPEG with EXIF orientation and GPS', async () => {
    expect(await inspectFile(fix('exif6-gps.jpg'))).toEqual({ mime: 'image/jpeg', width: 300, height: 400, orientation: 6, alphaPossible: false, hasGps: true });
    expect(await inspectFile(fix('photo-200x230.jpg'))).toMatchObject({ width: 200, height: 230, hasGps: false });
  });
  it('PNG / WebP basics and alpha hints', async () => {
    expect(await inspectFile(fix('transparent.png'))).toEqual({ mime: 'image/png', width: 800, height: 600, orientation: 1, alphaPossible: true, hasGps: false });
    expect(await inspectFile(fix('photo-800x600.webp'))).toMatchObject({ mime: 'image/webp', alphaPossible: false, hasGps: false });
  });
  it('PNG eXIf and WebP EXIF chunks with GPS', async () => {
    const p = pngBytes({ width: 4, height: 4 });
    const crc = 0; // CRC is not validated by the header reader
    const exif = tiffWithGps(true);
    const chunk = [(exif.length >>> 24) & 255, (exif.length >>> 16) & 255, (exif.length >>> 8) & 255, exif.length & 255, ...asciiBytes('eXIf'), ...exif, 0, 0, 0, crc];
    const withExif = new Uint8Array([...p.slice(0, 33), ...chunk, ...p.slice(33)]);
    expect((await inspectFile(mkBlob([withExif]))).hasGps).toBe(true);
    // WebP: VP8X (EXIF flag) + VP8 + EXIF chunk at the end
    const le32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
    const vp8x = [...asciiBytes('VP8X'), ...le32(10), 0x08, 0, 0, 0, 9, 0, 0, 9, 0, 0];
    const vp8d = [0x10, 0x02, 0x00, 0x9d, 0x01, 0x2a, 10, 0, 10, 0, 0, 0];
    const vp8 = [...asciiBytes('VP8 '), ...le32(vp8d.length), ...vp8d];
    const ex = tiffWithGps(true); if (ex.length % 2) ex.push(0);
    const exc = [...asciiBytes('EXIF'), ...le32(ex.length), ...ex];
    const body = [...asciiBytes('WEBP'), ...vp8x, ...vp8, ...exc];
    const webp = new Uint8Array([...asciiBytes('RIFF'), ...le32(body.length), ...body]);
    expect(await inspectFile(mkBlob([webp]))).toMatchObject({ mime: 'image/webp', width: 10, height: 10, hasGps: true });
    const noGps = tiffWithGps(false);
    const body2 = [...asciiBytes('WEBP'), ...vp8x, ...vp8, ...asciiBytes('EXIF'), ...le32(noGps.length), ...noGps];
    expect((await inspectFile(mkBlob([new Uint8Array([...asciiBytes('RIFF'), ...le32(body2.length), ...body2])]))).hasGps).toBe(false);
  });
  it('same limits and errors as processImage, no decode', async () => {
    await expect(inspectFile(fix('svg-renamed.png'))).rejects.toMatchObject({ code: 'unsupported_type' });
    await expect(inspectFile(mkBlob([]))).rejects.toMatchObject({ code: 'corrupt' });
    await expect(inspectFile(fix('photo-200x230.jpg'), { maxFileBytes: 100 })).rejects.toMatchObject({ code: 'too_large_bytes' });
    await expect(inspectFile(mkBlob([jpegBytes({ width: 12000, height: 9000 })]))).rejects.toMatchObject({ code: 'too_many_pixels' });
  });
  it('fuzz: random bytes and mutated/truncated fixtures never throw anything but EngineError', async () => {
    let s = 2024;
    const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const seeds = ['exif6-gps.jpg', 'transparent.png', 'photo-800x600.webp', 'alpha-400x300.webp', 'progressive-640x480.jpg'].map((n) => fs.readFileSync(path.join(FIX, n)));
    let ok = 0, rejected = 0;
    for (let i = 0; i < 1500; i++) {
      let b: Uint8Array;
      if (i % 5 === 0) { b = new Uint8Array(1 + Math.floor(R() * 200)); for (let k = 0; k < b.length; k++) b[k] = (R() * 256) | 0; }
      else {
        const src = seeds[i % seeds.length];
        // half full-length (header mutations), half truncated (now refused by the completeness check)
        b = new Uint8Array(i % 2 ? src : src.subarray(0, 1 + Math.floor(R() * src.length)));
        const flips = 1 + Math.floor(R() * 8);
        for (let k = 0; k < flips; k++) b[Math.floor(R() * Math.min(b.length, 400))] = (R() * 256) | 0;
      }
      try {
        const r = await inspectFile(mkBlob([b]));
        expect(r.width).toBeGreaterThan(0); expect(r.height).toBeGreaterThan(0);
        expect(r.orientation >= 1 && r.orientation <= 8).toBe(true);
        ok++;
      } catch (e) {
        expect(e).toBeInstanceOf(EngineError);
        rejected++;
      }
      try { const h = await readHeader(mkBlob([b])); await assertComplete(mkBlob([b]), h); } catch (e) { expect(e).toBeInstanceOf(EngineError); }
    }
    expect(ok).toBeGreaterThan(50);
    expect(rejected).toBeGreaterThan(50);
  });
});
