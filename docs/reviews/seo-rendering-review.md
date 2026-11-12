# SizeTune SEO and Rendering Review (2026-11-12)

Scope: SEO_ARCHITECTURE.md, ADR, TECHNICAL_SPIKE_RESULTS.md, CLOUDFLARE_DEPLOYMENT.md, src/**, scripts/verify-html.mjs, public/*, dist/, N1 research. Nothing modified except this file.
Tags: VERIFIED = I ran it or read the file/doc this session. ASSUMPTION = reasoning, not measured.
Method notes: ran `node scripts/verify-html.mjs` (exit 0) and `STRICT=1` (exit 1: guide 108/300, home 94/600, privacy 45/300 words, as the docs say). Mutation tests were run on a COPY of dist in the scratchpad, never on dist. Google docs fetched 2026-11-12 (FAQ, software-app, spam-policies). Cloudflare docs read from docs/evidence-cloudflare-docs-2026-11-12/.

## 1. Verdict
Static Astro with a single React island is the right rendering model for these pages (VERIFIED: H1, copy, links, JSON-LD, SSR'd form markup are in the HTML; content pages ship 0 JS). The weaknesses are not the framework. They are (a) a verify script that passes several real defects, (b) docs that are stale on FAQ rich results, (c) a launch plan that is too wide for the demand evidence, and (d) no real content yet. Do not launch any preset page until section 7 is satisfied.

## 2. Findings

### CRITICAL
None. Nothing in the current dist is broken for indexing; the gaps are pre-launch.

### HIGH
**H1. FAQPage guidance is stale; Google removed FAQ rich results.** (VERIFIED, developers.google.com FAQ page: "will no longer appear in Google Search starting May 7, 2026"; documentation removed Jun 15, 2026.) SEO_ARCHITECTURE.md section 3 ("Google restricts FAQ rich results; markup still valid") and section 10 ("visible FAQ on every tool page" fine, but JSON-LD rationale wrong). Fix: do NOT add FAQPage JSON-LD (zero benefit, extra maintenance, spam-risk if text drifts). Keep a visible FAQ as content for users (`<details>`), unmarked. Update docs.

**H2. verify-html.mjs lets real defects pass (mutation-tested on a copy, all exit 0).** (VERIFIED)
- Broken internal link `/does-not-exist/` and an absolute non-canonical link `https://sizetune.com/privacy` pass. The check only tests "ends with slash" on hrefs that start with `/`; it never checks the target exists in dist, ignores absolute/single-quoted hrefs, and ignores `#fragment`/`?query` forms (false FAIL for `/x/#a`).
- `robots.txt` with `Disallow: /` plus a Sitemap line passes (only the Sitemap line is tested). The doc rule "must not block /_astro/" is untested.
- `<meta name="robots" content="noindex, follow">` on a sitemap-listed page passes (regex needs exactly `content="noindex"`). 404.html is excluded from the page loop, so its noindex is never checked here.
- Missing `lang`, missing viewport meta, second `<h1>`, `<img>` without `alt` all pass (no check exists; spec text says nothing about them but the task requires them).
- Thin/duplicate gate false pass: two pages each with 250 shared boilerplate words + 150 unique words (400 words, Jaccard 0.45) pass `STRICT=1`. So "300 words of target-specific guidance" is not what is measured; shared template text counts, and 0.6 Jaccard allows ~60% duplication. Spun/synonym text defeats shingles anyway.
- A "preset" page with no tool at all passes: `noscript` and tool-markup SSR checks read only `dist/index.html`; other routes are only classified by the string `data-testid="tool"`.
- Title length (doc says <= ~60) and description length (doc 70-160) are not checked on non-guide pages; FAQ section presence is not checked (ADR/SEO doc require it); JSON-LD is JSON.parse only (type/required fields unchecked).
- "<2 internal links" is always satisfied by header/footer chrome (every page reports 7), so a page with zero contextual links passes. No orphan check (sitemap membership is not linking).
Fix: see task T1.

**H3. Launch URL set is wider than the demand evidence supports and has doorway risk.** (VERIFIED vs Google spam policy: doorway = "near-identical pages that sit closer to search results than a clear, browsable site structure"; scaled content abuse = many pages whose primary purpose is ranking, any production method.) The N1 SERP file shows imresizer's per-KB x format matrix and pages.dev clones already rank, so the "KB preset" pattern is exactly what Google's policy targets when copy is templated. SEO doc section 2 lists 3 KB preset pages, then section 10 says "1-2 preset pages"; ADR says "up to 2-3". Inconsistent. Recommended set in section 6. Presets must be a different tool state plus real differentiating content (see section 7), otherwise merge into `/` and one guide.

**H4. No real content exists yet; spike copy is placeholder.** (VERIFIED: `/` main text 94 words; guide 108; privacy 45; guide is two generic bullet lists with no author, no source, no examples.) For a utility site, helpful content = working tool + original explanation of the user's actual task (which form, which limit, what failure looks like) + visible authorship/contact. Google's 2025-26 guidance treats low-effort scaled/AI text as spam regardless of method (spam-policies, VERIFIED). N1 report also shows the real angle is spec accuracy with cited sources, which the pages must show.

### MEDIUM
**M1. Preview-host header rule is half redundant.** (VERIFIED from Cloudflare headers doc: placeholders match one host label, delimiter is `.`.) Production `sizetune.<account>.workers.dev` and preview `<ver>-sizetune.<account>.workers.dev` both have two labels, so `https://:version.:subdomain.workers.dev/*` covers both. `https://:subdomain.workers.dev/*` matches only a one-label host, i.e. nothing real. Harmless but misleading in docs ("both rules needed"). Also (VERIFIED, doc) redirects run before headers, so 307 responses carry no X-Robots-Tag; irrelevant for indexing.

**M2. Static robots.txt with hard-coded domain vs preview hosts: no conflict, but understand why.** (VERIFIED file; ASSUMPTION on crawler behaviour.) Same file is served on workers.dev/preview hosts: `Allow: /` plus `Sitemap: https://sizetune.com/...`. This is correct: a `Disallow` on preview would stop Google from seeing the `X-Robots-Tag: noindex`, so URLs could still be indexed from links. The hard-coded canonical (`https://sizetune.com/...`) on previews points at production, which also consolidates. Risk: before the domain is live, canonical points to a host that does not resolve, and Google may ignore it. Mitigation: keep workers.dev and preview URLs private until domain is live (`workers_dev:false`, `preview_urls:false` after domain). Add a test: deployed workers.dev response has `x-robots-tag: noindex` (ADR H2 still unverified on live edge).

**M3. Cloudflare redirect/404 behaviour is correct but the SEO doc understates one trap.** (VERIFIED docs: auto-trailing-slash gives 307 `/folder` -> `/folder/`, `/folder/index.html` -> `/folder/`.) 307 is temporary; Google follows it but a permanent signal is better. Internal links are canonical, so risk is only external links; canonical tag is the backstop. If a page is ever removed, `_redirects` 301/308 for moved URLs; for deleted pages let the 404 page serve (404 is fine; 410 not available in static assets and Google treats both as removal). `not_found_handling: 404-page` returns HTTP 404 (VERIFIED in spike e2e).

**M4. `/guides/` hub does not exist but nav label "Guides" links to one article.** (VERIFIED dist: nav and footer both point to the single guide.) Misleading anchor text, and `/guides/` itself returns 404 although users/crawlers may try it. Fix: either rename link to the article title, or add a real `/guides/` index when there are >= 3 guides.

**M5. Hydration choice.** (ASSUMPTION; no Lighthouse/CrUX measured. Astro docs: `client:load` hydrates immediately, `client:idle` on requestIdleCallback, `client:visible` on IntersectionObserver.)
- The LCP element is text (H1/paragraph) in static HTML, not gated by React. CLS: SSR'd island markup is the same shape as hydrated markup; empty `aria-live` div and the preview `<img>` appear only after user input (user-initiated, excluded from CLS within 500 ms; preview `max-h-48` but no width/height reserved, set an aspect-ratio box to be safe). Fine.
- The tool is above the fold, so `client:visible` fires immediately and buys nothing. `client:idle` is a reasonable small win (keeps 212 KB raw / 65.8 KB gz React parse off the critical load on mid-range Android) because native `<input type=file>` already works pre-hydration and the e2e proves a pre-hydration selection survives. Do not use `client:only` (kills SSR markup). Real fix for INP/TBT on low-end phones is Preact-compat (-58.6 KB gz, measured in spike). Recommendation: switch to `client:idle`, decide Preact before the second island, and measure on a real low-end phone (INP < 200 ms, CLS < 0.1, LCP < 2.5 s).
- Ads will dominate JS and CLS later; the 71 KB figure is a floor.

**M6. og:image missing; og:type wrong on guides; Twitter card `summary` without image.** (VERIFIED dist.) Not a ranking factor but affects sharing. Guide pages emit `og:type website`; should be `article`. Fix: one 1200x630 PNG, `og:image` + `og:image:alt`, `twitter:card=summary_large_image`, per-page override.

**M7. JSON-LD.** (VERIFIED Google software-app doc.) `WebApplication` is a supported subtype of `SoftwareApplication`, and the choice is fine for semantics. But Google requires `aggregateRating` or `review` for the software rich result, so no rich result is possible without real reviews; do not fabricate. Keep `WebApplication` as plain entity markup (add `description`, `browserRequirements: "Requires JavaScript"`, `isAccessibleForFree`). Article JSON-LD lacks `author`, `datePublished`, `image`, `publisher` (recommended); the guide hard-codes `updated` which is not a verified date. Add `BreadcrumbList` only when a hierarchy exists. No schema is a ranking boost; treat as low value.

**M8. STRICT word floors misapplied to policy pages.** `other: 300` applies to privacy/about/terms, which will push padding into legal pages. Google has no minimum word count (ASSUMPTION from its helpful-content guidance; word count is only a tripwire here). Use page-type thresholds and a unique-word metric (T1).

### LOW
**L1. Doc inconsistencies.** (VERIFIED by reading) (a) Preset count: "<= 9 URLs / 3 KB presets" (SEO sec 2) vs "1-2 preset pages" (SEO sec 10) vs "2-3" (ADR sec 6). (b) Spike doc says tool page JS "71,787 B" in one place and ADR "~71.8 KB" and SEO "71.3 KB gzip" (sum of itemised parts) - minor. (c) SEO sec 5 says tool JS only on tool routes; Spike says Node 26.3.0 first run, `engines`/.nvmrc 24.12.0; `node --version` here is 26.3.0 so my run of verify was on 26 not the pinned 24 (no effect on output). (d) SEO doc: "FAQ rich results restricted" obsolete (H1). (e) ADR says verify gate covers "thin-page risk (fixed in tooling)" - partly overstated (H2). (f) CSS "35 KB for one page" is raw; gzip is 7,244 B (VERIFIED), fine. (g) SEO doc sec 8 says "internal link canonical" gate - only format (H2). (h) `about/` and `terms/` are in the launch table but not built; sitemap/nav do not reference them. (i) CLOUDFLARE doc says both workers.dev rules are needed (M1).
**L2. Tailwind CSS / fonts / images.** (VERIFIED) 35.2 KB raw / 7.2 KB gz single render-blocking stylesheet (includes preflight, theme vars); acceptable. Because `inlineStylesheets: auto` only inlines < 4 KB, it is one extra blocking request; consider `build.inlineStylesheets: 'always'` (7 KB gz, saves a round trip on a 4G first visit, costs HTML cache efficiency; ASSUMPTION on net benefit). Fonts: system stack, no webfont, so no CLS/FOIT; if a brand font is added, self-host WOFF2, `font-display: swap`, preload one weight. Images: none on pages; only `favicon.svg` (Google accepts SVG favicons; add `apple-touch-icon` 180 px and a 48px-multiple raster/ICO for search). Preview `<img>` has an alt but it is generic.
**L3. dist HTML defects.** (VERIFIED, all three pages + 404) Good: `lang="en"`, viewport, unique title/description, canonical, one H1, sensible heading order (h1 > h2), alt on preview img, noscript present. Defects: footer/nav links have no underline (WCAG 1.4.1 for inline footer links; low); no `theme-color`; header brand and "Resize to KB" duplicate the same href; the home page has no visible FAQ or example table; `lang="en"` could be `en-IN` (optional, Google mostly ignores). No skip link. Privacy copy says "no ads or analytics enabled in this spike" - spike language must not ship.
**L4. hreflang.** Not needed (single language; N1: Hindi demand <100 bucket, Hindi SERP not verified for India). Do not add hreflang or Hindi pages now. If ever added, use reciprocal self-referencing hreflang and separate URLs (`/hi/...`).
**L5. Demand-evidence caveats.** (VERIFIED CSV) Ahrefs free tool gives volume buckets only (>10,000 is a floor), KD labels, no trend, US-vantage SERPs. 20/50/100 KB each >10K Easy; 30/200/10 KB >1K; `signature resize` >10K Easy; `photo resizer in kb` Hard; `pan card photo resize` >10K Hard; exam photo queries <=100. SERPs are saturated with clones and DR-40 imresizer; a new DR-0 site with templated pages gets no benefit of the doubt.

## 3. Rendering checks, answered
| Question | Answer |
|--|--|
| Static + island correct? | Yes. VERIFIED SSR markup in dist; crawlers need no JS for text/links/JSON-LD. |
| Island strategy | `client:load` acceptable, `client:idle` slightly better; `client:visible` useless above fold; Preact for real INP gain (ASSUMPTION: needs real-device test). |
| CSS | 7.2 KB gz, fine. |
| Fonts | System stack, nothing to fix. |
| Images | None; add og:image, apple-touch-icon. |
| 404/410 | 404 page noindex + HTTP 404 (spike e2e). 410 not needed. |
| Sitemap | Index + sitemap-0, no lastmod, excludes 404 (VERIFIED). Adding `lastmod` only when dates are real. |

## 4. Does verify-html.mjs catch the stated risks?
Catches: missing title/desc/H1/canonical mismatch, duplicate title/description, invalid JSON syntax, `<form action>`, tool JS on non-tool pages, too few words (tripwire), sitemap membership, noindex-in-sitemap (exact string only), non-slash internal links (relative `/` hrefs only). Does not catch: broken links, absolute links, Disallow in robots, loose noindex variants, lang/viewport/alt/duplicate H1, boilerplate-heavy near-duplicates under 0.6 Jaccard, tool-less preset pages, missing FAQ, wrong schema types, orphan pages, og:image, title/description length on all pages. It cannot test headers/redirects/live behaviour (Playwright covers some).

## 5. Google AI/scaled-content position (2025-26)
(VERIFIED spam-policies page.) Production method is irrelevant; the test is whether many pages exist mainly to rank. Templated KB pages with only the number changed are the textbook case. Allowed: AI-assisted drafting with human verification, original examples, tested screenshots, cited official specs. Require a named human reviewer/owner and "last verified" dates on any spec content.

## 6. Recommended launch URL set (7 indexable + 404)
| URL | Role | Indexable | Why |
|--|--|--|--|
| `/` | Generic "resize image to KB" tool with a target field (default 50 KB) + chip shortcuts 20/50/100 that set the field (no URL change) | yes | Head term, hardest; the shortcuts serve the three >10K Easy queries without 3 more URLs |
| `/resize-image-to-20kb/` | Preset page, only if section 7 copy done | yes | Highest Easy volume (>10K, plus compress 20kb >10K) |
| `/resize-image-to-50kb/` | same | yes, second wave | >10K Easy |
| `/resize-signature/` | Signature mode: own UI (crop, white background, 10-20 KB, dimension presets) | yes | `signature resize` >10K Easy; distinct function = not a doorway |
| `/guides/photo-size-for-online-forms/` | Real guide, links to tool pages | yes | Topical authority |
| `/about/`, `/privacy/`, `/terms/` | Trust + AdSense policy | yes (privacy/terms could be noindex; keep in sitemap only if indexable) | E-E-A-T |
Wave 1 (build now): `/`, `/resize-signature/`, one preset (`/resize-image-to-20kb/`), guide, privacy, about, terms. Wave 2 (only after Search Console shows impressions on the preset query or after day 60 gate): 50 KB, 100 KB. Never pre-build: 10/30/200 KB, per-exam/PAN/GDS pages, Hindi, per-format matrix. `/guides/` index when >= 3 guides. No query-string states indexable.

## 7. Content requirements per page (for indexable pages)
Common: unique title (<= 60 chars) and description (70-160), one H1, visible author/owner line and "last reviewed" date that is true, canonical, >= 3 contextual internal links, no fake ratings, no FAQPage JSON-LD, on-page statement of what is and is not uploaded (match actual network behaviour and ad scripts).
- `/` (>= ~600 words of own copy outside the island): what the tool does and when it fails; how the search works (quality then dimensions); a size-reachability explanation (why 10 KB at large pixels may not fit); 6-8 FAQ items answered with real behaviour; links to signature, guide, presets; tested result example (before/after numbers from a real file, state the file).
- Preset `/resize-image-to-20kb/` (>= 300 words unique, measured by unique-shingle count, not total): who asks for 20 KB (examples of forms, each cited to official spec or marked "check your form"); real quality loss at 20 KB with an actual before/after image pair and byte numbers; minimum-size pitfalls; dimensions guidance; own FAQ (4-5 items written for 20 KB); preset sets target=20 and the page-specific H1. Must contain the working tool SSR markup + noscript.
- `/resize-signature/`: own mode UI; spec table (10-20 KB, 140x60 px IBPS sample, cm conventions) with citation URL and verified date; step instructions; tested example.
- Guide: >= 600 words, real examples, linked to presets, named author, sources.
- Privacy/terms/about: complete policies (cookies, ad vendors, consent, data retention, contact); no word-count padding; about page names a real owner and contact email (E-E-A-T and AdSense).

## 8. Implementation tasks
- T1 (HIGH) Rewrite verify-html: resolve every internal href (absolute and relative, ignore fragments/query) to a dist file; parse `robots.txt` and fail on `Disallow: /` or `/_astro` blocks; parse robots meta properly (any value containing noindex); require `lang`, viewport, exactly one H1, heading level skips, `alt` on `<img>`; title <= 60 and description 70-160 on all pages; og:image present; per-page tool SSR markup + noscript for every tool route; require a FAQ `<details>`/heading on tool pages; compute unique words per page (words in shingles absent from all other pages) and require >= 300 for presets; lower Jaccard cap to 0.35 for same-type pages; per-page-type word floors (policy pages exempt); orphan check (each indexable page linked from >= 1 other page body, not just chrome); verify noindex on 404.html; reject JSON-LD `FAQPage`; check `@type` and required fields per type; check sitemap has no entries without a file. Add negative fixtures: run the script against mutated copies in CI (the six mutations tested here) and assert it fails.
- T2 (HIGH) Remove FAQPage JSON-LD plans from SEO_ARCHITECTURE section 3/10; correct preset count to one source of truth (section 6 above); update CLOUDFLARE doc on workers.dev rule (M1).
- T3 (HIGH) Write real copy per section 7; add author/about; real privacy/terms.
- T4 (MED) Build `/resize-signature/` with its own mode; one preset only; gate others on Search Console.
- T5 (MED) `client:idle` for the island; reserve preview box dimensions (aspect-ratio); decide Preact; measure Lighthouse mobile and INP on a real low-end Android + iOS Safari.
- T6 (MED) Design 1200x630 og:image, add `og:image`, `og:type=article` for guides, `apple-touch-icon`, enrich WebApplication and Article JSON-LD (author, datePublished, publisher); no ratings.
- T7 (MED) Nav: rename "Guides" or add `/guides/` hub; add contextual cross-links among tool pages and guide; add About/Terms to footer.
- T8 (LOW) After domain is live: `workers_dev:false`, `preview_urls:false`; test live `x-robots-tag` on any remaining preview host; submit sitemap in Search Console and Bing; check 307 behaviour on the live edge.
- T9 (LOW) Consider `inlineStylesheets: 'always'`, underline footer links, skip link, `en-IN`.
- T10 (LOW) Remove spike wording from privacy page; rerun `STRICT=1` as the launch gate, with the improved metric from T1.
