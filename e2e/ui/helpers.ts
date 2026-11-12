import { expect, type Page } from '@playwright/test';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

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
