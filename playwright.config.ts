import { defineConfig, devices } from '@playwright/test';
// Dedicated port (not Astro's 4321 dev port) and never reuse: tests must hit the built dist/ served by workerd.
const PORT = Number(process.env.PW_PORT ?? 8788); // override with PW_PORT when 8788 is taken
// Default: system Google Chrome only (no browser downloads).
// Firefox + WebKit projects are OPT-IN: they need `pnpm exec playwright install firefox webkit` (a download the owner must approve),
// then `PW_ALL_BROWSERS=1 pnpm exec playwright test`. Chrome-only CDP assertions are tagged @chromium-only and skipped there.
const ALL = process.env.PW_ALL_BROWSERS === '1';
// PW_NO_BUILD=1 skips the build step (dist/ must already be built); for fast local iteration only. PW_PORT overrides the port.
const BUILD = process.env.PW_NO_BUILD === '1' ? '' : 'pnpm run build && ';
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  projects: [
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    ...(ALL ? [
      // One CI retry for Firefox only: its content process has crashed inside axe.run ("Page crashed") on a different test
      // in several CI runs (never locally, 222/222 passes). A real regression fails twice and still fails; a one-off crash is
      // reported as "flaky" in the run output instead of blocking the deploy. Chrome and WebKit get no retries.
      { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grepInvert: /@chromium-only/, retries: process.env.CI ? 1 : 0 },
      { name: 'webkit', use: { ...devices['Desktop Safari'] }, grepInvert: /@chromium-only/ },
    ] : []),
  ],
  webServer: {
    command: `${BUILD}pnpm exec wrangler dev --port ${PORT} --ip 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
