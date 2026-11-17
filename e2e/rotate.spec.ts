import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import { makePng } from './ui/helpers';

const PAGE = '/rotate-image/';
const EXIF6 = path.join(import.meta.dirname, '..', 'tests', 'fixtures', 'exif6-gps.jpg'); // stored 400x300, Orientation 6, red band at the top once oriented

// 200x100 PNG: red channel grows left to right, green channel top to bottom.
const gradient = () => ({ name: 'grad.png', mimeType: 'image/png', buffer: makePng(200, 100, (x, y) => [Math.round((x / 199) * 255), Math.round((y / 99) * 255), 60, 255]) });

async function open(page: Page, f: string | { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto(PAGE);
  await expect(page.getByTestId('tool')).toBeVisible();
  await expect(async () => {
    await page.getByTestId('file').setInputFiles(f);
    await expect(page.getByTestId('rotate-preview')).toBeVisible({ timeout: 2500 });
  }).toPass({ timeout: 20_000 });
}

async function download(page: Page): Promise<Buffer> {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download').click()]);
  const p = await dl.path();
  return fs.readFileSync(p!);
}

const px = async (buf: Buffer, x: number, y: number) => {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const o = (y * info.width + x) * info.channels;
  return [data[o], data[o + 1], data[o + 2]];
};

test('AC-1: rotating 90 degrees swaps width and height in the downloaded file', async ({ page }) => {
  await open(page, gradient());
  await page.getByTestId('rotate-cw').click();
  const buf = await download(page);
  const meta = await sharp(buf).metadata();
  expect([meta.width, meta.height]).toEqual([100, 200]);
  // clockwise: the old top-left (low red, low green) is now top-right; old top-right (high red) is bottom-right
  const topRight = await px(buf, 99, 0);
  const bottomRight = await px(buf, 99, 199);
  expect(topRight[0]).toBeLessThan(30);
  expect(bottomRight[0]).toBeGreaterThan(225);
});

test('AC-2: flipping horizontally mirrors the picture', async ({ page }) => {
  await open(page, gradient());
  await page.getByTestId('flip-h').click();
  const buf = await download(page);
  expect((await px(buf, 0, 50))[0]).toBeGreaterThan(225);
  expect((await px(buf, 199, 50))[0]).toBeLessThan(30);
});

test('AC-3: EXIF orientation is applied once (preview and download match the system viewer)', async ({ page }) => {
  await open(page, EXIF6);
  const prev = page.getByTestId('rotate-preview');
  expect([await prev.getAttribute('data-width'), await prev.getAttribute('data-height')]).toEqual(['300', '400']);
  const buf = await download(page);
  const meta = await sharp(buf).metadata();
  expect([meta.width, meta.height]).toEqual([300, 400]);
  const top = await px(buf, 150, 5); // red band is at the top once oriented
  expect(top[0]).toBeGreaterThan(top[2] + 60);
  await page.getByTestId('rotate-cw').click();
  expect([await prev.getAttribute('data-width'), await prev.getAttribute('data-height')]).toEqual(['400', '300']);
});

test('AC-4: no network request carries the file and nothing leaves the origin', async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const bad: string[] = [];
  context.on('request', (r) => {
    const u = new URL(r.url());
    if (!['blob:', 'data:'].includes(u.protocol) && u.origin !== origin) bad.push(r.url());
    if (r.method() !== 'GET') bad.push(`${r.method()} ${r.url()}`);
  });
  await open(page, gradient());
  await page.getByTestId('rotate-cw').click();
  await download(page);
  expect(bad).toEqual([]);
});

test('AC-5: every control works from the keyboard', async ({ page }) => {
  await open(page, gradient());
  const prev = page.getByTestId('rotate-preview');
  await page.getByTestId('rotate-cw').focus();
  await page.keyboard.press('Enter');
  expect([await prev.getAttribute('data-width'), await prev.getAttribute('data-height')]).toEqual(['100', '200']);
  await page.getByTestId('rotate-ccw').focus();
  await page.keyboard.press('Space');
  expect([await prev.getAttribute('data-width'), await prev.getAttribute('data-height')]).toEqual(['200', '100']);
  await page.getByTestId('rotate-cw').focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('flip-v').focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('reset').focus();
  await page.keyboard.press('Enter');
  expect([await prev.getAttribute('data-width'), await prev.getAttribute('data-height')]).toEqual(['200', '100']);
  await expect(page.getByTestId('status')).toContainText(/original/i);
});
