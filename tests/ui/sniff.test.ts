import { describe, expect, it } from 'vitest';
import { sniffImage } from '../../src/components/tool/sniff';

const png = (colorType: number, extra: number[] = []) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, colorType, 0, 0, 0, 0, 0, 0, 0, ...extra]);
const asc = (s: string) => [...s].map((c) => c.charCodeAt(0));
const riff = (chunk: string, body: number[]) => new Uint8Array([...asc('RIFF'), 0, 0, 0, 0, ...asc('WEBP'), ...asc(chunk), 0, 0, 0, 0, ...body]);

describe('sniffImage', () => {
  it('detects JPEG', () => expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ kind: 'jpeg', hasAlpha: false }));
  it('detects PNG alpha from the colour type', () => {
    expect(sniffImage(png(6))).toEqual({ kind: 'png', hasAlpha: true });
    expect(sniffImage(png(4))).toEqual({ kind: 'png', hasAlpha: true });
    expect(sniffImage(png(2))).toEqual({ kind: 'png', hasAlpha: false });
    expect(sniffImage(png(0))).toEqual({ kind: 'png', hasAlpha: false });
  });
  it('detects tRNS transparency before IDAT', () => {
    const trns = [0, 0, 0, 1, ...asc('tRNS'), 0, 0, 0, 0, 0];
    expect(sniffImage(png(3, trns))).toEqual({ kind: 'png', hasAlpha: true });
    expect(sniffImage(png(3, [0, 0, 0, 0, ...asc('IDAT'), 0, 0, 0, 0, 0, ...trns]))).toEqual({ kind: 'png', hasAlpha: false });
  });
  it('detects WebP alpha (VP8X flag, VP8L bit, VP8 lossy)', () => {
    expect(sniffImage(riff('VP8X', [0x10, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toEqual({ kind: 'webp', hasAlpha: true });
    const vp8xNo = riff('VP8X', [0x00, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(sniffImage(vp8xNo)).toEqual({ kind: 'webp', hasAlpha: false });
    const l = riff('VP8L', [0x2f, 0, 0, 0, 0x10, 0, 0, 0, 0]);
    expect(sniffImage(l)).toEqual({ kind: 'webp', hasAlpha: true });
    expect(sniffImage(riff('VP8L', [0x2f, 0, 0, 0, 0x00, 0, 0, 0, 0]))).toEqual({ kind: 'webp', hasAlpha: false });
    expect(sniffImage(riff('VP8 ', [0, 0, 0, 0]))).toEqual({ kind: 'webp', hasAlpha: false });
  });
  it('rejects SVG, GIF, HEIC, text and empty input', () => {
    const t = (s: string) => new TextEncoder().encode(s);
    expect(sniffImage(t('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).kind).toBeNull();
    expect(sniffImage(t('GIF89a....')).kind).toBeNull();
    expect(sniffImage(new Uint8Array([0, 0, 0, 0x18, ...asc('ftypheic')])).kind).toBeNull();
    expect(sniffImage(new Uint8Array()).kind).toBeNull();
    expect(sniffImage(t('not an image')).kind).toBeNull();
  });
});
