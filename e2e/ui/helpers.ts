import { expect, type Page } from '@playwright/test';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { once } from 'node:events';

export const NOISE = path.join(import.meta.dirname, '..', 'noise.png'); // 800x600 RGB noise (1.4 MB)

const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

/** Deterministic RGBA PNG. px(x,y) -> [r,g,b,a]. */
export function makePng(w: number, h: number, px: (x: number, y: number) => [number, number, number, number]): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) { const p = px(x, y); const o = y * (w * 4 + 1) + 1 + x * 4; raw[o] = p[0]; raw[o + 1] = p[1]; raw[o + 2] = p[2]; raw[o + 3] = p[3]; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Smooth gradient photo-like image with a transparent top-left quarter. */
export const transparentPng = () => makePng(240, 180, (x, y) => (x < 100 && y < 70 ? [0, 0, 0, 0] : [x, y, 128, 255]));
/** White paper, dark ink strokes inside x 200..400, y 60..140 of a 600x200 canvas. */
export const signaturePng = (alpha = false) => makePng(600, 200, (x, y) => {
  const ink = x >= 200 && x < 400 && y >= 60 && y < 140 && (((x - 200) >> 3) + ((y - 60) >> 3)) % 3 === 0;
  return ink ? [10, 10, 40, 255] : alpha ? [0, 0, 0, 0] : [255, 255, 255, 255];
});
/** Flat colour: compresses to almost nothing, so a large minimum cannot honestly be met. */
export const flatPng = (w = 60, h = 30) => makePng(w, h, () => [250, 250, 250, 255]);

export const file = (name: string, buffer: Buffer, mimeType = 'image/png') => ({ name, mimeType, buffer });

export async function openTool(page: Page, url = '/') {
  await page.goto(url);
  await expect(page.getByTestId('tool')).toBeVisible();
  // hydrated once the preset buttons react
  await page.getByTestId('preset-100').click();
  await expect(page.getByTestId('preset-100')).toHaveAttribute('aria-pressed', 'true');
}

export async function pick(page: Page, f: string | { name: string; mimeType: string; buffer: Buffer }) {
  await page.getByTestId('file').setInputFiles(f);
  await expect(page.getByTestId('run')).toBeEnabled({ timeout: 15_000 });
}

export async function resize(page: Page) {
  await page.getByTestId('run').click();
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });
}

/** Clicks the download link, returns the saved file bytes and the decoded pixel size. */
export async function downloaded(page: Page, testId = 'download') {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId(testId).click()]);
  const buf = fs.readFileSync(await dl.path());
  const dim = await page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bin]));
    return { w: bmp.width, h: bmp.height };
  }, buf.toString('base64'));
  return { buf, name: dl.suggestedFilename(), ...dim, n: buf.length };
}

export const isJpeg = (b: Buffer) => b[0] === 0xff && b[1] === 0xd8;
export const isPng = (b: Buffer) => b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG';
export const isWebp = (b: Buffer) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';

export const bytesOf = async (page: Page) => Number(await page.getByTestId('result-size').getAttribute('data-bytes'));

/** Records anything that leaves the origin or is not a GET (context-level: includes workers). */
export function watchNetwork(page: Page, baseURL: string) {
  const origin = new URL(baseURL).origin;
  const external: string[] = [];
  const nonGet: string[] = [];
  page.context().on('request', (r) => {
    const u = new URL(r.url());
    if (!['blob:', 'data:'].includes(u.protocol) && u.origin !== origin) external.push(r.url());
    if (r.method() !== 'GET') nonGet.push(`${r.method()} ${r.url()}`);
  });
  return { external, nonGet };
}

/** White canvas with an opaque red block at (rx,ry,rw,rh). */
export const redBlockPng = (w: number, h: number, rx: number, ry: number, rw: number, rh: number) =>
  makePng(w, h, (x, y) => (x >= rx && x < rx + rw && y >= ry && y < ry + rh ? [230, 20, 20, 255] : [255, 255, 255, 255]));

/**
 * JPEG stored 400x1200 with EXIF orientation 6 (displayed 1200x400, rotated 90 degrees clockwise).
 * The red block is at displayed (290,90,220x70), i.e. stored (90,690,70x220).
 */
export async function exifRotatedJpeg(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 1200;
    const x = c.getContext('2d')!;
    x.fillStyle = '#fff'; x.fillRect(0, 0, 400, 1200);
    x.fillStyle = 'rgb(230,20,20)'; x.fillRect(90, 690, 70, 220);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.95));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (const v of bytes) s += String.fromCharCode(v);
    return btoa(s);
  });
  const jpeg = Buffer.from(b64, 'base64');
  const tiff = Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0]);
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const seg = Buffer.concat([Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 0xff]), body]);
  return Buffer.concat([jpeg.subarray(0, 2), seg, jpeg.subarray(2)]);
}

