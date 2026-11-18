import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { NOISE, file, makePng } from './ui/helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/blur-pixelate-censor/');
  await expect(page.getByTestId('tool').first()).toBeVisible();
  // Server-rendered, so visible before the island hydrates; clicks and typing before then are lost.
  await page.waitForFunction(() => { const i = document.querySelector('astro-island'); return !!i && !i.hasAttribute('ssr'); });
});

async function open(page: Page) {
  await page.getByTestId('file').setInputFiles(NOISE); // 800 x 600 random pixels: every pixel differs, so any leak of the original shows
  await expect(page.getByTestId('redact-canvas')).toBeVisible();
  await expect.poll(() => size(page)).toEqual({ w: 800, h: 600 });
}
const size = (page: Page) => page.getByTestId('redact-canvas').evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height }));
/** A checksum of a rectangle of the picture, computed in the page. */
const sum = (page: Page, x0: number, y0: number, x1: number, y1: number) => page.getByTestId('redact-canvas').evaluate((c: HTMLCanvasElement, r) => {
  const d = c.getContext('2d')!.getImageData(r[0], r[1], r[2] - r[0], r[3] - r[1]).data;
  let t = 0;
  for (let i = 0; i < d.length; i++) t = (t * 31 + d[i]) >>> 0;
  return t;
}, [x0, y0, x1, y1]);
/** The distinct colours in a rectangle of the picture. */
const colours = (page: Page, x0: number, y0: number, x1: number, y1: number) => page.getByTestId('redact-canvas').evaluate((c: HTMLCanvasElement, r) => {
  const d = c.getContext('2d')!.getImageData(r[0], r[1], r[2] - r[0], r[3] - r[1]).data;
  const s = new Set<string>();
  for (let i = 0; i < d.length; i += 4) s.add(`${d[i]},${d[i + 1]},${d[i + 2]},${d[i + 3]}`);
  return [...s];
}, [x0, y0, x1, y1]);
/** How much neighbouring pixels differ in a rectangle: low means smooth. */
const roughness = (page: Page, x0: number, y0: number, x1: number, y1: number) => page.getByTestId('redact-canvas').evaluate((c: HTMLCanvasElement, r) => {
  const w = r[2] - r[0], d = c.getContext('2d')!.getImageData(r[0], r[1], w, r[3] - r[1]).data;
  let s = 0;
  for (let i = 0; i < d.length - 4; i += 4) if (((i / 4) % w) !== w - 1) s += Math.abs(d[i] - d[i + 4]);
  return s;
}, [x0, y0, x1, y1]);

/** The overlay's position once the page has stopped scrolling or reflowing (two identical readings in a row). */
async function steadyBox(page: Page) {
  const o = page.getByTestId('redact-overlay');
  await o.scrollIntoViewIfNeeded(); // the canvas can sit below a short window, where the mouse sends nothing
  let prev = JSON.stringify(await o.boundingBox());
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(50);
    const cur = JSON.stringify(await o.boundingBox());
    if (cur === prev) break;
    prev = cur;
  }
  return (await o.boundingBox())!;
}

/** Drags a rectangle over the overlay, given as fractions of the picture. */
async function dragRect(page: Page, fx0: number, fy0: number, fx1: number, fy1: number) {
  const b = await steadyBox(page);
  await page.mouse.move(b.x + b.width * fx0, b.y + b.height * fy0);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * ((fx0 + fx1) / 2), b.y + b.height * ((fy0 + fy1) / 2), { steps: 4 });
  await page.mouse.move(b.x + b.width * fx1, b.y + b.height * fy1, { steps: 4 });
  await page.mouse.up();
}
async function dragLine(page: Page, fx0: number, fy: number, fx1: number) {
  const b = await steadyBox(page);
  await page.mouse.move(b.x + b.width * fx0, b.y + b.height * fy);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(b.x + b.width * (fx0 + ((fx1 - fx0) * i) / 12), b.y + b.height * fy);
  await page.mouse.up();
}

test('the warning that this is not guaranteed redaction is always shown with the tool', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('redaction-warning')).toContainText(/not guaranteed secure redaction/i);
  await expect(page.getByTestId('count')).toContainText('No areas hidden yet');
});

