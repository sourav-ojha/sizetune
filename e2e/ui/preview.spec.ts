import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { NOISE, bombPng, browserRssMb, bytesOf, file, openTool, pick, resize, smallJpeg, writeBigPng } from './helpers';

test.describe('previews never undo the engine’s memory-safe decode (F1)', () => {
  test('a 9000x9000 RGBA PNG (81 MP) is accepted from its header: no decode on the main thread, bounded memory', async ({ page }) => {
    test.setTimeout(120_000);
    const big = await writeBigPng(9000, 9000);
    try {
      await openTool(page);
      await page.evaluate(() => { (window as any).__urls = 0; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b: any) => { (window as any).__urls++; return o(b); }; });
      const before = await browserRssMb(page);
      await page.getByTestId('file').setInputFiles(big);
      await expect(page.getByTestId('file-info')).toContainText('9,000 × 9,000 px', { timeout: 30_000 });
      await expect(page.getByTestId('run')).toBeEnabled();
      await expect(page.getByTestId('no-preview')).toBeVisible(); // beyond the preview decode limit: no preview at all
      await page.waitForTimeout(1500);
      const delta = (await browserRssMb(page)) - before;
      console.log(`81 MP pick: RSS delta ${Math.round(delta)} MB`);
      expect(delta, 'RSS growth while picking an 81 MP PNG').toBeLessThan(150);
      // the only object URL is the (never decoded) original
      expect(await page.evaluate(() => (window as any).__urls)).toBe(1);
      // and it can still be resized by the engine
      await page.getByTestId('preset-100').click();
      await resize(page);
      expect(await bytesOf(page)).toBeLessThanOrEqual(100_000);
    } finally { fs.rmSync(big, { force: true }); }
  });

  test('a 6000x6000 PNG (36 MP) gets a reduced thumbnail (<= 1024 px), not a full-size preview', async ({ page }) => {
    test.setTimeout(120_000);
    const big = await writeBigPng(6000, 6000);
    try {
      await openTool(page);
      const before = await browserRssMb(page);
      await page.getByTestId('file').setInputFiles(big);
      await expect(page.getByTestId('preview')).toBeVisible({ timeout: 30_000 });
      const nat = await page.getByTestId('preview').evaluate((i: HTMLImageElement) => [i.naturalWidth, i.naturalHeight]);
      expect(Math.max(...nat)).toBeLessThanOrEqual(1024);
      expect(nat[0] / nat[1]).toBeCloseTo(1, 1);
      await expect(page.getByTestId('file-info')).toContainText('6,000 × 6,000 px');
      await page.waitForTimeout(1500);
      const delta = (await browserRssMb(page)) - before;
      console.log(`36 MP pick: RSS delta ${Math.round(delta)} MB`);
      expect(delta, 'RSS growth while previewing a 36 MP PNG').toBeLessThan(300);
    } finally { fs.rmSync(big, { force: true }); }
  });

  test('a 400 MP-header PNG is rejected at pick with a friendly message, before any object URL or decode', async ({ page }) => {
    await page.addInitScript(() => { (window as any).__urls = 0; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b: any) => { (window as any).__urls++; return o(b); }; });
    await openTool(page);
    const before = await page.evaluate(() => (window as any).__urls);
    await page.getByTestId('file').setInputFiles(file('bomb.png', bombPng(20000, 20000)));
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('too many pixels');
    await expect(alert).toContainText('20,000 × 20,000 px');
    await expect(alert).toContainText('400 megapixels');
    await expect(page.getByTestId('preview')).toHaveCount(0);
    await expect(page.getByTestId('run')).toBeDisabled();
    expect(await page.evaluate(() => (window as any).__urls)).toBe(before);
  });

  test('EXIF-rotated JPEG: the thumbnail is upright and the shown size is the oriented size', async ({ page }) => {
    await openTool(page, '/resize-signature/');
    const wide = await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 400; c.height = 1200; c.getContext('2d')!.fillRect(0, 0, 400, 1200);
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
      let s = ''; for (const v of new Uint8Array(await blob.arrayBuffer())) s += String.fromCharCode(v);
      return btoa(s);
    });
    const jpeg = Buffer.from(wide, 'base64');
    const tiff = Buffer.from([0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0]);
    const body = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
    const seg = Buffer.concat([Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255]), body]);
    await page.getByTestId('file').setInputFiles(file('rot2.jpg', Buffer.concat([jpeg.subarray(0, 2), seg, jpeg.subarray(2)]), 'image/jpeg'));
    await expect(page.getByTestId('crop-width')).toHaveValue('1200');
    await expect(page.getByTestId('crop-height')).toHaveValue('400');
    const nat = await page.getByTestId('crop-image').evaluate((i: HTMLImageElement) => [i.naturalWidth, i.naturalHeight]);
    expect(nat[0]).toBeGreaterThan(nat[1]); // displayed landscape (3:1), as the header says
    expect(nat[0] / nat[1]).toBeCloseTo(3, 1);
  });
});

