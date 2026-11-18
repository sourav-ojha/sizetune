import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { file, makePng } from './ui/helpers';

const RED = [220, 30, 30], BLUE = [30, 30, 220], GREEN = [20, 200, 20];
// 400 x 300: left half red, right half blue. The logo is a solid green 100 x 50 block.
const photo = () => file('photo.png', makePng(400, 300, (x) => (x < 200 ? [...RED, 255] as [number, number, number, number] : [...BLUE, 255] as [number, number, number, number])));
const logo = () => file('logo.png', makePng(100, 50, () => [...GREEN, 255] as [number, number, number, number]));

test.beforeEach(async ({ page }) => {
  await page.goto('/photo-effects/');
  await expect(page.getByTestId('tool').first()).toBeVisible();
  // Server-rendered, so visible before the island hydrates; clicks and typing before then are lost.
  await page.waitForFunction(() => { const i = document.querySelector('astro-island'); return !!i && !i.hasAttribute('ssr'); });
});

async function open(page: Page, withLogo = false) {
  await page.getByTestId('slot-photo').getByTestId('file').setInputFiles(photo());
  await expect(page.getByTestId('edit-preview')).toBeVisible();
  await expect.poll(() => size(page)).toEqual({ w: 400, h: 300 });
  if (withLogo) {
    await page.getByTestId('slot-logo').getByTestId('file').setInputFiles(logo());
    await expect.poll(() => logoBox(page)).not.toBeNull();
  }
}
const size = (page: Page) => page.getByTestId('edit-preview').evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height }));
const px = (page: Page, x: number, y: number) => page.getByTestId('edit-preview').evaluate((c: HTMLCanvasElement, [a, b]) => Array.from(c.getContext('2d')!.getImageData(a, b, 1, 1).data).slice(0, 3), [x, y] as [number, number]);
const near = (got: number[], want: number[], tol = 12) => want.every((v, i) => Math.abs(got[i] - v) <= tol);
const logoBox = async (page: Page) => { const v = await page.getByTestId('edit-preview').getAttribute('data-logo-box'); return v && v !== 'none' ? JSON.parse(v) as { x: number; y: number; w: number; h: number } : null; };
/** Distinct colours in a block of pixels, in the page. */
const colours = (page: Page, x0: number, y0: number, x1: number, y1: number) => page.getByTestId('edit-preview').evaluate((c: HTMLCanvasElement, r) => {
  const d = c.getContext('2d')!.getImageData(r[0], r[1], r[2] - r[0], r[3] - r[1]).data;
  const s = new Set<string>();
  for (let i = 0; i < d.length; i += 4) s.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
  return [...s];
}, [x0, y0, x1, y1]);

test('AC-1: a border grows the picture by its width on every side, in the chosen colour', async ({ page }) => {
  await open(page);
  await page.getByTestId('border').fill('20');
  await expect.poll(() => size(page)).toEqual({ w: 440, h: 340 });
  await page.getByTestId('border-color').selectOption('#111827');
  await expect.poll(async () => near(await px(page, 5, 5), [17, 24, 39], 2)).toBe(true);
  expect(near(await px(page, 434, 334), [17, 24, 39], 2), 'all four sides').toBe(true);
  expect(near(await px(page, 19, 100), [17, 24, 39], 2), 'border ends at 20 px').toBe(true);
  expect(near(await px(page, 20, 100), RED), 'the photo starts at 20 px').toBe(true);
  expect(near(await px(page, 419, 100), BLUE), 'and ends at 420').toBe(true);
  expect(near(await px(page, 420, 100), [17, 24, 39], 2)).toBe(true);
  await page.getByTestId('border').fill('0');
  await expect.poll(() => size(page)).toEqual({ w: 400, h: 300 });
});

test('a border width outside the range is limited, not trusted', async ({ page }) => {
  await open(page);
  await page.getByTestId('border').fill('99999');
  await expect.poll(() => size(page)).toEqual({ w: 1400, h: 1300 }); // 500 px on each side
  await page.getByTestId('border').fill('-30');
  await expect.poll(() => size(page)).toEqual({ w: 400, h: 300 });
});

