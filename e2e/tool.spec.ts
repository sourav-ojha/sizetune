import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const IMG = path.join(import.meta.dirname, 'noise.png');

async function compress(page: import('@playwright/test').Page, kb = '50') {
  await page.getByTestId('file').setInputFiles(IMG);
  await page.getByTestId('target').fill(kb);
  await page.getByTestId('run').click();
  const size = page.getByTestId('result-size');
  await expect(size).toBeVisible({ timeout: 30_000 });
  return size;
}

test('compresses in-browser to a valid JPEG <= target KB, via worker, with no uploads', async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  const nonGet: string[] = [];
  // context-level listener also sees worker-initiated requests
  context.on('request', (r) => {
    const u = new URL(r.url());
    if (!['blob:', 'data:'].includes(u.protocol) && u.origin !== origin) external.push(r.url());
    if (r.method() !== 'GET') nonGet.push(`${r.method()} ${r.url()}`);
  });
  await page.goto('/');
  await expect(page.getByTestId('tool')).toBeVisible();
  const size = await compress(page);
  const bytes = Number(await size.getAttribute('data-bytes'));
  expect(bytes).toBeGreaterThan(1000);
  expect(bytes).toBeLessThanOrEqual(50 * 1024);
  expect(await size.getAttribute('data-mode')).toBe('worker');
  const href = await page.getByTestId('download').getAttribute('href');
  expect(href).toMatch(/^blob:/);
  // Real download (CSP forbids fetch(blob:), which is itself a feature): read the saved file and decode it.
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download').click()]);
  const buf = fs.readFileSync(await dl.path());
  const dim = await page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bin], { type: 'image/jpeg' }));
    return { w: bmp.width, h: bmp.height };
  }, buf.toString('base64'));
  const info = { sig: [buf[0], buf[1]], w: dim.w, h: dim.h, n: buf.length };
  expect(info.sig).toEqual([0xff, 0xd8]);
  expect(info.w).toBeGreaterThan(50);
  expect(info.w).toBeLessThanOrEqual(800);
  expect(nonGet, 'no non-GET requests').toEqual([]);
  expect(external, 'no requests to other origins').toEqual([]);
});

test('no CSP violations on the tool page (hydration + worker + preview + download)', async ({ page }) => {
  await page.addInitScript(() => { (window as any).__csp = []; document.addEventListener('securitypolicyviolation', (e) => (window as any).__csp.push(`${e.violatedDirective} ${e.blockedURI}`)); });
  const errs: string[] = [];
  page.on('console', (m) => { if (/content security policy/i.test(m.text())) errs.push(m.text()); });
  await page.goto('/');
  await compress(page);
  expect(await page.evaluate(() => (window as any).__csp)).toEqual([]);
  expect(errs).toEqual([]);
});

test('file picked BEFORE hydration is not lost', async ({ page }) => {
  // Hold back the island JS so the SSR'd input is interactive but React is not.
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route('**/_astro/*.js', async (route) => { await gate; await route.continue(); });
  await page.goto('/', { waitUntil: 'commit' });
  await page.getByTestId('file').setInputFiles(IMG);
  release();
  await expect(page.getByTestId('preview')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('run')).toBeEnabled();
});

test('stale result from a superseded run is dropped', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file').setInputFiles(IMG);
  await page.getByTestId('run').click();
  await page.getByTestId('file').setInputFiles({ name: 'other.png', mimeType: 'image/png', buffer: fs.readFileSync(IMG) });
  await page.waitForTimeout(2500);
  await expect(page.getByTestId('result-size')).toHaveCount(0);
});

test('non-image content is rejected by magic-byte check', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file').setInputFiles({ name: 'evil.png', mimeType: 'image/png', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>') });
  await page.getByTestId('run').click();
  await expect(page.getByRole('alert')).toContainText('JPEG, PNG or WebP');
});

test('invalid target disables the button', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file').setInputFiles(IMG);
  await page.getByTestId('target').fill('1');
  await expect(page.getByTestId('run')).toBeDisabled();
  await page.getByTestId('target').fill('');
  await expect(page.getByTestId('run')).toBeDisabled();
});

test('undecodable file shows an error, no crash', async ({ page }) => {
  const bad = path.join(import.meta.dirname, 'bad.png');
  fs.writeFileSync(bad, 'not an image');
  await page.goto('/');
  await page.getByTestId('file').setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: fs.readFileSync(bad) });
  await page.getByTestId('run').click();
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
  fs.unlinkSync(bad);
});

test('SEO content is present with JavaScript disabled', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Resize an image');
  expect(await page.content()).toContain('This tool needs JavaScript');
  await expect(page.locator('noscript p')).toBeVisible();
  await expect(page.getByRole('link', { name: 'photo size guide for online forms' })).toHaveAttribute('href', '/guides/photo-size-for-online-forms/');
  await ctx.close();
});

test('unknown URL returns 404 status', async ({ request }) => {
  expect((await request.get('/definitely-missing/')).status()).toBe(404);
});

test('trailing-slash redirect, noindex on 404, and caching headers (served by workerd)', async ({ request }) => {
  const r = await request.get('/privacy', { maxRedirects: 0 });
  expect(r.status()).toBe(307);
  expect(r.headers()['location']).toBe('/privacy/');
  const html = await request.get('/privacy/');
  expect(html.status()).toBe(200);
  expect(html.headers()['x-content-type-options']).toBe('nosniff');
  expect(await (await request.get('/definitely-missing/')).text()).toContain('noindex');
  const home = await (await request.get('/')).text();
  const js = home.match(/\/_astro\/[^"']+\.js/)![0];
  expect((await request.get(js)).headers()['cache-control']).toContain('immutable');
});

test('non-tool pages load no JS files', async ({ page }) => {
  const js: string[] = [];
  page.on('request', (r) => { if (r.url().endsWith('.js')) js.push(r.url()); });
  for (const p of ['/privacy/', '/guides/photo-size-for-online-forms/']) { await page.goto(p); await page.waitForLoadState('networkidle'); }
  expect(js).toEqual([]);
});
