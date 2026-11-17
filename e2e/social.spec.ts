import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import sharp from 'sharp';
import { makePng, NOISE, transparentPng } from './ui/helpers';

// 400x200 PNG: red grows left to right, green top to bottom, blue constant 60 (so a white pad is never mistaken for picture).
const wide = () => ({ name: 'wide.png', mimeType: 'image/png', buffer: makePng(400, 200, (x, y) => [Math.round((x / 399) * 255), Math.round((y / 199) * 255), 60, 255]) });

async function load(page: Page, url: string, f: string | { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto(url);
  await expect(page.getByTestId('tool')).toBeVisible();
  await expect(async () => {
    await page.getByTestId('file').setInputFiles(f);
    await expect(page.getByTestId('social-result')).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 40_000 });
}

async function download(page: Page): Promise<Buffer> {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download').click()]);
  return fs.readFileSync((await dl.path())!);
}

const px = async (buf: Buffer, x: number, y: number) => {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const o = (y * info.width + x) * info.channels;
  return [data[o], data[o + 1], data[o + 2]];
};

test('AC-1: crop mode outputs exactly the preset pixels', async ({ page }) => {
  await load(page, '/instagram-image-resizer/', wide());
  await page.getByTestId('fit-crop').check();
  const result = page.getByTestId('social-result');
  await expect(result).toHaveAttribute('data-width', '1080');
  await expect(result).toHaveAttribute('data-height', '1080');
  const buf = await download(page);
  const meta = await sharp(buf).metadata();
  expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 1080, 1080]);
});

test('changing the preset changes the output size', async ({ page }) => {
  await load(page, '/instagram-image-resizer/', wide());
  await page.getByTestId('preset').selectOption('ig-feed-portrait');
  await expect(page.getByTestId('social-result')).toHaveAttribute('data-height', '1440');
});

test('AC-2: pad keeps the whole picture and fills the rest with the chosen colour', async ({ page }) => {
  await load(page, '/instagram-image-resizer/', wide());
  await page.getByTestId('fit-pad').check();
  await page.getByTestId('pad-white').check();
  await expect(page.getByTestId('social-result')).toHaveAttribute('data-fit', 'pad');
  const buf = await download(page);
  const meta = await sharp(buf).metadata();
  expect([meta.width, meta.height]).toEqual([1080, 1080]);
  const corner = await px(buf, 5, 5);
  expect(Math.min(...corner)).toBeGreaterThan(240); // white bar
  expect((await px(buf, 3, 540))[0]).toBeLessThan(40); // left edge of the picture is visible (red low)
  expect((await px(buf, 1076, 540))[0]).toBeGreaterThan(215); // right edge too: nothing was cropped
});

test('AC-2: blur keeps the whole picture over a blurred copy of itself', async ({ page }) => {
  await load(page, '/instagram-image-resizer/', wide());
  await page.getByTestId('fit-blur').check();
  await expect(page.getByTestId('social-result')).toHaveAttribute('data-fit', 'blur');
  const buf = await download(page);
  const corner = await px(buf, 5, 5);
  expect(corner[2]).toBeLessThan(150); // picture colours, not a white bar
  expect((await px(buf, 3, 540))[0]).toBeLessThan(40);
  expect((await px(buf, 1076, 540))[0]).toBeGreaterThan(215);
});

test('AC-4: no network request carries the file and nothing leaves the origin', async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const bad: string[] = [];
  context.on('request', (r) => {
    const u = new URL(r.url());
    if (!['blob:', 'data:'].includes(u.protocol) && u.origin !== origin) bad.push(r.url());
    if (r.method() !== 'GET') bad.push(`${r.method()} ${r.url()}`);
  });
  await load(page, '/linkedin-image-resizer/', wide());
  await download(page);
  expect(bad).toEqual([]);
});

