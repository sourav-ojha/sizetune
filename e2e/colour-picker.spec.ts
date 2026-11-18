import { test, expect, type Page } from '@playwright/test';
import { file, makePng, watchNetwork } from './ui/helpers';

type Px = [number, number, number, number];
const LEFT: Px = [200, 100, 50, 255]; // #C86432
const RIGHT: Px = [10, 200, 150, 255]; // #0AC896
// 400 x 300: left half orange-brown, right half green; the top-left 20 x 20 block is half transparent.
const photo = () => file('colours.png', makePng(400, 300, (x, y) => (x < 20 && y < 20 ? [200, 100, 50, 128] : x < 200 ? LEFT : RIGHT)));

test.beforeEach(async ({ page }) => {
  await page.goto('/colour-picker-from-image/');
  await expect(page.getByTestId('tool').first()).toBeVisible();
  // Server-rendered, so visible before the island hydrates; clicks and typing before then are lost.
  await page.waitForFunction(() => { const i = document.querySelector('astro-island'); return !!i && !i.hasAttribute('ssr'); });
});

async function open(page: Page) {
  await page.getByTestId('file').setInputFiles(photo());
  await expect(page.getByTestId('picker-canvas')).toBeVisible();
  await expect.poll(() => page.getByTestId('picker-canvas').evaluate((c: HTMLCanvasElement) => c.width)).toBe(400);
}
/** Clicks the picture at a fraction of its shown size, so the test holds whatever size the layout gives it. */
async function clickAt(page: Page, fx: number, fy: number) {
  const canvas = page.getByTestId('picker-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}
const val = (page: Page, k: 'hex' | 'rgb' | 'hsl') => page.getByTestId(`value-${k}`).inputValue();

test('AC-1: clicking a pixel shows that pixel as HEX, RGB and HSL', async ({ page }) => {
  await open(page);
  await clickAt(page, 0.75, 0.5);
  await expect(page.getByTestId('value-hex')).toHaveValue('#0AC896');
  expect(await val(page, 'rgb')).toBe('rgb(10, 200, 150)');
  expect(await val(page, 'hsl')).toMatch(/^hsl\(16\d, \d+%, \d+%\)$/);
  await clickAt(page, 0.25, 0.5);
  await expect(page.getByTestId('value-hex')).toHaveValue('#C86432');
  expect(await val(page, 'rgb')).toBe('rgb(200, 100, 50)');
  expect(await val(page, 'hsl')).toMatch(/^hsl\(20, \d+%, \d+%\)$/);
});

test('the pixel is exact at the boundary, on a wide and on a narrow screen (scaled canvas)', async ({ page }) => {
  await open(page);
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(async () => (await page.getByTestId('picker-canvas').boundingBox())!.width).toBeLessThanOrEqual(width);
    await clickAt(page, 0.49, 0.5); // pixel 196: left half
    await expect(page.getByTestId('value-hex')).toHaveValue('#C86432');
    await clickAt(page, 0.51, 0.5); // pixel 204: right half
    await expect(page.getByTestId('value-hex')).toHaveValue('#0AC896');
  }
});

test('a half-transparent pixel shows its alpha', async ({ page }) => {
  await open(page);
  await clickAt(page, 0.02, 0.03); // pixel 8, 9: inside the 20 x 20 block
  await expect(page.getByTestId('value-hex')).toHaveValue(/^#[0-9A-F]{6}80$/);
  expect(await val(page, 'rgb')).toMatch(/^rgba\(\d+, \d+, \d+, 0\.5\)$/);
  expect(await val(page, 'hsl')).toMatch(/^hsla\(/);
  await expect(page.getByTestId('position')).toContainText('opaque');
});

test('keyboard: arrow keys move a pixel at a time, Shift ten, and the colour follows', async ({ page }) => {
  await open(page);
  await page.getByTestId('picker-canvas').focus();
  await page.keyboard.press('Enter'); // starts at the centre: 200, 150
  await expect(page.getByTestId('picker-canvas')).toHaveAttribute('data-at', '200,150');
  await expect(page.getByTestId('value-hex')).toHaveValue('#0AC896');
  await page.keyboard.press('ArrowLeft'); // 199: left half
  await expect(page.getByTestId('picker-canvas')).toHaveAttribute('data-at', '199,150');
  await expect(page.getByTestId('value-hex')).toHaveValue('#C86432');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(page.getByTestId('picker-canvas')).toHaveAttribute('data-at', '199,160');
});

test('FR-3: recent colours keep the newest first, without repeats, and can be shown again', async ({ page }) => {
  await open(page);
  await clickAt(page, 0.25, 0.5);
  await clickAt(page, 0.75, 0.5);
  await clickAt(page, 0.25, 0.8); // the same colour again
  const items = page.getByTestId('recent-item');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toHaveAttribute('data-hex', '#C86432');
  await expect(items.nth(1)).toHaveAttribute('data-hex', '#0AC896');
  await items.nth(1).click();
  await expect(page.getByTestId('value-hex')).toHaveValue('#0AC896');
});

test('AC-2: Copy puts the value on the clipboard', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    (window as unknown as { copied: string[] }).copied = [];
    document.addEventListener('copy', () => { (window as unknown as { copied: string[] }).copied.push(String(document.getSelection())); });
  });
  await clickAt(page, 0.75, 0.5);
  await page.getByTestId('copy-hex').click();
  await expect(page.getByTestId('status')).toContainText('HEX copied');
  await page.getByTestId('copy-rgb').click();
  await expect(page.getByTestId('status')).toContainText('RGB copied');
  expect(await page.evaluate(() => (window as unknown as { copied: string[] }).copied)).toEqual(['#0AC896', 'rgb(10, 200, 150)']);
});

test('a blocked clipboard selects the text and tells the person to copy by hand', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { document.execCommand = () => false; });
  await clickAt(page, 0.75, 0.5);
  await page.getByTestId('copy-hex').click();
  await expect(page.getByTestId('copy-manual')).toBeVisible();
  const selected = await page.getByTestId('value-hex').evaluate((el: HTMLInputElement) => el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0));
  expect(selected).toBe('#0AC896');
});

test('AC-3: no request leaves the page and nothing is posted while picking', async ({ page, baseURL }) => {
  const net = watchNetwork(page, baseURL!);
  await open(page);
  await clickAt(page, 0.3, 0.3);
  await clickAt(page, 0.8, 0.8);
  await page.getByTestId('copy-hex').click();
  expect(net.external).toEqual([]);
  expect(net.nonGet).toEqual([]);
});

test('a file that is not a picture is refused with a plain message', async ({ page }) => {
  await page.getByTestId('file').setInputFiles({ name: 'notes.png', mimeType: 'image/png', buffer: Buffer.from('this is not an image at all') });
  await expect(page.getByTestId('error')).toContainText('not a JPEG, PNG or WebP');
  await expect(page.getByTestId('picker-canvas')).toHaveCount(0);
});

test('choosing a new picture clears the old reading', async ({ page }) => {
  await open(page);
  await clickAt(page, 0.75, 0.5);
  await expect(page.getByTestId('value-hex')).toHaveValue('#0AC896');
  await page.getByTestId('file').setInputFiles(file('other.png', makePng(400, 300, () => [1, 2, 3, 255])));
  await expect(page.getByTestId('hint')).toBeVisible();
  await expect(page.getByTestId('value-hex')).toHaveCount(0);
  await clickAt(page, 0.5, 0.5);
  await expect(page.getByTestId('value-hex')).toHaveValue('#010203');
});
