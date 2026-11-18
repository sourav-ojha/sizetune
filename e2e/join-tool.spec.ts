import { test, expect, type Page } from '@playwright/test';
import { file, makePng } from './ui/helpers';

const solid = (name: string, w: number, h: number, rgb: [number, number, number]) => file(name, makePng(w, h, () => [...rgb, 255] as [number, number, number, number]));
const RED: [number, number, number] = [220, 30, 30], GREEN: [number, number, number] = [30, 180, 30], BLUE: [number, number, number] = [30, 30, 220];
const three = () => [solid('red.png', 400, 300, RED), solid('green.png', 300, 300, GREEN), solid('blue.png', 200, 400, BLUE)];

test.beforeEach(async ({ page }) => {
  await page.goto('/join-images/');
  await expect(page.getByTestId('tool').first()).toBeVisible();
  // Server-rendered, so visible before the island hydrates; clicks and typing before then are lost.
  await page.waitForFunction(() => { const i = document.querySelector('astro-island'); return !!i && !i.hasAttribute('ssr'); });
});

type Box = { x: number; y: number; w: number; h: number };
const add = async (page: Page, files: ReturnType<typeof three>) => page.getByTestId('file').setInputFiles(files);
const boxes = async (page: Page) => JSON.parse((await page.getByTestId('join-preview').getAttribute('data-boxes'))!) as Box[];
const size = (page: Page) => page.getByTestId('join-preview').evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height }));
const px = (page: Page, x: number, y: number) => page.getByTestId('join-preview').evaluate((c: HTMLCanvasElement, [a, b]) => Array.from(c.getContext('2d')!.getImageData(a, b, 1, 1).data).slice(0, 3), [x, y] as [number, number]);
const centre = (b: Box): [number, number] => [b.x + Math.floor(b.w / 2), b.y + Math.floor(b.h / 2)];
const is = (got: number[], want: number[], tol = 14) => want.every((v, i) => Math.abs(got[i] - v) <= tol);
const order = async (page: Page) => { const out: string[] = []; for (const b of await boxes(page)) { const p = await px(page, ...centre(b)); out.push(is(p, RED) ? 'red' : is(p, GREEN) ? 'green' : is(p, BLUE) ? 'blue' : p.join(',')); } return out; };

test('before two pictures are added there is only a hint, and no preview', async ({ page }) => {
  await expect(page.getByTestId('join-empty')).toBeVisible();
  await add(page, [three()[0]]);
  await expect(page.getByTestId('pic')).toHaveCount(1);
  await expect(page.getByTestId('join-hint')).toBeVisible();
  await expect(page.getByTestId('join-preview')).toHaveCount(0);
});

test('AC-1: three pictures joined in a row appear in the order they were added', async ({ page }) => {
  await add(page, three());
  await expect(page.getByTestId('pic')).toHaveCount(3);
  await expect(page.getByTestId('join-preview')).toBeVisible();
  await expect.poll(async () => (await size(page)).w).toBe(1200);
  const b = await boxes(page);
  expect(b[0].x).toBeLessThan(b[1].x);
  expect(b[1].x).toBeLessThan(b[2].x);
  expect(new Set(b.map((x) => x.h)).size, 'one row at one height').toBe(1);
  await expect.poll(() => order(page)).toEqual(['red', 'green', 'blue']);
});

test('Earlier and Later change the order, Remove takes a picture out', async ({ page }) => {
  await add(page, three());
  await expect.poll(() => order(page)).toEqual(['red', 'green', 'blue']);
  await page.getByTestId('pic').nth(0).getByTestId('move-down').click(); // red later
  await expect.poll(() => order(page)).toEqual(['green', 'red', 'blue']);
  await page.getByTestId('pic').nth(2).getByTestId('move-up').click(); // blue earlier
  await expect.poll(() => order(page)).toEqual(['green', 'blue', 'red']);
  await page.getByTestId('pic').nth(1).getByTestId('remove').click();
  await expect(page.getByTestId('pic')).toHaveCount(2);
  await expect.poll(() => order(page)).toEqual(['green', 'red']);
  await page.getByTestId('pic').nth(0).getByTestId('remove').click();
  await expect(page.getByTestId('join-preview')).toHaveCount(0); // one picture left: nothing to join
});

test('one under another stacks them at the same width, in order', async ({ page }) => {
  await add(page, three());
  await page.getByTestId('mode-column').click();
  await expect.poll(async () => (await boxes(page))[0].w).toBe(1200);
  const b = await boxes(page);
  expect(b[0].y).toBeLessThan(b[1].y);
  expect(b[1].y).toBeLessThan(b[2].y);
  await expect.poll(() => order(page)).toEqual(['red', 'green', 'blue']);
});