test.describe('F3: keeping the original', () => {
  test('result larger than a GPS-tagged original: keep-original is SECONDARY and the location warning is explicit', async ({ page }) => {
    await openTool(page);
    const orig = await smallJpeg(page, { gps: true });
    await pick(page, file('gps.jpg', orig, 'image/jpeg'));
    await page.getByTestId('preset-200').click();
    await page.getByTestId('format-jpeg').check();
    await resize(page);
    await expect(page.getByTestId('result-heading')).toContainText('larger than your original');
    const keep = page.getByTestId('keep-original');
    await expect(keep).toBeVisible();
    await expect(keep).not.toHaveClass(/bg-indigo-800/);
    await expect(page.getByTestId('download')).not.toHaveClass(/bg-indigo-800/);
    await expect(page.getByTestId('larger-note')).toContainText('Your original contains location data; the SizeTune result does not.');
    // D1: no doubled parenthesis
    const note = (await page.getByTestId('larger-note').textContent()) ?? '';
    expect(note).not.toContain('))');
    expect(note).toMatch(/Your original \([\d.,]+ (KB|bytes), [\d,]+ bytes\)/);
  });

  test('without GPS the generic caution is shown, not the location claim', async ({ page }) => {
    await openTool(page);
    await pick(page, file('plain.jpg', await smallJpeg(page, { orientation: 1 }), 'image/jpeg'));
    await page.getByTestId('preset-200').click();
    await page.getByTestId('format-jpeg').check();
    await resize(page);
    await expect(page.getByTestId('result-heading')).toContainText('larger than your original');
    await expect(page.getByTestId('larger-note')).not.toContainText('Your original contains location data');
    await expect(page.getByTestId('larger-note')).toContainText('can still contain camera details');
    await expect(page.getByTestId('keep-original')).not.toHaveClass(/bg-indigo-800/);
  });
});

test.describe('layout, scroll and cold-start robustness (D1, D5-D8)', () => {
  test('D5: Reset brings the tool back into view even when the page has nothing to anchor to (no scroll anchoring)', async ({ page }) => {
    await openTool(page);
    await page.evaluate(() => document.documentElement.style.setProperty('overflow-anchor', 'none')); // Safari has no scroll anchoring
    await pick(page, NOISE);
    await resize(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); // far below the tool
    await page.evaluate(() => (document.querySelector('[data-testid=reset]') as HTMLButtonElement).click());
    await expect(page.getByTestId('result')).toHaveCount(0);
    await expect.poll(async () => page.getByTestId('dropzone').evaluate((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; })).toBe(true);
  });

  test('D5: a state change inside the tool does not move the tool on screen', async ({ page }) => {
    await openTool(page);
    await page.evaluate(() => document.documentElement.style.setProperty('overflow-anchor', 'none'));
    await pick(page, NOISE);
    await page.getByTestId('tool').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + 300));
    const top = () => page.getByTestId('tool').evaluate((el) => Math.round(el.getBoundingClientRect().top));
    const t0 = await top();
    await page.getByTestId('preset-10').click();
    await page.getByTestId('run').click();
    await expect(page.getByTestId('result')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('preset-20').click(); // clears the result
    await expect(page.getByTestId('result')).toHaveCount(0);
    expect(Math.abs((await top()) - t0)).toBeLessThanOrEqual(2);
  });

  test('D6: Cancel keeps the picked file and the settings, and Resize works again', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await page.getByTestId('preset-30').click();
    await page.evaluate(async () => {
      (document.querySelector('[data-testid=run]') as HTMLButtonElement).click();
      await Promise.resolve();
      (document.querySelector('[data-testid=cancel]') as HTMLButtonElement).click();
    });
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('file-info')).toContainText('noise.png');
    await expect(page.getByTestId('preview')).toBeVisible();
    await expect(page.getByTestId('preset-30')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('run')).toBeEnabled();
    await resize(page);
    expect(await bytesOf(page)).toBeLessThanOrEqual(30_000);
  });

  test('D8: clicking Resize immediately after hydration never ends idle without a result or an error', async ({ page }) => {
    test.setTimeout(120_000);
    for (let i = 0; i < 6; i++) {
      await page.goto(i % 2 ? '/resize-image-to-20kb/' : '/');
      await page.getByTestId('file').setInputFiles(NOISE);   // possibly before hydration
      await expect(page.getByTestId('run')).toBeEnabled({ timeout: 20_000 });
      await page.getByTestId('run').click();                  // immediately
      await expect.poll(async () => (await page.getByTestId('result').count()) + (await page.getByRole('alert').count()), { timeout: 40_000, message: `run ${i} ended idle` }).toBeGreaterThan(0);
      await expect(page.getByTestId('progress')).toHaveCount(0);
    }
  });

  test('D8: a file picked while the page is still loading, then Resize, still gives a result', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route('**/_astro/*.js', async (route) => { await gate; await route.continue(); });
    await page.goto('/', { waitUntil: 'commit' });
    await page.getByTestId('file').setInputFiles(NOISE);
    release();
    await expect(page.getByTestId('run')).toBeEnabled({ timeout: 20_000 });
    await page.getByTestId('run').click();
    await expect.poll(async () => (await page.getByTestId('result').count()) + (await page.getByRole('alert').count()), { timeout: 40_000 }).toBeGreaterThan(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
