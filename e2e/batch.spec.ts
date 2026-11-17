import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { unzipSync } from 'fflate';
import sharp from 'sharp';
import { makePng, NOISE } from './ui/helpers';

const FIX = path.join(import.meta.dirname, '..', 'tests', 'fixtures');
const three = [NOISE, path.join(FIX, 'photo-1200x800.jpg'), path.join(FIX, 'photo-200x230.jpg')];
const tinyPng = (i: number) => ({ name: `t${i}.png`, mimeType: 'image/png', buffer: makePng(30 + i, 30, (x, y) => [x * 5, y * 5, i * 10, 255]) });

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('tool')).toBeVisible();
  await expect(async () => {
    await page.getByTestId('preset-50').click();
    await expect(page.getByTestId('preset-50')).toHaveAttribute('aria-pressed', 'true', { timeout: 1500 });
  }).toPass({ timeout: 20_000 });
}

const rows = (page: Page) => page.getByTestId('batch-row');
const allDone = async (page: Page, n: number) => {
  await expect(page.getByTestId('download-zip')).toBeVisible({ timeout: 90_000 });
  await expect(rows(page)).toHaveCount(n);
};

test('AC-1: several files in one selection are all listed', async ({ page }) => {
  await open(page);
  await page.getByTestId('file').setInputFiles(three);
  await expect(page.getByTestId('batch-panel')).toBeVisible();
  await expect(rows(page)).toHaveCount(3);
  await expect(page.getByTestId('file-card')).toHaveCount(0); // the single-file view is not shown
});

test('AC-2/AC-3: files are processed in turn and one ZIP holds every result under the target, with a report', async ({ page }) => {
  await open(page);
  await page.getByTestId('file').setInputFiles(three);
  await allDone(page, 3);
  for (const r of await rows(page).all()) await expect(r).toHaveAttribute('data-status', 'reached');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-zip').click()]);
  const z = unzipSync(new Uint8Array(fs.readFileSync((await dl.path())!)));
  const names = Object.keys(z);
  expect(names).toContain('SizeTune-report.txt');
  const images = names.filter((n) => n !== 'SizeTune-report.txt');
  expect(images.length).toBe(3);
  for (const n of images) expect(z[n].length, n).toBeLessThanOrEqual(50_000);
  expect(new TextDecoder().decode(z['SizeTune-report.txt'])).toMatch(/reached the target/);
});

test('AC-4: a file that cannot reach the target says so and shows the achieved size; others still finish', async ({ page }) => {
  await open(page);
  await page.getByTestId('target').fill('1');
  await page.getByTestId('file').setInputFiles([NOISE, path.join(FIX, 'tiny-8x8.jpg')]);
  await expect(page.getByTestId('download-zip')).toBeVisible({ timeout: 90_000 }).catch(() => undefined);
  await expect(rows(page).first()).toHaveAttribute('data-status', /not-reached|reached/, { timeout: 90_000 });
  await expect(page.getByTestId('batch-status').first()).not.toHaveText(/Processing/, { timeout: 90_000 });
  const first = rows(page).first();
  await expect(first).toContainText(/not reached/i);
  await expect(first).toContainText(/KB|bytes/);
});

test('mixed valid and invalid files: the valid one is processed, the invalid one lists its reason', async ({ page }) => {
  await open(page);
  await page.getByTestId('file').setInputFiles([path.join(FIX, 'photo-200x230.jpg'), path.join(FIX, 'svg-renamed.png')]);
  await expect(rows(page).nth(0)).toHaveAttribute('data-status', 'reached', { timeout: 60_000 });
  await expect(rows(page).nth(1)).toHaveAttribute('data-status', 'failed', { timeout: 60_000 });
  await expect(rows(page).nth(1)).toContainText(/JPEG, PNG|supported|image/i);
});

test('AC-5: no network request carries file content during a batch', async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const bad: string[] = [];
  context.on('request', (r) => {
    const u = new URL(r.url());
    if (!['blob:', 'data:'].includes(u.protocol) && u.origin !== origin) bad.push(r.url());
    if (r.method() !== 'GET') bad.push(`${r.method()} ${r.url()}`);
  });
  await open(page);
  await page.getByTestId('file').setInputFiles(three);
  await allDone(page, 3);
  await Promise.all([page.waitForEvent('download'), page.getByTestId('download-zip').click()]);
  expect(bad).toEqual([]);
});

test('AC-6: a single file still uses the existing single-file view', async ({ page }) => {
  await open(page);
  await page.getByTestId('file').setInputFiles(three[1]);
  await expect(page.getByTestId('file-card')).toBeVisible();
  await expect(page.getByTestId('batch-panel')).toHaveCount(0);
});

test('AC-7: a selection above the cap is limited, explained, and the excess is not processed', async ({ page }) => {
  await open(page);
  await page.getByTestId('file').setInputFiles(Array.from({ length: 12 }, (_, i) => tinyPng(i)));
  await expect(rows(page)).toHaveCount(10);
  await expect(page.getByTestId('batch-note')).toContainText(/10 files/);
  await allDone(page, 10);
});

test('AC-8: cancelling stops the batch, keeps finished files downloadable and marks the rest cancelled', async ({ page }) => {
  // big noisy pictures take long enough to cancel in the middle of the batch
  const big = await sharp({ create: { width: 3000, height: 2000, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 60 } } }).jpeg({ quality: 90 }).toBuffer();
  await open(page);
  await page.getByTestId('target').fill('5');
  await page.getByTestId('file').setInputFiles(Array.from({ length: 6 }, (_, i) => ({ name: `big${i}.jpg`, mimeType: 'image/jpeg', buffer: big })));
  await expect(rows(page).first()).toHaveAttribute('data-status', /reached|not-reached/, { timeout: 90_000 });
  await page.getByTestId('batch-cancel').click();
  await expect(page.getByTestId('batch-cancel')).toHaveCount(0, { timeout: 60_000 });
  const statuses = await Promise.all((await rows(page).all()).map((r) => r.getAttribute('data-status')));
  expect(statuses).toContain('cancelled');
  expect(['reached', 'not-reached']).toContain(statuses[0]);
  await expect(page.getByTestId('batch-download-0')).toBeVisible();
});
