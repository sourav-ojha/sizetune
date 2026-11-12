# SEO_ARCHITECTURE.md — SizeTune

Status: design validated by the spike (2026-11-12). Facts about generated HTML come from `npm run verify:html` on a real build; search-demand figures come from the earlier N1 research (`research/validation/n1/keywords_ahrefs_free_tool.csv`, Ahrefs free keyword generator, volume *buckets*, India, retrieved 2026-11-12). Buckets are floors, not exact counts.

## 1. Principles
1. Every indexable page is **static HTML at build time**. Crawlers need no JavaScript to see H1, body copy, links, metadata, JSON-LD.
2. The tool is an **island**: its server-rendered markup (labels, inputs) is in the HTML; JS only attaches behaviour.
3. One URL = one search intent = one canonical. No query-string states are indexable.
4. No mass-generated pages. A page ships only if it has intent evidence **and** content a human would not find in a sibling page.

## 2. Launch URL set (single source of truth; ADR D9)
| URL | Intent (N1 evidence: volume *buckets*, Ahrefs free tool, India) | Type |
|--|--|--|
| `/` | "resize image to kb", "photo resizer in kb" (>10K, Hard), generic head term | Tool + explainer |
| `/resize-image-to-20kb/` | "resize image to 20kb" (>10K, Easy) | Tool preset + unique guidance |
| `/resize-signature/` | "signature resize" (>10K, Easy) | **Own UI mode** (crop/background), not a preset |
| `/guides/photo-size-for-online-forms/` | topical support | Guide (MDX); add a `/guides/` hub only at ≥3 guides, else relabel nav |
| `/privacy/`, `/about/`, `/terms/` | trust / policy | Static (about has named author/contact — human H9) |
Held back until Search Console shows impressions: 50/100/10/30/200 KB pages, PAN/GDS/SSC/UTI/RRB pages (exam photo queries ≤100 bucket), Hindi, per-format pages. A new KB-target page must differ in preset, ≥300 *unique* words of target-specific guidance, own FAQ, and pass `STRICT=1`; otherwise merge into a guide. (v1 of this doc listed 3–4 presets and 1–3 in different sections; superseded.)

## 3. Metadata system
- Single `Base.astro` layout takes `title`, `description`, `path`, optional `jsonLd`, `noindex`. Canonical = `new URL(path, site)`; `site` is set once in `astro.config.mjs`.
- Title ≤ ~60 chars, description 70–160 chars (content schema enforces 50–160 for guides). Uniqueness checked by `verify:html` (fails build gate on duplicates).
- Open Graph: type, site_name, title, description, url. **Gap:** no `og:image` yet (needs a designed asset). Twitter card `summary`.
- JSON-LD: `WebApplication` (valid `SoftwareApplication` subtype; entity markup only — Google needs real ratings/reviews for the software rich result, none exist, none may be invented) on tool pages, `Article` on guides. **No FAQPage JSON-LD**: Google removed FAQ rich results in 2026 (its FAQ docs, accessed 2026-11-12); keep a *visible* FAQ section. `verify:html` rejects FAQPage and rating markup. Validity is checked for JSON syntax only; schema.org conformance needs Google's Rich Results Test (**human/manual**).
- Trailing slash policy: **always** (`trailingSlash: 'always'`, `build.format: 'directory'`). Matches Cloudflare `html_handling: auto-trailing-slash` (folders served with slash). Internal links always use the canonical slash form because Cloudflare redirects non-canonical forms with **307**, not 301 (documented), so link to the final URL directly.

## 4. Crawl control
- `robots.txt` is a static file (`public/robots.txt`; serving the same file on workers.dev/preview hosts is deliberate — a Disallow would hide the noindex header): `Allow: /`, `Sitemap:` line. It must not block `/_astro/` (Google needs CSS/JS to render).
- Sitemap via `@astrojs/sitemap` → `sitemap-index.xml` + `sitemap-0.xml`; excludes `404`. 404 page is `noindex` and returns **HTTP 404** (verified on workerd).
- No `lastmod` yet (integration option available once content dates are trustworthy).

## 5. Rendering of the two layers
| Layer | Where | JS |
|--|--|--|
| Layout, nav, footer, copy, FAQ, guides, legal, JSON-LD, metadata | `.astro` / `.mdx`, build time | none |
| Image upload, decode, compress, preview, download, signature editor | Preact island `client:load` (main tool above the fold) | tool bundle only on tool routes |
| Secondary widgets (e.g. "popular sizes" selector, FAQ accordions) | prefer plain HTML (`<details>`), else `client:visible`/`client:idle` | lazy |
Measured in spike (React build): guide/privacy pages load **0** JS files; the tool page loads 4 files totalling 71.8 KB gzip (React runtime 65.8 KB). Now: Preact 11 compat islands with `client:load` (migrated and merged; first-load JS ≈39.0 KB image pages / ≈42.4 KB signature gzip, worker ≈13.1 KB on demand; ADR D3 / `docs/experiments/PREACT.md`).

