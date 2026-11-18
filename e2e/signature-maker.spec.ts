import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

type Img = { width: number; height: number; b64: string };

test.beforeEach(async ({ page }) => {
  await page.goto('/signature-maker/');
  await expect(page.getByTestId('tool').first()).toBeVisible();
  // Server-rendered, so visible before the island hydrates; clicks and input before then are lost.
  await page.waitForFunction(() => { const i = document.querySelector('astro-island'); return !!i && !i.hasAttribute('ssr'); });
});

/** Strokes a wavy line across the drawing area with the mouse. */
async function sign(page: Page, y = 0.5, from = 0.1, to = 0.9) {
  await page.getByTestId('draw-canvas').scrollIntoViewIfNeeded(); // the canvas can extend below a short window, where the mouse sends nothing
  const box = (await page.getByTestId('draw-canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width * from, box.y + box.height * y);
  await page.mouse.down();
  for (let i = 0; i <= 20; i++) await page.mouse.move(box.x + box.width * (from + ((to - from) * i) / 20), box.y + box.height * (y + 0.2 * Math.sin(i / 2)));
  await page.mouse.up();
}

/** Loads a downloaded file in a blank page (outside the site's CSP) and returns its pixels as base64 RGBA. */
async function pixels(page: Page, bytes: Buffer, mime: string): Promise<Img> {
  const other = await page.context().newPage();
  try {
    return await other.evaluate(async ({ b64, type }) => {
      const u = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const img = document.createElement('img');
      img.src = URL.createObjectURL(new Blob([u], { type }));
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const c = cv.getContext('2d')!;
      c.drawImage(img, 0, 0);
      const d = c.getImageData(0, 0, cv.width, cv.height).data;
      let out = '';
      for (let i = 0; i < d.length; i += 0x8000) out += String.fromCharCode(...d.subarray(i, i + 0x8000));
      return { width: cv.width, height: cv.height, b64: btoa(out) };
    }, { b64: bytes.toString('base64'), type: mime });
  } finally { await other.close(); }
}
const rgba = (i: Img) => Buffer.from(i.b64, 'base64');
const at = (i: Img, x: number, y: number) => { const d = rgba(i), o = (y * i.width + x) * 4; return [d[o], d[o + 1], d[o + 2], d[o + 3]]; };
const stats = (i: Img) => {
  const d = rgba(i); let ink = 0, transparent = 0;
  for (let o = 0; o < d.length; o += 4) { if (d[o + 3] === 0) transparent++; else if (d[o + 3] > 200 && d[o] < 120 && d[o + 1] < 120) ink++; }
  return { ink, transparent, total: d.length / 4 };
};
async function save(page: Page, id: string) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId(id).click()]);
  return { name: dl.suggestedFilename(), bytes: fs.readFileSync((await dl.path())!) };
}

test('nothing can be saved or resized before something is drawn or typed', async ({ page }) => {
  for (const id of ['save-png', 'save-jpg', 'to-resizer', 'undo', 'clear']) await expect(page.getByTestId(id)).toBeDisabled();
});

