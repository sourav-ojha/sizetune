import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { stampDpi, readDpi } from '../src/components/tool/dpi';

const jpeg = async () => new Uint8Array(await sharp({ create: { width: 40, height: 30, channels: 3, background: '#888' } }).jpeg().toBuffer());
const png = async () => new Uint8Array(await sharp({ create: { width: 40, height: 30, channels: 3, background: '#888' } }).png().toBuffer());
const webp = async () => new Uint8Array(await sharp({ create: { width: 40, height: 30, channels: 3, background: '#888' } }).webp().toBuffer());
const decodes = async (b: Uint8Array) => (await sharp(Buffer.from(b)).metadata());

describe('DPI tag (FEATURE-013 AC-2)', () => {
  it('JPEG: writes 200 DPI into JFIF and the file still decodes', async () => {
    const out = stampDpi(await jpeg(), 'image/jpeg', 200)!;
    expect(readDpi(out, 'image/jpeg')).toBe(200);
    expect((await decodes(out)).density).toBe(200);
    expect((await decodes(out)).width).toBe(40);
  });
  it('JPEG: overwriting an existing density keeps the size unchanged', async () => {
    const a = stampDpi(await jpeg(), 'image/jpeg', 72)!;
    const b = stampDpi(a, 'image/jpeg', 300)!;
    expect(b.length).toBe(a.length);
    expect(readDpi(b, 'image/jpeg')).toBe(300);
  });
  it('JPEG without a JFIF segment (the encoder wrote none) gets one right after SOI', async () => {
    const j = await jpeg();
    expect(readDpi(j, 'image/jpeg')).toBeNull();
    const out = stampDpi(j, 'image/jpeg', 150)!;
    expect(out.length).toBe(j.length + 18);
    expect(readDpi(out, 'image/jpeg')).toBe(150);
    expect((await decodes(out)).width).toBe(40);
  });
  it('PNG: writes a pHYs chunk (pixels per metre) and the file still decodes', async () => {
    const out = stampDpi(await png(), 'image/png', 200)!;
    expect(readDpi(out, 'image/png')).toBe(200);
    expect((await decodes(out)).density).toBe(200);
  });
  it('PNG: replaces an existing pHYs chunk instead of adding a second', async () => {
    const a = stampDpi(await png(), 'image/png', 72)!;
    const b = stampDpi(a, 'image/png', 300)!;
    expect(b.length).toBe(a.length);
    expect(readDpi(b, 'image/png')).toBe(300);
  });
  it('WebP is not supported: returns null', async () => { expect(stampDpi(await webp(), 'image/webp', 200)).toBeNull(); });
  it('rejects a DPI outside 1..65535 for JPEG and a non-image buffer', async () => {
    expect(stampDpi(await jpeg(), 'image/jpeg', 0)).toBeNull();
    expect(stampDpi(await jpeg(), 'image/jpeg', 70000)).toBeNull();
    expect(stampDpi(new Uint8Array([1, 2, 3]), 'image/jpeg', 200)).toBeNull();
  });
});
