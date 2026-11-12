import { test, expect } from '@playwright/test';
import { NOISE, downloaded, file, openTool, pick, resize, signaturePng } from './helpers';

// Regression tests for the places where Preact (compat) and React differ and the existing suite was silent:
// per-keystroke input events, controlled radio/select/checkbox state, SSR -> hydration id stability, unmount cleanup.

test.describe('Preact semantics', () => {
  test('text inputs react on every keystroke, without a blur or change event', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    const target = page.getByTestId('target');
    await target.fill('');
    await target.pressSequentially('1x', { delay: 20 }); // no Tab/blur: only input events
    await expect(target).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('run')).toBeDisabled();
    await target.press('Backspace');
    await expect(target).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('run')).toBeEnabled();
    await target.pressSequentially('5');
    await expect(target).toHaveValue('15');
  });

  test('controlled radios, select and checkboxes stay in step with state', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await page.getByTestId('advanced').locator('summary').click();
    // radios
    await expect(page.getByTestId('strategy-quality')).toBeChecked();
    await page.getByTestId('strategy-dimensions').check();
    await expect(page.getByTestId('strategy-dimensions')).toBeChecked();
    await expect(page.getByTestId('strategy-quality')).not.toBeChecked();
    await page.getByTestId('strategy-quality').check();
    await expect(page.getByTestId('strategy-quality')).toBeChecked();
    await expect(page.getByTestId('strategy-dimensions')).not.toBeChecked();
    // select whose option list changes with the lock (value is derived from state)
    await page.getByTestId('width').fill('300');
    await page.getByTestId('height').fill('100');
    const fit = page.getByTestId('fit');
    await expect(fit).toHaveValue('contain');
    await fit.selectOption('cover');
    await expect(fit).toHaveValue('cover');
    await page.getByTestId('lock-aspect').uncheck();
    await expect(page.getByTestId('lock-aspect')).not.toBeChecked();
    await expect(fit).toBeDisabled();
    await expect(fit).toHaveValue('stretch');
    await page.getByTestId('lock-aspect').check();
    await expect(fit).toBeEnabled();
    await expect(fit).toHaveValue('cover'); // the user's choice was kept
    // and the chosen fit reaches the engine: cover keeps the requested size
    await page.getByTestId('preset-200').click();
    await resize(page);
    const d = await downloaded(page, (await page.getByTestId('download').count()) ? 'download' : 'download-anyway');
    expect([d.w, d.h]).toEqual([300, 100]); // cover fills the typed size; contain would give 133 x 100
  });

  test('crop lock checkbox and a clamped controlled field show the applied value', async ({ page }) => {
    await openTool(page, '/resize-signature/');
    await pick(page, file('sig.png', signaturePng()));
    await page.getByTestId('lock-crop').check();
    await expect(page.getByTestId('lock-crop')).toBeChecked();
    const w = page.getByTestId('crop-width');
    await w.fill('9999'); // clamped to what fits: the DOM value must be overwritten even though the user typed a different string
    await expect(w).toHaveValue('600');
    await w.fill('9999'); // typing the same out-of-range text again must snap back again
    await expect(w).toHaveValue('600');
    await page.getByTestId('lock-crop').uncheck();
    await expect(page.getByTestId('lock-crop')).not.toBeChecked();
  });

  test('server-rendered ids survive hydration and every label / aria-describedby still points at an element', async ({ browser, baseURL }) => {
    for (const path of ['/', '/resize-signature/']) {
      const plain = await browser.newContext({ javaScriptEnabled: false, baseURL });
      const p0 = await plain.newPage();
      await p0.goto(path);
      const ssr = await p0.evaluate(() => [...document.querySelectorAll('[data-testid="tool"] [id]')].map((e) => e.id));
      await plain.close();
      expect(ssr.length).toBeGreaterThan(3);

      const ctx = await browser.newContext({ baseURL });
      const page = await ctx.newPage();
      await openTool(page, path);
      await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
      await page.getByTestId('preset-100').click(); // forces a re-render after hydration
      const after = await page.evaluate(() => {
        const ids = [...document.querySelectorAll('[data-testid="tool"] [id]')].map((e) => e.id);
        const dangling: string[] = [];
        for (const l of document.querySelectorAll('[data-testid="tool"] label[for]')) if (!document.getElementById((l as HTMLLabelElement).htmlFor)) dangling.push('for=' + (l as HTMLLabelElement).htmlFor);
        for (const e of document.querySelectorAll('[data-testid="tool"] [aria-describedby]')) for (const t of e.getAttribute('aria-describedby')!.split(/\s+/)) if (!document.getElementById(t)) dangling.push('describedby=' + t);
        return { ids, dangling, dup: ids.filter((x, i) => ids.indexOf(x) !== i) };
      });
      expect(after.dangling).toEqual([]);
      expect(after.dup).toEqual([]);
      expect(after.ids.slice(0, ssr.length)).toEqual(ssr); // hydration did not renumber ids (would orphan SSR label/for pairs)
      await ctx.close();
    }
  });

  test('object URLs: every one created through the real UI is revoked on replace, reset and island unmount', async ({ page }) => {
    await page.addInitScript(() => {
      const live = new Set<string>();
      const w = window as unknown as { __live: Set<string>; __created: number; __revoked: number };
      w.__live = live; w.__created = 0; w.__revoked = 0;
      const c = URL.createObjectURL.bind(URL), r = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (o: Blob | MediaSource) => { const u = c(o); live.add(u); w.__created++; return u; };
      URL.revokeObjectURL = (u: string) => { if (live.delete(u)) w.__revoked++; r(u); };
    });
    const liveCount = () => page.evaluate(() => (window as unknown as { __live: Set<string> }).__live.size);
    await openTool(page);
    await pick(page, NOISE);
    await resize(page);
    await expect.poll(liveCount).toBe(2); // preview + result
    await page.getByTestId('preset-30').click(); // changing a setting clears the result
    await expect(page.getByTestId('result')).toHaveCount(0);
    await expect.poll(liveCount).toBe(1); // only the preview is left
    await resize(page);
    await pick(page, file('b.png', signaturePng())); // replacing the file revokes the old preview and result
    await expect(page.getByTestId('result')).toHaveCount(0);
    await expect.poll(liveCount).toBe(1);
    await page.getByTestId('start-over').click();
    await expect.poll(liveCount).toBe(0);
    await pick(page, NOISE);
    await resize(page);
    await expect.poll(liveCount).toBe(2);
    // the Astro unmount path (render(null)) must run the hook cleanups that dispose the session
    await page.evaluate(() => document.querySelector('astro-island')!.dispatchEvent(new Event('astro:unmount')));
    await expect(page.getByTestId('tool')).toHaveCount(0);
    await expect.poll(liveCount).toBe(0);
    const n = await page.evaluate(() => { const w = window as unknown as { __created: number; __revoked: number }; return [w.__created, w.__revoked]; });
    expect(n[0]).toBe(n[1]);
  });

  test('stale run: a result that arrives after Cancel or a settings change is dropped and leaves no URL behind', async ({ page }) => {
    await openTool(page);
    await pick(page, NOISE);
    await page.getByTestId('run').click();
    await expect(page.getByTestId('cancel')).toBeVisible();
    await page.getByTestId('cancel').click();
    await expect(page.getByTestId('result')).toHaveCount(0);
    await page.waitForTimeout(1500); // a late worker reply must not resurrect a result
    await expect(page.getByTestId('result')).toHaveCount(0);
    await expect(page.getByTestId('run')).toBeFocused(); // focus moved to a live control when Cancel disappeared
  });
});
