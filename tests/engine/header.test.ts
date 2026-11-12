import { describe, it, expect } from 'vitest';
import { sniffType, describeUnsupported } from '../../src/lib/engine/sniff';
import { parseHeader, readHeader } from '../../src/lib/engine/header';
import { EngineError } from '../../src/lib/engine/types';
import { jpegBytes, pngBytes, webpVp8, webpVp8l, webpVp8x, asciiBytes } from './bytes';

const ok = (b: Uint8Array) => {
  const r = parseHeader(b, b.length);
  if (!r.ok) throw new Error('expected ok, got ' + JSON.stringify(r));
  return r.info;
};

describe('sniffType (magic bytes, not MIME/extension)', () => {
  it('recognises JPEG, PNG, WebP', () => {
    expect(sniffType(jpegBytes({ width: 1, height: 1 }))).toBe('image/jpeg');
    expect(sniffType(pngBytes({ width: 1, height: 1 }))).toBe('image/png');
    expect(sniffType(webpVp8(2, 2))).toBe('image/webp');
  });
  it('rejects SVG, GIF, HEIC, AVIF, BMP, TIFF, text, empty and short input', () => {
    for (const b of [
      asciiBytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      asciiBytes('<?xml version="1.0"?><svg/>'),
      asciiBytes('GIF89a\x01\x00\x01\x00'),
      new Uint8Array([0, 0, 0, 0x18, ...asciiBytes('ftypheic'), 0, 0, 0, 0]),
      new Uint8Array([0, 0, 0, 0x1c, ...asciiBytes('ftypavif'), 0, 0, 0, 0]),
      asciiBytes('BM\x00\x00\x00\x00'),
      new Uint8Array([0x49, 0x49, 0x2a, 0]),
      asciiBytes('hello world'),
      new Uint8Array([]),
      new Uint8Array([0xff, 0xd8]), // too short to be a JPEG
      asciiBytes('RIFF\x00\x00\x00\x00WAVE'),
    ]) expect(sniffType(b)).toBeNull();
  });
  it('names common unsupported types for the error message', () => {
    expect(describeUnsupported(asciiBytes('<svg></svg>'))).toBe('SVG');
    expect(describeUnsupported(asciiBytes('GIF89a'))).toBe('GIF');
    expect(describeUnsupported(new Uint8Array([0, 0, 0, 0x18, ...asciiBytes('ftypheic')]))).toBe('HEIC');
    expect(describeUnsupported(new Uint8Array([0, 0, 0, 0x18, ...asciiBytes('ftypavif')]))).toBe('AVIF');
    expect(describeUnsupported(asciiBytes('zzzz'))).toBeNull();
  });
});

describe('parseHeader: JPEG', () => {
  it('reads SOF0 dimensions', () => {
    const i = ok(jpegBytes({ width: 640, height: 480 }));
    expect(i).toMatchObject({ mime: 'image/jpeg', storedWidth: 640, storedHeight: 480, width: 640, height: 480, orientation: 1, alphaPossible: false });
  });
  it('reads progressive SOF2 and other SOFn but not DHT/JPG/DAC', () => {
    expect(ok(jpegBytes({ width: 10, height: 20, sof: 0xc2 })).width).toBe(10);
    expect(ok(jpegBytes({ width: 10, height: 20, sof: 0xc1 })).height).toBe(20);
  });
  it.each([5, 6, 7, 8])('EXIF orientation %i swaps width/height (big- and little-endian)', (o) => {
    for (const le of [false, true]) {
      const i = ok(jpegBytes({ width: 400, height: 300, orientation: o, le }));
      expect(i.orientation).toBe(o);
      expect([i.width, i.height]).toEqual([300, 400]);
      expect([i.storedWidth, i.storedHeight]).toEqual([400, 300]);
    }
  });
  it.each([1, 2, 3, 4])('EXIF orientation %i keeps width/height', (o) => {
    const i = ok(jpegBytes({ width: 400, height: 300, orientation: o }));
    expect([i.width, i.height]).toEqual([400, 300]);
  });
  it('treats an out-of-range orientation as 1', () => {
    expect(ok(jpegBytes({ width: 4, height: 3, orientation: 9 })).orientation).toBe(1);
    expect(ok(jpegBytes({ width: 4, height: 3, orientation: 0 })).orientation).toBe(1);
  });
  it('asks for more bytes when SOF lies beyond a large APP segment, then parses', () => {
    const full = jpegBytes({ width: 4000, height: 3000, padApp: 200_000 });
    const head = full.slice(0, 64 * 1024);
    const r = parseHeader(head, full.length);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('need_more');
      if (r.reason === 'need_more') expect(r.needBytes).toBeGreaterThan(head.length);
    }
    expect(ok(full).width).toBe(4000);
  });
  it('reports corrupt (not a throw) for truncated/malicious input', () => {
    const full = jpegBytes({ width: 640, height: 480 });
    const sofEnd = 2 + 18 + 19; // SOI + APP0 + SOF0 segment
    for (let n = 3; n < sofEnd; n++) {
      const r = parseHeader(full.slice(0, n), n); // file really ends here
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('corrupt');
    }
    const zero = jpegBytes({ width: 0, height: 480 });
    expect(parseHeader(zero, zero.length)).toMatchObject({ ok: false, reason: 'corrupt' });
    const badLen = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0, 0, 0, 0]);
    expect(parseHeader(badLen, badLen.length)).toMatchObject({ ok: false, reason: 'corrupt' });
    const sosFirst = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 63, 0, 0xff, 0xd9]);
    expect(parseHeader(sosFirst, sosFirst.length)).toMatchObject({ ok: false, reason: 'corrupt' });
    const garbage = new Uint8Array([0xff, 0xd8, 0xff, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0]);
    expect(parseHeader(garbage, garbage.length).ok).toBe(false);
  });
  it('survives a malicious EXIF IFD (offsets past the end, huge counts)', () => {
    const b = jpegBytes({ width: 50, height: 40, orientation: 6 });
    // corrupt the IFD0 offset inside the TIFF header (APP1 starts after SOI+APP0 = 2+18 bytes)
    const tiffStart = 20 + 4 + 6;
    b[tiffStart + 4] = 0x7f; b[tiffStart + 5] = 0xff; b[tiffStart + 6] = 0xff; b[tiffStart + 7] = 0xff;
    const i = ok(b);
    expect(i.orientation).toBe(1);
    expect(i.width).toBe(50);
  });
});