## 6. No-JS and failure behaviour
Tool pages include server-rendered explanatory copy and a `<noscript>` message. Image processing without JS is impossible by design; the page still carries the full SEO content. If Worker/OffscreenCanvas is missing, the island falls back to main-thread canvas.

## 7. Performance targets (to be measured with Lighthouse/CrUX once public)
LCP < 2.5 s on mid-range Android over 4G; CLS < 0.1; INP < 200 ms. Levers: ~71 KB gzip JS only on tool routes, long-cache hashed assets, no web fonts in spike, no third-party scripts before consent. **AdSense will dominate JS weight later**; ads must reserve space to protect CLS.

## 8. Acceptance checks (automated, `npm run verify:html` + Playwright)
H1 and enough **words inside `<main>` excluding island/noscript** (thresholds are in `scripts/verify-html.mjs` and §11 — single source; Jaccard cap 0.35 between same-type pages); every internal link canonical (trailing slash); noindex pages absent from sitemap; unique title/description; canonical == site + route; ≥2 real `<a href>` links; valid JSON-LD; no `<form action>`; tool JS only referenced from the tool route; tool markup SSR'd; `<noscript>` present; robots has Sitemap; every page in sitemap; 404 status; no off-origin requests and no non-GET requests during compression.

## 9. Open items
`og:image`; real copy for each tool page; hreflang (not needed unless Hindi pages are created); Search Console / Bing Webmaster setup (human); schema validation in Google tools (human).

## 10. Added after independent review
- **Thin-page risk (HIGH, fixed in tooling):** preset pages (`/resize-image-to-20kb/` …) must not ship until real, distinct copy passes `STRICT=1 npm run verify:html`. Launch with `/` + at most 1–2 preset pages; add the rest only on Search Console evidence. Also needed on every tool page: a visible FAQ section.
- **AdSense / privacy wording:** copy now says *our code* does not upload images, and that ads (when enabled) come from third parties. Before applying: full privacy policy (cookies, ad vendors), terms, about, a Google-certified consent banner for EEA/UK, `ads.txt`, reserved ad-slot heights (CLS). A third-party script on a page with a file input can in principle read the `File`; consider ads only after results or a no-ads tool layout. Decide with the AdSense plan (human).
- **CSP (applied, Chrome-tested):** Astro 7 built-in `security.csp` emits a hash-based `<meta>` per page (`default-src 'self'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; …`) + header `frame-ancestors 'none'`. The meta policy is enforced from the first deploy (no Report-Only possible). `connect-src` alone does not stop navigations/beacons; no inline `style=` attributes allowed (verify lint).
- Rich-result eligibility and schema conformance: manual validation in Google tools (human).

## 11. Gate rules (verify-html v2, after SEO review)
`scripts/verify-html.mjs` exports `verifyDist()`; `tests/verify-html.test.ts` mutates copies of `dist/` (41 negative cases) and asserts failure for: broken/absolute-non-canonical links, robots `Disallow: /` or `/_astro`, `noindex, follow` on sitemap-listed pages, missing lang/viewport/og:title, second H1, heading skip, img without alt, FAQPage/rating JSON-LD, tool page without noscript/tool markup, wrong canonical, 404 without noindex, title >60 / description outside 70–160, near-duplicate same-type pages (Jaccard > 0.35), ad/analytics/third-party origin on tool routes, missing/unsafe CSP. **FAIL** rules always apply; **LAUNCH** rules (STRICT=1): unique words per page type (tool 300 / home 400 / guide 400 / policy 150), visible FAQ heading on tool pages, og:image, orphan check. Word count is a tripwire, not a Google requirement. Content requirements per page (authorship, cited specs with dates, examples) are in `docs/reviews/seo-rendering-review.md` §7.

## 12. Ads and tool pages (ADR D6)
Tool routes are ad-free and load no third-party origins (CSP + verify rule). If ads are ever enabled (human decision), they go on content pages only, behind a Google-certified CMP for EEA/UK/CH, with reserved slot heights (CLS) and a separate ad-route CSP (untested draft in the security review). Copy claims are page-type specific: tool pages may say "this page loads no ads or trackers" only while that is enforced.
