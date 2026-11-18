import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { watchNetwork, isRed } from './ui/helpers';

const FIX = path.join(import.meta.dirname, '..', 'tests', 'fixtures');
const AVIF = path.join(FIX, 'two-tone-64x48.avif');
const ANIMATED = path.join(FIX, 'animated-64x48.avif');
const JFIF = path.join(FIX, 'two-tone.jfif');

test.beforeEach(async ({ page }) => {
  await page.goto('/avif-jfif-to-jpg/');
  await expect(page.getByTestId('tool').first()).toBeVisible();
  // Server-rendered, so visible before the island hydrates; a pick before then is picked up on hydration, but waiting keeps tests steady.
  await page.waitForFunction(() => { const i = document.querySelector('astro-island'); return !!i && !i.hasAttribute('ssr'); });
});

/** Can this browser decode the AVIF fixture? Chromium and Firefox can; some WebKit builds cannot. */
const canDecodeAvif = (page: Page) => page.evaluate(async (b64) => {
  try { await createImageBitmap(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'image/avif' })); return true; } catch { return false; }
}, fs.readFileSync(AVIF).toString('base64'));

async function download(page: Page) {
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download').click()]);
  return { buf: fs.readFileSync((await dl.path())!), name: dl.suggestedFilename() };
}
const input = (page: Page) => page.getByTestId('file').first();

test('AC-1: an AVIF becomes a JPG with its colours, when the browser can decode AVIF', async ({ page }) => {
  test.skip(!(await canDecodeAvif(page)), 'this browser cannot decode AVIF; the message path is tested below');
  await input(page).setInputFiles(AVIF);
  const { buf, name } = await download(page);
  const meta = await sharp(buf).metadata();
  expect(meta.format).toBe('jpeg');
  expect([meta.width, meta.height]).toEqual([64, 48]);
  expect(name).toMatch(/\.jpe?g$/i);
  const { data } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  expect(isRed([data[(10 * 64 + 5) * 3], data[(10 * 64 + 5) * 3 + 1], data[(10 * 64 + 5) * 3 + 2]]), 'left half stays red').toBe(true);
  expect(data[(10 * 64 + 58) * 3 + 2], 'right half stays blue').toBeGreaterThan(150);
});

test('AC-2: a browser that cannot decode AVIF gets a clear message and no converter', async ({ page }) => {
  await page.evaluate(() => { window.createImageBitmap = () => Promise.reject(new DOMException('unsupported', 'InvalidStateError')); });
  await input(page).setInputFiles(AVIF);
  await expect(page.getByTestId('error')).toContainText('cannot read AVIF');
  await expect(page.getByTestId('result')).toHaveCount(0);
  await expect(page.getByTestId('file-card')).toHaveCount(0);
});

test('AC-3: a JFIF file becomes a JPG', async ({ page }) => {
  await input(page).setInputFiles(JFIF);
  const { buf } = await download(page);
  const meta = await sharp(buf).metadata();
  expect(meta.format).toBe('jpeg');
  expect([meta.width, meta.height]).toEqual([64, 48]);
});

test('an AVIF can also be saved as a PNG', async ({ page }) => {
  test.skip(!(await canDecodeAvif(page)), 'this browser cannot decode AVIF');
  await input(page).setInputFiles(AVIF);
  await expect(page.getByTestId('format-png')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('format-png').check();
  const { buf } = await download(page);
  expect((await sharp(buf).metadata()).format).toBe('png');
});

test('an animated AVIF converts its first frame and says so', async ({ page }) => {
  test.skip(!(await canDecodeAvif(page)), 'this browser cannot decode AVIF');
  await input(page).setInputFiles(ANIMATED);
  await expect(page.getByTestId('note')).toContainText('first frame');
  const { buf } = await download(page);
  const { data } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  // first frame: left half is red (220,30,30); the second frame's left half would be green
  expect(data[(10 * 64 + 5) * 3]).toBeGreaterThan(150);
  expect(data[(10 * 64 + 5) * 3 + 1]).toBeLessThan(100);
});

test('a damaged AVIF shows the message instead of failing silently', async ({ page }) => {
  const bytes = fs.readFileSync(AVIF);
  await input(page).setInputFiles({ name: 'broken.avif', mimeType: 'image/avif', buffer: Buffer.concat([bytes.subarray(0, 40), Buffer.alloc(60, 7)]) });
  await expect(page.getByTestId('error')).toBeVisible();
  await expect(page.getByTestId('result')).toHaveCount(0);
});

test('HEIC and other files are refused with their own message', async ({ page }) => {
  const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(12)]);
  await input(page).setInputFiles({ name: 'iphone.heic', mimeType: 'image/heic', buffer: heic });
  await expect(page.getByTestId('error')).toContainText('HEIC');
  await input(page).setInputFiles({ name: 'notes.avif', mimeType: 'image/avif', buffer: Buffer.from('plain text, not a picture at all') });
  await expect(page.getByTestId('error')).toContainText('not an AVIF');
});

test('AC-4: nothing leaves the page and nothing is posted', async ({ page, baseURL }) => {
  const net = watchNetwork(page, baseURL!);
  await input(page).setInputFiles(JFIF);
  await download(page);
  expect(net.external).toEqual([]);
  expect(net.nonGet).toEqual([]);
});
