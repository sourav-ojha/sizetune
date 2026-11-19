import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { file, makePng } from './ui/helpers';

// 400 x 300: the left half is red, the right half blue, so cropping, padding and any stretching can be read from single pixels.
const RED = [220, 30, 30], BLUE = [30, 30, 220];
const twoTone = () => file('two-tone.png', makePng(400, 300, (x) => (x < 200 ? [...RED, 255] as [number, number, number, number] : [...BLUE, 255] as [number, number, number, number])));

test.beforeEach(async ({ page }) => {
  await page.goto('/crop-shapes/');
  await expect(page.getByTestId('tool').first()).toBeVisible();
  // Server-rendered, so visible before the island hydrates; clicks and typing before then are lost.
  await page.waitForFunction(() => { const i = document.querySelector('astro-island'); return !!i && !i.hasAttribute('ssr'); });
});

async function open(page: Page) {
  await page.getByTestId('file').setInputFiles(twoTone());
  await expect(page.getByTestId('draw-canvas')).toBeVisible();
}
const size = (page: Page) => page.getByTestId('result-canvas').evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height }));
const px = (page: Page, x: number, y: number) => page.getByTestId('result-canvas').evaluate((c: HTMLCanvasElement, [a, b]) => Array.from(c.getContext('2d')!.getImageData(a, b, 1, 1).data), [x, y] as [number, number]);
const hasResult = (page: Page) => page.getByTestId('result-canvas').getAttribute('data-has-result');
const near = (a: number[], rgb: number[], tol = 12) => rgb.every((v, i) => Math.abs(a[i] - v) <= tol);

/** Draws a closed diamond (a rhombus) on the drawing canvas with the mouse, centred at (cx, cy) as fractions of the canvas. */
async function drawDiamond(page: Page, cx = 0.25, cy = 0.5, r = 0.2) {
  const cv = page.getByTestId('draw-canvas');
  await cv.scrollIntoViewIfNeeded();
  const b = (await cv.boundingBox())!;
  const P = (fx: number, fy: number) => [b.x + b.width * fx, b.y + b.height * fy] as const;
  const pts = [P(cx, cy - r * 1.3), P(cx + r, cy), P(cx, cy + r * 1.3), P(cx - r, cy), P(cx, cy - r * 1.3)];
  await page.mouse.move(...pts[0]);
  await page.mouse.down();
  for (let s = 0; s < pts.length - 1; s++) for (let i = 1; i <= 8; i++) await page.mouse.move(pts[s][0] + ((pts[s + 1][0] - pts[s][0]) * i) / 8, pts[s][1] + ((pts[s + 1][1] - pts[s][1]) * i) / 8);
  await page.mouse.up();
}

async function decode(page: Page, bytes: Buffer, mime: string) {
  const other = await page.context().newPage();
  try {
    return await other.evaluate(async ({ b64, type }) => {
      const u = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const img = document.createElement('img');
      img.src = URL.createObjectURL(new Blob([u], { type }));
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const ctx = cv.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const at = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data);
      return { w: cv.width, h: cv.height, corner: at(2, 2), centre: at(Math.floor(cv.width / 2), Math.floor(cv.height / 2)) };
    }, { b64: bytes.toString('base64'), type: mime });
  } finally { await other.close(); }
}
async function save(page: Page, id: string) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId(id).click()]);
  return { name: dl.suggestedFilename(), bytes: fs.readFileSync((await dl.path())!) };
}

test('AC-1: a drawn path cuts the picture out, with everything outside it transparent', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('save-png')).toBeDisabled(); // nothing drawn yet
  await drawDiamond(page);
  await expect.poll(() => hasResult(page)).toBe('true');
  const { w, h } = await size(page);
  expect(w, 'cropped to the shape, narrower than the picture').toBeLessThan(250);
  expect(h).toBeLessThan(300);
  expect((await px(page, 1, 1))[3], 'corner outside the path is transparent').toBe(0);
  expect((await px(page, w - 2, h - 2))[3]).toBe(0);
  const centre = await px(page, Math.floor(w / 2), Math.floor(h / 2));
  expect(centre[3], 'inside the path is opaque').toBe(255);
  expect(near(centre, RED), 'and shows the picture').toBe(true);
});

