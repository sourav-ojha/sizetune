import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { NOISE, file, flatPng, isJpeg, openTool, pick, resize, signaturePng } from './helpers';

/** Presses Tab until the element with this data-testid has focus (fails if it takes more than `max` presses = unreachable by keyboard). */
async function tabTo(page: Page, testId: string, max = 120) {
  for (let i = 0; i < max; i++) {
    if (await page.evaluate((id) => document.activeElement?.getAttribute('data-testid') === id, testId)) return i;
    await page.keyboard.press('Tab');
  }
  throw new Error(`"${testId}" not reachable by Tab within ${max} presses`);
}

const focusVisible = (page: Page) => page.evaluate(() => {
  const el = document.activeElement as HTMLElement;
  const has = (e: Element | null) => { if (!e) return false; const c = getComputedStyle(e); return c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0; };
  return has(el) || has(el.closest('label')) || has(el.closest('summary'));
});

test.describe('keyboard only', () => {
  test('pick (file chooser opened from the keyboard) -> preset -> run -> download, without a mouse', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('preset-100').click(); // hydration barrier only (the mouse is not used afterwards)
    await page.reload();
    await expect(page.getByTestId('tool')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await tabTo(page, 'file');
    expect(await focusVisible(page), 'file chooser shows a focus ring').toBe(true);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
    await chooser.setFiles(NOISE);
    await expect(page.getByTestId('file-info')).toContainText('noise.png');
    await tabTo(page, 'preset-20');
    expect(await focusVisible(page)).toBe(true);
    await page.keyboard.press('Space');
    await expect(page.getByTestId('preset-20')).toHaveAttribute('aria-pressed', 'true');
    await tabTo(page, 'run');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('result-heading')).toBeFocused();
    await tabTo(page, 'download');
    expect(await focusVisible(page)).toBe(true);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
    expect(isJpeg(fsRead(await dl.path()))).toBe(true);
    // and back to the start with the keyboard
    await tabTo(page, 'reset');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('file')).toBeFocused();
  });

  for (const how of ['escape', 'button'] as const) {
    test(`${how === 'escape' ? 'Escape' : 'The Cancel button (by keyboard)'} cancels a run, keeps the file and settings, and leaves focus on a live control`, async ({ page }) => {
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      await page.route('**/_astro/*worker*.js', async (route) => { await gate; await route.continue(); });
      await openTool(page);
      await pick(page, NOISE);
      await page.getByTestId('preset-30').click();
      await page.getByTestId('run').click();
      await expect(page.getByTestId('progress')).toBeVisible();
      if (how === 'escape') { await page.getByTestId('cancel').focus(); await page.keyboard.press('Escape'); }
      else { await tabTo(page, 'cancel'); await page.keyboard.press('Enter'); }
      await expect(page.getByTestId('progress')).toHaveCount(0);
      await expect(page.getByTestId('run')).toBeFocused();
      await expect(page.getByTestId('file-info')).toContainText('noise.png');
      await expect(page.getByTestId('preset-30')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('alert')).toHaveCount(0);
      release();
      await page.waitForTimeout(800);
      await expect(page.getByTestId('result')).toHaveCount(0); // the cancelled run never shows up later
    });
  }

  test('crop editor by keyboard: reachable, visible focus, move + resize + typed numbers', async ({ page }) => {
    await openTool(page, '/resize-signature/');
    await pick(page, file('sig.png', signaturePng()));
    await tabTo(page, 'crop-box');
    expect(await focusVisible(page), 'crop box has a visible focus indicator').toBe(true);
    const crop = async () => ({ x: await page.getByTestId('crop-x').inputValue(), w: await page.getByTestId('crop-width').inputValue() });
    await page.getByTestId('crop-width').fill('300');
    await page.getByTestId('crop-box').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Alt+ArrowRight');
    expect(await crop()).toEqual({ x: '1', w: '301' });
    await tabTo(page, 'crop-x'); // next stop after the box is the numeric fields
    expect(await focusVisible(page)).toBe(true);
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('crop-y')).toBeFocused();
    // the box announces its geometry
    expect(await page.getByTestId('crop-box').getAttribute('aria-label')).toMatch(/Crop box: left \d+, top \d+, \d+ by \d+ pixels/);
  });

  test('every control in every state shows a focus indicator, and Tab never gets stuck', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await page.getByTestId('advanced').locator('summary').click();
    await page.getByTestId('width').fill('300');
    await page.getByTestId('height').fill('100');
    await resize(page);
    await expect(page.getByTestId('result-heading')).toBeFocused(); // wait for the automatic focus move before starting from the top
    await page.getByTestId('file').focus();
    const seen = new Set<string>();
    const missing: string[] = [];
    for (let i = 0; i < 90; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return { id: el.getAttribute('data-testid') ?? el.tagName, inTool: !!document.querySelector('[data-testid=tool]')?.contains(el) };
      });
      if (!info.inTool) break;
      seen.add(info.id);
      if (!(await focusVisible(page))) missing.push(info.id);
    }
    expect(missing, 'controls without a visible focus indicator').toEqual([]);
    expect(seen.size, [...seen].join(', ')).toBeGreaterThan(25);
    expect(await page.evaluate(() => !document.querySelector('[data-testid=tool]')!.contains(document.activeElement)), 'Tab left the tool (no trap)').toBe(true);
    // and Shift+Tab goes back in
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => document.querySelector('[data-testid=tool]')!.contains(document.activeElement))).toBe(true);
  });
});

