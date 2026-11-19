import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import sharp from 'sharp';
import { watchNetwork } from './ui/helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/text-to-handwriting/');
  await expect(page.getByTestId('tool').first()).toBeVisible();
  // Server-rendered, so visible before the island hydrates; typing before then is lost.
  await page.waitForFunction(() => { const i = document.querySelector('astro-island'); return !!i && !i.hasAttribute('ssr'); });
});

const meta = (page: Page) => page.getByTestId('hw-preview').evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height, pages: Number(c.dataset.pages), page: Number(c.dataset.page), lines: Number(c.dataset.lines), font: c.dataset.font }));
/** Number of non-white pixels in a band of the preview, in the page. */
const ink = (page: Page, y0: number, y1: number, x0 = 0, x1 = 1240) => page.getByTestId('hw-preview').evaluate((c: HTMLCanvasElement, r) => {
  const d = c.getContext('2d')!.getImageData(r[0], r[1], r[2] - r[0], r[3] - r[1]).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] < 120 || d[i + 2] < 120) n++; // dark pixel: ink, not the pale paper lines
  return n;
}, [x0, y0, x1, y1]);
const write = async (page: Page, text: string) => { await page.getByTestId('hw-text').fill(text); };
const LONG = Array.from({ length: 80 }, (_, i) => `This is line number ${i + 1} of a long letter written by hand.`).join('\n');

test('AC-1: typed text appears on the page, in the chosen ink, on the chosen paper', async ({ page }) => {
  await write(page, 'Hello there');
  await expect.poll(() => ink(page, 150, 260)).toBeGreaterThan(300); // text drawn in the first lines
  expect(await ink(page, 1300, 1700), 'nothing below the text').toBe(0);
  // the default ink is blue (#1e40af): dark pixels that are clearly bluer than red
  expect(await page.getByTestId('hw-preview').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 150, 1240, 110).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 80 && d[i + 2] - d[i] > 80) n++;
    return n;
  })).toBeGreaterThan(100);
  await page.getByTestId('ink-black').click();
  await expect.poll(() => page.getByTestId('hw-preview').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 150, 1240, 110).data;
    let max = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 60) max = Math.max(max, Math.abs(d[i] - d[i + 2]));
    return max;
  })).toBeLessThan(40); // black ink: red and blue channels agree
});

test('paper styles change the page: ruled lines and a margin, squares, or plain white', async ({ page }) => {
  await write(page, 'x');
  const px = (x: number, y: number) => page.getByTestId('hw-preview').evaluate((c: HTMLCanvasElement, p) => Array.from(c.getContext('2d')!.getImageData(p[0], p[1], 1, 1).data).slice(0, 3), [x, y]);
  await page.getByTestId('paper-plain').click();
  await expect.poll(async () => (await px(600, 1000)).every((v) => v > 250)).toBe(true);
  await page.getByTestId('paper-ruled').click();
  // some pixel in the column x = 600 below the text is a ruled line (pale blue), none on plain paper
  await expect.poll(() => page.getByTestId('hw-preview').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(600, 400, 1, 600).data;
    let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 2] > d[i] + 20 && d[i] < 230) n++; return n;
  })).toBeGreaterThan(5);
  await page.getByTestId('paper-grid').click();
  await expect.poll(() => page.getByTestId('hw-preview').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 800, 1240, 1).data; // a row of the page: vertical grid lines cross it
    let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 235) n++; return n;
  })).toBeGreaterThan(10);
});

test('AC-2: long text runs on to more pages, and the page buttons walk through them', async ({ page }) => {
  await write(page, LONG);
  await expect.poll(async () => (await meta(page)).pages).toBeGreaterThan(2);
  const first = await meta(page);
  expect(first.page).toBe(1);
  await expect(page.getByTestId('hw-prev')).toBeDisabled();
  await page.getByTestId('hw-next').click();
  await expect(page.getByTestId('hw-page-label')).toHaveText(`Page 2 of ${first.pages}`);
  expect((await meta(page)).lines).toBeGreaterThan(5);
  while ((await meta(page)).page < first.pages) await page.getByTestId('hw-next').click();
  await expect(page.getByTestId('hw-next')).toBeDisabled();
});

