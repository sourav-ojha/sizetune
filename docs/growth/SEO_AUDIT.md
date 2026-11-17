# SEO audit — SizeTune

Audited 2026-11-17 on branch `claude/sizetune-growth-seo-strategy-95959f` (base `e1a5c57`). Method: read source, built `dist/`, ran `pnpm run verify:html` (+ `:strict`), `pnpm test`. Nothing here comes from Search Console: the site has no traffic data yet, so every status below is a **static-build** finding, not a ranking finding.

## Summary
Technical SEO foundation is already strong (static HTML, canonical, sitemap, OG, CSP, 844 tests, build gates). The audit found **gaps in structure and coverage, not in basics**. Most upside is content/landing-page coverage and distribution (see `LANDING_PAGE_STRATEGY.md`, `GROWTH_BACKLOG.md`).

## Checklist
| Area | Status | Evidence / note |
|---|---|---|
| Rendering / indexability | PASS | `output: static`, directory format; tool markup SSR'd; `verify:html` checks H1, words in `<main>`, noscript. |
| robots.txt | PASS | `Allow: /` + sitemap line; `/_astro/` not blocked. Same file on workers.dev; those hosts get `X-Robots-Tag: noindex` via `_headers`. |
| Sitemap | PASS | `sitemap-index.xml` + `sitemap-0.xml`, 404 excluded, 24 URLs after this change. No `lastmod` (deliberate: Google ignores untrusted dates; add only when real per-page dates exist). |
| Canonical | PASS | One per indexable page, absolute, trailing slash; noindex pages emit none. |
| Titles / descriptions | PASS | Unique, ≤60 / 70-160 chars, build-gated. |
| Open Graph / Twitter | PASS | `og:image` 1200×630 present on every page. Single shared image (see P2: per-tool OG images). |
| Structured data | IMPROVED | Was: `WebApplication` on tools, `Article` on guides. **Added:** `BreadcrumbList` on every non-home page, `WebSite`+publisher on home. FAQPage deliberately absent (Google restricted FAQ rich results to a few authoritative sites (2023); build gate rejects it). No ratings/reviews (none exist). |
| Breadcrumbs | FIXED | None existed. Added visible `<nav aria-label="Breadcrumb">` + JSON-LD (Home > All tools > tool; Home > Guides > guide). |
| Internal linking | IMPROVED | Header nav, footer, hub `/tools/`, `RelatedTools` block, per-page prose links existed. **Gap fixed:** `/guides/` did not exist (nav "Guides" pointed at one article; breadcrumb parent would 404). Added `/guides/` hub, linked from nav + footer. |
| URL structure | PASS | Flat, hyphenated, keyword-bearing, trailing slash. Convention for future pages: `/<verb>-<object>-<qualifier>/`. |
| Redirects / broken links | PASS in repo | `verify:html` fails on non-canonical/broken internal links. Cloudflare serves 307 for missing-slash; internal links already canonical. **Human:** `www` → apex 301 rule (CLOUDFLARE_DEPLOYMENT H5). |
| Core Web Vitals | UNMEASURED | Lab-only so far. Largest tool JS ≈22 KB gz (ImageTool) + shared chunks; compressor worker loads on demand. No fonts/third-party blocking. Measure with PageSpeed Insights/CrUX after launch. Risk later: AdSense (reserve slot heights). |
| Mobile | PASS (tests) | `e2e/mobile.spec.ts`, 44px tap targets, axe tests. Breadcrumb links use `min-h-11`. |
| Image optimisation | PASS | No `<img>` on pages (SVG logo inline); OG png only. |
| Duplicate / thin content | WATCH | Jaccard gate (≤0.35 between same-type pages) and unique-word floors enforced. Risk is the planned KB-page family: see doorway rules in `LANDING_PAGE_STRATEGY.md`. |
| Security headers / CSP | PASS | Strict hash CSP, no third-party origins. Constraint for analytics/ads: every vendor origin needs a CSP change (see `90_DAY_GROWTH_PLAN.md`). |
| ads.txt | MISSING (expected) | Needs real AdSense publisher ID — human. Do not ship a placeholder. |
| Analytics | NONE | By design so far. Plan in `90_DAY_GROWTH_PLAN.md` §Measurement. |
| Search Console / Bing | NOT SET UP | Human step; DNS TXT recommended. |

## Changes made in this branch
1. `src/pages/_seo.ts`: `breadcrumbTrail`, `breadcrumbLd`, `websiteLd`.
2. `src/layouts/Base.astro`: visible breadcrumbs, JSON-LD array support, nav/footer "Guides" → `/guides/`.
3. `src/pages/guides/index.astro`: new guides hub (auto-lists the content collection).
4. `src/pages/index.astro`: adds `WebSite` JSON-LD.
5. `tests/seo-breadcrumbs.test.ts`; `tests/verify-html.test.ts` orphan-test made robust to pages with no in-`<main>` privacy link.

## Open issues (not fixed here, with reason)
| # | Issue | Why not fixed | Owner |
|---|---|---|---|
| A1 | `/resize-image-to-50kb/` was missing | DONE in this branch. A separate `/resize-signature-to-20kb/` was rejected: `/resize-signature/` already defaults to 20 KB, so it would duplicate it; that page was retitled instead | agent |
| A2 | Search Console / Bing not verified | Account action | human |
| A3 | `ads.txt` | Needs AdSense publisher ID | human |
| A4 | `www` redirect, HSTS | Cloudflare dashboard | human |
| A5 | Analytics beacon | Needs CSP change + privacy-copy decision | human decision |
| A6 | Core Web Vitals field data | No traffic yet | after launch |
| A7 | Per-page OG images | Design asset; low priority | later |
