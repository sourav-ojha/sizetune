import { test, expect, type Page } from '@playwright/test';
import { watchNetwork } from './ui/helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/kb-mb-size-converter/');
  await expect(page.getByTestId('tool').first()).toBeVisible();
  // Server-rendered, so visible before the island hydrates; typing before then is lost.
  await page.waitForFunction(() => { const i = document.querySelector('astro-island'); return !!i && !i.hasAttribute('ssr'); });
});

const type = async (page: Page, text: string) => { await page.getByTestId('amount').fill(text); };

test('AC-1: 2 MB shows 2,000 KB and 2,048 KB with the conventions labelled', async ({ page }) => {
  await type(page, '2');
  await page.getByTestId('from').selectOption('MB');
  await page.getByTestId('to').selectOption('KB');
  await expect(page.getByTestId('decimal-value')).toHaveText('2,000 KB');
  await expect(page.getByTestId('binary-value')).toHaveText('2,048 KB');
  await expect(page.getByTestId('decimal')).toContainText('1 KB = 1,000 bytes');
  await expect(page.getByTestId('binary')).toContainText('1 KB = 1,024 bytes');
  await expect(page.getByTestId('decimal')).toContainText('2,000,000 bytes');
  await expect(page.getByTestId('binary')).toContainText('2,097,152 bytes');
});

test('the page opens with the 2 MB example already worked out', async ({ page }) => {
  await expect(page.getByTestId('decimal-value')).toHaveText('2,000 KB');
});

test('changing a unit or the number updates both answers', async ({ page }) => {
  await page.getByTestId('from').selectOption('GB');
  await page.getByTestId('to').selectOption('MB');
  await expect(page.getByTestId('decimal-value')).toHaveText('2,000 MB');
  await expect(page.getByTestId('binary-value')).toHaveText('2,048 MB');
  await type(page, '0.1');
  await page.getByTestId('from').selectOption('MB');
  await page.getByTestId('to').selectOption('KB');
  await expect(page.getByTestId('decimal-value')).toHaveText('100 KB'); // no 100.00000000000001
  await expect(page.getByTestId('binary-value')).toHaveText('102.4 KB');
});

test('empty input shows no result and no error; invalid input shows one inline message', async ({ page }) => {
  await type(page, '');
  await expect(page.getByTestId('decimal')).toHaveCount(0);
  await expect(page.getByTestId('error')).toHaveCount(0);
  for (const bad of ['-5', 'abc', '1e3', '2,5']) {
    await type(page, bad);
    await expect(page.getByTestId('error'), bad).toBeVisible();
    await expect(page.getByTestId('decimal'), bad).toHaveCount(0);
    await expect(page.getByTestId('amount')).toHaveAttribute('aria-invalid', 'true');
  }
  await type(page, '1,500');
  await expect(page.getByTestId('error')).toHaveCount(0);
  await expect(page.getByTestId('decimal-value')).toHaveText('1,500,000 KB'); // 1,500 MB
});

test('a very large size is refused with a message, not shown wrong', async ({ page }) => {
  await page.getByTestId('from').selectOption('GB');
  await page.getByTestId('to').selectOption('B');
  await type(page, '99999999999');
  await expect(page.getByTestId('error')).toContainText('too large');
  await expect(page.getByTestId('decimal')).toHaveCount(0);
  await type(page, '1000');
  await expect(page.getByTestId('decimal-value')).toHaveText('1,000,000,000,000 B');
  await expect(page.getByTestId('binary-value')).toHaveText('1,073,741,824,000 B');
});

test('AC-2: the resizer link opens the resizer with the KB target set', async ({ page }) => {
  await type(page, '2');
  const link = page.getByTestId('resizer-link');
  await expect(link).toHaveAttribute('href', '/?max=2000');
  await link.click();
  await expect(page).toHaveURL(/\/\?max=2000$/);
  await page.waitForFunction(() => { const i = document.querySelector('astro-island'); return !!i && !i.hasAttribute('ssr'); });
  await expect(page.getByTestId('target')).toHaveValue('2000');
});

test('no resizer link for under 1 KB or an enormous limit', async ({ page }) => {
  await page.getByTestId('from').selectOption('B');
  await type(page, '500');
  await expect(page.getByTestId('decimal-value')).toBeVisible();
  await expect(page.getByTestId('resizer-link')).toHaveCount(0);
  await page.getByTestId('from').selectOption('GB');
  await type(page, '5');
  await expect(page.getByTestId('resizer-link')).toHaveCount(0);
});

test('nothing is requested or posted while converting', async ({ page, baseURL }) => {
  const net = watchNetwork(page, baseURL!);
  await type(page, '7.25');
  await page.getByTestId('from').selectOption('KB');
  await expect(page.getByTestId('decimal-value')).toBeVisible();
  expect(net.external).toEqual([]);
  expect(net.nonGet).toEqual([]);
});