test('AC-1: pixelate flattens the area into blocks and leaves the rest of the picture untouched', async ({ page }) => {
  await open(page);
  const outsideBefore = [await sum(page, 0, 0, 800, 140), await sum(page, 0, 310, 800, 600), await sum(page, 0, 140, 190, 310), await sum(page, 410, 140, 800, 310)];
  const insideBefore = await sum(page, 205, 155, 395, 295);
  await dragRect(page, 0.25, 0.25, 0.5, 0.5); // about x 200..400, y 150..300
  await expect(page.getByTestId('count')).toContainText('1 area hidden');
  await expect.poll(async () => (await sum(page, 205, 155, 395, 295)) !== insideBefore).toBe(true);
  // squares sit on a fixed 27 px grid over the whole picture (x 189..216, y 162..189 is one of them, inside the area): one flat colour
  expect((await colours(page, 203, 163, 215, 175)).length, 'a 27 px square is one flat colour').toBe(1);
  expect([await sum(page, 0, 0, 800, 140), await sum(page, 0, 310, 800, 600), await sum(page, 0, 140, 190, 310), await sum(page, 410, 140, 800, 310)], 'everything outside the area is unchanged').toEqual(outsideBefore);
});

test('AC-2: black out leaves the area one solid colour, with no detail of the picture inside it', async ({ page }) => {
  await open(page);
  await page.getByTestId('effect-blackout').click();
  const outsideBefore = [await sum(page, 0, 0, 800, 140), await sum(page, 0, 310, 800, 600)];
  await dragRect(page, 0.25, 0.25, 0.5, 0.5);
  await expect(page.getByTestId('count')).toContainText('1 area hidden');
  await expect.poll(async () => (await colours(page, 204, 154, 396, 296)).join('|')).toBe('0,0,0,255'); // every pixel of the area, one colour
  expect([await sum(page, 0, 0, 800, 140), await sum(page, 0, 310, 800, 600)]).toEqual(outsideBefore);
});

test('AC-2: the saved PNG has the same solid area, and the saved JPG too', async ({ page }) => {
  await open(page);
  await page.getByTestId('effect-blackout').click();
  await dragRect(page, 0.25, 0.25, 0.5, 0.5);
  await expect.poll(async () => (await colours(page, 204, 154, 396, 296)).join('|')).toBe('0,0,0,255');
  for (const [id, mime, name] of [['save-png', 'image/png', 'noise-redacted.png'], ['save-jpg', 'image/jpeg', 'noise-redacted.jpg']] as const) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId(id).click()]);
    expect(dl.suggestedFilename()).toBe(name);
    const bytes = fs.readFileSync((await dl.path())!);
    const other = await page.context().newPage();
    const result = await other.evaluate(async ({ b64, type }) => {
      const u = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const img = document.createElement('img');
      img.src = URL.createObjectURL(new Blob([u], { type }));
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const ctx = cv.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(216, 166, 168, 118).data; // well inside the area: JPEG ringing from the noisy pixels next to the edge stays out
      let maxv = 0;
      for (let i = 0; i < d.length; i += 4) maxv = Math.max(maxv, d[i], d[i + 1], d[i + 2]);
      return { w: cv.width, h: cv.height, maxv };
    }, { b64: bytes.toString('base64'), type: mime });
    await other.close();
    expect(result.w).toBe(800);
    expect(result.maxv, `${name}: the area is black (JPEG may add at most a couple of levels at the edges, never the picture)`).toBeLessThanOrEqual(mime === 'image/png' ? 0 : 12); // the noise around the area is 0..255; a leak of it into the area would show as values in the hundreds
  }
});

test('the brush paints along a path; black out covers every pixel of the stroke and nothing far from it', async ({ page }) => {
  await open(page);
  await page.getByTestId('tool-brush').click();
  await page.getByTestId('effect-blackout').click();
  const farBefore = await sum(page, 0, 0, 800, 300);
  await dragLine(page, 0.2, 0.7, 0.8); // y = 420, x 160..640
  await expect(page.getByTestId('count')).toContainText('1 area hidden');
  await expect.poll(async () => (await colours(page, 200, 418, 600, 423)).join('|')).toBe('0,0,0,255'); // a strip along the line, one colour
  expect(await sum(page, 0, 0, 800, 300), 'far from the stroke: unchanged').toBe(farBefore);
});

test('blur smooths the area; white fill is a solid white', async ({ page }) => {
  await open(page);
  const rough = await roughness(page, 210, 160, 390, 290);
  await page.getByTestId('effect-blur').click();
  await dragRect(page, 0.25, 0.25, 0.5, 0.5);
  await expect.poll(async () => await roughness(page, 210, 160, 390, 290)).toBeLessThan(rough / 3);
  await page.getByTestId('effect-blackout').click();
  await page.getByTestId('fill').selectOption('white');
  await dragRect(page, 0.6, 0.6, 0.8, 0.8);
  await expect.poll(async () => (await colours(page, 490, 370, 630, 470)).join('|')).toBe('255,255,255,255');
});