test('a changed text goes back to page 1 and a shorter text never leaves the page index past the end', async ({ page }) => {
  await write(page, LONG);
  await expect.poll(async () => (await meta(page)).pages).toBeGreaterThan(2);
  await page.getByTestId('hw-next').click();
  await page.getByTestId('hw-next').click();
  await write(page, 'short');
  await expect.poll(() => meta(page)).toMatchObject({ pages: 1, page: 1 });
});

test('very long text stops at the page cap and says so', async ({ page }) => {
  await write(page, Array.from({ length: 400 }, (_, i) => `Line ${i}`).join('\n'));
  await expect.poll(async () => (await meta(page)).pages).toBe(10);
  await expect(page.getByTestId('hw-truncated')).toBeVisible();
});

test('characters outside the fonts are listed, not dropped', async ({ page }) => {
  await write(page, 'Hello नमस्ते');
  await expect(page.getByTestId('hw-missing')).toContainText('न');
  await write(page, 'Café déjà vu');
  await expect(page.getByTestId('hw-missing')).toHaveCount(0);
});

test('choosing another font redraws the page', async ({ page }) => {
  await write(page, 'The same words');
  await expect.poll(() => ink(page, 150, 260)).toBeGreaterThan(200);
  const a = await ink(page, 150, 260);
  await page.getByTestId('font-apple').click();
  await expect.poll(async () => (await meta(page)).font).toBe('apple');
  await expect.poll(async () => (await ink(page, 150, 260)) !== a).toBe(true);
});

test('AC-2 and FR-2: downloads are a real PNG, JPG and a ZIP of every page', async ({ page }) => {
  await write(page, LONG);
  await expect.poll(async () => (await meta(page)).pages).toBeGreaterThan(2);
  const pages = (await meta(page)).pages;
  let [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-png').click()]);
  let buf = fs.readFileSync((await dl.path())!);
  let m = await sharp(buf).metadata();
  expect([m.format, m.width, m.height]).toEqual(['png', 1240, 1754]);
  expect(dl.suggestedFilename()).toBe('handwriting-page-1.png');
  [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-jpg').click()]);
  buf = fs.readFileSync((await dl.path())!);
  expect((await sharp(buf).metadata()).format).toBe('jpeg');
  [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-zip').click()]);
  const zip = fs.readFileSync((await dl.path())!);
  expect(zip.subarray(0, 4).toString('hex')).toBe('504b0304');
  const entries = zip.toString('latin1').match(/handwriting-page-\d\d\.png/g) ?? [];
  expect(new Set(entries).size).toBe(pages);
});

test('an empty text cannot be saved', async ({ page }) => {
  await write(page, '   ');
  await expect(page.getByTestId('save-png')).toBeDisabled();
  await expect(page.getByTestId('to-resizer')).toBeDisabled();
});

test('FR-2: Resize this page to KB loads it in the resizer', async ({ page }) => {
  await write(page, 'A short note');
  await page.getByTestId('to-resizer').click();
  await expect(page.getByTestId('resize-area')).toBeVisible();
  await expect(page.getByTestId('file-card')).toBeVisible({ timeout: 20_000 });
});

test('AC-3: no request leaves the page and none carries the text', async ({ page, baseURL }) => {
  const net = watchNetwork(page, baseURL!);
  const posted: string[] = [];
  page.on('request', (r) => { if (r.postData()) posted.push(r.postData()!); });
  await write(page, 'secret words nobody else should see');
  await page.getByTestId('font-dancing').click();
  await page.getByTestId('save-png').click();
  expect(net.external).toEqual([]);
  expect(net.nonGet).toEqual([]);
  expect(posted).toEqual([]);
  // the text is not in any URL either
  expect((await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name))).some((u) => /secret/i.test(u))).toBe(false);
});
