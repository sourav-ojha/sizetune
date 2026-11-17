import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import { transparentPng } from './ui/helpers';

const FIX = path.join(import.meta.dirname, '..', 'tests', 'fixtures');
const WEBP = path.join(FIX, 'photo-800x600.webp');
const PNG = path.join(import.meta.dirname, 'noise.png');

async function convert(page: Page, url: string, f: string | { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto(url);
  await expect(page.getByTestId('tool')).toBeVisible();
  await expect(page.getByTestId('format-jpeg')).toBeChecked(); // the converter opens with JPEG selected
  await expect(async () => {
    await page.getByTestId('file').setInputFiles(f);
    await expect(page.getByTestId('result')).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 40_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download').click()]);
  return fs.readFileSync((await dl.path())!);
}

test('AC-1: WebP to JPG downloads a JPEG that opens', async ({ page }) => {
  const buf = await convert(page, '/webp-to-jpg/', WEBP);
  const meta = await sharp(buf).metadata();
  expect(meta.format).toBe('jpeg');
  expect([meta.width, meta.height]).toEqual([800, 600]);
});

test('AC-2: PNG to JPG downloads a JPEG, with no size limit applied by default', async ({ page }) => {
  const buf = await convert(page, '/png-to-jpg/', PNG);
  expect((await sharp(buf).metadata()).format).toBe('jpeg');
  expect(await page.getByTestId('result-target').count()).toBe(0); // no KB target was set
});

test('a transparent PNG becomes a JPEG on a white background', async ({ page }) => {
  const buf = await convert(page, '/png-to-jpg/', { name: 't.png', mimeType: 'image/png', buffer: transparentPng() });
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  expect(info.channels).toBeGreaterThanOrEqual(3);
  expect(data[0]).toBeGreaterThan(235); // top-left pixel was transparent: now white
});

test('AC-3: nothing leaves the origin and no request carries the file', async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const bad: string[] = [];
  context.on('request', (r) => {
    const u = new URL(r.url());
    if (!['blob:', 'data:'].includes(u.protocol) && u.origin !== origin) bad.push(r.url());
    if (r.method() !== 'GET') bad.push(`${r.method()} ${r.url()}`);
  });
  await convert(page, '/webp-to-jpg/', WEBP);
  expect(bad).toEqual([]);
});

test('AC-4: each converter page links into the KB resizer, visible before any file is chosen', async ({ page }) => {
  for (const url of ['/webp-to-jpg/', '/png-to-jpg/']) {
    await page.goto(url);
    const link = page.getByTestId('to-resizer');
    await expect(link).toHaveAttribute('href', '/');
    await expect(link).toBeVisible();
  }
});