test('AC-1: the saved PNG has the same transparent corners, and the JPG fills them with white', async ({ page }) => {
  await open(page);
  await drawDiamond(page);
  await expect.poll(() => hasResult(page)).toBe('true');
  const png = await save(page, 'save-png');
  expect(png.name).toBe('two-tone-cutout.png');
  const p = await decode(page, png.bytes, 'image/png');
  expect(p.corner[3]).toBe(0);
  expect(p.centre[3]).toBe(255);
  const jpg = await save(page, 'save-jpg');
  expect([...jpg.bytes.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  const j = await decode(page, jpg.bytes, 'image/jpeg');
  expect(Math.min(j.corner[0], j.corner[1], j.corner[2])).toBeGreaterThan(245);
});

test('a scribble that is too small is explained, and Start again clears the line', async ({ page }) => {
  await open(page);
  await page.getByTestId('draw-canvas').scrollIntoViewIfNeeded(); // the canvas can sit below a short window, where the mouse sends nothing
  const b = (await page.getByTestId('draw-canvas').boundingBox())!;
  await page.mouse.move(b.x + 40, b.y + 40); await page.mouse.down(); await page.mouse.move(b.x + 42, b.y + 41); await page.mouse.up();
  await expect(page.getByTestId('result-note')).toContainText(/larger shape/i);
  await drawDiamond(page);
  await expect.poll(() => hasResult(page)).toBe('true');
  await page.getByTestId('clear-path').click();
  await expect.poll(() => hasResult(page)).toBe('false');
  await expect(page.getByTestId('save-png')).toBeDisabled();
});

test('AC-2: a corner radius rounds the corners; none leaves them square; the maximum makes a circle', async ({ page }) => {
  await open(page);
  await page.getByTestId('mode-shape').click();
  await expect.poll(async () => (await size(page)).w).toBe(300); // centred square of a 400 x 300 picture
  expect((await size(page)).h).toBe(300);
  expect((await px(page, 1, 1))[3], 'radius 15%: corner is cut away').toBe(0);
  expect((await px(page, 150, 150))[3]).toBe(255);
  await page.getByTestId('radius').fill('0');
  await expect.poll(async () => (await px(page, 1, 1))[3]).toBe(255);
  await page.getByTestId('radius').fill('50');
  await expect.poll(async () => (await px(page, 1, 1))[3]).toBe(0);
  expect((await px(page, 150, 2))[3], 'a circle still touches the middle of each side').toBe(255);
  expect((await px(page, 40, 40))[3], 'but not the diagonal near the corner').toBe(0);
  await page.getByTestId('square').uncheck();
  await expect.poll(async () => (await size(page)).w).toBe(400);
});

test('AC-3: adding a border keeps the picture at its own size and shape, with nothing stretched', async ({ page }) => {
  await open(page);
  await page.getByTestId('mode-ratio').click();
  await page.getByTestId('method-pad').click();
  await expect.poll(async () => (await size(page)).h).toBe(400); // 400 x 300 padded to 1:1
  expect((await size(page)).w).toBe(400);
  expect((await px(page, 10, 10))[3], 'transparent border above').toBe(0);
  expect((await px(page, 10, 49))[3]).toBe(0);
  expect(near(await px(page, 10, 50), RED), 'the picture starts exactly 50 px down').toBe(true);
  expect(near(await px(page, 199, 200), RED) && near(await px(page, 200, 200), BLUE), 'the red/blue edge is still at x = 200: not scaled sideways').toBe(true);
  expect(near(await px(page, 10, 349), RED), 'the picture ends exactly at 350').toBe(true);
  expect((await px(page, 10, 350))[3]).toBe(0);
  await page.getByTestId('pad-color').selectOption('#ffffff');
  await expect.poll(async () => (await px(page, 10, 10)).join()).toBe('255,255,255,255');
});

test('AC-3: a wider ratio by padding adds space at the sides instead', async ({ page }) => {
  await open(page);
  await page.getByTestId('mode-ratio').click();
  await page.getByTestId('method-pad').click();
  await page.getByTestId('ratio-preset').selectOption('16:9');
  await expect.poll(async () => (await size(page)).w).toBe(533); // 300 tall, 16:9 wide
  expect((await size(page)).h).toBe(300);
  expect((await px(page, 5, 150))[3]).toBe(0);
  expect(near(await px(page, 67, 150), RED), 'picture starts 67 px in').toBe(true);
});

test('cropping to a ratio cuts a window, and the sliders move it across the picture', async ({ page }) => {
  await open(page);
  await page.getByTestId('mode-ratio').click(); // default 1:1, crop
  await expect.poll(async () => (await size(page)).w).toBe(300);
  // the 300 px window slides over the 400 px picture; where the red/blue edge (source x = 200) lands shows where the window is
  const edgeAt = async (x: number) => near(await px(page, x - 1, 150), RED) && near(await px(page, x, 150), BLUE);
  await expect.poll(() => edgeAt(150), 'centred: window starts at 50, edge at 150').toBe(true);
  await page.getByTestId('focus-x').fill('0');
  await expect.poll(() => edgeAt(200), 'left: window starts at 0, edge at 200').toBe(true);
  await page.getByTestId('focus-x').fill('100');
  await expect.poll(() => edgeAt(100), 'right: window starts at 100, edge at 100').toBe(true);
  await page.getByTestId('ratio-preset').selectOption('16:9');
  await expect.poll(async () => (await size(page)).h).toBe(225); // 400 wide, 16:9
});

test('a custom ratio works, and one that is not a ratio is explained with nothing to save', async ({ page }) => {
  await open(page);
  await page.getByTestId('mode-ratio').click();
  await page.getByTestId('ratio-preset').selectOption('custom');
  await page.getByTestId('ratio-custom').fill('2:1');
  await expect.poll(async () => (await size(page)).h).toBe(200); // 400 wide, 2:1
  await page.getByTestId('ratio-custom').fill('banana');
  await expect(page.getByTestId('result-note')).toContainText(/two numbers/i);
  await expect(page.getByTestId('save-png')).toBeDisabled();
});

test('a file that is not an image is explained', async ({ page }) => {
  await page.getByTestId('file').setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('not a picture') });
  await expect(page.getByTestId('error')).toContainText(/not a JPEG, PNG or WebP/i);
  await expect(page.getByTestId('draw-canvas')).toHaveCount(0);
});

test('AC-4: cropping and saving send no request that carries the picture', async ({ page }) => {
  const seen: { method: string; url: string; post: boolean }[] = [];
  page.on('request', (r) => seen.push({ method: r.method(), url: r.url(), post: !!r.postData() }));
  await open(page);
  await drawDiamond(page);
  await expect.poll(() => hasResult(page)).toBe('true');
  await save(page, 'save-png');
  const origin = new URL(page.url()).origin;
  expect(seen.filter((r) => r.method !== 'GET' || r.post)).toEqual([]);
  expect(seen.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('blob:') && !r.url.startsWith('data:'))).toEqual([]);
});
