import { test, expect, devices } from '@playwright/test';
test.use({ ...devices['Pixel 7'], channel: 'chrome' });
test('mobile viewport: no horizontal scroll, tool usable', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByTestId('file')).toBeVisible();
});
