/** Fake browser Env for pipeline tests: JPEG-like size model, real magic bytes, records renders/decodes. */
import type { Env, DecodedImage } from '../../src/lib/engine/env';
import type { ProcessOptions } from '../../src/lib/engine/types';
import { jpegBytes, pngBytes, asciiBytes } from './bytes';

export const MAGIC: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff, 0xe0],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/webp': [...asciiBytes('RIFF'), 0, 0, 0, 0, ...asciiBytes('WEBP')],
};

export interface FakeImg extends DecodedImage { closed: boolean; id: number }
export interface FakeOpts { alpha?: boolean; webp?: boolean; complexity?: number; decodeDelay?: number; renderDelay?: number; swapOrientation?: boolean; wrongMagic?: boolean; decodeFails?: unknown;
  /** Replace the rendered Blob (n = 1-based render index). */
  renderHook?: (i: { n: number; w: number; h: number; q?: number; mime: string; blob: Blob }) => Blob | undefined;
  /** Decoded bitmap is this factor larger per side than the header says (malicious/mismatched file). */
  inflate?: number;
  /** Browser that ignores createImageBitmap resizeWidth (decodes at full size). */
  ignoreResize?: boolean;
  /** Alpha that a downscaled probe cannot see but a full-resolution scan can. */
  alphaSubpixel?: boolean }

export function fakeEnv(o: FakeOpts = {}) {
  const images: FakeImg[] = [];
  const renders: Array<{ w: number; h: number; q?: number; mime: string; fill: string | null; src: { x: number; y: number; width: number; height: number } }> = [];
  let released = 0;
  let decodeArgs: Array<number | undefined> = [];
  const downscales: Array<{ w: number; h: number }> = [];
  const alphaCalls: string[] = [];
  const env: Env<FakeImg> = {
    async decode(blob, resizeWidth) {
      decodeArgs.push(resizeWidth);
      if (o.decodeFails) throw o.decodeFails;
      if (o.decodeDelay) await new Promise((r) => setTimeout(r, o.decodeDelay));
      const { readHeader } = await import('../../src/lib/engine/header');
      const h = await readHeader(blob);
      let [w, hh] = o.swapOrientation ? [h.storedWidth, h.storedHeight] : [h.width, h.height];
      if (resizeWidth && !o.ignoreResize) { hh = Math.round((hh * resizeWidth) / w); w = resizeWidth; }
      if (o.inflate) { w = Math.round(w * o.inflate); hh = Math.round(hh * o.inflate); }
      const img: FakeImg = { width: w, height: hh, closed: false, id: images.length, close() { this.closed = true; } };
      images.push(img);
      return img;
    },
    async render(img, src, w, h, fill, mime, quality) {
      if (img.closed) throw new Error('render on closed image');
      renders.push({ w, h, q: quality, mime, fill, src });
      if (o.renderDelay) await new Promise((r) => setTimeout(r, o.renderDelay));
      const q = quality ?? 1;
      const bpp = mime === 'image/png' ? 1.5 : 0.03 + 0.5 * Math.pow(q, 3.5);
      const n = Math.max(20, Math.round(400 + w * h * bpp * (o.complexity ?? 1)));
      const bytes = new Uint8Array(n);
      bytes.set(o.wrongMagic ? MAGIC['image/png'] : MAGIC[mime]);
      const blob = new Blob([bytes], { type: o.wrongMagic ? 'image/png' : mime });
      return o.renderHook?.({ n: renders.length, w, h, q: quality, mime, blob }) ?? blob;
    },
    async downscale(img, w, h) {
      if (img.closed) throw new Error('downscale on closed image');
      downscales.push({ w, h });
      const out: FakeImg = { width: w, height: h, closed: false, id: images.length, close() { this.closed = true; } };
      images.push(out);
      return out;
    },
    async hasAlpha(_img, full) { alphaCalls.push(full ? 'full' : 'probe'); return !!o.alpha || (!!full && !!o.alphaSubpixel); },
    async canEncode(mime) { return mime === 'image/webp' ? !!o.webp : true; },
    release() { released++; },
  };
  return { env, images, renders, get released() { return released; }, decodeArgs, downscales, alphaCalls };
}

export const base: ProcessOptions = { format: 'jpeg', strategy: 'quality-first', lockAspect: true, fit: 'contain', background: 'white' };
export const jpg = (w: number, h: number, extra: Parameters<typeof jpegBytes>[0] | object = {}) => new Blob([jpegBytes({ width: w, height: h, ...extra }) as BlobPart], { type: 'image/jpeg' });
export const png = (w: number, h: number, colorType = 6) => new Blob([pngBytes({ width: w, height: h, colorType }) as BlobPart], { type: 'image/png' });

