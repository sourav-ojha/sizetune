import { test, expect, type Page } from '@playwright/test';
import { file, makePng, NOISE, signaturePng } from './ui/helpers';

const photo = () => file('photo.png', makePng(300, 400, () => [200, 30, 30, 255])); // red, 300 x 400
const sig = () => file('sig.png', signaturePng()); // white with dark ink, 600 x 200

test.beforeEach(async ({ page }) => {
  await page.goto('/merge-photo-and-signature/');
  await expect(page.getByTestId('tool').first()).toBeVisible();
  // Server-rendered, so visible before the island hydrates; clicks and typing before then are lost.
  await page.waitForFunction(() => { const i = document.querySelector('astro-island'); return !!i && !i.hasAttribute('ssr'); });
});

async function addBoth(page: Page) {
  await page.getByTestId('slot-photo').getByTestId('file').setInputFiles(photo());
  await page.getByTestId('slot-signature').getByTestId('file').setInputFiles(sig());
  await expect(page.getByTestId('merge-preview')).toBeVisible();
}
type Box = { x: number; y: number; w: number; h: number };
const boxes = async (page: Page) => {
  const c = page.getByTestId('merge-preview');
  return { photo: JSON.parse((await c.getAttribute('data-photo-box'))!) as Box, sig: JSON.parse((await c.getAttribute('data-signature-box'))!) as Box };
};
const canvasSize = (page: Page) => page.getByTestId('merge-preview').evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height }));
const pixel = (page: Page, x: number, y: number) => page.getByTestId('merge-preview').evaluate((c: HTMLCanvasElement, [px, py]) => Array.from(c.getContext('2d')!.getImageData(px, py, 1, 1).data), [x, y] as [number, number]);
/** Dark pixels inside a box: the signature's ink. */
const darkIn = (page: Page, b: Box) => page.getByTestId('merge-preview').evaluate((c: HTMLCanvasElement, bb) => {
  const d = c.getContext('2d')!.getImageData(bb.x, bb.y, bb.w, bb.h).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] < 90 && d[i + 1] < 90 && d[i + 2] < 120) n++;
  return n;
}, b);
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('before both pictures are added there is only a hint, and no preview', async ({ page }) => {
  await expect(page.getByTestId('merge-hint')).toBeVisible();
  await page.getByTestId('slot-photo').getByTestId('file').setInputFiles(photo());
  await expect(page.getByTestId('photo-info')).toContainText('300');
  await expect(page.getByTestId('merge-preview')).toHaveCount(0);
});

test('AC-1: stacked, the photo is above the signature, both fully inside and not overlapping', async ({ page }) => {
  await addBoth(page);
  await expect.poll(async () => (await canvasSize(page)).h).toBe(1012); // 800 photo + 12 gap + 200 signature at 600 wide
  const b = await boxes(page);
  expect(overlap(b.photo, b.sig)).toBe(false);
  expect(b.sig.y).toBeGreaterThanOrEqual(b.photo.y + b.photo.h);
  const red = await pixel(page, 300, 400);
  expect(red[0]).toBeGreaterThan(150);
  expect(red[1]).toBeLessThan(80);
  expect(await pixel(page, 5, 806), 'the gap is white').toEqual([255, 255, 255, 255]);
  expect(await darkIn(page, b.sig), 'the signature ink is there').toBeGreaterThan(300);
  expect(await darkIn(page, b.photo), 'no ink on the photo').toBe(0);
});

test('AC-1: side by side, both sit on one row at the same height without overlapping', async ({ page }) => {
  await addBoth(page);
  await page.getByTestId('layout-side').click();
  await page.getByTestId('out-w').fill('1000');
  await expect.poll(async () => (await canvasSize(page)).w).toBe(1000);
  const b = await boxes(page);
  expect(b.photo.h).toBe(b.sig.h);
  expect(b.photo.y).toBe(b.sig.y);
  expect(overlap(b.photo, b.sig)).toBe(false);
  expect(b.sig.x + b.sig.w).toBeLessThanOrEqual(1000);
  const red = await pixel(page, Math.floor(b.photo.w / 2), Math.floor(b.photo.h / 2));
  expect(red[0]).toBeGreaterThan(150);
  expect(await darkIn(page, b.sig)).toBeGreaterThan(100);
});

