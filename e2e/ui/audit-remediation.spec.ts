import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { NOISE, flatPng, openTool, pick, resize } from './helpers';

// Regression tests for the audit register ST-001 .. ST-015 (AUDIT_ISSUES.md).
test.describe('audit remediation', () => {
  test('ST-001: no quality slider when the real output is PNG; slider stays for JPEG', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE); // PNG source
    await page.getByTestId('preset-none').click();
    await expect(page.getByTestId('quality')).toHaveCount(0); // Auto on a PNG source stays PNG
    await page.getByTestId('format-png').check();
    await expect(page.getByTestId('quality')).toHaveCount(0);
    await page.getByTestId('format-jpeg').check();
    await expect(page.getByTestId('quality')).toBeVisible();
    await expect(page.getByTestId('nolimit-note')).toContainText('12 megapixels'); // ST-006
  });

  test('ST-003: the keep-original blob is typed from its bytes, not its .html name, and still downloads with the right name', async ({ page }) => {
    await openTool(page);
    const tiny = flatPng(60, 30);
    await pick(page, { name: 'polyglot.html', mimeType: 'text/html', buffer: tiny });
    await page.getByTestId('preset-200').click();
    await resize(page);
    const href = await page.getByTestId('keep-original').getAttribute('href');
    // The page CSP blocks fetch() of blob URLs, so open the link in a new tab and read the type the browser assigned.
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.evaluate((u) => { window.open(u!); }, href)]);
    await popup.waitForLoadState();
    const type = await popup.evaluate(() => document.contentType);
    await popup.close();
    expect(type).toBe('image/png');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('keep-original').click()]);
    expect(dl.suggestedFilename()).toBe('polyglot.html');
    expect(Buffer.compare(fs.readFileSync(await dl.path()), tiny)).toBe(0);
  });

  test('ST-009: Resize is disabled while a replacement file is being inspected (delayed intake)', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = window.createImageBitmap.bind(window);
      (window as unknown as { createImageBitmap: unknown }).createImageBitmap = async (...a: unknown[]) => {
        if ((window as unknown as { __slow?: boolean }).__slow) await new Promise((r) => setTimeout(r, 1500));
        return (orig as (...x: unknown[]) => Promise<ImageBitmap>)(...a);
      };
    });
    await openTool(page);
    await pick(page, NOISE);
    await resize(page);
    await page.evaluate(() => { (window as unknown as { __slow: boolean }).__slow = true; });
    await page.getByTestId('file').setInputFiles({ name: 'second.png', mimeType: 'image/png', buffer: flatPng(300, 200) });
    await expect(page.getByTestId('run')).toBeDisabled(); // would otherwise accept a click that the new file then discards
    await expect(page.getByTestId('run')).toBeEnabled({ timeout: 15_000 });
    await expect(page.getByTestId('file-info')).toContainText('second.png');
    await page.getByTestId('run').click();
    await expect(page.getByTestId('result')).toBeVisible({ timeout: 30_000 });
  });

  test('ST-012: an empty file says it is empty', async ({ page }) => {
    await openTool(page);
    await page.getByTestId('file').setInputFiles({ name: 'empty.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(0) });
    await expect(page.getByTestId('error')).toContainText('empty');
    await expect(page.getByTestId('error')).not.toContainText('not a JPEG');
  });

  test('ST-011 and ST-010: signature crop fields explain invalid input; selects are 44 px tall', async ({ page }) => {
    await openTool(page, '/resize-signature/');
    await pick(page, NOISE);
    for (const id of ['crop-shape', 'crop-margin']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(43.5);
    }
    const left = page.getByTestId('crop-x');
    await left.fill('abc');
    await expect(page.getByTestId('crop-x-error')).toBeVisible();
    await expect(left).toHaveAttribute('aria-invalid', 'true');
    await left.fill('-5');
    await expect(page.getByTestId('crop-x-error')).toBeVisible();
    await left.fill('10');
    await expect(page.getByTestId('crop-x-error')).toHaveCount(0);
  });

  test('ST-015: the 404 page has no og:url', async ({ page }) => {
    const res = await page.request.get('/definitely-not-a-page/');
    expect(await res.text()).not.toContain('og:url');
  });
});
