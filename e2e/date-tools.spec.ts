import { test, expect } from '@playwright/test';

const PAGE = '/date-calculators/';

test.beforeEach(async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.getByTestId('tool')).toBeVisible();
  // The tool is server-rendered, so it is visible before the island hydrates. Input typed before then is lost; wait for hydration.
  await page.waitForFunction(() => { const i = document.querySelector('astro-island'); return !!i && !i.hasAttribute('ssr'); });
});

test('AC-1: age is exact in years, months and days, including a leap-day birth', async ({ page }) => {
  await page.getByTestId('age-dob').fill('1990-05-15');
  await page.getByTestId('age-asof').fill('2024-08-20');
  await expect(page.getByTestId('age-result')).toHaveText('34 years, 3 months, 5 days');
  await page.getByTestId('age-dob').fill('2000-02-29');
  await page.getByTestId('age-asof').fill('2023-03-01');
  await expect(page.getByTestId('age-result')).toHaveText('23 years, 0 months, 1 day');
});

test('AC-1: a birth date after the as-of date is explained, not calculated', async ({ page }) => {
  await page.getByTestId('age-dob').fill('2030-01-01');
  await page.getByTestId('age-asof').fill('2024-01-01');
  await expect(page.getByTestId('age-error')).toContainText(/after the as-of date/i);
  await expect(page.getByTestId('age-result')).toHaveCount(0);
});

test('AC-2: days between two dates agree in both orders and name the direction', async ({ page }) => {
  await page.getByTestId('days-a').fill('2024-01-01');
  await page.getByTestId('days-b').fill('2024-03-01');
  await expect(page.getByTestId('days-result')).toHaveText('60 days');
  await expect(page.getByTestId('days-note')).toContainText(/later/);
  await page.getByTestId('days-a').fill('2024-03-01');
  await page.getByTestId('days-b').fill('2024-01-01');
  await expect(page.getByTestId('days-result')).toHaveText('60 days');
  await expect(page.getByTestId('days-note')).toContainText(/earlier/);
});

test('AC-3: a timestamp follows the chosen zone and converts back to the same value', async ({ page }) => {
  await page.getByTestId('ts-in').fill('1700000000');
  await expect(page.getByTestId('ts-result')).toHaveText('2023-11-14 22:13:20');
  await page.getByTestId('ts-zone').selectOption('Asia/Kolkata');
  await expect(page.getByTestId('ts-result')).toHaveText('2023-11-15 03:43:20');
  await page.getByTestId('when-in').fill('2023-11-15T03:43:20');
  await expect(page.getByTestId('when-result')).toHaveText('1700000000');
  await page.getByTestId('ts-in').fill('1700000000000');
  await expect(page.getByTestId('ts-unit')).toContainText('milliseconds');
});

test('AC-3: unusable input shows a message, not a wrong date', async ({ page }) => {
  await page.getByTestId('ts-in').fill('12ab');
  await expect(page.getByTestId('ts-error')).toBeVisible();
  await expect(page.getByTestId('ts-result')).toHaveCount(0);
});

test('AC-4: using every calculator makes no request that carries the input', async ({ page }) => {
  const seen: string[] = [];
  page.on('request', (r) => { seen.push(`${r.method()} ${r.url()} ${r.postData() ?? ''}`); });
  await page.getByTestId('age-dob').fill('1991-11-11');
  await page.getByTestId('days-a').fill('2022-02-02');
  await page.getByTestId('days-b').fill('2022-12-12');
  await page.getByTestId('ts-in').fill('1234567890');
  await expect(page.getByTestId('ts-result')).toBeVisible();
  expect(seen.filter((s) => /1991-11-11|2022-02-02|2022-12-12|1234567890/.test(s))).toEqual([]);
  expect(seen.filter((s) => !s.includes(new URL(page.url()).origin))).toEqual([]);
});
