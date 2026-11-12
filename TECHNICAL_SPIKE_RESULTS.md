# TECHNICAL_SPIKE_RESULTS.md — SizeTune

Date: 2026-11-12. Environment: macOS, Node 26.3.0, npm 11.16.0, system Google Chrome (via Playwright `channel: 'chrome'`). All numbers below were **measured** in this spike unless marked otherwise. Run everything with `npm run verify`.

## 1. What was built
Astro 7.4.11 static site (`output: static`, no adapter) with: tool page `/` (React island), MDX guide `/guides/photo-size-for-online-forms/`, `/privacy/`, `404`, generated `robots.txt` and sitemap, `_headers`, `wrangler.jsonc` (static assets only).
Tool: file input → local blob preview → compression (binary search on JPEG quality + scale ladder) in a **module Web Worker** (OffscreenCanvas) with main-thread canvas fallback → blob download link. Search logic is pure (`src/lib/compress.ts`) and unit tested with a fake encoder.

## 2. Requirement checklist
| # | Requirement | Result | Evidence |
|--|--|--|--|
| 1 | Static home/tool page | PASS | `dist/index.html`, H1 + copy + SSR'd tool markup |
| 2 | Separate static SEO page | PASS | `dist/guides/.../index.html` (MDX content collection) |
| 3 | React upload component | PASS | `ImageCompressor.tsx` |
| 4 | Browser-side preview | PASS | e2e: `preview` visible, `blob:` URL |
| 5 | Working compression | PASS | e2e: 1.44 MB noisy PNG → ≤ 50 KB (>1 KB) result, download href is `blob:` |
| 6 | Unique metadata per route | PASS | `verify:html` (title, description, canonical, OG all per route; duplicate check) |
| 7 | Sitemap + robots | PASS | robots has `Sitemap:`; sitemap lists all 3 pages, not 404 |
| 8 | Cloudflare-compatible static build | PASS (local) | build ok (0.58 s); `wrangler dev` (workerd) serves dist: 200/307/404 and headers as designed. **Not deployed.** |

## 3. Generated-HTML checks (no JS executed; `scripts/verify-html.mjs`)
| Route | H1 in HTML | visible text chars | internal `<a href>` | JS files referenced |
|--|--|--|--|--|
| `/` | yes | 853 | 7 | 2 (island + renderer) |
| `/guides/photo-size-for-online-forms/` | yes | 718 | 7 | **0** |
| `/privacy/` | yes | 214 | 7 | **0** |
Canonical equals `https://sizetune.com` + route on all. Valid JSON-LD (WebApplication / Article). No `<form action>`. `<noscript>` fallback present. **Mutation check:** altering a canonical made the script fail (so it can fail), then restored.
Playwright with JavaScript disabled: H1, noscript text and a real link to the guide are visible.

## 4. Privacy / no-upload check
Playwright recorded every request during compression: **zero non-GET requests and zero off-origin requests**. A worker was started from same origin. Scope: proves this build does not transmit the image; it does not prove future code stays that way, so keep this test as a permanent gate (and add a CSP `connect-src 'self'` when headers are finalised).

## 5. Bundle / hydration (gzip, measured)
| File | gzip |
|--|--|
| `client` (React runtime/hydration) | 65,821 B |
| `react` helper | 3,023 B |
| `ImageCompressor` | 2,330 B |
| `compress.worker` | 613 B |
| **Tool page total JS** | **71,787 B** |
CSS 35 KB raw for one page (Tailwind v4, only used classes). Non-tool pages: no JS. `client:load` used for the main tool (it is above the fold and needs to react at once). Secondary widgets should be plain HTML or `client:visible`.
Not measured: Lighthouse/LCP/INP on real mobile hardware; iOS Safari canvas limits; low-RAM Android; large (20+ MP) images; HEIC; EXIF orientation handling; bulk mode. **Compression quality is not product-ready:** PNG transparency is flattened to white; **EXIF orientation is untested** (modern `createImageBitmap` defaults to `from-image`, so it is probably handled, but no rotated fixture exists yet); the search cannot reach exact-dimension minimum-size rules (see N1 validation). After review: quality floor 0.4 before shrinking dimensions, 3% safety margin under the target, last-resort low quality pass, 64 MP guard, 60 s worker timeout, input validation, no silent worker→main-thread retry (main thread is used only when OffscreenCanvas/Worker are absent).

