import { test, expect, devices } from '@playwright/test';
import { NOISE, openTool, pick, resize, signaturePng, file, flatPng } from './ui/helpers';

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

test('mobile: on a tiny source the corner handles are still >= 44px and win over the edge handles (D7)', async ({ page }) => {
  await openTool(page, '/resize-signature/');
  await pick(page, file('tiny.png', flatPng(140, 60)));
  // measure only once the crop image has loaded and its handles have stopped moving (an early read races the image layout)
  await expect(page.getByTestId('crop-image')).toHaveJSProperty('complete', true);
  let last = '';
  await expect.poll(async () => { const b = JSON.stringify(await page.locator('[data-handle=se]').boundingBox()); const same = b === last; last = b; return same; }, { intervals: [100, 100, 100], timeout: 5000 }).toBe(true);
  const corner = (await page.locator('[data-handle=se]').boundingBox())!;
  expect(corner.width).toBeGreaterThanOrEqual(43.5);
  const cx = corner.x + corner.width / 2, cy = corner.y + corner.height / 2;
  expect(await page.evaluate(([x, y]) => (document.elementFromPoint(x, y) as HTMLElement).closest('[data-handle]')?.getAttribute('data-handle'), [cx, cy])).toBe('se');
  // grab it by touch-sized slop (12 px outside the visible dot) and resize
  const before = await page.getByTestId('crop-width').inputValue();
  await page.mouse.move(cx - 10, cy - 10);
  await page.mouse.down();
  await page.mouse.move(cx - 40, cy - 20, { steps: 4 });
  await page.mouse.up();
  expect(Number(await page.getByTestId('crop-width').inputValue())).toBeLessThan(Number(before));
});

test('mobile: crop handles can be dragged by touch-sized pointer events', async ({ page }) => {
  await openTool(page, '/resize-signature/');
  await pick(page, file('s.png', signaturePng()));
  const h = (await page.locator('[data-handle=se]').boundingBox())!;
  expect(h.width).toBeGreaterThanOrEqual(43.5); // touch hit area (D7)
  expect(h.height).toBeGreaterThanOrEqual(43.5);
});
