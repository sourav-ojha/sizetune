import { defineConfig, devices } from '@playwright/test';
// Dedicated port (not Astro's 4321 dev port) and never reuse: tests must hit the built dist/ served by workerd.
const PORT = 8788;
// Default: system Google Chrome only (no browser downloads).
// Firefox + WebKit projects are OPT-IN: they need `npx playwright install firefox webkit` (a download the owner must approve),
// then `PW_ALL_BROWSERS=1 npx playwright test`. Chrome-only CDP assertions are tagged @chromium-only and skipped there.
const ALL = process.env.PW_ALL_BROWSERS === '1';
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  projects: [
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    ...(ALL ? [
      { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grepInvert: /@chromium-only/ },
      { name: 'webkit', use: { ...devices['Desktop Safari'] }, grepInvert: /@chromium-only/ },
    ] : []),
  ],
  webServer: {
    command: `npm run build && npx wrangler dev --port ${PORT} --ip 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
