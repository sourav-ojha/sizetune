import { test, expect } from '@playwright/test';

// FEATURE-001 AC-1: each per-size landing page opens its tool with the page's KB limit preselected as the maximum.
// Wave 1 is capped at 5 pages (FR-5); add a row here when a page is added.
const SIZE_PAGES: Array<{ url: string; kb: string; tool: 'tool' | 'signature'; h1: RegExp }> = [
  { url: '/resize-image-to-100kb/', kb: '100', tool: 'tool', h1: /100 KB/ },
  { url: '/resize-signature-to-10kb/', kb: '10', tool: 'signature', h1: /10 KB/ },
];

for (const p of SIZE_PAGES) {
  test(`${p.url} opens the tool with ${p.kb} KB as the maximum`, async ({ page }) => {
    await page.goto(p.url);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.h1);
    await expect(page.getByTestId('target')).toHaveValue(p.kb);
    // signature tool only: guards against a signature page accidentally built on the photo tool
    await expect(page.getByTestId('signature-guidance')).toHaveCount(p.tool === 'signature' ? 1 : 0);
    await expect(page.getByRole('heading', { level: 2, name: /questions/i })).toBeVisible();
  });
}
