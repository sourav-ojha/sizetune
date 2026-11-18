import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const PHOTO = path.join(import.meta.dirname, '..', 'tests', 'fixtures', 'photo-1200x800.jpg'); // 1200 x 800
const ROTATED = path.join(import.meta.dirname, '..', 'tests', 'fixtures', 'exif6-gps.jpg'); // stored 400x300, EXIF orientation 6

test.beforeEach(async ({ page }) => {
  await page.goto('/add-name-date-to-photo/');
  await expect(page.getByTestId('tool').first()).toBeVisible();
  // Server-rendered, so visible before the island hydrates; a file chosen before then is handled, but clicks and typing are lost.
  await page.waitForFunction(() => { const i = document.querySelector('astro-island'); return !!i && !i.hasAttribute('ssr'); });
});

async function openPhoto(page: Page, file = PHOTO) {
  await page.getByTestId('file').setInputFiles(file);
  await expect(page.getByTestId('caption-preview')).toBeVisible();
}

type Region = { width: number; height: number; ink: number; leftmost: number; rightmost: number; bg: number[] };
/** Counts pixels in a band of the preview that differ from the band's background, and where they start and stop. Done in the page: no pixels cross the boundary. */
const band = (page: Page, y0: number, y1: number, bgAt: [number, number]): Promise<Region> => page.getByTestId('caption-preview').evaluate((cv: HTMLCanvasElement, [a, b, bx, by]) => {
  const ctx = cv.getContext('2d')!;
  const bgp = ctx.getImageData(bx, by, 1, 1).data;
  const d = ctx.getImageData(0, a, cv.width, b - a).data;
  let ink = 0, left = cv.width, right = -1;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i] - bgp[0]) + Math.abs(d[i + 1] - bgp[1]) + Math.abs(d[i + 2] - bgp[2]) > 120) {
      ink++;
      const x = (i / 4) % cv.width;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  return { width: cv.width, height: cv.height, ink, leftmost: left, rightmost: right, bg: [bgp[0], bgp[1], bgp[2]] };
}, [y0, y1, bgAt[0], bgAt[1]] as [number, number, number, number]);
/** A checksum of a horizontal band of the preview, to tell whether anything in it changed. */
const sum = (page: Page, y0: number, y1: number): Promise<number> => page.getByTestId('caption-preview').evaluate((cv: HTMLCanvasElement, [a, b]) => {
  const d = cv.getContext('2d')!.getImageData(0, a, cv.width, b - a).data;
  let t = 0;
  for (let i = 0; i < d.length; i++) t = (t * 31 + d[i]) >>> 0;
  return t;
}, [y0, y1] as [number, number]);
const dims = (page: Page) => page.getByTestId('caption-preview').evaluate((cv: HTMLCanvasElement) => ({ w: cv.width, h: cv.height }));

test('AC-1: the caption appears on a strip below the photo, which grows the picture by the strip height', async ({ page }) => {
  await openPhoto(page);
  await page.getByTestId('cap-name').fill('Asha Rao');
  await page.getByTestId('cap-date').fill('2024-03-07');
  await expect.poll(async () => (await dims(page)).h).toBe(912); // 800 + 14% of 800
  expect((await dims(page)).w).toBe(1200);
  const strip = await band(page, 800, 912, [5, 905]);
  expect(strip.bg, 'strip is white').toEqual([255, 255, 255]);
  expect(strip.ink, 'the caption text is drawn on the strip').toBeGreaterThan(400);
  expect(strip.leftmost, 'text is centred, not touching the edges').toBeGreaterThan(100);
  expect(strip.rightmost).toBeLessThan(1100);
});

test('AC-1: the date follows the chosen style, and a typed date is used as typed', async ({ page }) => {
  await openPhoto(page);
  await page.getByTestId('cap-date').fill('2024-03-07');
  await expect.poll(async () => (await band(page, 800, 912, [5, 905])).ink).toBeGreaterThan(100);
  const a = await band(page, 800, 912, [5, 905]);
  await page.getByTestId('cap-style').selectOption('d-mon-y'); // the picked date must survive a change of style
  await expect.poll(async () => { const b = await band(page, 800, 912, [5, 905]); return b.ink > 100 && b.ink !== a.ink; }).toBe(true); // "07 Mar 2024" draws differently from "07/03/2024"
  await page.getByTestId('cap-style').selectOption('typed');
  await page.getByTestId('cap-date-text').fill('Spring term');
  await expect.poll(async () => (await band(page, 800, 912, [5, 905])).ink).toBeGreaterThan(200);
});

test('AC-2: changing the text size updates the preview live, without any button', async ({ page }) => {
  await openPhoto(page);
  await page.getByTestId('cap-name').fill('Asha');
  await page.getByTestId('cap-text-pct').fill('3');
  await expect.poll(async () => (await band(page, 800, 912, [5, 905])).ink).toBeGreaterThan(50);
  const small = (await band(page, 800, 912, [5, 905])).ink;
  await page.getByTestId('cap-text-pct').fill('9');
  await expect.poll(async () => (await band(page, 800, 912, [5, 905])).ink).toBeGreaterThan(small * 2);
});

