import { test, expect, type Page } from '@playwright/test';
import { tab, NOISE, openTool, pick, resize } from './helpers';

/** Simple DOM accessibility assertions (no axe dependency). */
async function audit(page: Page) {
  return page.evaluate(() => {
    const issues: string[] = [];
    const tool = document.querySelector('[data-testid=tool]')!;
    const name = (el: Element) => {
      const h = el as HTMLElement & { labels?: NodeListOf<HTMLLabelElement> };
      if (h.getAttribute('aria-label')?.trim()) return true;
      const by = h.getAttribute('aria-labelledby');
      if (by && by.split(' ').some((id) => document.getElementById(id)?.textContent?.trim())) return true;
      if (h.labels && h.labels.length && [...h.labels].some((l) => l.textContent?.trim())) return true;
      if (['BUTTON', 'A', 'SUMMARY'].includes(el.tagName) && el.textContent?.trim()) return true;
      return false;
    };
    for (const el of tool.querySelectorAll('input, select, textarea, button, a[href], progress, summary')) {
      if (!name(el)) issues.push(`no accessible name: <${el.tagName.toLowerCase()} data-testid=${el.getAttribute('data-testid')}>`);
    }
    for (const img of tool.querySelectorAll('img')) if (!img.hasAttribute('alt')) issues.push('img without alt');
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
    for (const id of new Set(ids.filter((i, n) => ids.indexOf(i) !== n))) issues.push(`duplicate id ${id}`);
    if (!tool.querySelector('[aria-live]')) issues.push('no aria-live region');
    for (const fs of tool.querySelectorAll('fieldset')) if (!fs.querySelector(':scope > legend')) issues.push('fieldset without legend');
    for (const r of tool.querySelectorAll<HTMLInputElement>('input[type=radio]')) if (!r.name) issues.push('radio without name');
    // (style attributes set through the CSSOM are allowed by CSP; SSR'd inline styles are caught by scripts/verify-html.mjs)
    for (const a of document.querySelectorAll('*')) for (const at of a.getAttributeNames()) if (at.startsWith('on')) issues.push('inline handler ' + at);
    const small = [...tool.querySelectorAll<HTMLElement>('button, a[href], select, input:not([type=radio]):not([type=checkbox]):not([type=range]):not([type=file]):not([type=color])')]
      .filter((e) => e.offsetParent && e.getBoundingClientRect().height < 43.5 && e.getBoundingClientRect().height > 0)
      .map((e) => `${e.getAttribute('data-testid') ?? e.tagName} ${Math.round(e.getBoundingClientRect().height)}px`);
    if (small.length) issues.push('targets under 44px: ' + small.join(', '));
    return issues;
  });
}

for (const url of ['/', '/resize-signature/']) {
  test(`a11y: ${url} in empty, ready and result states`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(url);
    await expect(page.getByTestId('tool')).toBeVisible();
    expect(await audit(page), 'empty').toEqual([]);
    await openTool(page, url);
    await pick(page, NOISE);
    await page.getByTestId('advanced').locator('summary').click();
    expect(await audit(page), 'ready').toEqual([]);
    await resize(page);
    expect(await audit(page), 'result').toEqual([]);
  });
}

test('keyboard-only main flow and focus management', async ({ page }) => {
  await openTool(page);
  await pick(page, NOISE);
  await page.getByTestId('preset-20').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('preset-20')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('run').focus();
  await expect(page.getByTestId('run')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('result-heading')).toBeFocused();
  await expect(page.getByTestId('status')).toContainText(/Finished/);
  // Tab reaches the download link, then Enter on Reset returns focus to the file chooser
  await tab(page);
  await page.getByTestId('reset').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('file')).toBeFocused();
});

test('no keyboard trap: Tab eventually leaves the tool', async ({ page }) => {
  await openTool(page);
  await pick(page, NOISE);
  await page.getByTestId('file').focus();
  let left = false;
  for (let i = 0; i < 80 && !left; i++) {
    await tab(page);
    left = await page.evaluate(() => !document.querySelector('[data-testid=tool]')!.contains(document.activeElement));
  }
  expect(left).toBe(true);
});

test('focus ring is visible on the file chooser and on buttons', async ({ page }) => {
  await openTool(page);
  await tab(page);
  await page.getByTestId('file').focus();
  const outline = await page.getByTestId('file').locator('xpath=..').evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.getByTestId('preset-50').focus();
  await tab(page, true);
  await tab(page);
  expect(await page.getByTestId('preset-50').evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
});

test('reduced motion: nothing animates', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTool(page);
  const anim = await page.evaluate(() => [...document.querySelectorAll('[data-testid=tool] *')].filter((e) => parseFloat(getComputedStyle(e).transitionDuration) > 0 || getComputedStyle(e).animationName !== 'none').length);
  expect(anim).toBe(0);
});
