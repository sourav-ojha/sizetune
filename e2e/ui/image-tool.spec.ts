import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { NOISE, bytesOf, downloaded, file, flatPng, isJpeg, isPng, isWebp, openTool, pick, resize, transparentPng } from './helpers';

test.describe('image tool', () => {
  test('preset buttons set the maximum and the result honours it', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await page.getByTestId('preset-30').click();
    await expect(page.getByTestId('preset-30')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('preset-50')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('target')).toHaveValue('30');
    await resize(page);
    await expect(page.getByTestId('result')).toHaveAttribute('data-status', 'ok');
    expect(await bytesOf(page)).toBeLessThanOrEqual(30_000);
    await expect(page.getByTestId('result-target')).toContainText('below 30 × 1,000 = 30,000 bytes');
    await expect(page.getByTestId('result-target')).toContainText('passes whether a portal counts 1 KB as 1,000 or 1,024 bytes');
    await expect(page.getByTestId('result-change')).toContainText('smaller than the original');
    await expect(page.getByTestId('original-info')).toContainText('800 × 600 px');
    const d = await downloaded(page);
    expect(d.name).toMatch(/^noise-sizetune\.(jpg|png|webp)$/);
    expect(d.n).toBeLessThanOrEqual(30_000);
  });

  test('custom maximum, and changing it clears the stale result', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await page.getByTestId('target').fill('35');
    await expect(page.getByTestId('preset-none')).toHaveAttribute('aria-pressed', 'false');
    await resize(page);
    expect(await bytesOf(page)).toBeLessThanOrEqual(35_000);
    await page.getByTestId('preset-10').click();
    await expect(page.getByTestId('result')).toHaveCount(0);
  });

  test('invalid maximum disables the button with a message', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    for (const bad of ['0', '', 'abc', '-3', '99999999']) {
      await page.getByTestId('target').fill(bad);
      await expect(page.getByTestId('run'), `value "${bad}"`).toBeDisabled();
      await expect(page.getByTestId('size-picker')).toContainText(/Enter a/);
    }
    await page.getByTestId('target').fill('25');
    await expect(page.getByTestId('run')).toBeEnabled();
  });

  test('"No limit" shows a quality slider and uses a fixed quality', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await page.getByTestId('preset-none').click();
    await page.getByTestId('format-jpeg').check();
    await expect(page.getByTestId('quality')).toBeVisible();
    await page.getByTestId('quality').fill('30');
    await resize(page);
    await expect(page.getByTestId('result')).toContainText('quality 30');
    await page.getByTestId('preset-50').click();
    await expect(page.getByTestId('quality')).toHaveCount(0);
  });

  test('range: minimum and maximum together', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await page.getByTestId('preset-50').click();
    await page.getByTestId('advanced').locator('summary').click();
    await page.getByTestId('min-size').fill('20');
    await resize(page);
    const b = await bytesOf(page);
    expect(b).toBeLessThanOrEqual(50_000);
    expect(b).toBeGreaterThanOrEqual(20 * 1024);
    await expect(page.getByTestId('result-target')).toContainText('below 50 × 1,000 = 50,000 bytes and above 20 × 1,024 = 20,480 bytes');
  });

  test('range validation: a minimum above the maximum is rejected (and the advanced section opens)', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await page.getByTestId('advanced').locator('summary').click();
    await page.getByTestId('min-size').fill('80');
    await page.getByTestId('preset-50').click();
    await expect(page.getByTestId('run')).toBeDisabled();
    await expect(page.getByTestId('advanced')).toContainText('smaller than the maximum');
    await page.getByTestId('min-size').fill('49');
    await expect(page.getByTestId('advanced')).toContainText('too close');
  });

  test('impossible minimum is reported honestly: warning, not success, download only as secondary', async ({ page }) => {
    await openTool(page);
    await pick(page, { name: 'tiny.png', mimeType: 'image/png', buffer: flatPng() });
    await page.getByTestId('format-jpeg').check();
    await page.getByTestId('advanced').locator('summary').click();
    await page.getByTestId('min-size').fill('50');
    await page.getByTestId('preset-100').click();
    await resize(page);
    await expect(page.getByTestId('result')).toHaveAttribute('data-status', 'below_min');
    await expect(page.getByTestId('result-heading')).toContainText('Minimum size not reached');
    await expect(page.getByTestId('result-message')).not.toBeEmpty();
    await expect(page.getByTestId('result-gap')).toContainText('Under by');
    await expect(page.getByTestId('download')).toHaveCount(0);
    await expect(page.getByTestId('download-anyway')).toBeVisible();
    await expect(page.getByTestId('result-hint')).toContainText('does not pad');
    await expect(page.getByTestId('status')).toContainText('not met');
  });

  test('format switching: JPEG, PNG and WebP outputs are real files of that type', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await page.getByTestId('preset-200').click();
    await page.getByTestId('format-jpeg').check();
    await resize(page);
    let d = await downloaded(page, (await page.getByTestId('download').count()) ? 'download' : 'download-anyway');
    expect(isJpeg(d.buf)).toBe(true);
    expect(d.name).toMatch(/\.jpg$/);
    await page.getByTestId('format-png').check();
    await resize(page);
    d = await downloaded(page, (await page.getByTestId('download').count()) ? 'download' : 'download-anyway');
    expect(isPng(d.buf)).toBe(true);
    expect(d.name).toMatch(/\.png$/);
    const webp = page.getByTestId('format-webp');
    if (await webp.isEnabled()) {
      await webp.check();
      await resize(page);
      d = await downloaded(page, (await page.getByTestId('download').count()) ? 'download' : 'download-anyway');
      expect(isWebp(d.buf)).toBe(true);
      expect(d.name).toMatch(/\.webp$/);
    } else {
      await expect(page.getByTestId('webp-unsupported')).toBeVisible();
    }
  });

  test('transparent PNG: default keeps transparency; JPEG needs a colour and discloses the fill', async ({ page }) => {
    await openTool(page);
    await pick(page, { name: 'logo.png', mimeType: 'image/png', buffer: transparentPng() });
    await expect(page.getByTestId('alpha-note')).toContainText('transparent');
    await expect(page.getByTestId('format-auto')).toBeChecked();
    await expect(page.getByTestId('flatten-choice')).toHaveCount(0);
    await page.getByTestId('preset-100').click();
    await resize(page);
    const kept = await downloaded(page, (await page.getByTestId('download').count()) ? 'download' : 'download-anyway');
    expect(isPng(kept.buf) || isWebp(kept.buf), 'default output must not be JPEG for a transparent image').toBe(true);

    await page.getByTestId('format-jpeg').check();
    await expect(page.getByTestId('flatten-choice')).toBeVisible();
    await expect(page.getByTestId('bg-white')).toBeChecked();
    await page.getByTestId('bg-black').check();
    await resize(page);
    await expect(page.getByTestId('result-notes')).toBeVisible();
    await expect(page.getByTestId('result-notes')).toContainText(/transparen/i);
    await expect(page.getByTestId('result-notes')).toContainText(/black/i);
    const flat = await downloaded(page, (await page.getByTestId('download').count()) ? 'download' : 'download-anyway');
    expect(isJpeg(flat.buf)).toBe(true);
  });

  test('before/after comparison works by keyboard', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await resize(page);
    const slider = page.getByTestId('compare-slider');
    await expect(slider).toHaveValue('50');
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('51');
    await page.keyboard.press('End');
    await expect(slider).toHaveValue('100');
    expect(await page.getByTestId('compare').locator('div').first().evaluate((el) => el.style.getPropertyValue('--cmp'))).toBe('100%');
    await expect(slider).toHaveAttribute('aria-valuetext', /original/i);
    await page.keyboard.press('Home');
    await expect(slider).toHaveValue('0');
    await page.getByTestId('compare-show-before').focus();
    await page.keyboard.press('Enter');
    await expect(slider).toHaveValue('100');
    await expect(page.getByTestId('compare-show-before')).toHaveAttribute('aria-pressed', 'true');
  });

  test('cancel stops the run silently and keeps the file', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    // click Run then Cancel in the same task so the engine cannot finish in between
    await page.evaluate(async () => {
      (document.querySelector('[data-testid=run]') as HTMLButtonElement).click();
      await Promise.resolve(); // let the UI commit the "processing" UI, but not long enough for the engine to answer
      (document.querySelector('[data-testid=cancel]') as HTMLButtonElement).click();
    });
    await page.waitForTimeout(2500);
    await expect(page.getByTestId('result')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByTestId('progress')).toHaveCount(0);
    await expect(page.getByTestId('run')).toBeEnabled();
    await expect(page.getByTestId('preview')).toBeVisible();
  });

  test('progress and Cancel are shown while processing', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await page.evaluate(() => (document.querySelector('[data-testid=run]') as HTMLButtonElement).click());
    // may already be done on a fast machine: either state is valid, but never both
    const progress = await page.getByTestId('progress').count();
    if (progress) { await expect(page.getByTestId('cancel')).toBeVisible(); await expect(page.getByTestId('run')).toHaveCount(0); }
    await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('progress')).toHaveCount(0);
  });

  test('reset returns to an empty tool and removes previews', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await resize(page);
    await page.getByTestId('reset').click();
    await expect(page.getByTestId('result')).toHaveCount(0);
    await expect(page.getByTestId('preview')).toHaveCount(0);
    await expect(page.getByTestId('run')).toBeDisabled();
    await expect(page.getByTestId('file')).toBeFocused();
    // same file can be chosen again
    await pick(page, NOISE);
    await expect(page.getByTestId('preview')).toBeVisible();
  });

  test('drag and drop works (and the button remains)', async ({ page }) => {
    await openTool(page);
    await expect(page.getByText('Drag and drop an image here')).toBeVisible();
    const dt = await page.evaluateHandle(async () => {
      const d = new DataTransfer();
      const c = document.createElement('canvas'); c.width = 64; c.height = 48;
      c.getContext('2d')!.fillRect(0, 0, 64, 48);
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
      d.items.add(new File([blob], 'dropped.png', { type: 'image/png' }));
      return d;
    });
    await page.getByTestId('dropzone').dispatchEvent('dragover', { dataTransfer: dt });
    await expect(page.getByTestId('dropzone')).toHaveAttribute('data-over', 'true');
    await page.getByTestId('dropzone').dispatchEvent('drop', { dataTransfer: dt });
    await expect(page.getByTestId('file-info')).toContainText('dropped.png');
    await expect(page.getByTestId('run')).toBeEnabled();
    await expect(page.getByTestId('dropzone')).toHaveAttribute('data-over', 'false');
  });

  test('a second dropped file is ignored with a notice', async ({ page }) => {
    await openTool(page);
    const dt = await page.evaluateHandle(async () => {
      const d = new DataTransfer();
      const c = document.createElement('canvas'); c.width = 8; c.height = 8; c.getContext('2d')!.fillRect(0, 0, 8, 8);
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
      d.items.add(new File([blob], 'a.png', { type: 'image/png' }));
      d.items.add(new File([blob], 'b.png', { type: 'image/png' }));
      return d;
    });
    await page.getByTestId('dropzone').dispatchEvent('drop', { dataTransfer: dt });
    await expect(page.getByTestId('file-info')).toContainText('a.png');
    await expect(page.getByTestId('notice')).toContainText('first file');
  });

  test('non-image content is rejected immediately', async ({ page }) => {
    await openTool(page);
    await page.getByTestId('file').setInputFiles(file('evil.png', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')));
    await expect(page.getByRole('alert')).toContainText('JPEG, PNG or WebP');
    await expect(page.getByTestId('preview')).toHaveCount(0);
    await expect(page.getByTestId('run')).toBeDisabled();
  });

  test('a damaged image shows a friendly error and can be retried', async ({ page }) => {
    await openTool(page);
    const real = flatPng(200, 200);
    await page.getByTestId('file').setInputFiles(file('broken.png', real.subarray(0, 60)));
    await page.getByTestId('run').click();
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('alert')).not.toContainText(/undefined|Error:/);
    await expect(page.getByTestId('run')).toBeEnabled();
    await pick(page, file('ok.png', real));
    await resize(page);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('picking a new file replaces the old result', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await resize(page);
    await page.getByTestId('file').setInputFiles(file('other.png', flatPng(100, 80)));
    await expect(page.getByTestId('result')).toHaveCount(0);
    await expect(page.getByTestId('file-info')).toContainText('other.png');
  });

  test('settings: dimensions with aspect lock show derived placeholders, nothing is prefilled', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE); // 800x600
    await page.getByTestId('advanced').locator('summary').click();
    await expect(page.getByTestId('width')).toHaveValue('');
    await expect(page.getByTestId('height')).toHaveValue('');
    await page.getByTestId('width').fill('400');
    await expect(page.getByTestId('height')).toHaveAttribute('placeholder', '300');
    await page.getByTestId('lock-aspect').uncheck();
    await expect(page.getByTestId('height')).toHaveAttribute('placeholder', 'auto');
    await page.getByTestId('lock-aspect').check();
    await page.getByTestId('preset-200').click();
    await resize(page);
    const d = await downloaded(page, (await page.getByTestId('download').count()) ? 'download' : 'download-anyway');
    expect(d.w).toBe(400);
    expect(d.h).toBe(300);
  });

  test('M4: a result larger than the original is not presented as success; the original can be kept', async ({ page }) => {
    await openTool(page);
    const tiny = flatPng(60, 30);
    await pick(page, { name: 'tiny.png', mimeType: 'image/png', buffer: tiny });
    await page.getByTestId('preset-200').click();
    await resize(page);
    await expect(page.getByTestId('result-heading')).toContainText('The result is larger than your original');
    await expect(page.getByTestId('result-heading')).not.toContainText('ready');
    await expect(page.getByTestId('result')).toHaveClass(/amber/);
    await expect(page.getByTestId('larger-note')).toContainText('already fits your limit');
    await expect(page.getByTestId('status')).toContainText('larger than your original');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('keep-original').click()]);
    expect(dl.suggestedFilename()).toBe('tiny.png');
    expect(Buffer.compare(fs.readFileSync(await dl.path()), tiny)).toBe(0);
    await expect(page.getByTestId('download')).toContainText('larger result anyway');
  });

  test('M5: an opaque PNG with a size limit is preselected as JPEG, visibly; Auto/PNG keep the format; transparent PNGs keep Auto', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await expect(page.getByTestId('format-jpeg')).toBeChecked();
    await expect(page.getByTestId('default-format-note')).toContainText('Your PNG will be saved as a JPEG: smaller files keep more detail. Choose PNG to keep the format.');
    await page.getByTestId('preset-20').click();
    await resize(page);
    const d = await downloaded(page, (await page.getByTestId('download').count()) ? 'download' : 'download-anyway');
    expect(isJpeg(d.buf)).toBe(true);
    expect(d.w).toBeGreaterThan(300); // pixels are not shrunk to a thumbnail
    await page.getByTestId('format-auto').check();
    await expect(page.getByTestId('default-format-note')).toHaveCount(0);
    await expect(page.getByTestId('format-auto')).toBeChecked();
    await page.getByTestId('preset-none').click();
    await expect(page.getByTestId('format-auto')).toBeChecked();
    // a transparent PNG is never switched
    await page.getByTestId('file').setInputFiles(file('logo.png', transparentPng()));
    await expect(page.getByTestId('alpha-note')).toBeVisible();
    await expect(page.getByTestId('default-format-note')).toHaveCount(0);
  });

  test('M5: transparent PNG with a limit stays on Auto (no switch)', async ({ page }) => {
    await openTool(page);
    await pick(page, file('logo.png', transparentPng()));
    await expect(page.getByTestId('alpha-note')).toBeVisible();
    await expect(page.getByTestId('format-auto')).toBeChecked();
    await expect(page.getByTestId('default-format-note')).toHaveCount(0);
  });

  test('L1: typed width and height that the aspect lock changes are explained; Fit appears when needed', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE); // 800x600
    await page.getByTestId('advanced').locator('summary').click();
    await expect(page.getByTestId('fit')).toHaveCount(0);
    await page.getByTestId('width').fill('300');
    await expect(page.getByTestId('fit')).toHaveCount(0);
    await page.getByTestId('height').fill('100');
    await expect(page.getByTestId('fit')).toBeVisible();
    await page.getByTestId('preset-200').click();
    await resize(page);
    await expect(page.getByTestId('result-notes')).toContainText('Aspect lock kept the shape');
    await expect(page.getByTestId('result-notes')).toContainText('133 × 100 px');
    await page.getByTestId('lock-aspect').uncheck();
    await expect(page.getByTestId('fit')).toBeVisible();
    await expect(page.getByTestId('fit')).toBeDisabled();
    await resize(page);
    const d = await downloaded(page, (await page.getByTestId('download').count()) ? 'download' : 'download-anyway');
    expect([d.w, d.h]).toEqual([300, 100]);
    await page.getByTestId('width').fill('');
    await page.getByTestId('height').fill('');
    await expect(page.getByTestId('fit')).toBeVisible(); // lock is still off
  });

  test('L2: a wrong-type pick over a loaded image keeps the image and result, and shows the error beside them', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await resize(page);
    await page.getByTestId('file').setInputFiles(file('evil.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/svg+xml'));
    await expect(page.getByRole('alert')).toContainText('JPEG, PNG or WebP');
    await expect(page.getByTestId('result')).toBeVisible();
    await expect(page.getByTestId('file-info')).toContainText('noise.png');
    await expect(page.getByTestId('compare')).toBeVisible();
    // the error goes away with the next real action
    await page.getByTestId('preset-10').click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('L2: a miss-drop outside the drop zone does not navigate the tab', async ({ page }) => {
    await openTool(page);
    const prevented = await page.evaluate(async () => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(4)], 'x.png', { type: 'image/png' }));
      const out: boolean[] = [];
      for (const type of ['dragover', 'drop']) {
        const ev = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt });
        document.querySelector('main')!.dispatchEvent(ev);
        out.push(ev.defaultPrevented);
      }
      return out;
    });
    expect(prevented).toEqual([true, true]);
  });

  test('L3: changing a setting during a run cancels it with a visible notice', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await page.evaluate(async () => {
      (document.querySelector('[data-testid=run]') as HTMLButtonElement).click();
      await Promise.resolve();
      (document.querySelector('[data-testid=preset-10]') as HTMLButtonElement).click();
    });
    await expect(page.getByTestId('notice')).toContainText('Settings changed, so the run was cancelled');
    await page.waitForTimeout(2000);
    await expect(page.getByTestId('result')).toHaveCount(0);
    await expect(page.getByTestId('run')).toBeEnabled();
    await expect(page.getByTestId('preset-10')).toHaveAttribute('aria-pressed', 'true');
  });

  test('L4: sizes accept units and separators, and say what is expected otherwise', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await page.getByTestId('target').fill('20 KB');
    await expect(page.getByTestId('preset-20')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('run')).toBeEnabled();
    await page.getByTestId('target').fill('1,000');
    await expect(page.getByTestId('run')).toBeEnabled();
    await page.getByTestId('target').fill('abc');
    await expect(page.getByTestId('size-picker')).toContainText('for example 20 or “20 KB”');
    await expect(page.getByTestId('run')).toBeDisabled();
    await page.getByTestId('target').fill('30kb');
    await resize(page);
    expect(await bytesOf(page)).toBeLessThanOrEqual(30_000);
    await page.getByTestId('advanced').locator('summary').click();
    await page.getByTestId('width').fill('1,200 px');
    await expect(page.getByTestId('run')).toBeEnabled();
    await page.getByTestId('width').fill('12 KB');
    await expect(page.getByTestId('advanced')).toContainText('whole number of pixels');
  });

  test('a worker that fails to load shows a friendly error with Try again, and retry works', async ({ page }) => {
    await page.route('**/_astro/*worker*.js', (r) => r.abort());
    await openTool(page);
    await pick(page, NOISE);
    await page.getByTestId('run').click();
    await expect(page.getByRole('alert')).toContainText(/try again/i, { timeout: 20_000 });
    await expect(page.getByRole('alert')).not.toContainText(/undefined|Error:/);
    await expect(page.getByTestId('retry')).toBeVisible();
    await page.unroute('**/_astro/*worker*.js');
    await page.getByTestId('retry').click();
    await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
