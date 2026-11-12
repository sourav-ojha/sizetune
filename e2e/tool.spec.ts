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

test('compresses in-browser to a valid image <= target KB, with no uploads', async ({ page, context, baseURL }) => {
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
  // wait for hydration, then watch only the processing phase for requests too
  await page.getByTestId('preset-100').click();
  const afterLoad = { external: external.length, nonGet: nonGet.length };
  const size = await compress(page);
  const bytes = Number(await size.getAttribute('data-bytes'));
  expect(bytes).toBeGreaterThan(1000);
  expect(bytes).toBeLessThanOrEqual(50 * 1000);
  expect(await size.getAttribute('data-status')).toBe('ok');
  expect(await page.getByTestId('result').getAttribute('data-mode'), 'the real site must use the worker').toBe('worker');
  const href = await page.getByTestId('download').getAttribute('href');
  expect(href).toMatch(/^blob:/);
  // Real download (CSP forbids fetch(blob:), which is itself a feature): read the saved file and decode it.
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download').click()]);
  expect(dl.suggestedFilename()).toMatch(/^noise-sizetune\.(jpg|png|webp)$/);
  const buf = fs.readFileSync(await dl.path());
  expect(buf.length).toBe(bytes);
  const dim = await page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bin]));
    return { w: bmp.width, h: bmp.height };
  }, buf.toString('base64'));
  expect(buf[0] === 0xff || buf[0] === 0x89).toBe(true); // JPEG or PNG magic
  expect(dim.w).toBeGreaterThan(50);
  expect(dim.w).toBeLessThanOrEqual(800);
  expect(nonGet, 'no non-GET requests').toEqual([]);
  expect(external, 'no requests to other origins').toEqual([]);
  expect(nonGet.length - afterLoad.nonGet, 'nothing sent while processing').toBe(0);
  expect(external.length - afterLoad.external, 'nothing contacted while processing').toBe(0);
});

test('without OffscreenCanvas the real site falls back to the main thread and still works (feature detection, not error retry)', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'OffscreenCanvas', { value: undefined, configurable: true, writable: true }); });
  await page.goto('/');
  const size = await compress(page);
  expect(await page.getByTestId('result').getAttribute('data-mode')).toBe('main-thread');
  expect(await size.getAttribute('data-status')).toBe('ok');
  expect(Number(await size.getAttribute('data-bytes'))).toBeLessThanOrEqual(50_000);
});

test('no CSP violations on the tool page (hydration + processing + preview + comparison + download)', async ({ page }) => {
  await page.addInitScript(() => { (window as any).__csp = []; document.addEventListener('securitypolicyviolation', (e) => (window as any).__csp.push(`${e.violatedDirective} ${e.blockedURI}`)); });
  const errs: string[] = [];
  page.on('console', (m) => { if (/content security policy/i.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('/');
  await compress(page);
  await page.getByTestId('compare-slider').focus();
  await page.keyboard.press('ArrowLeft');
  await page.getByTestId('advanced').locator('summary').click();
  await Promise.all([page.waitForEvent('download'), page.getByTestId('download').click()]);
  expect(await page.evaluate(() => (window as any).__csp)).toEqual([]);
  expect(errs).toEqual([]);
});

test('no CSP violations on the signature tool (crop overlay, canvas trim, preview)', async ({ page }) => {
  await page.addInitScript(() => { (window as any).__csp = []; document.addEventListener('securitypolicyviolation', (e) => (window as any).__csp.push(`${e.violatedDirective} ${e.blockedURI}`)); });
  const errs: string[] = [];
  page.on('console', (m) => { if (/content security policy/i.test(m.text())) errs.push(m.text()); });
  await page.goto('/resize-signature/');
  await page.getByTestId('file').setInputFiles(IMG);
  await expect(page.getByTestId('crop-box')).toBeVisible();
  await page.getByTestId('auto-trim').click();
  await page.getByTestId('crop-box').focus();
  await page.keyboard.press('ArrowRight');
  await page.getByTestId('run').click();
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).__csp)).toEqual([]);
  expect(errs).toEqual([]);
});

