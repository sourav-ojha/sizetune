# Growth backlog

Priority: P0 critical (index/meta/technical) · P1 high (high-intent pages, linking, CWV, Search Console) · P2 medium (content, programmatic expansion, backlinks, social) · P3 later. Status: DONE (in this branch) · HUMAN (needs owner account/decision) · READY · GATED (waits for data) · LATER.
Effort S ≤½ day, M ≤2 days, L >2 days. Evidence labels as in the other growth docs.

| ID | P | Item | Status | Effort | Evidence / acceptance criteria |
|---|---|---|---|---|---|
| G-01 | P0 | Breadcrumbs (visible + `BreadcrumbList`) on all non-home pages | DONE | S | `tests/seo-breadcrumbs.test.ts`; JSON-LD present in `dist/**`; `verify:html` OK |
| G-02 | P0 | `/guides/` hub (nav + footer + breadcrumb parent were dangling) | DONE | S | Page builds, lists every guide, in sitemap, `verify:html:strict` OK |
| G-03 | P0 | `WebSite` + publisher JSON-LD on home | DONE | S | no SearchAction/rating (gate rejects ratings) |
| G-04 | P0 | Search Console Domain property + sitemap submit | HUMAN | S | `90_DAY_GROWTH_PLAN.md` 0.1; AC: sitemap status "Success", pages discovered = 24 |
| G-05 | P0 | `www`→apex 301, Always HTTPS | HUMAN | S | CLOUDFLARE_DEPLOYMENT H5 |
| G-06 | P1 | `/resize-image-to-50kb/` (distinct copy: portrait vs document vs signature; two strategies; range forms; counting) | DONE | M | `e2e/size-pages.spec.ts` row; unique-word gate passes STRICT=1; FEATURE-001 cap (5 wave-1 pages) now 4/5 used (20, 50, 100, sig-10) + `/resize-signature/` 20 KB by default |
| G-07 | P1 | `/resize-signature/` retitled to target "signature 20 KB" (it already defaults to 20 KB; a separate `/resize-signature-to-20kb/` would be a near-duplicate doorway) | DONE | S | title/H1/description changed; no new URL |
| G-08 | P1 | Bing import + IndexNow key | HUMAN/READY | S | plan 0.2/0.3 |
| G-09 | P1 | Verified exam spec table (SSC, UPSC, IBPS, SBI, NEET, JEE, passport, PAN) with official source URL + "last verified" date | READY (blocked on source verification) | M | see `LANDING_PAGE_STRATEGY.md` §Exam pages; AC: every number links to a primary page |
| G-10 | P1 | Exam-specific pages (max 3 at first) | GATED on G-09 + 4 weeks GSC | M each | only for exams whose spec is verified AND query seen in GSC |
| G-11 | P1 | Core Web Vitals baseline via PageSpeed Insights on 5 pages | HUMAN/after deploy | S | LCP<2.5 s, CLS<0.1, INP<200 ms targets (SEO_ARCHITECTURE §7) |
| G-12 | P1 | Guide #1 "Photo rejected: why portals say file too large" (CONTENT_ROADMAP A) | READY | M | links to 20/50/100 KB pages + checker |
| G-13 | P1 | Internal links: every guide links to ≥2 tools; every tool page links to its guide | READY | S | extend `RelatedTools` to guides; test in `tools-data.test.ts` |
| G-14 | P2 | Guide #2 "JPG vs PNG vs WebP for forms and websites" | READY | M | links to converters |
| G-15 | P2 | Guide #3 "Photo size in cm/pixels/KB for forms" (cm→px at DPI) | READY | M | pairs with OPP-018 (cm/inch/DPI) |
| G-16 | P2 | Directory submissions (SaaSHub, Uneed, Fazier, Startup Stash) | HUMAN | S | 3-4 only |
| G-17 | P2 | dev.to/Hashnode engineering post, canonical to sizetune.com | HUMAN/READY | M | |
| G-18 | P2 | Show HN when ≥8 tools live | HUMAN | M | rules read [V] |
| G-19 | P2 | Per-page OG images | LATER | M | design asset |
| G-20 | P2 | Cloudflare Web Analytics (optional) + CSP + privacy copy update | HUMAN decision | S | plan §analytics option B |
| G-21 | P2 | `lastmod` in sitemap once per-page content dates are tracked | LATER | S | only trustworthy dates |
| G-22 | P3 | Hindi pages | LATER | L | competitor gap #5; only after English pages show traction |
| G-23 | P3 | HEIC→JPG (OPP-002) | LATER | L | legal review (LGPL) |
| G-24 | P3 | PDF size tools (OPP-003) | LATER | L | legal review (AGPL) |
| G-25 | P0→human | `ads.txt` + AdSense application | HUMAN | S | publisher ID needed; no placeholder |
| G-26 | P2 | Weekly GSC review ritual (30 min) | HUMAN | ongoing | `90_DAY_GROWTH_PLAN.md` |

## Explicitly not doing (and why)
- **Mass per-KB pages** (`/…-to-30kb/`, `-45kb/`…). Competitors do this (imresizer ~65 KB slugs), but Google's scaled-content/doorway policy names near-identical template pages; the repo gate (Jaccard ≤0.35, unique-word floors) would fail them. Wave 1 is capped; expansion needs GSC evidence.
- **Pixel-size page farm** (`/resize-image-to-1080x1080/`).
- **Programmatic country passport pages** (photoresizer.in has 50). No tool support (OPP-008 blocked on legal/liability decisions A-010).
- **GA4**, purchased links, directory blasts, automated social posting.