test('the output width changes the picture size, and a width that makes it too large is explained', async ({ page }) => {
  await addBoth(page);
  await page.getByTestId('out-w').fill('300');
  await expect.poll(async () => (await canvasSize(page)).w).toBe(300);
  await page.getByTestId('out-w').fill('99999'); // clamps to 4000, where photo + signature exceed what a canvas can safely hold
  await expect(page.getByTestId('size-error')).toContainText(/more than this page can handle/i);
  await expect(page.getByTestId('make')).toBeDisabled();
  await page.getByTestId('out-w').fill('600');
  await expect(page.getByTestId('size-error')).toHaveCount(0);
  await expect(page.getByTestId('make')).toBeEnabled();
});

test('AC-2: the merged picture lands in the resizer with the size limit, and the result is at or under it', async ({ page }) => {
  await addBoth(page);
  await page.getByTestId('cap-kb').fill('20');
  await page.getByTestId('make').click();
  const area = page.getByTestId('resize-area');
  await expect(area).toBeVisible();
  const resizer = area.getByTestId('tool');
  await expect(resizer.getByTestId('result')).toBeVisible({ timeout: 60_000 });
  const size = resizer.getByTestId('result-size');
  expect(Number(await size.getAttribute('data-bytes'))).toBeLessThanOrEqual(20_000);
  expect(await size.getAttribute('data-status')).toBe('ok');
});

test('AC-2: a very small limit is either met, or the result says by how much it was missed', async ({ page }) => {
  await page.getByTestId('slot-photo').getByTestId('file').setInputFiles(NOISE); // random pixels: 1 KB is at the edge of what any browser's encoder can reach
  await page.getByTestId('slot-signature').getByTestId('file').setInputFiles(sig());
  await expect(page.getByTestId('merge-preview')).toBeVisible();
  await page.getByTestId('cap-kb').fill('1');
  await page.getByTestId('make').click();
  const resizer = page.getByTestId('resize-area').getByTestId('tool');
  await expect(resizer.getByTestId('result')).toBeVisible({ timeout: 60_000 });
  const size = resizer.getByTestId('result-size');
  if ((await size.getAttribute('data-status')) === 'ok') expect(Number(await size.getAttribute('data-bytes'))).toBeLessThanOrEqual(1000);
  else await expect(resizer.getByTestId('result-gap')).toContainText(/Over by [\d,]+ bytes/); // not hidden: the miss is stated
  await expect(resizer.getByTestId('result')).toContainText(/\d+ × \d+ px/);
});

test('a size limit that is not a number is explained', async ({ page }) => {
  await addBoth(page);
  await page.getByTestId('cap-kb').fill('');
  await page.getByTestId('make').click();
  await expect(page.getByTestId('size-error')).toContainText(/whole number of KB/i);
  await expect(page.getByTestId('resize-area')).toHaveCount(0);
});

test('a file that is not an image is explained in its own slot and does not break the other', async ({ page }) => {
  await page.getByTestId('slot-photo').getByTestId('file').setInputFiles({ name: 'x.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not a picture') });
  await expect(page.getByTestId('photo-error')).toContainText(/not a JPEG, PNG or WebP/i);
  await page.getByTestId('slot-signature').getByTestId('file').setInputFiles(sig());
  await expect(page.getByTestId('signature-info')).toBeVisible();
  await expect(page.getByTestId('signature-error')).toHaveCount(0);
});

test('AC-3: merging and resizing sends no request that carries the pictures', async ({ page }) => {
  const seen: { method: string; url: string; post: boolean }[] = [];
  page.on('request', (r) => seen.push({ method: r.method(), url: r.url(), post: !!r.postData() }));
  await addBoth(page);
  await page.getByTestId('make').click();
  await expect(page.getByTestId('resize-area').getByTestId('file-card')).toBeVisible({ timeout: 15_000 });
  const origin = new URL(page.url()).origin;
  expect(seen.filter((r) => r.method !== 'GET' || r.post)).toEqual([]);
  expect(seen.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('blob:') && !r.url.startsWith('data:'))).toEqual([]);
});