test('AC-2: grayscale makes every pixel grey, and keeps red lighter than blue', async ({ page }) => {
  await open(page);
  await page.getByTestId('effect-gray').click();
  await expect.poll(async () => { const p = await px(page, 50, 50); return p[0] === p[1] && p[1] === p[2]; }).toBe(true);
  for (const [x, y] of [[10, 10], [150, 290], [250, 40], [390, 150]]) { const p = await px(page, x, y); expect(p[0] === p[1] && p[1] === p[2], `${x},${y}`).toBe(true); }
  expect((await px(page, 50, 50))[0], 'red is brighter than blue').toBeGreaterThan((await px(page, 300, 50))[0]);
});

test('AC-2: black and white leaves only pure black and pure white, split at the cut-off', async ({ page }) => {
  await open(page);
  await page.getByTestId('effect-bw').click();
  await page.getByTestId('threshold').fill('70'); // red is brighter than 70, blue is not
  await expect.poll(async () => (await colours(page, 0, 0, 400, 300)).sort().join('|')).toBe('0,0,0|255,255,255');
  expect(near(await px(page, 50, 50), [255, 255, 255], 0), 'red side is white').toBe(true);
  expect(near(await px(page, 300, 50), [0, 0, 0], 0), 'blue side is black').toBe(true);
  await page.getByTestId('threshold').fill('250');
  await expect.poll(async () => (await colours(page, 0, 0, 400, 300)).join('|')).toBe('0,0,0');
  await page.getByTestId('threshold').fill('10');
  await expect.poll(async () => (await colours(page, 0, 0, 400, 300)).join('|')).toBe('255,255,255');
});

test('pixel art makes flat blocks with a small palette', async ({ page }) => {
  await open(page);
  await page.getByTestId('effect-pixel').click();
  await page.getByTestId('chunk').fill('20'); // 20 px squares on a 400 px wide picture
  await page.getByTestId('palette').selectOption('4');
  await expect.poll(async () => (await colours(page, 0, 0, 20, 20)).length).toBe(1); // the first square is one colour
  const all = await colours(page, 0, 0, 400, 300);
  expect(all.length, 'a handful of colours at most').toBeLessThanOrEqual(8);
});

test('effects change the photo only: the border and the logo keep their own colours', async ({ page }) => {
  await open(page, true);
  await page.getByTestId('border').fill('20');
  await page.getByTestId('border-color').selectOption('#b91c1c'); // red border
  await page.getByTestId('effect-gray').click();
  await expect.poll(async () => { const p = await px(page, 70, 100); return p[0] === p[1] && p[1] === p[2]; }).toBe(true); // photo is grey
  expect(near(await px(page, 5, 5), [185, 28, 28], 2), 'the border is still red').toBe(true);
  const b = (await logoBox(page))!;
  expect(near(await px(page, b.x + Math.floor(b.w / 2), b.y + Math.floor(b.h / 2)), GREEN, 6), 'the logo is still green').toBe(true);
});

test('AC-3: the logo appears at the chosen corner and at the chosen size', async ({ page }) => {
  await open(page, true);
  // default: bottom right, 20% of 400 = 80 wide, 40 tall (the logo is 2:1), 6 px from the edges
  let b = (await logoBox(page))!;
  expect(b).toEqual({ x: 314, y: 254, w: 80, h: 40 });
  expect(near(await px(page, 354, 274), GREEN, 6), 'green inside the box').toBe(true);
  expect(near(await px(page, 312, 274), BLUE), 'photo just outside it').toBe(true);
  await page.getByTestId('position').selectOption('tl');
  await expect.poll(() => logoBox(page)).toEqual({ x: 6, y: 6, w: 80, h: 40 });
  expect(near(await px(page, 40, 20), GREEN, 6)).toBe(true);
  await page.getByTestId('position').selectOption('center');
  await expect.poll(() => logoBox(page)).toEqual({ x: 160, y: 130, w: 80, h: 40 });
  await page.getByTestId('logo-size').fill('40');
  await expect.poll(() => logoBox(page)).toEqual({ x: 120, y: 110, w: 160, h: 80 });
  b = (await logoBox(page))!;
  expect(near(await px(page, b.x + 5, b.y + 5), GREEN, 6) && near(await px(page, b.x + b.w - 5, b.y + b.h - 5), GREEN, 6)).toBe(true);
  await page.getByTestId('remove-logo').click();
  await expect.poll(() => logoBox(page)).toBeNull();
  expect(near(await px(page, 200, 150), BLUE) || near(await px(page, 200, 150), RED), 'logo gone, photo shows').toBe(true);
});

