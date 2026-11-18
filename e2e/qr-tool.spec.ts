import { test, expect, type Page } from '@playwright/test';
import jsQR from 'jsqr';

const PAGE = '/qr-code-generator/';

test.beforeEach(async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.getByTestId('tool')).toBeVisible();
  // Server-rendered, so visible before the island hydrates; input typed before then is lost.
  await page.waitForFunction(() => { const i = document.querySelector('astro-island'); return !!i && !i.hasAttribute('ssr'); });
});

// Pixels cross the Playwright boundary as one base64 string: a number array of a million entries is slow enough to time out polls under load.
type Px = { width: number; height: number; b64: string };
const decodePx = (px: Px) => jsQR(Uint8ClampedArray.from(Buffer.from(px.b64, 'base64')), px.width, px.height)?.data ?? null;

/** Reads the pixels the tool actually shows. */
const canvasPixels = (page: Page): Promise<Px> => page.getByTestId('qr-canvas').evaluate((cv: HTMLCanvasElement) => {
  const c = cv.getContext('2d')!;
  const d = c.getImageData(0, 0, cv.width, cv.height);
  let bin = '';
  for (let i = 0; i < d.data.length; i += 0x8000) bin += String.fromCharCode(...d.data.subarray(i, i + 0x8000));
  return { width: d.width, height: d.height, b64: btoa(bin) };
});

/** Opens a downloaded file in a blank page (outside the site's own CSP) and returns its rendered pixels. */
async function renderFile(page: Page, bytes: Buffer, mime: string): Promise<Px> {
  const other = await page.context().newPage();
  try {
    return await other.evaluate(async ({ b64, type }) => {
      const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bin], { type }));
      const img = new Image();
      img.src = url;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const c = cv.getContext('2d')!;
      c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
      c.drawImage(img, 0, 0);
      const d = c.getImageData(0, 0, cv.width, cv.height);
      let out = '';
      for (let i = 0; i < d.data.length; i += 0x8000) out += String.fromCharCode(...d.data.subarray(i, i + 0x8000));
      return { width: d.width, height: d.height, b64: btoa(out) };
    }, { b64: bytes.toString('base64'), type: mime });
  } finally { await other.close(); }
}

test('AC-1: a web address is decoded by a reader as exactly what was typed', async ({ page }) => {
  await page.getByTestId('qr-url').fill('https://example.org/path?a=1&b=é');
  await expect(page.getByTestId('qr-info')).toBeVisible();
  await expect.poll(async () => decodePx(await canvasPixels(page))).toBe('https://example.org/path?a=1&b=é');
});

test('AC-1: plain text works and the error-correction choice changes the code, not the content', async ({ page }) => {
  await page.getByTestId('kind-text').click();
  await page.getByTestId('qr-text').fill('Hello, नमस्ते 👍');
  await expect(page.getByTestId('qr-info')).toBeVisible();
  const low = await canvasPixels(page);
  await expect.poll(async () => decodePx(await canvasPixels(page))).toBe('Hello, नमस्ते 👍');
  await page.getByTestId('qr-ecl').selectOption('H');
  await expect.poll(() => page.getByTestId('qr-canvas').evaluate((c: HTMLCanvasElement) => c.width)).not.toBe(low.width);
  await expect.poll(async () => decodePx(await canvasPixels(page))).toBe('Hello, नमस्ते 👍');
});

test('AC-2: Wi-Fi details give the WIFI: payload a phone offers to join, with special characters escaped', async ({ page }) => {
  await page.getByTestId('kind-wifi').click();
  await page.getByTestId('qr-ssid').fill('Cafe;Guest');
  await page.getByTestId('qr-pass').fill('pa:ss,word');
  await expect(page.getByTestId('qr-info')).toBeVisible();
  await expect.poll(async () => decodePx(await canvasPixels(page))).toBe('WIFI:T:WPA;S:Cafe\\;Guest;P:pa\\:ss\\,word;;');
  await page.getByTestId('qr-sec').selectOption('nopass');
  await expect(page.getByTestId('qr-pass')).toHaveCount(0);
  await expect.poll(async () => decodePx(await canvasPixels(page))).toBe('WIFI:T:nopass;S:Cafe\\;Guest;;');
});

test('AC-3: the downloaded PNG and SVG files open and scan to the same content', async ({ page }) => {
  await page.getByTestId('qr-url').fill('https://example.com/download-check');
  await expect(page.getByTestId('qr-png')).toHaveAttribute('href', /^blob:/);
  await expect(page.getByTestId('qr-svg')).toHaveAttribute('href', /^blob:/);
  for (const [id, name, mime] of [['qr-png', 'qr-code.png', 'image/png'], ['qr-svg', 'qr-code.svg', 'image/svg+xml']] as const) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId(id).click()]);
    expect(dl.suggestedFilename()).toBe(name);
    const path = await dl.path();
    const bytes = (await import('node:fs')).readFileSync(path);
    if (mime === 'image/svg+xml') expect(bytes.toString('utf8')).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(decodePx(await renderFile(page, bytes, mime)), name).toBe('https://example.com/download-check');
  }
});

test('AC-3: the PNG size option changes the picture size', async ({ page }) => {
  await page.getByTestId('qr-url').fill('https://example.com/size');
  await page.getByTestId('qr-size').selectOption('256');
  await expect(page.getByTestId('qr-info')).toBeVisible();
  const width = () => page.getByTestId('qr-canvas').evaluate((c: HTMLCanvasElement) => c.width);
  await expect.poll(width).toBeLessThan(300);
  await page.getByTestId('qr-size').selectOption('1024');
  await expect.poll(width).toBeGreaterThan(900);
});

test('text too long for a QR code is explained and no download is offered', async ({ page }) => {
  await page.getByTestId('kind-text').click();
  await page.getByTestId('qr-text').fill('x'.repeat(2500));
  await expect(page.getByTestId('qr-error')).toBeVisible();
  await expect(page.getByTestId('qr-png')).toHaveCount(0);
});

test('a warning to test the printed code is shown with every code', async ({ page }) => {
  await expect(page.getByTestId('qr-warn')).toHaveCount(0);
  await page.getByTestId('qr-url').fill('https://example.com');
  await expect(page.getByTestId('qr-warn')).toContainText(/test the code with a phone/i);
});

test('AC-4: making codes sends no request that carries what was typed', async ({ page }) => {
  const seen: string[] = [];
  page.on('request', (r) => { seen.push(`${r.method()} ${r.url()} ${r.postData() ?? ''}`); });
  await page.getByTestId('qr-url').fill('https://secret-host-xyz.example/token-123');
  await page.getByTestId('kind-wifi').click();
  await page.getByTestId('qr-ssid').fill('secret-ssid-xyz');
  await page.getByTestId('qr-pass').fill('secret-pass-xyz');
  await expect(page.getByTestId('qr-png')).toHaveAttribute('href', /^blob:/);
  expect(seen.filter((s) => /secret-(host|ssid|pass)-xyz|token-123/.test(s))).toEqual([]);
  expect(seen.filter((s) => !s.includes(new URL(page.url()).origin) && !s.startsWith('GET blob:'))).toEqual([]);
});