## 6. Tests
- Vitest: 5 passing (fits target; picks highest quality; downscales; unreachable → fits=false smallest; bounded attempts).
- Playwright (system Chrome + `wrangler dev` on dedicated port 8788, never reusing a server): **9 passing** after review fixes — compress → valid JPEG (FFD8, decoded) ≤ target via **worker** with zero non-GET / off-origin requests (context-level listener); file chosen *before* hydration is kept (mutation-tested: fails without the fix); invalid target disables button; undecodable file shows an alert; no-JS SEO; 404 status; 307 slash redirect + `nosniff` + `immutable` asset cache + noindex on 404; no JS on non-tool pages; Pixel 7 no horizontal scroll.
- `astro check`: 0 errors, 0 warnings.

## 7. Problems met and fixes
1. `astro preview` in Astro 7 daemonises and exits, so Playwright's `webServer` died ("exited early"). Fixed by serving with `wrangler dev` — which also gives better Cloudflare fidelity.
2. Two test failures were test bugs (fake encoder could not reach 50 KB; ambiguous link locator), fixed in tests, not in product code.
3. npm resolved TypeScript 6.0.3 (latest tag is 7.0.2) because of tooling peer ranges; `astro check` passes on 6.0.3. Revisit when upgrading.
4. Node: first run on 26.3.0; after review the full `npm run verify` was re-run and passed on **Node 24.12.0** (now pinned in `.nvmrc`). `engines` declares ≥22.23.4 (Astro 7 requirement) but Node 22 was **not** run.

## 8. Verdict
Spike passes all eight requirements. Architecture (Astro static + one React island + worker) is validated for the SEO layer, the privacy property, and Cloudflare static serving. Product-grade image processing remains unvalidated and is the main remaining risk.

## 9. Post-review changes (see ADR for the finding list)
Added: workers.dev noindex headers; thin-content gate in `verify-html` (`STRICT=1` launch thresholds (superseded; now unique-word floors in `verify-html.mjs`: tool 300 / home 400 / guide 400 / policy 150); near-duplicate shingle check; canonical-link check; sitemap/noindex consistency) — **`STRICT=1` currently FAILS on purpose because spike copy is placeholder**; static `robots.txt`; dedicated Playwright port; stronger e2e; `src/lib/types.ts`; CI workflow file (inactive until repo is pushed).

## 10. Preact experiment (measured, not adopted)
A scratch copy swapped React for `@astrojs/preact` (`compat: true`): tool-page JS fell **71.8 KB → 13.2 KB gzip** (−58.6 KB, −82%), build and `verify:html` passed, 8 of 9 e2e passed untouched. But `astro check` reported 6 type errors on the naive swap and the numeric-input test failed (change/input event semantics differ). So the saving is real and the migration is small but not free. Kept React for the foundation (matches the brief, lowest agent/ecosystem risk); recorded as a human decision with a recommendation to decide **before adding more islands**.

## 11. Addendum (architecture-closure gate, 2026-11-12)
- Tests now: Vitest 48 (5 engine + 43 verify-html incl. 41 negative fixtures), Playwright 12 (adds stale-result and magic-byte tests, CSP-violation test and real-download validation: CSP forbids `fetch(blob:)` by design), `astro check` 0/0/0. All green on Node 24.12.0.
- The spike compression algorithm is **superseded** by the `fitRange` spec (ADR D11, `QA/PRODUCT_READINESS.md` §2): its ladder/last-resort gives 8.9 KB for a 20 KB target and fails to fit on iOS Safari at 36/48 MP. Do not treat §5 numbers as product quality.
- Changes since: Astro built-in CSP, `data-page-type`, CSP/ad-route verify rules, JSON-LD `<` escaping, static robots, wrangler `workers_dev/preview_urls/routes`, `.nvmrc` 24, CI `ubuntu-24.04`.
