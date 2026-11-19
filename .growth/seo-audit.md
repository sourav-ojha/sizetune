# Technical SEO and product audit

<!-- Owned by the audit phase (product-seo-auditor). -->

## Summary
- Site is live and crawlable: 38 URLs in the sitemap, `robots.txt` allows all, repo matches live. [E: fact; high; S-035; 2026-11-19]
- No analytics, no consent tool, no `ads.txt`, no contact page: nothing can be measured and AdSense is not ready. [E: fact; high; S-036; 2026-11-19]
- Preset pages (20/50/100 KB, signature 10 KB) are close variants of one tool; thin/doorway risk. [E: inference; medium; S-041; 2026-11-19]
- Internal links from tool pages to specific guides are uneven; one guide is an orphan candidate. [E: fact; medium; S-037; 2026-11-19]
- Index status, rankings and traffic are unknown: the site is about 2 days old and Search Console has no data. [E: unknown; high; search:Search Console has no data yet; 2026-11-19]

## Page inventory
| Type | Count | Notes |
|---|---|---|
| tool | 27 (home resizer + 26 slug pages) | 20/50/100 KB and signature-10 KB pages are presets of one tool |
| guide | 5 + hub | 363 to 1,767 words each, about 4,400 words total [E: fact; high; S-040; 2026-11-19] |
| trust (about, privacy, terms) | 3 | Rendered text of about 440, 1,460 and 900 words [E: fact; high; S-038; 2026-11-19] |
| other | /tools/ hub | Lists the tools |

## Indexability
- `robots.txt` is `Allow: /` plus a Sitemap line. [E: fact; high; S-034; 2026-11-19]
- `sitemap-index.xml` points to one `sitemap-0.xml` listing all 38 pages; no `lastmod`. [E: fact; medium; S-035; 2026-11-19]
- Unknown URLs return a true 404, including `/contact/` and `/ads.txt`. [E: fact; high; S-039; 2026-11-19]
- Index count and status: unknown; the Search Console Pages export would answer it. [E: unknown; high; search:no Search Console data; 2026-11-19]
- `SEO_ARCHITECTURE.md` still says preset pages are held back and og:image is missing; both are live now, so the doc is stale. [E: fact; high; S-041; 2026-11-19]

## Metadata and structured data
- Home: `WebApplication` + `WebSite`; tool pages: `WebApplication`, `Offer`, `BreadcrumbList`; guides: `Article` (author is an `Organization`) and `BreadcrumbList`; about: `BreadcrumbList` only. [E: fact; high; S-042; 2026-11-19]
- FAQPage and rating markup are blocked by `verify:html` by design. [E: fact; high; S-044; 2026-11-19]
- `og:image` present. Per-page titles, H1s and canonicals across all 38 URLs were not checked (see Not verified). [E: fact; medium; S-036; 2026-11-19]

## Internal linking
- Tool pages carry a 4-link related-tools block. [E: fact; high; S-043; 2026-11-19]
- The live 50 KB page links only to the `/guides/` hub, not to a specific guide; about 24 tool pages have no specific guide link in their page file (shared components not fully read). [E: fact; medium; S-037; 2026-11-19]
- `reduce-pdf-to-200kb` guide has only guide-to-guide inbound links. [E: fact; medium; S-040; 2026-11-19]
- Nav and footer surface about 10 of 27 tools; the rest rely on `/tools/` and related blocks. [E: fact; high; S-043; 2026-11-19]

## Analytics and consent
- No GA4, GTM, AdSense, Cloudflare analytics tag or consent code in live HTML or `src`. [E: fact; high; S-036; 2026-11-19]
- Privacy copy says no ads or analytics today and promises a policy update and consent tool before ads start; this matches the baseline. [E: fact; high; S-038; 2026-11-19]
- No tool-usage events (start, success, error, download) exist. [E: fact; high; S-036; 2026-11-19]
- `/ads.txt` and `/contact/` return 404; a contact email appears on about, privacy and terms. [E: fact; high; S-039; 2026-11-19]

## Gaps
1. No usage analytics or tool funnel events: without it, success and download rates are unknowable. Fix: privacy-preserving counts after the privacy copy update. [E: fact; high; S-036; 2026-11-19] Effort M.
2. AdSense readiness unmet: thin content volume, no consent tool, no contact page, tool pages mostly presets. Approval outcome is unknown. [E: inference; medium; S-040; 2026-11-19] Effort L.
3. Guide links from tool pages are uneven; add a guide link per tool family and link the orphan guide. [E: fact; medium; S-037; 2026-11-19] Effort S.
4. Preset pages are near-duplicates; add unique content per page (spec matrix, FAQ, examples) or fold into one parameterized hub. [E: inference; medium; S-041; 2026-11-19] Effort M.
5. Guides name an Organization author, no `lastmod` in the sitemap; use real authorship where true. [E: fact; high; S-042; 2026-11-19] Effort S.
6. `SEO_ARCHITECTURE.md` is stale (preset hold-back, og:image). [E: fact; high; S-041; 2026-11-19] Effort S.
7. English only; no hreflang, while other languages are in scope. [E: fact; high; S-042; 2026-11-19] Effort L.

## Not verified
- Index status, impressions, queries, rankings: need a Search Console export (about 4 weeks of data).
- Page-level titles, H1s, canonicals, JSON-LD validity and Core Web Vitals for all 38 routes: run the experience-audit skill (priority routes: `/`, `/resize-image-to-50kb/`, `/png-to-jpg/`, `/signature-maker/`, `/text-tools/`, `/guides/reduce-pdf-to-200kb/`, `/guides/social-image-sizes/`, `/about/`, `/privacy/`, `/terms/`).
- Whether `verify:html` passes today (no `dist/`, not run).
- Whether `ToolGuide` and social components add guide links not visible in page files.
- Search Console DNS verification itself (no meta tag, cannot confirm).
