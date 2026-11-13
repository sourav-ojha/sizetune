import { test, expect, type Page } from '@playwright/test';
import { downloaded, exifRotatedJpeg, file, flatPng, isJpeg, isPng, isRed, openTool, pick, pixelsAt, redBlockPng, resize, signaturePng } from './helpers';

const URL = '/resize-signature/';
const sig = () => file('sig.png', signaturePng());
const crop = async (page: Page) => (await expect(page.getByTestId('crop-width')).not.toHaveValue(''), {
  x: Number(await page.getByTestId('crop-x').inputValue()),
  y: Number(await page.getByTestId('crop-y').inputValue()),
  w: Number(await page.getByTestId('crop-width').inputValue()),
  h: Number(await page.getByTestId('crop-height').inputValue()),
});

test.describe('signature tool', () => {
  test('shows signature guidance, crop tools and a distinct UI', async ({ page }) => {
    await openTool(page, URL);
    await expect(page.getByTestId('signature-guidance')).toContainText('white paper');
    await expect(page.getByTestId('signature-guidance')).toContainText('Crop tight');
    await pick(page, sig());
    await expect(page.getByTestId('crop-box')).toBeVisible();
    expect(await crop(page)).toEqual({ x: 0, y: 0, w: 600, h: 200 });
    await expect(page.getByTestId('format-jpeg')).toBeChecked();
    await expect(page.getByTestId('format-webp')).toHaveCount(0);
    await expect(page.getByTestId('width')).toHaveValue('');
  });

  test('numeric crop inputs drive the output size', async ({ page }) => {
    await openTool(page, URL);
    await pick(page, sig());
    await page.getByTestId('crop-width').fill('300');
    await page.getByTestId('crop-height').fill('100');
    await page.getByTestId('crop-x').fill('150');
    await page.getByTestId('crop-y').fill('50');
    expect(await crop(page)).toEqual({ x: 150, y: 50, w: 300, h: 100 });
    await page.getByTestId('crop-width').fill('9999'); // clamped to what fits
    expect((await crop(page)).w).toBe(450);
    await page.getByTestId('crop-width').fill('300');
    await page.getByTestId('preset-20').click();
    await resize(page);
    const d = await downloaded(page, 'download');
    expect(isJpeg(d.buf)).toBe(true);
    expect(d.w).toBe(300);
    expect(d.h).toBe(100);
    await expect(page.getByTestId('signature-preview')).toBeVisible();
    await expect(page.getByTestId('signature-preview')).toHaveClass(/bg-white/);
  });

  test('crop shape preset reshapes the box and the output', async ({ page }) => {
    await openTool(page, URL);
    await pick(page, sig());
    await page.getByTestId('crop-shape').selectOption('4'); // the fixture is already 3:1, so 3 would not change the menu
    const c = await crop(page);
    expect(Math.abs(c.w / c.h - 4)).toBeLessThan(0.05);
    await expect(page.getByTestId('lock-crop')).toBeChecked();
    await page.getByTestId('preset-20').click();
    await resize(page);
    const d = await downloaded(page, 'download');
    expect(Math.abs(d.w / d.h - 4)).toBeLessThan(0.1);
  });

  test('zoom enlarges the picture inside a scrollable frame; crop still maps to source pixels', async ({ page }) => {
    await openTool(page, URL);
    await pick(page, sig());
    const img = page.getByTestId('crop-image');
    const before = (await img.boundingBox())!.width;
    await page.getByTestId('crop-zoom').fill('3');
    await expect.poll(async () => (await img.boundingBox())!.width).toBeGreaterThan(before * 1.5);
    // a small box in the middle, so a drag actually moves it
    await page.getByTestId('crop-width').fill('200');
    await page.getByTestId('crop-height').fill('100');
    await page.getByTestId('crop-x').fill('50');
    await page.getByTestId('crop-y').fill('50');
    const box = page.getByTestId('crop-box');
    await box.scrollIntoViewIfNeeded();
    const b = (await box.boundingBox())!;
    const shown = (await img.boundingBox())!.width; // zoomed display width of the 600 px source
    const startX = (await crop(page)).x;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 30, b.y + b.height / 2, { steps: 4 });
    await page.mouse.up();
    const moved = (await crop(page)).x - startX;
    expect(Math.abs(moved - (30 * 600) / shown)).toBeLessThanOrEqual(2); // 30 CSS px at this zoom = 30*600/shown source px
  });

  test('changing the margin after a manual edit keeps the manual crop', async ({ page }) => {
    await openTool(page, URL);
    await pick(page, sig());
    await page.getByTestId('auto-trim').click();
    await expect(page.getByTestId('trim-status')).toContainText('Cropped');
    await page.getByTestId('crop-width').fill('210');
    const edited = await crop(page);
    await page.getByTestId('crop-margin').selectOption('0.1');
    expect(await crop(page)).toEqual(edited);
  });

  test('crop shape menu follows the real crop and Free releases the lock', async ({ page }) => {
    await openTool(page, URL);
    await pick(page, sig());
    await page.getByTestId('crop-shape').selectOption('2');
    await expect(page.getByTestId('crop-shape')).toHaveValue('2');
    await expect(page.getByTestId('lock-crop')).toBeChecked();
    await page.getByTestId('crop-width').fill('100'); // lock keeps 2:1, still 2:1
    await expect(page.getByTestId('crop-shape')).toHaveValue('2');
    await page.getByTestId('crop-shape').selectOption('free');
    await expect(page.getByTestId('lock-crop')).not.toBeChecked();
  });

  test('auto-trim margin setting changes the margin around the ink', async ({ page }) => {
    await openTool(page, URL);
    await pick(page, sig());
    await page.getByTestId('crop-margin').selectOption('0');
    await page.getByTestId('auto-trim').click();
    await expect(page.getByTestId('trim-status')).toContainText('tight');
    const tight = await crop(page);
    await page.getByTestId('crop-margin').selectOption('0.1');
    await expect(page.getByTestId('trim-status')).toContainText('margin');
    const wide = await crop(page);
    expect(wide.w).toBeGreaterThan(tight.w);
    expect(wide.h).toBeGreaterThan(tight.h);
  });

  test('keyboard: arrows move, Shift moves faster, Alt+arrows resize', async ({ page }) => {
    await openTool(page, URL);
    await pick(page, sig());
    await page.getByTestId('crop-width').fill('200');
    await page.getByTestId('crop-height').fill('100');
    await page.getByTestId('crop-box').focus();
    await page.keyboard.press('ArrowRight');
    expect((await crop(page)).x).toBe(1);
    await page.keyboard.press('Shift+ArrowRight');
    expect((await crop(page)).x).toBe(11);
    await page.keyboard.press('ArrowDown');
    expect((await crop(page)).y).toBe(1);
    await page.keyboard.press('Alt+ArrowRight');
    expect((await crop(page)).w).toBe(201);
    await page.keyboard.press('Alt+Shift+ArrowLeft');
    expect((await crop(page)).w).toBe(191);
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
    expect((await crop(page)).x).toBe(8);
  });

  test('pointer: dragging the box and a handle changes the crop in source pixels', async ({ page }) => {
    await openTool(page, URL);
    await pick(page, sig());
    await page.getByTestId('crop-width').fill('300');
    await page.getByTestId('crop-height').fill('100');
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); // let any layout/scroll compensation settle before measuring
    await page.getByTestId('crop-box').scrollIntoViewIfNeeded(); // mouse coordinates are viewport-relative: the crop box must be on screen
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const img = (await page.getByTestId('crop-image').boundingBox())!;
    const scale = 600 / img.width; // source px per CSS px
    const box = (await page.getByTestId('crop-box').boundingBox())!;
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 40, cy + 10, { steps: 5 });
    await page.mouse.up();
    const moved = await crop(page);
    expect(Math.abs(moved.x - 40 * scale)).toBeLessThanOrEqual(2);
    expect(Math.abs(moved.y - 10 * scale)).toBeLessThanOrEqual(2);
    expect(moved.w).toBe(300);
    const h = (await page.locator('[data-handle=se]').boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2 - 30, h.y + h.height / 2 - 10, { steps: 5 });
    await page.mouse.up();
    const after = await crop(page);
    expect(after.x).toBe(moved.x);
    expect(after.y).toBe(moved.y);
    expect(Math.abs(after.w - (300 - 30 * scale))).toBeLessThanOrEqual(2);
    expect(Math.abs(after.h - (100 - 10 * scale))).toBeLessThanOrEqual(2);
  });

  test('auto-trim crops to the ink with a margin', async ({ page }) => {
    await openTool(page, URL);
    await pick(page, sig()); // ink in x 200..399, y 60..139
    await page.getByTestId('auto-trim').click();
    await expect(page.getByTestId('trim-status')).toContainText('Cropped');
    const c = await crop(page);
    expect(c.x).toBeLessThanOrEqual(200);
    expect(c.x).toBeGreaterThan(150);
    expect(c.x + c.w).toBeGreaterThanOrEqual(400);
    expect(c.x + c.w).toBeLessThan(450);
    expect(c.y).toBeLessThanOrEqual(60);
    expect(c.y + c.h).toBeGreaterThanOrEqual(140);
    await page.getByTestId('crop-reset').click();
    expect(await crop(page)).toEqual({ x: 0, y: 0, w: 600, h: 200 });
  });

  test('output width with aspect lock derives the height from the crop', async ({ page }) => {
    await openTool(page, URL);
    await pick(page, sig());
    await page.getByTestId('crop-width').fill('400');
    await page.getByTestId('crop-height').fill('100');
    await page.getByTestId('width').fill('200');
    await expect(page.getByTestId('height')).toHaveAttribute('placeholder', '50');
    await page.getByTestId('preset-20').click();
    await resize(page);
    const d = await downloaded(page, 'download');
    expect(d.w).toBe(200);
    expect(d.h).toBe(50);
  });

  test('impossible minimum explains itself and does not pad', async ({ page }) => {
    await openTool(page, URL);
    await pick(page, { name: 'small.png', mimeType: 'image/png', buffer: flatPng(140, 60) });
    await page.getByTestId('advanced').locator('summary').click();
    await page.getByTestId('min-size').fill('50');
    await page.getByTestId('preset-100').click();
    await resize(page);
    await expect(page.getByTestId('result')).toHaveAttribute('data-status', 'below_min');
    await expect(page.getByTestId('result-hint')).toContainText('small, simple signature');
    await expect(page.getByTestId('download')).toHaveCount(0);
    await expect(page.getByTestId('download-anyway')).toBeVisible();
    expect(Number(await page.getByTestId('result-size').getAttribute('data-bytes'))).toBeLessThan(50 * 1024);
  });

  test('transparent signature defaults to PNG; JPEG asks for a fill colour', async ({ page }) => {
    await openTool(page, URL);
    await pick(page, file('t.png', signaturePng(true)));
    await expect(page.getByTestId('format-png')).toBeChecked();
    await expect(page.getByTestId('alpha-note')).toBeVisible();
    await page.getByTestId('preset-100').click();
    await resize(page);
    const d = await downloaded(page, (await page.getByTestId('download').count()) ? 'download' : 'download-anyway');
    expect(isPng(d.buf)).toBe(true);
    await page.getByTestId('format-jpeg').check();
    await expect(page.getByTestId('flatten-choice')).toBeVisible();
    await resize(page);
    await expect(page.getByTestId('result-notes')).toContainText(/transparen/i);
  });

  test('reset clears crop and result', async ({ page }) => {
    await openTool(page, URL);
    await pick(page, sig());
    await resize(page);
    await page.getByTestId('reset').click();
    await expect(page.getByTestId('crop-box')).toHaveCount(0);
    await expect(page.getByTestId('result')).toHaveCount(0);
    await pick(page, sig());
    // Run becomes enabled as soon as the file is chosen; the full-picture crop is applied once the preview has loaded (effect after image onLoad).
    await expect(page.getByTestId('crop-width')).toHaveValue('600');
    expect(await crop(page)).toEqual({ x: 0, y: 0, w: 600, h: 200 });
  });

  const typeInTabOrder = async (page: Page) => {
    await page.getByTestId('crop-x').click();
    for (const [v, last] of [['290', false], ['90', false], ['220', false], ['70', true]] as const) {
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.type(v);
      if (!last) await page.keyboard.press('Tab');
    }
    await page.keyboard.press('Tab'); // commit the last field
  };

  test('M1: typing Left, Top, Width, Height in tab order gives the exact region (1200x400 PNG)', async ({ page }) => {
    await openTool(page, URL);
    await pick(page, file('wide.png', redBlockPng(1200, 400, 290, 90, 220, 70)));
    await expect(page.getByTestId('crop-width')).toHaveValue('1200'); // the crop is initialised in an effect right after the file is accepted
    expect(await crop(page)).toEqual({ x: 0, y: 0, w: 1200, h: 400 });
    await typeInTabOrder(page);
    expect(await crop(page)).toEqual({ x: 290, y: 90, w: 220, h: 70 });
    await page.getByTestId('preset-20').click();
    await resize(page);
    const d = await downloaded(page, 'download');
    expect([d.w, d.h]).toEqual([220, 70]);
    const px = await pixelsAt(page, d.buf, [[6, 6], [213, 6], [6, 63], [213, 63], [110, 35]]);
    expect(px.every(isRed), JSON.stringify(px)).toBe(true);
  });

  test('M1: same with an EXIF-orientation-6 JPEG (crop is in oriented source pixels)', async ({ page }) => {
    await openTool(page, URL);
    await pick(page, file('rotated.jpg', await exifRotatedJpeg(page), 'image/jpeg'));
    await expect(page.getByTestId('crop-width')).toHaveValue('1200'); // displayed size, orientation applied
    await expect(page.getByTestId('crop-height')).toHaveValue('400');
    await typeInTabOrder(page);
    expect(await crop(page)).toEqual({ x: 290, y: 90, w: 220, h: 70 });
    await page.getByTestId('preset-20').click();
    await resize(page);
    const d = await downloaded(page, 'download');
    expect([d.w, d.h]).toEqual([220, 70]);
    const px = await pixelsAt(page, d.buf, [[8, 8], [211, 8], [8, 61], [211, 61], [110, 35]]);
    expect(px.every(isRed), JSON.stringify(px)).toBe(true);
  });

  test('crop fields accept units and show the value that was applied', async ({ page }) => {
    await openTool(page, URL);
    await pick(page, sig());
    await page.getByTestId('crop-x').fill('100 px');
    await page.getByTestId('crop-x').blur(); // on blur the field shows the applied number
    expect((await crop(page)).x).toBe(100);
    await page.getByTestId('crop-height').fill('9,999');
    await expect(page.getByTestId('crop-height')).toHaveValue('200');
  });
});
