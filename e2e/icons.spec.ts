import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import sharp from 'sharp';
import { unzipSync } from 'fflate';
import { makePng } from './ui/helpers';

const PAGE = '/favicon-generator/';
// 1024x1024: red grows to the right, green grows down; the top-left 200x200 corner is fully transparent.
const square = () => ({ name: 'logo.png', mimeType: 'image/png', buffer: makePng(1024, 1024, (x, y) => (x < 200 && y < 200 ? [0, 0, 0, 0] : [Math.round((x / 1023) * 255), Math.round((y / 1023) * 255), 90, 255])) });
const wide = () => ({ name: 'wide.png', mimeType: 'image/png', buffer: makePng(600, 300, (x, y) => [Math.round((x / 599) * 255), Math.round((y / 299) * 255), 90, 255]) });
const tiny = () => ({ name: 'tiny.png', mimeType: 'image/png', buffer: makePng(100, 100, (x, y) => [x * 2, y * 2, 90, 255]) });

async function load(page: Page, f: { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto(PAGE);
  await expect(page.getByTestId('tool')).toBeVisible();
  await expect(async () => {
    await page.getByTestId('file').setInputFiles(f);
    await expect(page.getByTestId('icon-result')).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 40_000 });
}

async function zip(page: Page) {
  await expect(page.getByTestId('icon-result')).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-zip').click()]);
  return unzipSync(new Uint8Array(fs.readFileSync((await dl.path())!)));
}

const meta = async (b: Uint8Array) => sharp(Buffer.from(b)).metadata();
const px = async (b: Uint8Array, x: number, y: number) => {
  const { data, info } = await sharp(Buffer.from(b)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const o = (y * info.width + x) * info.channels;
  return [data[o], data[o + 1], data[o + 2], data[o + 3]];
};

test('AC-1: favicon mode gives an ICO and the PNG sizes in the list', async ({ page }) => {
  await load(page, square());
  const z = await zip(page);
  expect(Object.keys(z).sort()).toEqual(['HOW-TO-ADD.txt', 'favicon-48x48.png', 'favicon-96x96.png', 'favicon.ico']);
  const ico = z['favicon.ico'];
  expect([ico[0], ico[2], ico[4]]).toEqual([0, 1, 3]); // ICONDIR: reserved, type icon, three images
  for (const [name, side] of [['favicon-48x48.png', 48], ['favicon-96x96.png', 96]] as const) {
    const m = await meta(z[name]);
    expect([m.format, m.width, m.height]).toEqual(['png', side, side]);
  }
  expect((await px(z['favicon-96x96.png'], 2, 2))[3]).toBe(0); // transparency kept in favicon PNGs
});

test('AC-2: app icon mode ZIP holds every file and a manifest that matches them', async ({ page }) => {
  await load(page, square());
  await page.getByTestId('mode-app').check();
  await expect(page.getByTestId('icon-result')).toHaveAttribute('data-mode', 'app');
  await page.getByTestId('app-name').fill('Test App');
  await expect(page.getByTestId('icon-file-site.webmanifest')).toBeVisible();
  const z = await zip(page);
  const names = Object.keys(z).sort();
  expect(names).toEqual(['HOW-TO-ADD.txt', 'apple-1024.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'play-store-512.png', 'site.webmanifest']);
  const manifest = JSON.parse(new TextDecoder().decode(z['site.webmanifest']));
  expect(manifest.name).toBe('Test App');
  expect(manifest.icons.length).toBe(3);
  for (const icon of manifest.icons) {
    expect(z[icon.src], icon.src).toBeTruthy();
    const m = await meta(z[icon.src]);
    expect(`${m.width}x${m.height}`).toBe(icon.sizes);
  }
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  // the store icon must be opaque; the plain app icon keeps transparency
  expect((await px(z['play-store-512.png'], 2, 2))[3]).toBe(255);
  expect((await px(z['icon-512.png'], 2, 2))[3]).toBe(0);
  const mask = await px(z['icon-maskable-512.png'], 5, 5);
  expect(mask[3]).toBe(255); // full-bleed background in the corner
});

test('AC-4: no network request carries the file and nothing leaves the origin', async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const bad: string[] = [];
  context.on('request', (r) => {
    const u = new URL(r.url());
    if (!['blob:', 'data:'].includes(u.protocol) && u.origin !== origin) bad.push(r.url());
    if (r.method() !== 'GET') bad.push(`${r.method()} ${r.url()}`);
  });
  await load(page, wide());
  await zip(page);
  expect(bad).toEqual([]);
});

test('AC-5: a non-square or small source shows a warning and a fix', async ({ page }) => {
  await load(page, wide());
  await expect(page.getByTestId('icon-warning')).toContainText(/not square/i);
  await expect(page.getByTestId('fix-pad')).toBeChecked();
  const z1 = await zip(page);
  expect((await px(z1['favicon-96x96.png'], 48, 2))[3]).toBe(0); // padded: empty space above the picture
  await page.getByTestId('fix-crop').check();
  await expect(page.getByTestId('icon-result')).toBeVisible();
  await expect.poll(async () => { const z = await zip(page); return (await px(z['favicon-96x96.png'], 48, 2))[3]; }, { timeout: 15_000 }).toBe(255); // cropped: picture fills the square
});

test('AC-5: a source under 512 px is flagged as enlarged', async ({ page }) => {
  await load(page, tiny());
  await expect(page.getByTestId('icon-warning')).toContainText(/512/);
});

test('an individual file can be downloaded without the ZIP', async ({ page }) => {
  await load(page, square());
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-file-favicon.ico').click()]);
  expect(fs.statSync((await dl.path())!).size).toBeGreaterThan(100);
});