/** Colours (rgb) of a decoded image at the given points. */
export async function pixelsAt(page: Page, buf: Buffer, pts: Array<[number, number]>) {
  return page.evaluate(async ({ b64, pts }) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bin]));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const x = c.getContext('2d')!;
    x.drawImage(bmp, 0, 0);
    return pts.map(([px, py]) => Array.from(x.getImageData(px, py, 1, 1).data.slice(0, 3)));
  }, { b64: buf.toString('base64'), pts });
}
export const isRed = (p: number[]) => p[0] > 170 && p[1] < 100 && p[2] < 100;

const pngChunk = chunk;
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ihdrOf = (w: number, h: number) => { const b = Buffer.alloc(13); b.writeUInt32BE(w, 0); b.writeUInt32BE(h, 4); b[8] = 8; b[9] = 6; return b; };

/** Writes a real w x h opaque-white RGBA PNG to a temp file, streaming (never holds the raw image in memory). Caller deletes it. */
export async function writeBigPng(w: number, h: number): Promise<string> {
  const file = path.join(os.tmpdir(), `sizetune-big-${w}x${h}-${process.pid}.png`);
  const deflate = zlib.createDeflate({ level: 1 });
  const parts: Buffer[] = [];
  deflate.on('data', (c: Buffer) => parts.push(c));
  const ended = once(deflate, 'end');
  const row = Buffer.alloc(w * 4 + 1, 255); row[0] = 0;
  for (let y = 0; y < h; y++) if (!deflate.write(row)) await once(deflate, 'drain');
  deflate.end();
  await ended;
  fs.writeFileSync(file, Buffer.concat([SIG, pngChunk('IHDR', ihdrOf(w, h)), pngChunk('IDAT', Buffer.concat(parts)), pngChunk('IEND', Buffer.alloc(0))]));
  return file;
}

/** A tiny PNG whose HEADER claims w x h (e.g. a 400 MP "bomb"); the pixel data is not real. */
export const bombPng = (w: number, h: number) => Buffer.concat([SIG, pngChunk('IHDR', ihdrOf(w, h)), pngChunk('IDAT', zlib.deflateSync(Buffer.alloc(64))), pngChunk('IEND', Buffer.alloc(0))]);

/** Sum of resident memory (MB) of every browser process (CDP SystemInfo gives the pids). */
export async function browserRssMb(page: Page): Promise<number> {
  const cdp = await page.context().browser()!.newBrowserCDPSession();
  try {
    const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
    const out = execSync(`ps -o rss= -p ${processInfo.map((p) => p.id).join(',')} || true`).toString();
    return out.split('\n').map((l) => Number(l.trim())).filter(Boolean).reduce((a, b) => a + b, 0) / 1024;
  } finally { await cdp.detach(); }
}

/** 8x8 JPEG without any APPn metadata, then optionally an EXIF APP1 (orientation and/or a GPS IFD). */
export async function smallJpeg(page: Page, opts: { orientation?: number; gps?: boolean } = {}): Promise<Buffer> {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 8; c.height = 8;
    const x = c.getContext('2d')!; x.fillStyle = '#c33'; x.fillRect(0, 0, 8, 8);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
    let s = ''; for (const v of new Uint8Array(await blob.arrayBuffer())) s += String.fromCharCode(v);
    return btoa(s);
  });
  const src = Buffer.from(b64, 'base64');
  const out: Buffer[] = [src.subarray(0, 2)];
  let p = 2;
  while (p + 4 <= src.length) { // drop APP1..APP15 (ICC, EXIF), keep everything else
    const m = src[p + 1]; const len = src.readUInt16BE(p + 2);
    if (m === 0xda) { out.push(src.subarray(p)); break; }
    if (!(m >= 0xe1 && m <= 0xef)) out.push(src.subarray(p, p + 2 + len));
    p += 2 + len;
  }
  const jpeg = Buffer.concat(out);
  if (opts.orientation === undefined && !opts.gps) return jpeg;
  const entries: Buffer[] = [];
  const be16 = (n: number) => Buffer.from([n >> 8, n & 255]);
  const be32 = (n: number) => Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
  const n = (opts.orientation !== undefined ? 1 : 0) + (opts.gps ? 1 : 0);
  const gpsAt = 8 + 2 + 12 * n + 4;
  if (opts.orientation !== undefined) entries.push(Buffer.concat([be16(0x0112), be16(3), be32(1), be16(opts.orientation), be16(0)]));
  if (opts.gps) entries.push(Buffer.concat([be16(0x8825), be16(4), be32(1), be32(gpsAt)]));
  const tiff = Buffer.concat([Buffer.from('MM'), be16(42), be32(8), be16(n), ...entries, be32(0),
    ...(opts.gps ? [be16(1), be16(0x0001), be16(2), be32(2), Buffer.from('N\0\0\0'), be32(0)] : [])]);
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const seg = Buffer.concat([Buffer.from([0xff, 0xe1]), be16(body.length + 2), body]);
  return Buffer.concat([jpeg.subarray(0, 2), seg, jpeg.subarray(2)]);
}