test('Undo removes only the last area, and Clear returns the original picture', async ({ page }) => {
  await open(page);
  const original = await sum(page, 0, 0, 800, 600);
  await page.getByTestId('effect-blackout').click();
  await dragRect(page, 0.1, 0.1, 0.3, 0.3);
  await expect(page.getByTestId('count')).toContainText('1 area hidden');
  await expect.poll(async () => (await sum(page, 0, 0, 800, 600)) !== original).toBe(true); // the canvas is repainted just after the count changes
  const afterOne = await sum(page, 0, 0, 800, 600);
  await dragRect(page, 0.6, 0.6, 0.9, 0.9);
  await expect(page.getByTestId('count')).toContainText('2 areas hidden');
  await expect.poll(async () => (await sum(page, 0, 0, 800, 600)) !== afterOne).toBe(true);
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('count')).toContainText('1 area hidden');
  await expect.poll(() => sum(page, 0, 0, 800, 600)).toBe(afterOne);
  await page.getByTestId('clear').click();
  await expect.poll(() => sum(page, 0, 0, 800, 600)).toBe(original);
  await expect(page.getByTestId('undo')).toBeDisabled();
});

test('a click or a tiny drag with the rectangle does nothing', async ({ page }) => {
  await open(page);
  await dragRect(page, 0.5, 0.5, 0.5 + 0.001, 0.5 + 0.001);
  await expect(page.getByTestId('count')).toContainText('No areas hidden yet');
});

test('Resize to KB loads the picture into the resizer with the size limit', async ({ page }) => {
  await open(page);
  await page.getByTestId('effect-blackout').click();
  await dragRect(page, 0.25, 0.25, 0.5, 0.5);
  await page.getByTestId('kb').fill('100');
  await page.getByTestId('to-resizer').click();
  const resizer = page.getByTestId('resize-area').getByTestId('tool');
  await expect(resizer.getByTestId('result')).toBeVisible({ timeout: 60_000 });
  const s = resizer.getByTestId('result-size');
  if ((await s.getAttribute('data-status')) === 'ok') expect(Number(await s.getAttribute('data-bytes'))).toBeLessThanOrEqual(100_000);
  else await expect(resizer.getByTestId('result-gap')).toContainText(/Over by/);
});

test('a size limit that is not a number is explained', async ({ page }) => {
  await open(page);
  await page.getByTestId('kb').fill('');
  await page.getByTestId('to-resizer').click();
  await expect(page.getByTestId('size-error')).toContainText(/whole number of KB/i);
  await expect(page.getByTestId('resize-area')).toHaveCount(0);
});

test('a file that is not an image is explained', async ({ page }) => {
  await page.getByTestId('file').setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('not a picture') });
  await expect(page.getByTestId('error')).toContainText(/not a JPEG, PNG or WebP/i);
  await expect(page.getByTestId('redact-canvas')).toHaveCount(0);
});

test('AC-3: hiding, saving and resizing send no request that carries the picture', async ({ page }) => {
  const seen: { method: string; url: string; post: boolean }[] = [];
  page.on('request', (r) => seen.push({ method: r.method(), url: r.url(), post: !!r.postData() }));
  await open(page);
  await dragRect(page, 0.25, 0.25, 0.5, 0.5);
  await page.getByTestId('to-resizer').click();
  await expect(page.getByTestId('resize-area').getByTestId('file-card')).toBeVisible({ timeout: 15_000 });
  const origin = new URL(page.url()).origin;
  expect(seen.filter((r) => r.method !== 'GET' || r.post)).toEqual([]);
  expect(seen.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('blob:') && !r.url.startsWith('data:'))).toEqual([]);
});

test('review finding: pixelating with the brush leaves no pixel of the original inside the stroke', async ({ page }) => {
  // a black and white checkerboard: every pixel is 0 or 255, while any block average is about 128, so a kept pixel is easy to spot
  await page.getByTestId('file').setInputFiles(file('checker.png', makePng(400, 300, (x, y) => ((x + y) % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255]))));
  await expect(page.getByTestId('redact-canvas')).toBeVisible();
  await expect.poll(() => size(page)).toEqual({ w: 400, h: 300 });
  await page.getByTestId('tool-brush').click(); // pixelate is the default effect
  await dragLine(page, 0.2, 0.5, 0.8); // y = 150, x 80..320, a brush about 6 px in radius
  await expect(page.getByTestId('count')).toContainText('1 area hidden');
  const kept = () => page.getByTestId('redact-canvas').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(86, 145, 228, 10).data; // the middle of the stroke
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] === 0 || d[i] === 255) n++;
    return n;
  });
  await expect.poll(async () => { const c = await page.getByTestId('redact-canvas').evaluate((cv: HTMLCanvasElement) => cv.getContext('2d')!.getImageData(150, 148, 1, 1).data[0]); return c !== 0 && c !== 255; }).toBe(true);
  expect(await kept(), 'no pixel along the stroke kept its black or white value').toBe(0);
});