test('with a border, the logo is placed on the whole picture including the border', async ({ page }) => {
  await open(page, true);
  await page.getByTestId('border').fill('20');
  await expect.poll(() => size(page)).toEqual({ w: 440, h: 340 });
  // 20% of 440 = 88 wide, 44 tall; margin 2% of the shorter side (340) = 7
  await expect.poll(() => logoBox(page)).toEqual({ x: 440 - 88 - 7, y: 340 - 44 - 7, w: 88, h: 44 });
});

test('the saved PNG and JPG match the preview', async ({ page }) => {
  await open(page, true);
  await page.getByTestId('border').fill('10');
  await page.getByTestId('border-color').selectOption('#111827');
  await expect.poll(() => size(page)).toEqual({ w: 420, h: 320 });
  for (const [id, name, mime] of [['save-png', 'photo-edited.png', 'image/png'], ['save-jpg', 'photo-edited.jpg', 'image/jpeg']] as const) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId(id).click()]);
    expect(dl.suggestedFilename()).toBe(name);
    const bytes = fs.readFileSync((await dl.path())!);
    const other = await page.context().newPage();
    const r = await other.evaluate(async ({ b64, type }) => {
      const u = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const img = document.createElement('img');
      img.src = URL.createObjectURL(new Blob([u], { type }));
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const ctx = cv.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      return { w: cv.width, h: cv.height, corner: Array.from(ctx.getImageData(2, 2, 1, 1).data).slice(0, 3) };
    }, { b64: bytes.toString('base64'), type: mime });
    await other.close();
    expect([r.w, r.h]).toEqual([420, 320]);
    expect(near(r.corner, [17, 24, 39], 6), `${name} border colour`).toBe(true);
  }
});

test('Resize to KB loads the edited photo into the resizer, and a bad limit is explained', async ({ page }) => {
  await open(page, true);
  await page.getByTestId('cap-kb').fill('');
  await page.getByTestId('to-resizer').click();
  await expect(page.getByTestId('size-error')).toContainText(/whole number of KB/i);
  await page.getByTestId('cap-kb').fill('20');
  await page.getByTestId('to-resizer').click();
  const resizer = page.getByTestId('resize-area').getByTestId('tool');
  await expect(resizer.getByTestId('result')).toBeVisible({ timeout: 60_000 });
  const s = resizer.getByTestId('result-size');
  expect(Number(await s.getAttribute('data-bytes'))).toBeLessThanOrEqual(20_000);
  expect(await s.getAttribute('data-status')).toBe('ok');
});

test('a file that is not an image is explained in its own slot', async ({ page }) => {
  await page.getByTestId('slot-logo').getByTestId('file').setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('not a picture') });
  await expect(page.getByTestId('logo-error')).toContainText(/not a JPEG, PNG or WebP/i);
  await page.getByTestId('slot-photo').getByTestId('file').setInputFiles(photo());
  await expect(page.getByTestId('edit-preview')).toBeVisible();
  await expect(page.getByTestId('photo-error')).toHaveCount(0);
});

test('AC-4: editing, saving and resizing send no request that carries the pictures', async ({ page }) => {
  const seen: { method: string; url: string; post: boolean }[] = [];
  page.on('request', (r) => seen.push({ method: r.method(), url: r.url(), post: !!r.postData() }));
  await open(page, true);
  await page.getByTestId('to-resizer').click();
  await expect(page.getByTestId('resize-area').getByTestId('file-card')).toBeVisible({ timeout: 15_000 });
  const origin = new URL(page.url()).origin;
  expect(seen.filter((r) => r.method !== 'GET' || r.post)).toEqual([]);
  expect(seen.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('blob:') && !r.url.startsWith('data:'))).toEqual([]);
});
