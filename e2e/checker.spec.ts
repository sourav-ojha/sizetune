import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { makePng } from './ui/helpers';

const PAGE = '/check-image-size/';
const FIX = path.join(import.meta.dirname, '..', 'tests', 'fixtures');
const PHOTO = path.join(FIX, 'photo-1200x800.jpg');

async function check(page: Page, f: string | { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto(PAGE);
  await expect(page.getByTestId('tool')).toBeVisible();
  await expect(async () => {
    await page.getByTestId('file').setInputFiles(f);
    await expect(page.getByTestId('check-result')).toBeVisible({ timeout: 2500 });
  }).toPass({ timeout: 20_000 });
}

test('AC-1: a JPEG named .png is reported as a JPEG', async ({ page }) => {
  await check(page, { name: 'photo.png', mimeType: 'image/png', buffer: fs.readFileSync(PHOTO) });
  await expect(page.getByTestId('real-type')).toHaveText(/JPEG/);
  await expect(page.getByTestId('type-mismatch')).toContainText(/\.png/i);
});

test('AC-2: size in KB and pixel dimensions are shown', async ({ page }) => {
  await check(page, PHOTO);
  const bytes = fs.statSync(PHOTO).size;
  await expect(page.getByTestId('file-size')).toContainText(new Intl.NumberFormat('en-US').format(bytes));
  await expect(page.getByTestId('file-dims')).toContainText('1,200 × 800');
});

test('AC-3: rules give pass or fail per rule, with the measured value on a fail', async ({ page }) => {
  await check(page, PHOTO);
  const kb = fs.statSync(PHOTO).size / 1000;
  await page.getByTestId('rule-maxKb').fill(String(Math.ceil(kb) + 20));
  await expect(page.getByTestId('rule-row-max-size')).toHaveAttribute('data-status', 'pass');
  await page.getByTestId('rule-maxKb').fill(String(Math.max(1, Math.floor(kb / 2))));
  const row = page.getByTestId('rule-row-max-size');
  await expect(row).toHaveAttribute('data-status', 'fail');
  await expect(row).toContainText(/KB/);
  await page.getByTestId('rule-maxW').fill('1000');
  await expect(page.getByTestId('rule-row-max-width')).toHaveAttribute('data-status', 'fail');
  await expect(page.getByTestId('rule-row-max-width')).toContainText('1,200');
});

test('AC-4: the fix link opens the resizer with the size target filled in', async ({ page }) => {
  await check(page, PHOTO);
  await page.getByTestId('rule-minKb').fill('5');
  await page.getByTestId('rule-maxKb').fill('30');
  const link = page.getByTestId('fix-link');
  await expect(link).toHaveAttribute('href', '/?max=30&min=5');
  await link.click();
  await expect(page.getByTestId('tool')).toBeVisible();
  await expect(page.getByTestId('target')).toHaveValue('30');
  // the resizer opens its Advanced section by itself when the link carries a minimum
  await expect(page.getByTestId('min-size')).toHaveValue('5');
});

test('AC-5: no network request carries the file', async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const bad: string[] = [];
  context.on('request', (r) => {
    const u = new URL(r.url());
    if (!['blob:', 'data:'].includes(u.protocol) && u.origin !== origin) bad.push(r.url());
    if (r.method() !== 'GET') bad.push(`${r.method()} ${r.url()}`);
  });
  await check(page, PHOTO);
  await page.getByTestId('rule-maxKb').fill('20');
  expect(bad).toEqual([]);
});

test('AC-6: a file without density metadata reports DPI as not present', async ({ page }) => {
  await check(page, { name: 'flat.png', mimeType: 'image/png', buffer: makePng(40, 30, () => [10, 20, 30, 255]) });
  await expect(page.getByTestId('file-dpi')).toContainText(/not present|not found/i);
});

test('a file that is not an image says what it is and does not crash', async ({ page }) => {
  await check(page, { name: 'doc.png', mimeType: 'image/png', buffer: Buffer.from('%PDF-1.7 hello world') });
  await expect(page.getByTestId('real-type')).toHaveText(/PDF/);
});

test('H1: a HEIC file is named, and an accepted-type rule fails it', async ({ page }) => {
  await check(page, path.join(FIX, 'heic-header.heic'));
  await expect(page.getByTestId('real-type')).toHaveText(/HEIC/);
  await page.getByTestId('rule-type-jpeg').check();
  await expect(page.getByTestId('rule-row-type')).toHaveAttribute('data-status', 'fail');
  await expect(page.getByTestId('unsupported-note')).toBeVisible();
});
