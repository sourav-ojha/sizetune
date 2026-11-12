/**
 * UI review M6 investigation against the REAL built signature tool (runs under the repo-wide playwright.config.ts,
 * which builds and serves dist/ with wrangler). TEST-ONLY: the worker chunk gets a prelude that logs raw browser errors.
 * Skipped under the engine-only config (no baseURL there).
 */
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.resolve(import.meta.dirname, '../../package.json'));
const PRELUDE = `;(() => {
  const tag = (where, e) => console.error('RAWERR ' + where + ' ' + (e && e.name) + ': ' + (e && e.message));
  const wrapP = (obj, key, where) => { const o = obj[key]; obj[key] = function (...a) { try { const r = o.apply(this, a); return r && r.then ? r.catch((e) => { tag(where, e); throw e; }) : r; } catch (e) { tag(where, e); throw e; } }; };
  wrapP(OffscreenCanvas.prototype, 'convertToBlob', 'convertToBlob');
  wrapP(OffscreenCanvasRenderingContext2D.prototype, 'drawImage', 'drawImage');
  wrapP(self, 'createImageBitmap', 'createImageBitmap');
  const gc = OffscreenCanvas.prototype.getContext;
  OffscreenCanvas.prototype.getContext = function (...a) { const c = gc.apply(this, a); if (!c) console.error('RAWERR getContext null ' + this.width + 'x' + this.height); return c; };
})();\n`;

test('M6 (real UI): 140×60 JPEG, min 10 KB, 25 runs incl. immediate re-runs', async ({ page, baseURL }) => {
  test.skip(!baseURL, 'needs the built site (repo-wide config)');
  test.setTimeout(300_000);
  const sharp = require('sharp');
  const jpeg: Buffer = await sharp({ create: { width: 140, height: 60, channels: 3, background: '#f4f4f4' } })
    .composite([{ input: Buffer.from('<svg width="140" height="60"><path d="M10 40 C 40 5, 70 55, 130 20" stroke="#123" stroke-width="3" fill="none"/></svg>'), top: 0, left: 0 }])
    .jpeg({ quality: 90 }).toBuffer();
  const raw: string[] = [];
  page.on('console', (m) => { if (/RAWERR/.test(m.text())) raw.push(m.text()); });
  await page.route('**/_astro/compress.worker-*.js', async (route) => {
    const r = await route.fetch();
    await route.fulfill({ response: r, body: PRELUDE + (await r.text()) });
  });
  const tally: Record<string, number> = {};
  await page.goto('/resize-signature/');
  await expect(page.getByTestId('tool')).toBeVisible();
  await page.getByTestId('preset-100').click();
  for (let i = 0; i < 25; i++) {
    await page.getByTestId('file').setInputFiles({ name: `s${i}.jpg`, mimeType: 'image/jpeg', buffer: jpeg });
    await expect(page.getByTestId('run')).toBeEnabled({ timeout: 15_000 });
    if (!(await page.getByTestId('min-size').isVisible())) await page.getByTestId('advanced').locator('summary').click();
    await page.getByTestId('min-size').fill('10', { timeout: 10_000 });
    await page.getByTestId('run').click();
    if (i % 3 === 0) await page.getByTestId('run').click({ timeout: 500 }).catch(() => {}); // immediate re-run
    const res = page.getByTestId('result'), err = page.getByTestId('error');
    await expect(res.or(err).first()).toBeVisible({ timeout: 60_000 });
    const k = (await err.count()) ? 'error: ' + (await err.first().innerText()).slice(0, 60) : 'status: ' + (await res.getAttribute('data-status'));
    tally[k] = (tally[k] ?? 0) + 1;
  }
  console.log('M6-UI tally', JSON.stringify(tally));
  console.log('M6-UI raw', raw.length ? raw.join('\n') : 'none');
  expect(Object.keys(tally).filter((k) => /memory/.test(k))).toEqual([]);
});
