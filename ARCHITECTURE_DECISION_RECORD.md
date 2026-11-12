# ARCHITECTURE_DECISION_RECORD.md — SizeTune

Version 3 (post build sprint, 2026-11-12) — v2 text below is preserved as history; §11 records what the sprint changed · Status (v2): **Architecture closed, subject to §8b (second-pass review: conditional, residual items listed); product NOT ready for launch.** Version 1 (same day, pre-closure-gate) is preserved in §9 history. Companion: `TECH_STACK_COMPARISON.md`, `SEO_ARCHITECTURE.md`, `CLOUDFLARE_DEPLOYMENT.md`, `TECHNICAL_SPIKE_RESULTS.md`, `SIZETUNE_EXECUTION_PLAN.md`, `BLOCKERS.md`, `QA/PRODUCT_READINESS.md`, and the four domain review reports in `docs/reviews/` (the fifth, independent architecture review, is §8; a second pass is §8b).

## 1. Context update
**Domain:** `sizetune.com` is registered (user purchase; verified via Verisign RDAP 2026-11-12T05:19Z: created 04:48:59Z, registrar Cloudflare, Inc., Cloudflare nameservers, no A record, no HTTPS response). Earlier documents that said "not purchased" were correct *when written*; they are kept as history and corrected here and in the plan. Nothing is deployed, no DNS record was added by this project, no ads, no analytics.

## 2. Reviews run in this gate (implementer ≠ reviewers)
| Review | Report | Headline |
|--|--|--|
| Compression engineering | `docs/reviews/compression-review.md` | Spike algorithm has a real defect (ladder + q=.05 last resort); Safari/Chrome encoders differ 1.4–1.9×; decode-at-reduced-size cuts memory ~3×; EXIF safe; honest min-size strategy = raise quality, never default padding. Verified on Chrome, Android emulator, iOS Simulator. |
| SEO & rendering | `docs/reviews/seo-rendering-review.md` | Static+island is right. HIGH: FAQPage JSON-LD obsolete; verify-html had 8 false-pass classes; launch URL set too wide; no real content. |
| Cloudflare deployment | `docs/reviews/cloudflare-review.md` | Workers static assets confirmed. HIGH: stale "not bought" text; deploys not gated by GitHub Actions (needs ruleset). MED: dead `_headers` rule, Node image default 24.22.1, workers_dev/preview_urls, CI hardening. |
| Security & privacy | `docs/reviews/security-privacy-review.md` | HIGH (gates ads): any same-page ad script can read the selected file → ad-free tool routes. CSP tested; Astro built-in CSP works. MED: JSON-LD `<` escape, decompression-bomb order of checks. |
| Independent architecture (final pass) | §8 below | conditional yes; 4 HIGH doc/enforcement findings fixed in this version; second pass in §8 |