describe('parseHeader: PNG', () => {
  it('reads IHDR; alpha possible only for colour types 4/6 or tRNS', () => {
    expect(ok(pngBytes({ width: 800, height: 600, colorType: 2 }))).toMatchObject({ mime: 'image/png', width: 800, height: 600, alphaPossible: false });
    expect(ok(pngBytes({ width: 8, height: 6, colorType: 6 })).alphaPossible).toBe(true);
    expect(ok(pngBytes({ width: 8, height: 6, colorType: 4 })).alphaPossible).toBe(true);
    expect(ok(pngBytes({ width: 8, height: 6, colorType: 3, tRNS: true })).alphaPossible).toBe(true);
    expect(ok(pngBytes({ width: 8, height: 6, colorType: 2, tRNS: true })).alphaPossible).toBe(true);
  });
  it('flags APNG as animated', () => {
    expect(ok(pngBytes({ width: 8, height: 6, acTL: true })).animated).toBe(true);
  });
  it('rejects zero/oversized dimensions and a missing IHDR', () => {
    const z = pngBytes({ width: 0, height: 6 });
    expect(parseHeader(z, z.length)).toMatchObject({ ok: false, reason: 'corrupt' });
    const huge = pngBytes({ width: 0x80000000, height: 6 });
    expect(parseHeader(huge, huge.length)).toMatchObject({ ok: false, reason: 'corrupt' });
    const noIhdr = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44]);
    expect(parseHeader(noIhdr, noIhdr.length)).toMatchObject({ ok: false, reason: 'corrupt' });
  });
  it('truncation is corrupt, never a throw', () => {
    const full = pngBytes({ width: 8, height: 6, colorType: 6 });
    for (let n = 8; n < 33; n++) expect(parseHeader(full.slice(0, n), n).ok).toBe(false);
  });
  it('needs more bytes when a big ancillary chunk precedes IDAT', () => {
    const full = pngBytes({ width: 8, height: 6, colorType: 2, bigChunk: 100_000, tRNS: true });
    const r = parseHeader(full.slice(0, 65536), full.length);
    expect(r).toMatchObject({ ok: false, reason: 'need_more' });
    expect(ok(full).alphaPossible).toBe(true);
  });
});

describe('parseHeader: WebP', () => {
  it('VP8 (lossy): dims, no alpha', () => {
    expect(ok(webpVp8(1024, 768))).toMatchObject({ mime: 'image/webp', width: 1024, height: 768, alphaPossible: false });
  });
  it('VP8L (lossless): dims and alpha hint', () => {
    expect(ok(webpVp8l(300, 200, true))).toMatchObject({ width: 300, height: 200, alphaPossible: true });
    expect(ok(webpVp8l(300, 200, false)).alphaPossible).toBe(false);
  });
  it('VP8X: canvas dims, alpha and animation flags', () => {
    expect(ok(webpVp8x(5000, 4000, { alpha: true }))).toMatchObject({ width: 5000, height: 4000, alphaPossible: true, animated: false });
    expect(ok(webpVp8x(10, 10, { anim: true })).animated).toBe(true);
  });
  it('bad VP8 start code / bad VP8L signature / truncation are corrupt', () => {
    const a = webpVp8(10, 10); a[23] = 0;
    expect(parseHeader(a, a.length)).toMatchObject({ ok: false, reason: 'corrupt' });
    const b = webpVp8l(10, 10, false); b[20] = 0;
    expect(parseHeader(b, b.length)).toMatchObject({ ok: false, reason: 'corrupt' });
    const c = webpVp8x(10, 10, {});
    for (let n = 12; n < c.length; n++) expect(parseHeader(c.slice(0, n), n).ok).toBe(false);
  });
});

describe('readHeader (Blob, incremental reads)', () => {
  it('reads a header that sits beyond the first chunk', async () => {
    const full = jpegBytes({ width: 3000, height: 2000, orientation: 8, padApp: 300_000 });
    const info = await readHeader(new Blob([full as BlobPart]));
    expect([info.width, info.height, info.orientation]).toEqual([2000, 3000, 8]);
  });
  it('throws EngineError unsupported_type for SVG named .png and corrupt for a truncated JPEG', async () => {
    const svg = new File([asciiBytes('<svg xmlns="http://www.w3.org/2000/svg"/>') as BlobPart], 'x.png', { type: 'image/png' });
    await expect(readHeader(svg)).rejects.toMatchObject({ code: 'unsupported_type' });
    const t = jpegBytes({ width: 10, height: 10 }).slice(0, 30);
    const e = await readHeader(new Blob([t as BlobPart])).catch((x) => x);
    expect(e).toBeInstanceOf(EngineError);
    expect(e.code).toBe('corrupt');
  });
  it('ignores the declared MIME type: a JPEG labelled image/png is still a JPEG', async () => {
    const f = new File([jpegBytes({ width: 5, height: 7 }) as BlobPart], 'a.png', { type: 'image/png' });
    expect((await readHeader(f)).mime).toBe('image/jpeg');
  });
});