test('AC-5: each preset shows its source and checked date, and the sources guide links the official page', async ({ page }) => {
  for (const [url, id] of [['/instagram-image-resizer/', 'ig-photo'], ['/linkedin-image-resizer/', 'li-profile'], ['/youtube-thumbnail-resizer/', 'yt-thumbnails']] as const) {
    await page.goto(url);
    await expect(page.getByTestId('preset-source')).toHaveAttribute('href', `/guides/social-image-sizes/#${id}`);
    await expect(page.getByTestId('preset-checked')).toContainText(/\d{4}-\d{2}-\d{2}/);
  }
  await page.goto('/guides/social-image-sizes/');
  for (const [id, host] of [['ig-photo', 'help.instagram.com'], ['li-profile', 'linkedin.com/help'], ['yt-thumbnails', 'support.google.com']] as const) {
    const link = page.locator(`#${id} a[href*="${host}"]`);
    await expect(link).toHaveAttribute('rel', /noreferrer/);
  }
});

test('FR-5: the YouTube thumbnail page applies the 2 MB byte cap and the result fits it', async ({ page }) => {
  await load(page, '/youtube-thumbnail-resizer/', NOISE);
  await expect(page.getByTestId('max-kb')).toHaveValue('2000');
  const buf = await download(page);
  const meta = await sharp(buf).metadata();
  expect([meta.width, meta.height]).toEqual([3840, 2160]);
  expect(buf.length).toBeLessThanOrEqual(2_000_000);
});

test('a source smaller than the preset is flagged as enlarged', async ({ page }) => {
  await load(page, '/instagram-image-resizer/', wide());
  await expect(page.getByTestId('enlarge-note')).toBeVisible();
});

test('H1: choosing a second picture replaces the result (no stale download)', async ({ page }) => {
  await load(page, '/instagram-image-resizer/', wide()); // red grows to the right
  const flipped = { name: 'other.png', mimeType: 'image/png', buffer: makePng(400, 200, (x, y) => [Math.round(((399 - x) / 399) * 255), Math.round((y / 199) * 255), 60, 255]) }; // red grows to the left
  await page.getByTestId('fit-pad').check();
  await expect(page.getByTestId('social-result')).toHaveAttribute('data-fit', 'pad');
  await page.getByTestId('file').setInputFiles(flipped);
  await expect(async () => {
    const buf = await download(page);
    expect((await px(buf, 1076, 540))[0]).toBeLessThan(60); // right edge now has LOW red
    expect((await px(buf, 3, 540))[0]).toBeGreaterThan(200);
  }).toPass({ timeout: 15_000 });
});

test('M3: transparent areas are filled with the chosen colour in crop mode too, never black', async ({ page }) => {
  await load(page, '/instagram-image-resizer/', { name: 't.png', mimeType: 'image/png', buffer: transparentPng() });
  await page.getByTestId('fit-crop').check();
  await expect(page.getByTestId('social-result')).toHaveAttribute('data-fit', 'crop');
  const buf = await download(page);
  expect(Math.min(...(await px(buf, 5, 5)))).toBeGreaterThan(235); // top-left of the source is transparent: white, not black
});

test('M2/M7: a tight size limit lowers the quality, says so, and the result fits', async ({ page }) => {
  await load(page, '/youtube-thumbnail-resizer/', NOISE);
  await page.getByTestId('max-kb').fill('300');
  const result = page.getByTestId('social-result');
  await expect.poll(async () => Number(await result.getAttribute('data-bytes')), { timeout: 20_000 }).toBeLessThanOrEqual(300_000);
  await expect(result).toHaveAttribute('data-busy', 'false');
  await expect(page.getByTestId('lowered-note')).toBeVisible();
  const buf = await download(page);
  expect(buf.length).toBeLessThanOrEqual(300_000);
});

test('Start over clears the result', async ({ page }) => {
  await load(page, '/instagram-image-resizer/', wide());
  await page.getByTestId('start-over').click();
  await expect(page.getByTestId('social-result')).toHaveCount(0);
});
