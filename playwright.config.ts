import { defineConfig } from '@playwright/test';
// Dedicated port (not Astro's 4321 dev port) and never reuse: tests must hit the built dist/ served by workerd.
const PORT = 8788;
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${PORT}`, channel: 'chrome' }, // system Chrome: no browser download
  webServer: {
    command: `npm run build && npx wrangler dev --port ${PORT} --ip 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
