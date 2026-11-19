import { test, expect } from '@playwright/test';

const FIXTURE = "The quick brown fox.  It jumped over the lazy dog!\n\nIsn't that well-known?";

test.beforeEach(async ({ page }) => {
  await page.goto('/text-tools/');
  await expect(page.getByTestId('tool')).toBeVisible();
  // Server-rendered, so visible before the island hydrates; input typed before then is lost.
  await page.waitForFunction(() => { const i = document.querySelector('astro-island'); return !!i && !i.hasAttribute('ssr'); });
});

test('AC-1: counts update live and match the fixture', async ({ page }) => {
  await expect(page.getByTestId('count-words')).toHaveText('0');
  await page.getByTestId('text-in').fill(FIXTURE);
  await expect(page.getByTestId('count-words')).toHaveText('13');
  await expect(page.getByTestId('count-chars')).toHaveText('74');
  await expect(page.getByTestId('count-nospace')).toHaveText('60');
  await expect(page.getByTestId('count-sentences')).toHaveText('3');
  await expect(page.getByTestId('count-paragraphs')).toHaveText('2');
  await page.getByTestId('text-in').fill('one two');
  await expect(page.getByTestId('count-words')).toHaveText('2');
});

test('AC-2: each case option follows its rule, accented letters included', async ({ page }) => {
  await page.getByTestId('text-in').fill('école ÉLAN. hello THERE');
  await page.getByTestId('case-upper').click();
  await expect(page.getByTestId('case-out')).toHaveValue('ÉCOLE ÉLAN. HELLO THERE');
  await page.getByTestId('case-lower').click();
  await expect(page.getByTestId('case-out')).toHaveValue('école élan. hello there');
  await page.getByTestId('case-title').click();
  await expect(page.getByTestId('case-out')).toHaveValue('École Élan. Hello There');
  await page.getByTestId('case-sentence').click();
  await expect(page.getByTestId('case-out')).toHaveValue('École élan. Hello there');
});

test('AC-3: filler text has exactly the requested words, sentences or characters', async ({ page }) => {
  await page.getByTestId('filler-amount').fill('25');
  await page.getByTestId('filler-go').click();
  await expect(page.getByTestId('filler-note')).toContainText('Generated 25 words');
  const words = (await page.getByTestId('filler-out').inputValue()).trim().split(/\s+/).length;
  expect(words).toBe(25);
  await page.getByTestId('filler-unit').selectOption('characters');
  await page.getByTestId('filler-amount').fill('120');
  await page.getByTestId('filler-go').click();
  expect([...(await page.getByTestId('filler-out').inputValue())].length).toBe(120);
  await page.getByTestId('filler-unit').selectOption('sentences');
  await page.getByTestId('filler-amount').fill('4');
  await page.getByTestId('filler-go').click();
  expect((await page.getByTestId('filler-out').inputValue()).match(/\./g)?.length).toBe(4);
});

test('AC-3: an invalid amount is explained, and a huge one is shortened', async ({ page }) => {
  await page.getByTestId('filler-amount').fill('0');
  await page.getByTestId('filler-go').click();
  await expect(page.getByTestId('filler-note')).toContainText(/whole number/);
  await page.getByTestId('filler-amount').fill('99999999');
  await page.getByTestId('filler-go').click();
  await expect(page.getByTestId('filler-note')).toContainText('Shortened to the limit of 5,000 words');
});

test('AC-4: using every tool makes no request that carries the text', async ({ page }) => {
  const seen: string[] = [];
  page.on('request', (r) => { seen.push(`${r.method()} ${r.url()} ${r.postData() ?? ''}`); });
  await page.getByTestId('text-in').fill('secret-sentence-xyz');
  await page.getByTestId('case-upper').click();
  await page.getByTestId('filler-go').click();
  await expect(page.getByTestId('case-out')).toHaveValue('SECRET-SENTENCE-XYZ');
  expect(seen.filter((s) => /secret-sentence-xyz/i.test(s))).toEqual([]);
  expect(seen.filter((s) => !s.includes(new URL(page.url()).origin))).toEqual([]);
});