## 3. Decisions
| # | Decision | Status | Basis | Reversal cost |
|--|--|--|--|--|
| D1 | Astro 7 static output + islands (**React at v2; Preact 11 compat since the sprint, see D3**) + Tailwind v4 + MDX; processing in browser Worker | **FINAL** | spike, 5 reviews, comparison doc | high (framework) — not expected |
| D2 | Cloudflare **Workers static assets** (not Pages) | **FINAL** | CF docs "Start new projects with Workers"; free unlimited static requests; same `dist/`; CF review confirms; local workerd tests | low (Pages = config swap) |
| D3 | **Preact (compat) instead of React** for islands, `client:idle`; executed as work package A1 **after** the engine packages (A2/A3, which don't depend on it) and **only after the owner has had the chance to veto (H8)**; gated by the e2e suite plus a WebKit run (hydration-race test is Chrome-only today) | **EXECUTED in the sprint and KEPT** (see §11): −60 KB gzip first-load JS, all gates green, independent review keep-with-fixes (fixes applied); WebKit run only via iOS Simulator, Firefox never run — owner may still revert (`docs/experiments/PREACT.md`) | measured 71.8 → 13.2 KB gz (−58.6 KB); swap is small (6 type errors, 1 event-semantics test) and the UI is being rewritten anyway; mobile/India audience; AdSense later adds weight elsewhere | low |
| D4 | Node (owner may override via H8): `.nvmrc` = `24` (Cloudflare build default 24.22.1); full verify passed on 24.12.0 locally only; Astro needs ≥22.23.4; Node 22 not run | **FINAL pending the first CI/Workers build run (none has happened; repo has zero commits)** | CF build-image doc; local run | low |
| D5 | CI: GitHub Actions `verify` on `ubuntu-24.04` (Chrome preinstalled), + `main` ruleset (PR, required check, no bypass) **before** connecting Workers Builds; build command also runs check/test/verify:html | **FINAL design; implementation needs human (H1,H2,H4)** | CF review CF-02/07 | — |
| D6 | **Ad-free tool routes**; ads (if ever) only on content pages with a certified CMP; tripwire-checked by `verify:html` (no ad/analytics/third-party origin or external-URL inline script, strict CSP source allow-list; 8 mutation fixtures incl. protocol-relative, CSP host, meta refresh) — a build-time tripwire, **not** proof against a determined future edit; the browser-enforced guarantee is the shipped CSP | **ADOPTED as engineering policy — owner decides business trade-off (H10)** | security review §1 (same-origin script can read `File`, blob URLs, DOM) | low (rule can be relaxed deliberately) |
| D7 | CSP: Astro `security.csp` (hashes, meta) + header `frame-ancestors 'none'`, `X-Frame-Options`, COOP; `connect-src 'self'`, `frame-src 'none'`. **Limits:** a `<meta>` CSP cannot carry `frame-ancestors`/`report-uri` or be Report-Only, and its hashes change every build, so the meta policy is *enforced from the first deploy* (the first live deploy is its real-world test); a header CSP with only `frame-ancestors` applies in addition (both apply: intersection). Lint added against `style=` attributes. | **IMPLEMENTED (Chrome-tested)** | security review §3 | low |
| D8 | Analytics at launch: **none** (Search Console only). Cloudflare Web Analytics optional later after a consent decision. Never send file names/sizes/EXIF. | **FINAL for launch** | security review §4 | low |
| D9 | Launch URL set: `/`, `/resize-image-to-20kb/`, `/resize-signature/` (own UI mode), 1 guide, privacy, about, terms. 50/100 KB pages only on Search Console evidence; no exam/Hindi/per-format pages | **FINAL** | SEO review H3; N1 keyword buckets | low |
| D10 | No FAQPage JSON-LD (Google removed FAQ rich results in 2026); visible FAQ text stays | **FINAL** | SEO review H1 | — |
| D11 | Compression: adopt `fitRange` spec (window `[min·1024, max·1000]`, integer-q bisect, continuous scale, q100 raise for minimums, explicit statuses, no ladder/last resort); **no padding by default** | **FINAL spec; implementation Stages 0–5** | compression review §7–8 | — |
| D12 | `www`: apex is canonical; redirect www→apex via zone rule | **RECOMMENDED — human (H5)** | CF review CF-09 | low |
| D13 | `wrangler.jsonc`: `workers_dev:false`, `preview_urls:false`, custom-domain `routes` for `sizetune.com`. **Consequence: the first deploy by any route (human `wrangler deploy` OR connecting Workers Builds and pushing `main`) publishes sizetune.com publicly; there is no pre-launch preview URL.** Pre-launch verification = local `wrangler dev` + CI. A staging URL needs a deliberate config change (H12). | **IMPLEMENTED in config; deploy is human-gated** | CF review CF-05 | low |
| D14 | MDX kept (FAQ/callout components expected) | FINAL | — | low |

## 4. Rejected alternatives (unchanged from v1; see `TECH_STACK_COMPARISON.md`)
SvelteKit 3, TanStack Start, React Router 8 framework mode, Next.js (static export / vinext / OpenNext), Vite + vite-react-ssg, Pages-as-primary, SSR/adapters/D1/R2.

## 5. Architecture (unchanged shape)
```
 src/pages/*.astro, src/content/*.mdx, Base.astro ──► Astro static build ──► dist/ ──► Workers static assets (no Worker code)
 src/components/<Tool>.tsx (island, client:idle/load) ◄─ src/lib/engine (pure, tested) ◄─ src/lib/*.worker.ts (OffscreenCanvas)
 SEO layer = plain HTML/CSS (0 JS on content pages).  Tool layer = island only on tool routes, ad-free, CSP meta + headers.
```

## 6. Remaining critical/high risks (none CRITICAL known)
1. HIGH — No real content; STRICT gate fails by design (BLOCKERS B1).
2. HIGH — Compression engine not production-grade; iOS `fits=false` at large inputs (B2).
3. HIGH — Real-device behaviour unverified (B3, human).
4. HIGH — Demand/competition vs N1 kill criteria (B4).
5. HIGH — Deploy safety depends on repo + ruleset (B5, human).
6. MED — Ads/privacy trade-off, CSP ad draft untested, privacy policy stub, TM check IP India (B6–B8, human).

## 6b. Added by the final review
- The **first deploy is production** (D13) — don't connect Builds/push `main` until launch-ready (BLOCKERS B11, H12).
- The verifier is a tripwire; ImageCompressor had stale-result/leak/magic-byte issues (fixed: run-id guard, worker terminate, URL revoke, `try/finally`, sniff; remaining S-05 double-decode in Stage 2).
- Schedule below is a work-package order; a gated launch realistically takes 5–7 days (human items have no turnaround).
- STRICT thresholds (300/400/150 unique words) are tripwires, untested on real copy.

## 7. Known limitations of the evidence
Local verification only (Chrome, workerd, iOS Simulator, one Android emulator). Simulators use Mac RAM; real phone limits unknown. Compression metric is luma SSIM on landscape-heavy corpus; no faces. Comparison doc is largely from summarised page fetches. No live deploy, no Lighthouse, no legal advice anywhere.

## 8. Independent architecture review (final pass)
Separate read-only reviewer (no implementation role). Ran check/test/build/verify/STRICT/Playwright (Node 26 default shell) and 7 new mutations on a copy of `dist`. Verdict: **conditional** — D1, D2, D5, D7, D13 hold; no CRITICAL. Findings and disposition:
| ID | Sev | Finding | Disposition |
|--|--|--|--|
| R1 | HIGH | Plan/QA required a preview deploy that `preview_urls:false`+`workers_dev:false` make impossible; first deploy is production | Docs corrected everywhere; D13 states it; H12 added (staging needs deliberate config change); noindex `_headers` rule labelled as only relevant if workers.dev/previews are ever enabled |
| R2 | HIGH | `verify:html` missed 7/7 new mutations (sitemap-index, `//host` script, FAQPage with attributes, CSP CDN host, inline external URL, 2nd canonical, meta refresh) | Verifier hardened; all 7 + style-attribute lint added as fixtures (29 negative fixtures after pass 1; 41 after pass 2); D6 claim softened to "tripwire" |
| R3 | HIGH | D4 claimed a CI-confirmed pin | Reworded: pending first CI/build |
| R4 | HIGH | ADR declared closure with empty review section; counts wrong | This section; counts corrected (4 domain reviews + this one) |
| R5 | MED | Meta CSP cannot do Report-Only/frame-ancestors | D7 rewritten; `style=` lint added |
| R6 | MED | Stale-result race, blob URL not revoked on file change, `bmp.close` on error only, no magic-byte check, raw error text | Fixed + e2e (stale result, SVG-as-PNG); S-05 (full decode before pixel check) deferred to Stage 2, tracked in BLOCKERS B2 |
| R7 | MED | Inconsistent H-numbers, thresholds, stale SEO sections, copy contradicting D6 | Unified on BLOCKERS IDs; thresholds single-sourced (code); SEO §5/§8/§10 fixed; tool/privacy copy corrected |
| R8 | MED | D3 swap not needed for A2/A3; "human may override" but Day 1 started it | D3 resequenced and gated on veto + WebKit |
| R9 | MED | 3-day schedule not credible; missing human actions | Reframed as work-package order (5–7 days realistic); missing actions added (H12–H16) |
| R10 | LOW | STRICT can't pass because 404 needs og:image; vendor docs copy would be pushed | 404 exempt; evidence folder added to `.gitignore`; Actions SHA pinning stays B12 |
Second review pass: §8b.

## 8b. Second-pass independent review (different reviewer instance)
Verified each R1–R10 disposition in the repo, ran check/test/build/verify/STRICT/Playwright (Node 24.12.0; 12/12), and 33 new mutations. Verdict: **conditional** — code/tests hold, no CRITICAL, nothing deploys. Findings and disposition:
| ID | Sev | Finding | Disposition |
|--|--|--|--|
| F1 | HIGH(doc) | ADR referenced a nonexistent §8b and said "CLOSED" | This section added; header/plan reworded "closed subject to §8b" |
| F2 | MED | QA said Lighthouse "on the preview URL" | QA corrected: Lighthouse on the local `wrangler dev` build; real-edge checks only after first production deploy |
| F3 | MED | Verifier missed `script-src data:/blob:`, `data:` script src, `srcset`, unquoted attributes, `@import`, CSP directive case/duplicates/missing base-uri/object-src, inline handlers, `form method=post`, uppercase META refresh | Fixed in `verify-html.mjs`; 12 new fixtures (now 41 negative). **Still regex-based**: not caught — external checks on non-tool pages (by design, ads may later live there), `rel` lint on external links, inline `sendBeacon`, framework-generated markup the regexes can't see. A real HTML parser (parse5) is the proper fix → BLOCKERS B7. Claim stays "tripwire". |
| F4 | MED | Stale-result e2e partly vacuous (passes with only the `runId` guard removed because `terminate()` masks it) | Added a guard after `sniff`/`checkSize` so no worker is created for a cancelled run; test remains **partial** (covers combined regression; deterministic Worker stub needed) → BLOCKERS B2 |
| F5 | MED | Meta descriptions overclaimed ("exact file size", "Nothing is uploaded"; privacy meta absolute) | Reworded to "your size limit" and "SizeTune's code does not upload…" |
| F6 | LOW | Stale run could create a worker; stale 60 s timer; old result shown after target change; S-05/S-08 | First and third fixed; timer untidy but harmless; S-05/S-08 in B2 |
| F7 | LOW | D4/D6 "FINAL" vs owner override; header review count; unlabelled word metrics | Wording fixed (D4 "owner may override via H8"; D6 "ADOPTED… owner decides"); B1 metrics labelled |

## 9. History
v1 (2026-11-12 morning): initial decision (Astro/React/Workers), 13 review findings (H1–H4, M1–M9, L1–L8) fixed or deferred, Preact experiment measured but not adopted, "domain not yet bought". v2 (this): domain registered, four domain reviews, decisions finalised, verifier/CSP/headers/CI/config hardened, QA and BLOCKERS created.

## 11. Build sprint addendum (2026-11-12, after v2) — what changed, with evidence
**Implemented (see `BUILD_STATUS.md`, `QA/PRODUCT_READINESS.md`, `QA/TEST_RESULTS.md`):** production-style engine (`src/lib/engine`), image tool, signature tool, launch content, parse5 verifiers, Preact migration, axe-core accessibility audit, quality samples, iOS Simulator smoke. Local commits only; nothing pushed/deployed.
**Decisions added (autonomous, reversible, evidence in the cited files):**
| # | Decision | Evidence |
|--|--|--|
| D15 | Engine design: byte window `[min·1024, max·1000]`; integer-quality bisect + continuous scale search; verify real `blob.size` + magic bytes of every candidate; statuses ok/raised/below_min/above_max/above_max_fixed; **no padding** (`allowPadding` rejected) | `docs/engine/ENGINE.md`, property tests, independent engine review |
| D16 | Limits: file ≤ 25 MiB, source ≤ 100 MP (by header, before decode), **output ≤ 16 MP / 16384 px** (iOS canvas cap), reduced-size decode above 12 MP, ≤ 20 encodes, timeouts; large sources (>36 MP) get no preview | review F1/F3, audit F1; real-phone tuning pending (BLOCKERS H2) |
| D17 | Header-first rejection at file pick via `inspectFile` (no object URL, no decode); truncated JPEG/PNG/WebP are `corrupt` (Safari otherwise returns a grey partial decode) | audit F1/F2, simulator |
| D18 | Transparency: Auto keeps alpha; JPEG needs a visible background choice + disclosure; opaque PNG with a size limit preselects JPEG with a visible note (not silent) | UI review M5 |
| D19 | The original file may be offered only as a secondary download ("keep original"), with an explicit location-data warning when EXIF GPS is present | audit F3 |
| D20 | Verifiers: parse5 HTML checker + `verify-privacy`; `[[HUMAN: …]]` markers are listed under STRICT=1 and fail under STRICT=2 (`verify:html:final`) — launch gate stays strict, no rule weakened | `docs/verification/VERIFIERS.md` |
| D21 | Dependencies added (all pinned exactly, with reasons): `parse5` (HTML parsing), `preact` 11.2.0 + `@astrojs/preact` 6.1.5 (islands), `axe-core` 4.14.0 (test-only a11y), `sharp` 0.35.5 (dev-only fixtures/OG; already transitive) | package.json |
| D22 | No Firefox/Playwright-WebKit download without owner approval; opt-in projects `PW_ALL_BROWSERS=1`; WebKit evidence from the iOS Simulator only (labelled simulator) | BLOCKERS H3 |
| D23 | Scope kept: no PDF tools, no backend/auth/DB, no analytics, no ads, ad-free tool pages | owner brief |
**Independent reviews in the sprint (each by a separate read-only agent, findings fixed and re-tested):** engine review (no false-success case; 1 HIGH, 4 MED, rest LOW fixed); UI+content review (0 critical; copy errors, crop-field bug, OOM misclassification fixed); Preact review (keep-with-fixes: anchored allow-list, exact pins, explicit imports, test conventions); final audit (no prohibited actions, no weakened gates; F1–F11 fixed: header-first preview, truncated files, keep-original secondary, `data-mode`, docs, pins). A **second final pass** (HEAD cd65226) found 0 critical/high issues; its findings A1–A8 (Escape focus, preview resize robustness, pick-time truncation check, valid-JPEG tolerance, alpha-probe limits, percentage cap, .vitest artefact, parse5 pin, doc corrections) are being fixed and listed in `BUILD_STATUS.md`.
**Remaining critical/high risks:** none critical. HIGH: real phones untested; Firefox untested; owner markers/legal/trademark pending; demand risk; deploy safety depends on repo + ruleset (all in `BLOCKERS.md`).
**§8/§8b statuses above remain valid history;** D4 (Node pin) is still "pending first CI run".
