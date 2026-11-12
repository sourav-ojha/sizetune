// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Static output (Astro default): every page is pre-rendered to HTML at build time.
// No adapter on purpose: Cloudflare serves ./dist as static assets.
export default defineConfig({
  site: 'https://sizetune.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  markdown: { syntaxHighlight: false }, // Shiki emits inline styles that break CSP; no code samples needed yet
  integrations: [react(), mdx(), sitemap()],
  // Built-in CSP (static output => <meta http-equiv> per page with computed script/style hashes). Tool pages load NO third-party origins.
  // frame-ancestors can't be set via meta: see public/_headers. Ads policy: docs/reviews/security-privacy-review.md (ad-free tool routes).
  security: {
    csp: {
      directives: [
        "default-src 'self'", "img-src 'self' blob: data:", "connect-src 'self'", "worker-src 'self'", "font-src 'self'",
        "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-src 'none'", "manifest-src 'self'",
      ],
    },
  },
  vite: { plugins: [tailwindcss()] },
});