const fsRead = (p: string) => fs.readFileSync(p);

test.describe('reduced motion', () => {
  test('nothing animates or transitions in any tool state with prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openTool(page);
    await pick(page, NOISE);
    await resize(page);
    const moving = await page.evaluate(() => [...document.querySelectorAll('*')].filter((e) => { const c = getComputedStyle(e); return parseFloat(c.transitionDuration) > 0 || (c.animationName !== 'none' && parseFloat(c.animationDuration) > 0); }).map((e) => e.tagName + '.' + String(e.className).slice(0, 40)));
    expect(moving).toEqual([]);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).not.toBe('smooth');
  });
});

for (const vp of [{ name: '320 px wide (400% zoom reflow)', width: 320, height: 640 }, { name: '640 px wide (200% zoom)', width: 640, height: 400 }]) {
  test.describe(`reflow: ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    const layout = (page: Page) => page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const clipped: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('[data-testid=tool] :is(button, a[href], input:not(.sr-only), select, summary, [role=group][tabindex], progress, img)')) {
        if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.left < -0.5 || r.right > vw + 0.5) clipped.push(`${el.getAttribute('data-testid') ?? el.tagName} [${Math.round(r.left)}..${Math.round(r.right)}] of ${vw}`);
      }
      return { overflow: document.documentElement.scrollWidth - vw, clipped };
    });
    for (const url of ['/', '/resize-signature/']) {
      test(`${url}: no horizontal scroll and no clipped controls in empty, loaded, advanced and result states`, async ({ page }) => {
        await openTool(page, url);
        const check = async (label: string) => { const l = await layout(page); expect(l.overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(0); expect(l.clipped, `${label}: clipped controls`).toEqual([]); };
        await check('empty');
        await pick(page, url === '/' ? NOISE : file('s.png', signaturePng()));
        await check('file loaded');
        await page.getByTestId('advanced').locator('summary').click();
        await check('advanced open');
        await resize(page);
        await check('result');
        if (url === '/') { await page.getByTestId('compare-slider').focus(); await check('compare'); }
      });
    }
    test('long file names and long messages wrap instead of overflowing', async ({ page }) => {
      await openTool(page);
      await pick(page, file(`${'a-very-long-photo-name-'.repeat(8)}.png`, flatPng(200, 100)));
      await page.getByTestId('advanced').locator('summary').click();
      await page.getByTestId('min-size').fill('90');
      await page.getByTestId('preset-100').click();
      await resize(page);
      const l = await layout(page);
      expect(l.overflow).toBeLessThanOrEqual(0);
      expect(l.clipped).toEqual([]);
    });
  });
}

test.describe('screen-reader semantics (accessibility tree)', () => {
  test('ok result: heading + status only; no alert; one live region; the result panel itself is not live', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await resize(page);
    const snap = await page.getByTestId('result').ariaSnapshot();
    expect(snap).toMatch(/heading "✓ Your image is ready"|heading "Your image is ready"/);
    expect(snap).toContain('link "Download');
    expect(snap).toContain('button "Process another image"');
    expect(snap).not.toMatch(/\balert\b/);
    expect(await page.getByRole('alert').count()).toBe(0);
    expect(await page.getByRole('status').count()).toBe(1);
    expect(await page.getByTestId('result').evaluate((el) => !!el.querySelector('[aria-live],[role=status],[role=alert]') || el.hasAttribute('aria-live'))).toBe(false);
    await expect(page.getByRole('status')).toContainText(/^Finished\. The result is/);
  });

  test('warnings (below_min, larger than original) are announced once, via the status region, never as alerts', async ({ page }) => {
    await openTool(page);
    await pick(page, file('tiny.png', flatPng()));
    await page.getByTestId('format-jpeg').check();
    await page.getByTestId('advanced').locator('summary').click();
    await page.getByTestId('min-size').fill('50');
    await page.getByTestId('preset-100').click();
    await resize(page);
    const snap = await page.getByTestId('result').ariaSnapshot();
    expect(snap).toContain('Minimum size not reached');
    expect(snap).toContain('link "Download anyway');
    expect(snap).not.toMatch(/link "Download:/); // no primary download for a failed target
    expect(await page.getByRole('alert').count()).toBe(0);
    await expect(page.getByRole('status')).toContainText('target was not met');
    // the status text is not the same sentence as the focused heading (no duplicate announcement of identical text)
    const heading = (await page.getByTestId('result-heading').textContent())!.replace(/^[^A-Za-z]+/, '').trim();
    expect((await page.getByRole('status').textContent())!).not.toContain(heading);
  });

  test('errors: exactly one alert, and the status region stays silent', async ({ page }) => {
    await openTool(page);
    await page.getByTestId('file').setInputFiles(file('x.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/svg+xml'));
    await expect(page.getByRole('alert')).toHaveCount(1);
    expect((await page.getByRole('status').textContent())!.trim()).toBe('');
    await pick(page, file('broken.png', flatPng(200, 200).subarray(0, 60)));
    await page.getByTestId('run').click();
    await expect(page.getByRole('alert')).toHaveCount(1, { timeout: 20_000 });
    expect((await page.getByRole('status').textContent())!.trim()).toBe('');
  });

  test('form semantics: groups have legends, toggle buttons expose pressed state, errors are tied to their fields', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await page.getByTestId('target').fill('abc');
    const snap = await page.getByTestId('tool').ariaSnapshot();
    expect(snap).toContain('group "Maximum file size"');
    expect(snap).toContain('group "Output format"');
    expect(snap).toMatch(/button "10 KB"/);
    expect(await page.getByTestId('target').getAttribute('aria-invalid')).toBe('true');
    const described = await page.getByTestId('target').getAttribute('aria-describedby');
    expect(await page.locator(`[id="${described}"]`).textContent()).toContain('Enter a size');
    for (const kb of [10, 20, 30, 50, 100, 200]) expect(await page.getByTestId(`preset-${kb}`).getAttribute('aria-pressed')).toMatch(/true|false/);
  });

  test('compare control: slider has a name, a value text, and the quick buttons expose pressed state', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await resize(page);
    const snap = await page.getByTestId('compare').ariaSnapshot();
    expect(snap).toMatch(/slider "Comparison slider/);
    expect(snap).toContain('img "Original image"');
    expect(snap).toContain('img "Result image"');
    await expect(page.getByTestId('compare-slider')).toHaveAttribute('aria-valuetext', /on the left/);
  });
});
