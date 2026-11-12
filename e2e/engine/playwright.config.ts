import { defineConfig, devices } from '@playwright/test';

// Engine-only browser tests: no Astro build, no server. The engine is bundled with esbuild (global-setup) and served
// through context.route on a fake origin (http://engine.test), so nothing touches the network.
// Run: pnpm exec playwright test -c e2e/engine/playwright.config.ts
// Cross-browser (needs the Playwright Firefox/WebKit builds): PW_ALL_BROWSERS=1 pnpm exec playwright test -c e2e/engine/playwright.config.ts
// Tests tagged @chromium-only use Chromium-only APIs (CDP process info, performance.memory) and are excluded elsewhere.
const ALL = process.env.PW_ALL_BROWSERS === '1';
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  timeout: 120_000,
  workers: 1, // memory measurements need an otherwise idle browser
  reporter: [['list']],
  globalSetup: './global-setup.ts',
  projects: [
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome', launchOptions: { args: ['--enable-precise-memory-info'] } } },
    ...(ALL ? [
      { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grepInvert: /@chromium-only/ },
      { name: 'webkit', use: { ...devices['Desktop Safari'] }, grepInvert: /@chromium-only/ },
    ] : []),
  ],
});
