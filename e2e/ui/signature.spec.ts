import { test, expect, type Page } from '@playwright/test';
import { downloaded, file, flatPng, isJpeg, isPng, openTool, pick, resize, signaturePng } from './helpers';

const URL = '/resize-signature/';
const sig = () => file('sig.png', signaturePng());
const crop = async (page: Page) => ({
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
    expect(await crop(page)).toEqual({ x: 0, y: 0, w: 600, h: 200 });
  });
});
