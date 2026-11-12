import { defineConfig } from '@playwright/test';

// Engine-only browser tests: no Astro build, no server. The engine is bundled with esbuild (global-setup) and served
// through context.route on a fake origin (http://engine.test), so nothing touches the network.
// Run: pnpm exec playwright test -c e2e/engine/playwright.config.ts
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  timeout: 120_000,
  workers: 1, // memory measurements need an otherwise idle browser
  reporter: [['list']],
  globalSetup: './global-setup.ts',
  use: {
    channel: 'chrome', // system Chrome: no browser download
    launchOptions: { args: ['--enable-precise-memory-info'] },
  },
});
