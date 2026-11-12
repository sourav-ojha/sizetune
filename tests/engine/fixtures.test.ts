import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readHeader } from '../../src/lib/engine/header';

const FIX = path.join(import.meta.dirname, '../fixtures');
const file = (n: string, type = '') => new File([fs.readFileSync(path.join(FIX, n))], n, { type });

describe('header parsing on real encoder output (tests/fixtures, from scripts/gen-fixtures.mjs)', () => {
  it.each([
    ['photo-200x230.jpg', 'image/jpeg', 200, 230],
    ['photo-1200x800.jpg', 'image/jpeg', 1200, 800],
    ['progressive-640x480.jpg', 'image/jpeg', 640, 480],
    ['cmyk-300x200.jpg', 'image/jpeg', 300, 200],
    ['tiny-8x8.jpg', 'image/jpeg', 8, 8],
    ['transparent.png', 'image/png', 800, 600],
    ['tiny-1x1.png', 'image/png', 1, 1],
    ['photo-800x600.webp', 'image/webp', 800, 600],
    ['alpha-400x300.webp', 'image/webp', 400, 300],
  ])('%s -> %s %ix%i', async (n, mime, w, h) => {
    const i = await readHeader(file(n));
    expect([i.mime, i.width, i.height]).toEqual([mime, w, h]);
  });
  it('EXIF orientation 6 fixture: stored 400x300, display 300x400 (permanent regression test)', async () => {
    const i = await readHeader(file('exif6-gps.jpg'));
    expect(i).toMatchObject({ orientation: 6, storedWidth: 400, storedHeight: 300, width: 300, height: 400 });
  });
  it('the GPS fixture really contains Make/Model/GPS (so the e2e strip test is meaningful)', () => {
    const t = fs.readFileSync(path.join(FIX, 'exif6-gps.jpg')).toString('latin1');
    expect(t).toContain('TestCam');
    expect(t).toContain('Model9');
    expect(t).toMatch(/Exif\0\0/);
  });
  it('alpha hints: transparent PNG and alpha WebP yes, JPEG/lossy WebP no', async () => {
    expect((await readHeader(file('transparent.png'))).alphaPossible).toBe(true);
    expect((await readHeader(file('alpha-400x300.webp'))).alphaPossible).toBe(true);
    expect((await readHeader(file('photo-800x600.webp'))).alphaPossible).toBe(false);
    expect((await readHeader(file('photo-200x230.jpg'))).alphaPossible).toBe(false);
  });
  it.each([['svg-renamed.png', 'image/png'], ['gif-renamed.jpg', 'image/jpeg'], ['heic-header.heic', 'image/heic']])('%s is unsupported_type whatever its MIME', async (n, mime) => {
    await expect(readHeader(file(n, mime))).rejects.toMatchObject({ code: 'unsupported_type' });
  });
  it('header survives truncation (dims are before the cut); garbage after SOF still has a header', async () => {
    expect((await readHeader(file('corrupt-truncated.jpg'))).width).toBe(200);
    expect((await readHeader(file('corrupt-garbage.jpg'))).width).toBe(200);
  });
});