test('file picked BEFORE hydration is not lost (image tool and signature tool)', async ({ page }) => {
  for (const [url, extra] of [['/', 'preview'], ['/resize-signature/', 'crop-box']] as const) {
    // Hold back the island JS so the SSR'd input is interactive but the UI framework is not.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route('**/_astro/*.js', async (route) => { await gate; await route.continue(); });
    await page.goto(url, { waitUntil: 'commit' });
    await page.getByTestId('file').setInputFiles(IMG);
    release();
    await expect(page.getByTestId(extra)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('run')).toBeEnabled();
    await page.unroute('**/_astro/*.js');
  }
});

test('stale result from a superseded run is dropped', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('preset-100').click();
  await page.getByTestId('file').setInputFiles(IMG);
  await expect(page.getByTestId('run')).toBeEnabled();
  // Run, then pick another file in the same task (before the engine can answer).
  await page.evaluate(async (b64) => {
    (document.querySelector('[data-testid=run]') as HTMLButtonElement).click();
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const input = document.querySelector('[data-testid=file]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(new File([bin], 'other.png', { type: 'image/png' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, fs.readFileSync(IMG).toString('base64'));
  await expect(page.getByTestId('file-info')).toContainText('other.png');
  await page.waitForTimeout(2500);
  await expect(page.getByTestId('result-size')).toHaveCount(0);
  await expect(page.getByTestId('progress')).toHaveCount(0);
});

test('non-image content is rejected by magic-byte check', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file').setInputFiles({ name: 'evil.png', mimeType: 'image/png', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>') });
  await expect(page.getByRole('alert')).toContainText('JPEG, PNG or WebP');
  await expect(page.getByTestId('run')).toBeDisabled();
});

test('invalid target disables the button', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('preset-100').click(); // wait for hydration
  await page.getByTestId('file').setInputFiles(IMG);
  await expect(page.getByTestId('run')).toBeEnabled();
  await page.getByTestId('target').fill('0');
  await expect(page.getByTestId('run')).toBeDisabled();
  await page.getByTestId('target').fill('');
  await expect(page.getByTestId('run')).toBeDisabled();
});

test('undecodable file shows an error, no crash (complete structure, unreadable pixels: fails at Resize)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('preset-100').click();
  // valid PNG structure (signature, IHDR 100x100, IDAT, IEND) whose pixel data cannot be decoded
  const zlib = await import('node:zlib');
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(100, 0); ihdr.writeUInt32BE(100, 4); ihdr[8] = 8; ihdr[9] = 6;
  const bad = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.alloc(64))), chunk('IEND', Buffer.alloc(0))]);
  await page.getByTestId('file').setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: bad });
  await expect(page.getByTestId('run')).toBeEnabled();
  await page.getByTestId('run').click();
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('run')).toBeEnabled();
});

test('a truncated file is rejected at pick with a friendly message, and a good file recovers', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('preset-100').click();
  await page.getByTestId('file').setInputFiles({ name: 'cut.png', mimeType: 'image/png', buffer: fs.readFileSync(IMG).subarray(0, 200) });
  await expect(page.getByRole('alert')).toContainText(/incomplete or damaged/);
  await expect(page.getByTestId('run')).toBeDisabled();
  await page.getByTestId('file').setInputFiles(IMG);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByTestId('run')).toBeEnabled();
});

test('SEO content is present with JavaScript disabled', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Resize an image');
  expect(await page.content()).toMatch(/needs JavaScript/);
  await expect(page.locator('noscript p')).toBeVisible();
  await expect(page.getByRole('link', { name: /photo size guide/i }).first()).toHaveAttribute('href', '/guides/photo-size-for-online-forms/');
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