test('strip height and colours change the picture; text too long for the width shrinks to fit', async ({ page }) => {
  await openPhoto(page);
  await page.getByTestId('cap-strip-pct').fill('25');
  await expect.poll(async () => (await dims(page)).h).toBe(1000);
  await page.getByTestId('cap-strip-color').selectOption('#111827');
  await page.getByTestId('cap-color').selectOption('#ffffff');
  await page.getByTestId('cap-name').fill('A very long name that goes on and on and on and on and on and on and on and on and on');
  await expect.poll(async () => (await band(page, 800, 1000, [5, 995])).ink).toBeGreaterThan(300);
  const strip = await band(page, 800, 1000, [5, 995]);
  expect(strip.bg, 'strip is now black').toEqual([17, 24, 39]);
  expect(strip.leftmost, 'long text still fits inside the picture').toBeGreaterThanOrEqual(0);
  expect(strip.rightmost).toBeLessThan(1200);
});

test('text on the photo keeps the photo size and draws the caption on its bottom edge', async ({ page }) => {
  await openPhoto(page);
  await page.getByTestId('place-over').click();
  await expect.poll(async () => (await dims(page)).h).toBe(800);
  const bottom = await sum(page, 690, 800), top = await sum(page, 0, 600);
  await page.getByTestId('cap-name').fill('Asha Rao');
  await expect.poll(() => sum(page, 690, 800)).not.toBe(bottom); // the caption changed the bottom edge
  expect(await sum(page, 0, 600), 'the rest of the photo is untouched').toBe(top);
  await expect(page.getByTestId('cap-strip-color')).toHaveCount(0); // no strip, so no strip colour
});

test('a photo taken on its side is turned upright first, so the caption sits along the bottom', async ({ page }) => {
  await openPhoto(page, ROTATED);
  // 400x300 stored with orientation 6 shows as portrait (300 wide, 400 tall); the strip makes it taller still
  await expect.poll(async () => { const d = await dims(page); return d.w === 300 && d.h > 400; }).toBe(true);
});

test('Download JPG saves the captioned picture at the previewed size', async ({ page }) => {
  await openPhoto(page);
  await page.getByTestId('cap-name').fill('Asha Rao');
  await expect.poll(async () => (await dims(page)).h).toBe(912);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download').click()]);
  expect(dl.suggestedFilename()).toBe('photo-1200x800-caption.jpg');
  const bytes = fs.readFileSync((await dl.path())!);
  expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  const other = await page.context().newPage();
  const size = await other.evaluate(async (b64) => {
    const u = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const img = document.createElement('img');
    img.src = URL.createObjectURL(new Blob([u], { type: 'image/jpeg' }));
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  }, bytes.toString('base64'));
  await other.close();
  expect(size).toEqual([1200, 912]);
});

test('AC-3: Resize to KB loads the captioned photo into the resizer on this page', async ({ page }) => {
  await openPhoto(page);
  await page.getByTestId('cap-name').fill('Asha Rao');
  await page.getByTestId('to-resizer').click();
  const area = page.getByTestId('resize-area');
  await expect(area).toBeVisible();
  const resizer = area.getByTestId('tool');
  await expect(resizer.getByTestId('file-card')).toBeVisible({ timeout: 15_000 }); // loaded without picking a file
  await resizer.getByTestId('preset-100').click();
  await expect(resizer.getByTestId('result')).toBeVisible({ timeout: 60_000 });
  expect(Number(await resizer.getByTestId('result-size').getAttribute('data-bytes'))).toBeLessThanOrEqual(100_000);
});

test('a file that is not an image is explained, not drawn', async ({ page }) => {
  await page.getByTestId('file').setInputFiles({ name: 'notes.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('this is plain text, not a picture') });
  await expect(page.getByTestId('error')).toContainText(/not a JPEG, PNG or WebP/i);
  await expect(page.getByTestId('caption-preview')).toHaveCount(0);
});

test('AC-4: captioning, saving and resizing sends no request that carries the photo', async ({ page }) => {
  const seen: { method: string; url: string; post: boolean }[] = [];
  page.on('request', (r) => seen.push({ method: r.method(), url: r.url(), post: !!r.postData() }));
  await openPhoto(page);
  await page.getByTestId('cap-name').fill('secret-name-xyz');
  await page.getByTestId('to-resizer').click();
  await expect(page.getByTestId('resize-area').getByTestId('file-card')).toBeVisible({ timeout: 15_000 });
  const origin = new URL(page.url()).origin;
  expect(seen.filter((r) => r.method !== 'GET' || r.post)).toEqual([]);
  expect(seen.filter((r) => /secret-name-xyz/.test(r.url))).toEqual([]);
  expect(seen.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('blob:') && !r.url.startsWith('data:'))).toEqual([]);
});
