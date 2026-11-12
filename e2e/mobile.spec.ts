import { test, expect, devices } from '@playwright/test';
import { NOISE, openTool, pick, resize, signaturePng, file } from './ui/helpers';

test.use({ ...devices['Pixel 7'], channel: 'chrome' });

const overflow = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const url of ['/', '/resize-image-to-20kb/', '/resize-signature/']) {
  test(`mobile ${url}: no horizontal scroll through the whole flow, tool usable`, async ({ page }) => {
    await page.goto(url);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await expect(page.getByTestId('file')).toBeVisible();
    await openTool(page, url);
    await pick(page, url === '/resize-signature/' ? file('s.png', signaturePng()) : NOISE);
    await page.getByTestId('advanced').locator('summary').click();
    expect(await overflow(page), 'with file + advanced open').toBeLessThanOrEqual(0);
    await resize(page);
    expect(await overflow(page), 'with result').toBeLessThanOrEqual(0);
    const box = await page.getByTestId('result').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  });
}

test('mobile: primary controls are at least 44px tall', async ({ page }) => {
  await openTool(page);
  await pick(page, NOISE);
  for (const id of ['preset-10', 'preset-200', 'run', 'target', 'start-over']) {
    const b = (await page.getByTestId(id).boundingBox())!;
    expect(b.height, id).toBeGreaterThanOrEqual(43.5);
  }
});

test('mobile: crop handles can be dragged by touch-sized pointer events', async ({ page }) => {
  await openTool(page, '/resize-signature/');
  await pick(page, file('s.png', signaturePng()));
  const h = (await page.locator('[data-handle=se]').boundingBox())!;
  expect(h.width).toBeGreaterThanOrEqual(31);
  expect(h.height).toBeGreaterThanOrEqual(31);
});