test('AC-1: a drawn stroke exports as a PNG with a transparent background and visible ink', async ({ page }) => {
  await sign(page);
  await expect(page.getByTestId('save-png')).toBeEnabled();
  const f = await save(page, 'save-png');
  expect(f.name).toBe('signature.png');
  expect([...f.bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  const img = await pixels(page, f.bytes, 'image/png');
  expect(at(img, 0, 0)[3], 'corner is see-through').toBe(0);
  const s = stats(img);
  expect(s.ink, 'the stroke is visible').toBeGreaterThan(200);
  expect(s.transparent / s.total, 'most of the picture is transparent').toBeGreaterThan(0.5);
  expect(img.width, 'cropped to the ink, not the whole drawing area').toBeLessThan(1800);
});

test('undo removes only the last stroke and clear removes all', async ({ page }) => {
  await sign(page, 0.3);
  await sign(page, 0.7);
  const one = stats(await pixels(page, (await save(page, 'save-png')).bytes, 'image/png'));
  await page.getByTestId('undo').click();
  const two = stats(await pixels(page, (await save(page, 'save-png')).bytes, 'image/png'));
  expect(two.ink, 'one stroke has less ink than two').toBeLessThan(one.ink);
  expect(two.ink).toBeGreaterThan(100);
  await page.getByTestId('clear').click();
  await expect(page.getByTestId('save-png')).toBeDisabled();
  await expect(page.getByTestId('undo')).toBeDisabled();
});

test('AC-2: a typed name exports as a JPG with the text on white, in each font', async ({ page }) => {
  await page.getByTestId('mode-type').click();
  await page.getByTestId('sig-text').fill('Asha Rao');
  const seen: string[] = [];
  for (const font of ['caveat', 'dancing', 'apple']) {
    await page.getByTestId(`font-${font}`).click();
    await expect(page.getByTestId(`font-${font}`)).toHaveAttribute('aria-pressed', 'true');
    const f = await save(page, 'save-jpg');
    expect(f.name).toBe('signature.jpg');
    expect([...f.bytes.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    const img = await pixels(page, f.bytes, 'image/jpeg');
    const [r, g, b] = at(img, 2, 2);
    expect(Math.min(r, g, b), `${font}: background is white`).toBeGreaterThan(245);
    expect(stats(img).ink, `${font}: text is visible`).toBeGreaterThan(300);
    seen.push(`${img.width}x${img.height}`);
  }
  expect(new Set(seen).size, 'the three fonts really render differently').toBeGreaterThan(1);
});

test('typed text with a blue ink is blue', async ({ page }) => {
  await page.getByTestId('mode-type').click();
  await page.getByTestId('sig-text').fill('Blue Ink');
  await page.getByTestId('ink-blue').click();
  const img = await pixels(page, (await save(page, 'save-png')).bytes, 'image/png');
  const d = rgba(img);
  let blue = 0, red = 0;
  for (let o = 0; o < d.length; o += 4) if (d[o + 3] > 200) { if (d[o + 2] > d[o] + 60) blue++; else red++; }
  expect(blue).toBeGreaterThan(200);
  expect(blue).toBeGreaterThan(red * 3);
});

test('AC-3: Resize to KB opens the resizer on this page with the signature already loaded', async ({ page }) => {
  await sign(page);
  await page.getByTestId('to-resizer').click();
  const area = page.getByTestId('resize-area');
  await expect(area).toBeVisible();
  const resizer = area.getByTestId('tool');
  await expect(resizer.getByTestId('crop-box')).toBeVisible(); // the picture was loaded without picking a file
  await resizer.getByTestId('preset-20').click();
  await resizer.getByTestId('run').click();
  await expect(resizer.getByTestId('result')).toBeVisible();
  await expect(resizer.getByTestId('result-size')).toHaveAttribute('data-bytes', /^\d+$/);
  const bytes = Number(await resizer.getByTestId('result-size').getAttribute('data-bytes'));
  expect(bytes).toBeLessThanOrEqual(20_000);
});

test('AC-4: making, saving and resizing a signature sends no request that carries the image', async ({ page }) => {
  const seen: { method: string; url: string; post: boolean }[] = [];
  page.on('request', (r) => seen.push({ method: r.method(), url: r.url(), post: !!r.postData() }));
  await sign(page);
  await save(page, 'save-png');
  await page.getByTestId('to-resizer').click();
  await expect(page.getByTestId('resize-area').getByTestId('crop-box')).toBeVisible();
  const origin = new URL(page.url()).origin;
  expect(seen.filter((r) => r.method !== 'GET' || r.post)).toEqual([]);
  expect(seen.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('blob:') && !r.url.startsWith('data:'))).toEqual([]);
});
