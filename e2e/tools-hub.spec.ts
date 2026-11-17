import { test, expect } from '@playwright/test';
import { TOOLS } from '../src/data/tools';

// FEATURE-012 AC-1: the hub lists every published tool with a working link.
test('hub lists every tool and every link resolves', async ({ page, request }) => {
  await page.goto('/tools/');
  await expect(page.getByRole('heading', { level: 1, name: /all sizetune tools/i })).toBeVisible();
  for (const t of TOOLS) {
    const link = page.locator('main').getByRole('link', { name: new RegExp(t.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first();
    await expect(link, t.href).toHaveAttribute('href', t.href);
    expect((await request.get(t.href)).status(), t.href).toBe(200);
  }
});

// AC-2: guide block shows how-it-works, FAQ and privacy.
test('hub guide block has how it works, FAQ and privacy', async ({ page }) => {
  await page.goto('/tools/');
  const g = page.getByTestId('tool-guide');
  for (const h of [/how the tools work/i, /frequently asked/i, /^privacy$/i]) await expect(g.getByRole('heading', { level: 2, name: h })).toBeVisible();
});

// AC-3: each tool page links to at least two related tools, none of them itself.
for (const t of TOOLS) {
  test(`${t.href} shows at least two related tools`, async ({ page }) => {
    await page.goto(t.href);
    const links = page.getByTestId('related-tools').getByRole('link');
    expect(await links.count()).toBeGreaterThanOrEqual(3); // two or more tools plus "See all tools"
    expect(await page.getByTestId('related-tools').locator(`a[href="${t.href}"]`).count()).toBe(0);
  });
}

test('main navigation links to the hub', async ({ page }) => {
  await page.goto('/about/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'All tools' }).click();
  await expect(page).toHaveURL(/\/tools\/$/);
});

// AC-5: the hub is in the sitemap without a separate edit.
test('sitemap contains the hub and every listed tool', async ({ request }) => {
  const xml = await (await request.get('/sitemap-0.xml')).text();
  for (const p of ['/tools/', ...TOOLS.map((t) => t.href)]) expect(xml, p).toContain(`https://sizetune.com${p}`);
});
