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

// ---- FEATURE-041: Indian-language names ----
const fontFiles = (urls: string[], re: RegExp) => urls.filter((u) => re.test(u));
const loaded = (page: Page, family: string) => page.evaluate((f) => [...document.fonts].some((x) => x.family.replace(/"/g, '') === f && x.status === 'loaded'), family);
const inkPixels = (page: Page) => page.getByTestId('type-preview').evaluate((c: HTMLCanvasElement) => {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n;
});

test('FEATURE-041 FR-1: the language list offers English, Hindi, Marathi and Tamil in that order', async ({ page }) => {
  await page.getByTestId('mode-type').click();
  await expect(page.getByTestId('sig-lang').locator('option')).toHaveText(['English (Latin letters)', 'Hindi (हिन्दी)', 'Marathi (मराठी)', 'Tamil (தமிழ்)']);
});

test('FEATURE-041 AC-2: no Indian-script font file is requested until its language is chosen', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.reload();
  await page.waitForFunction(() => { const i = document.querySelector('astro-island'); return !!i && !i.hasAttribute('ssr'); });
  await page.getByTestId('mode-type').click();
  await page.getByTestId('sig-text').fill('Ravi Kumar');
  await expect(page.getByTestId('type-preview')).toBeVisible();
  await expect.poll(() => loaded(page, 'Caveat')).toBe(true); // the English font did load, so the wait above means something
  expect(fontFiles(urls, /kalam|kavivanar/i), 'English only: no Indian font files').toEqual([]);
  await page.getByTestId('sig-lang').selectOption('hi');
  await page.getByTestId('sig-text').fill('रवि कुमार');
  await expect.poll(() => loaded(page, 'Kalam')).toBe(true);
  expect(fontFiles(urls, /kalam.*devanagari.*\.woff2?/i).length).toBeGreaterThan(0);
  expect(fontFiles(urls, /kavivanar/i), 'Tamil font still not requested').toEqual([]);
  await page.getByTestId('sig-lang').selectOption('ta');
  await page.getByTestId('sig-text').fill('சுரேஷ் குமார்');
  await expect.poll(() => loaded(page, 'Kavivanar')).toBe(true);
  expect(fontFiles(urls, /kavivanar.*tamil.*\.woff2?/i).length).toBeGreaterThan(0);
});

test('FEATURE-041 AC-1: a Hindi, Marathi and Tamil name is drawn in the script font and saves as a PNG', async ({ page }) => {
  await page.getByTestId('mode-type').click();
  for (const [lang, name, family] of [['hi', 'रवि कुमार', 'Kalam'], ['mr', 'सुनीता पाटील', 'Kalam'], ['ta', 'சுரேஷ் குமார்', 'Kavivanar']] as const) {
    await page.getByTestId('sig-lang').selectOption(lang);
    await page.getByTestId('sig-text').fill(name);
    await expect.poll(() => loaded(page, family)).toBe(true);
    await expect.poll(() => inkPixels(page)).toBeGreaterThan(500);
    await expect(page.getByTestId('sig-foreign')).toHaveCount(0);
    await expect(page.getByTestId(`font-${family.toLowerCase()}`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('sig-text')).toHaveAttribute('lang', lang);
  }
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-png').click()]);
  const buf = fs.readFileSync((await dl.path())!);
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
});

test('FEATURE-041: the script font changes the drawing (it is not the Latin fallback)', async ({ page }) => {
  await page.getByTestId('mode-type').click();
  await page.getByTestId('sig-lang').selectOption('hi');
  await page.getByTestId('sig-text').fill('रवि');
  await expect.poll(() => loaded(page, 'Kalam')).toBe(true);
  await expect.poll(() => inkPixels(page)).toBeGreaterThan(300);
  const withFont = await page.getByTestId('type-preview').evaluate((c: HTMLCanvasElement) => c.toDataURL());
  // the same word drawn with the font stack minus Kalam looks different, so the font really took part
  const without = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 160;
    const x = c.getContext('2d')!; x.font = '90px cursive'; x.fillText('रवि', 10, 110);
    return c.toDataURL();
  });
  expect(withFont).not.toBe(without);
});

test('FEATURE-041 edge: a mixed-script name lists the letters the font cannot draw', async ({ page }) => {
  await page.getByTestId('mode-type').click();
  await page.getByTestId('sig-lang').selectOption('hi');
  await page.getByTestId('sig-text').fill('Ravi रवि');
  await expect(page.getByTestId('sig-foreign')).toContainText('R');
  await page.getByTestId('sig-text').fill('रवि');
  await expect(page.getByTestId('sig-foreign')).toHaveCount(0);
  await page.getByTestId('sig-lang').selectOption('en');
  await page.getByTestId('sig-text').fill('Ravi रवि');
  await expect(page.getByTestId('sig-foreign')).toContainText('र');
});

test('FEATURE-041: switching language picks that language’s font and keeps the English choices for English', async ({ page }) => {
  await page.getByTestId('mode-type').click();
  await expect(page.getByTestId('font-dancing')).toBeVisible();
  await page.getByTestId('sig-lang').selectOption('ta');
  await expect(page.getByTestId('font-dancing')).toHaveCount(0);
  await expect(page.getByTestId('font-kavivanar')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('sig-lang').selectOption('en');
  await expect(page.getByTestId('font-caveat')).toHaveAttribute('aria-pressed', 'true');
});

test('FEATURE-041 AC-3: no request leaves the page and none carries the typed name', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const bad: string[] = [];
  const bodies: string[] = [];
  page.context().on('request', (r) => {
    const u = new URL(r.url());
    if (!['blob:', 'data:'].includes(u.protocol) && u.origin !== origin) bad.push(r.url());
    if (r.method() !== 'GET') bad.push(`${r.method()} ${r.url()}`);
    if (r.postData()) bodies.push(r.postData()!);
    if (/रवि|%E0%A4%B0|சுரே/.test(decodeURIComponent(u.pathname + u.search))) bad.push(`name in URL ${r.url()}`);
  });
  await page.getByTestId('mode-type').click();
  await page.getByTestId('sig-lang').selectOption('hi');
  await page.getByTestId('sig-text').fill('रवि कुमार');
  await expect.poll(() => loaded(page, 'Kalam')).toBe(true);
  expect(bad).toEqual([]);
  expect(bodies).toEqual([]);
});
