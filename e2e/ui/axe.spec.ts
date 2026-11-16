import { test, expect, type Page } from '@playwright/test';
import { NOISE, bombPng, unreadablePng, file, flatPng, openTool, pick, resize, signaturePng, transparentPng } from './helpers';
import { format, runAxe, unexpected } from './axe-helper';

/** Fails on ANY axe violation (all impacts) not in the justified ALLOW list (e2e/ui/axe-helper.ts). */
async function expectClean(page: Page, label: string) {
  const bad = unexpected(await runAxe(page));
  expect(bad, `${label}\n${format(bad)}`).toEqual([]);
}

const PAGES = ['/', '/resize-image-to-20kb/', '/resize-signature/', '/guides/photo-size-for-online-forms/', '/privacy/', '/about/', '/terms/', '/definitely-missing/'];
const VIEWPORTS = [{ name: 'desktop', width: 1280, height: 800 }, { name: 'mobile 375', width: 375, height: 800 }];

for (const vp of VIEWPORTS) {
  test.describe(`axe: launch pages, ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const url of PAGES) {
      test(url, async ({ page }) => {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        await expectClean(page, `${url} @${vp.name}`);
      });
    }
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`axe: image tool states, ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('initial, file loaded, Advanced open', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('tool')).toBeVisible();
      await expectClean(page, 'initial');
      await openTool(page);
      await pick(page, NOISE);
      await expectClean(page, 'file loaded');
      await page.getByTestId('advanced').locator('summary').click();
      await page.getByTestId('width').fill('300');
      await page.getByTestId('height').fill('100'); // shows the Fit select
      await page.getByTestId('min-size').fill('5');
      await expectClean(page, 'advanced open (min, dimensions, fit)');
      await page.getByTestId('lock-aspect').uncheck();
      await expectClean(page, 'advanced open, aspect lock off');
    });

    test('invalid input (field errors)', async ({ page }) => {
      await openTool(page);
      await pick(page, NOISE);
      await page.getByTestId('target').fill('abc');
      await page.getByTestId('advanced').locator('summary').click();
      await page.getByTestId('width').fill('x');
      await expectClean(page, 'field errors');
    });

    test('processing (progress + Cancel)', async ({ page }) => {
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      await page.route('**/_astro/*worker*.js', async (route) => { await gate; await route.continue(); });
      await openTool(page);
      await pick(page, NOISE);
      await page.getByTestId('run').click();
      await expect(page.getByTestId('progress')).toBeVisible();
      await expectClean(page, 'processing');
      release();
      await expect(page.getByTestId('result')).toBeVisible({ timeout: 30_000 });
    });

    test('ok result with before/after compare', async ({ page }) => {
      await openTool(page);
      await pick(page, NOISE);
      await resize(page);
      await expect(page.getByTestId('result')).toHaveAttribute('data-status', 'ok');
      await expectClean(page, 'ok result');
      await page.getByTestId('compare-slider').focus();
      await page.keyboard.press('End');
      await expectClean(page, 'compare, original shown');
    });

    test('below_min warning', async ({ page }) => {
      await openTool(page);
      await pick(page, file('tiny.png', flatPng()));
      await page.getByTestId('format-jpeg').check();
      await page.getByTestId('advanced').locator('summary').click();
      await page.getByTestId('min-size').fill('50');
      await page.getByTestId('preset-100').click();
      await resize(page);
      await expect(page.getByTestId('result')).toHaveAttribute('data-status', 'below_min');
      await expectClean(page, 'below_min');
    });

    test('larger-than-original warning', async ({ page }) => {
      await openTool(page);
      await pick(page, file('tiny.png', flatPng()));
      await page.getByTestId('preset-200').click();
      await resize(page);
      await expect(page.getByTestId('larger-note')).toBeVisible();
      await expectClean(page, 'larger than original');
    });

    test('error alert (unsupported file) and run error (damaged)', async ({ page }) => {
      await page.route('**/_astro/*worker*.js', (r) => r.abort()); // run-time failure reproducible in every browser
      await openTool(page);
      await page.getByTestId('file').setInputFiles(file('x.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/svg+xml'));
      await expect(page.getByRole('alert')).toBeVisible();
      await expectClean(page, 'unsupported file alert');
      await page.getByTestId('file').setInputFiles(file('broken.png', flatPng(200, 200).subarray(0, 60)));
      await expect(page.getByRole('alert')).toContainText(/incomplete or damaged/);
      await expectClean(page, 'truncated file alert');
      await pick(page, file('ok.png', flatPng(100, 100)));
      await page.getByTestId('run').click();
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 20_000 });
      await expectClean(page, 'run error');
    });

    test('transparency: note, JPEG fill choice, custom colour', async ({ page }) => {
      await openTool(page);
      await pick(page, file('logo.png', transparentPng()));
      await expect(page.getByTestId('alpha-note')).toBeVisible();
      await expectClean(page, 'transparency note');
      await page.getByTestId('format-jpeg').check();
      await expect(page.getByTestId('flatten-choice')).toBeVisible();
      await expectClean(page, 'JPEG fill choice');
      await page.getByTestId('bg-custom').check();
      await expectClean(page, 'custom fill colour');
      await resize(page);
      await expectClean(page, 'flattened result with notes');
    });

    test('opaque PNG default-JPEG note', async ({ page }) => {
      await openTool(page);
      await pick(page, NOISE);
      await expect(page.getByTestId('default-format-note')).toBeVisible();
      await expectClean(page, 'default JPEG note');
    });
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`axe: signature tool, ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    test('crop editor, auto-trim status, result on white', async ({ page }) => {
      await openTool(page, '/resize-signature/');
      await expectClean(page, 'signature initial');
      await pick(page, file('sig.png', signaturePng()));
      await expectClean(page, 'crop editor');
      await page.getByTestId('auto-trim').click();
      await expectClean(page, 'after auto-trim');
      await resize(page);
      await expectClean(page, 'signature result');
    });
  });
}

test('axe harness self-test: it really detects missing names, missing alt, low contrast and tiny targets', async ({ page }) => {
  await page.goto('/privacy/');
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.innerHTML = '<button id="t-empty"></button><img id="t-img" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" /><p id="t-low">Low contrast text sample</p><a id="t-tiny" href="#x">.</a>';
    document.body.prepend(d);
    const p = document.getElementById('t-low')!; p.style.color = '#bbbbbb'; p.style.background = '#ffffff';
    const a = document.getElementById('t-tiny')!; a.style.display = 'inline-block'; a.style.width = '10px'; a.style.height = '10px'; a.style.fontSize = '8px';
  });
  const ids = (await runAxe(page)).map((v) => v.id);
  for (const id of ['button-name', 'image-alt', 'color-contrast', 'target-size']) expect(ids, `axe must report ${id}`).toContain(id);
});