test('grid: templates set the columns, each picture sits in an equal cell, empty cells show the background', async ({ page }) => {
  await add(page, three());
  await page.getByTestId('mode-grid').click();
  await page.getByTestId('tpl-2').click();
  await page.getByTestId('bg').selectOption('#111827');
  await expect.poll(async () => (await boxes(page))[2].y).toBeGreaterThan((await boxes(page))[0].y); // third picture is on the second row
  const b = await boxes(page);
  expect(b[2].x, 'second row starts at the left').toBeLessThan(b[1].x);
  await expect.poll(() => order(page)).toEqual(['red', 'green', 'blue']);
  await expect.poll(async () => { const { w, h } = await size(page); return is(await px(page, w - 5, h - 5), [17, 24, 39]); }, { message: 'the empty cell shows the background' }).toBe(true);
  await page.getByTestId('tpl-3').click();
  await expect.poll(async () => { const bb = await boxes(page); return new Set(bb.map((x) => x.y)).size; }).toBeLessThanOrEqual(2); // three columns: all on one row of cells
});

test('the gap slider sets the space between pictures, filled with the background colour', async ({ page }) => {
  await add(page, three());
  await page.getByTestId('gap').fill('10');
  await expect.poll(async () => { const b = await boxes(page); return b[1].x - (b[0].x + b[0].w); }).toBe(120); // 10% of 1200
  const b = await boxes(page);
  const gapX = b[0].x + b[0].w + 60;
  await expect.poll(async () => is(await px(page, gapX, Math.floor(b[0].h / 2)), [255, 255, 255]), { message: 'white gap' }).toBe(true);
  await page.getByTestId('bg').selectOption('#111827');
  await expect.poll(async () => is(await px(page, gapX, Math.floor(b[0].h / 2)), [17, 24, 39])).toBe(true);
});

test('the output width changes the size, and a width that makes it too large is explained', async ({ page }) => {
  await add(page, three());
  await page.getByTestId('out-w').fill('600');
  await expect.poll(async () => (await size(page)).w).toBe(600);
  await page.getByTestId('mode-column').click();
  await page.getByTestId('out-w').fill('4000');
  await expect(page.getByTestId('size-error')).toContainText(/more than this page can handle/i);
  await expect(page.getByTestId('make')).toBeDisabled();
});

test('more than 12 pictures: the extra ones are left out and the page says so', async ({ page }) => {
  await add(page, Array.from({ length: 14 }, (_, i) => solid(`p${i}.png`, 60, 40, RED)));
  await expect(page.getByTestId('pic')).toHaveCount(12);
  await expect(page.getByTestId('messages')).toContainText(/Only 12 pictures/);
});

test('a file that is not an image is named and skipped; the good ones are still added', async ({ page }) => {
  await page.getByTestId('file').setInputFiles([
    { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not a picture') },
    solid('a.png', 100, 80, RED), solid('b.png', 100, 80, BLUE),
  ]);
  await expect(page.getByTestId('pic')).toHaveCount(2);
  await expect(page.getByTestId('messages')).toContainText('broken.png: not a JPEG, PNG or WebP');
});

test('AC-2: the joined picture lands in the resizer with the size limit, and the result is at or under it', async ({ page }) => {
  await add(page, three());
  await page.getByTestId('cap-kb').fill('20');
  await page.getByTestId('make').click();
  const resizer = page.getByTestId('resize-area').getByTestId('tool');
  await expect(resizer.getByTestId('result')).toBeVisible({ timeout: 60_000 });
  const size = resizer.getByTestId('result-size');
  expect(Number(await size.getAttribute('data-bytes'))).toBeLessThanOrEqual(20_000);
  expect(await size.getAttribute('data-status')).toBe('ok');
});

test('a size limit that is not a number is explained', async ({ page }) => {
  await add(page, three());
  await page.getByTestId('cap-kb').fill('');
  await page.getByTestId('make').click();
  await expect(page.getByTestId('size-error')).toContainText(/whole number of KB/i);
  await expect(page.getByTestId('resize-area')).toHaveCount(0);
});

test('AC-3: joining and resizing sends no request that carries the pictures', async ({ page }) => {
  const seen: { method: string; url: string; post: boolean }[] = [];
  page.on('request', (r) => seen.push({ method: r.method(), url: r.url(), post: !!r.postData() }));
  await add(page, three());
  await page.getByTestId('make').click();
  await expect(page.getByTestId('resize-area').getByTestId('file-card')).toBeVisible({ timeout: 15_000 });
  const origin = new URL(page.url()).origin;
  expect(seen.filter((r) => r.method !== 'GET' || r.post)).toEqual([]);
  expect(seen.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('blob:') && !r.url.startsWith('data:'))).toEqual([]);
});
