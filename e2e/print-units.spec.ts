import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';
import { downloaded, makePng, openTool, pick, resize, watchNetwork } from './ui/helpers';

// FEATURE-013. A 35:45 source so that a 35 x 45 mm size at 300 DPI can be matched exactly.
const portrait = () => ({ name: 'p.png', mimeType: 'image/png', buffer: makePng(700, 900, (x, y) => [(x * 7) % 256, (y * 5) % 256, (x * y) % 256, 255]) });

async function openAdvanced(page: Page) {
  await page.getByTestId('advanced').locator('summary').click();
  await expect(page.getByTestId('unit')).toBeVisible();
}

test('AC-1: 35 x 45 mm at 300 DPI gives about 413 x 531 px, shown before and after', async ({ page }) => {
  await openTool(page);
  await openAdvanced(page);
  await page.getByTestId('unit').selectOption('mm');
  await expect(page.getByTestId('dpi')).toHaveValue('300');
  await page.getByTestId('width').fill('35');
  await page.getByTestId('height').fill('45');
  await expect(page.getByTestId('px-preview')).toContainText('413');
  await expect(page.getByTestId('px-preview')).toContainText('531');
  await pick(page, portrait());
  await resize(page);
  const d = await downloaded(page);
  expect(Math.abs(d.w - 413)).toBeLessThanOrEqual(1);
  expect(Math.abs(d.h - 531)).toBeLessThanOrEqual(1);
});

test('AC-2: a DPI of 200 is written into the downloaded JPEG', async ({ page }) => {
  await openTool(page);
  await openAdvanced(page);
  await page.getByTestId('dpi').fill('200');
  await pick(page, portrait());
  await resize(page);
  const d = await downloaded(page);
  expect((await sharp(d.buf).metadata()).density).toBe(200);
  await expect(page.getByTestId('result')).toContainText('DPI set to 200');
});

test('a DPI is written into a PNG too', async ({ page }) => {
  await openTool(page);
  await page.getByTestId('format-png').check();
  await openAdvanced(page);
  await page.getByTestId('dpi').fill('150');
  await pick(page, portrait());
  await resize(page);
  const d = await downloaded(page);
  expect((await sharp(d.buf).metadata()).density).toBe(150);
});

test('AC-4: with px and no DPI the tool behaves as before (no DPI note)', async ({ page }) => {
  await openTool(page);
  await pick(page, portrait());
  await resize(page);
  await expect(page.getByTestId('result')).not.toContainText('DPI set to');
  await expect(page.getByTestId('dpi')).toHaveValue(''); // px is the default and no DPI is typed
});

test('a print unit with an empty DPI shows a field error, not a crash', async ({ page }) => {
  await openTool(page);
  await openAdvanced(page);
  await page.getByTestId('unit').selectOption('cm');
  await page.getByTestId('dpi').fill('');
  await page.getByTestId('width').fill('3.5');
  await expect(page.getByText(/Enter the DPI/)).toBeVisible();
});

test('AC-3: no request leaves the page or carries the file while using print units', async ({ page, baseURL }) => {
  const net = watchNetwork(page, baseURL!);
  await openTool(page);
  await openAdvanced(page);
  await page.getByTestId('unit').selectOption('cm');
  await page.getByTestId('width').fill('4');
  await pick(page, portrait());
  await resize(page);
  expect(net.external).toEqual([]);
  expect(net.nonGet).toEqual([]);
});

test('switching back to px takes back a DPI the tool filled in, but keeps one the user typed', async ({ page }) => {
  await openTool(page);
  await openAdvanced(page);
  await page.getByTestId('unit').selectOption('mm');
  await expect(page.getByTestId('dpi')).toHaveValue('300');
  await page.getByTestId('unit').selectOption('px');
  await expect(page.getByTestId('dpi')).toHaveValue('');
  await page.getByTestId('dpi').fill('200');
  await page.getByTestId('unit').selectOption('cm');
  await page.getByTestId('unit').selectOption('px');
  await expect(page.getByTestId('dpi')).toHaveValue('200');
});

test('length fields use a decimal keypad in print units and the fit choice appears for two lengths with a suffix', async ({ page }) => {
  await openTool(page);
  await openAdvanced(page);
  await expect(page.getByTestId('width')).toHaveAttribute('inputmode', 'numeric');
  await page.getByTestId('unit').selectOption('cm');
  await expect(page.getByTestId('width')).toHaveAttribute('inputmode', 'decimal');
  await page.getByTestId('width').fill('3.5 cm');
  await page.getByTestId('height').fill('4.5cm');
  await expect(page.getByTestId('fit')).toBeVisible();
  await expect(page.getByTestId('width')).toHaveAttribute('aria-describedby', /pxp/);
});
