# SizeTune master execution plan (updated 2026-11-12, post architecture-closure gate)

Status key: DONE · NEXT · GATED (waits on a gate/human) · HUMAN. Companion files: `ARCHITECTURE_DECISION_RECORD.md`, `BLOCKERS.md`, `QA/PRODUCT_READINESS.md`, `docs/reviews/*`.

## Phase 0 — Research (DONE)
Niche discovery → N1 validation (CONDITIONAL GO, "KB + signature resizer") → domain shortlisting (history preserved in `research/domains/final-selection-2026-11-12/`; that report recommended `kbwand.com`, nothing was bought at the time).
**Domain status (updated):** the user chose and registered **`sizetune.com`** on 2026-11-12. Verified by RDAP at 05:19Z: created 04:48:59Z, expires 2027-11-12, registrar Cloudflare, Inc., Cloudflare nameservers, clientTransferProhibited, no A record, nothing served. Trademark: USPTO exact-wordmark "sizetune" → no hits (positive controls passed); IP India not checked; no clearance claimed.

## Phase 1 — Architecture (DONE this session)
Spike 8/8; 5 independent reviews (compression, SEO/rendering, Cloudflare, security/privacy, final architecture; the last one conditional, fixes applied, second pass recorded in ADR §8b); decisions finalised in ADR §3; verifier, CSP, headers, CI, wrangler config hardened. Architecture is closed subject to ADR §8b; **product is not ready** (`QA/PRODUCT_READINESS.md`).

## Revised work-package order (nominally 3 days of agent work; **a gated launch realistically takes 5–7 days** because human items — device tests, trademark, legal, identity, repo setup — have no turnaround)
Agents work in parallel on disjoint files; humans in bold. Step IDs H# = `BLOCKERS.md`.
**Day 1 — engine + foundations**
- A2 Stage 0 fixtures + Stage 1 pure `fitRange()` with tests (`src/lib/`, `tests/`).
- A3 Stage 2 worker pipeline (resize-at-decode, memory discipline; fixes S-05) (`src/lib/*.worker.ts`).
- A1 Preact-compat swap (`@astrojs/preact`, `client:idle`, fix 6 type errors/1 test; ≈0.5 d) — **only after owner veto window H8**, gated by e2e + a WebKit run; independent of A2/A3.
- A4 CI hardening already written; **H1 push repo, H2 ruleset** (can happen any time Day 1).
- A5 Draft real copy outlines for `/`, `/resize-image-to-20kb/`, `/resize-signature/`, guide, about, terms, privacy (agent writes; human approves).
**Day 2 — product UI + content**
- A6 Stage 3 alpha/format, Stage 4 range UI + status messages.
- A7 Signature mode (own UI) + page.
- A8 Write launch copy (unique words per `verify-html` STRICT thresholds), og:image, nav/`/guides/` fix, About/Terms.
- A9 Stage 5 WebKit/iOS-simulator matrix.
- **H3 zone/account, H6 IP India TM search, H9 author identity + legal, H13 contact mailbox, H15 og:image.**
**Day 3 — gates**
- A10 `STRICT=1` green, Lighthouse mobile on local build, accessibility pass, final independent review + fixes.
- **H7 real-device test (≥3 phones)** — a failure forces a lower pixel cap and rework (schedule slip).
- **There is no preview deploy:** the first deploy is production (BLOCKERS H12/B11). Only after H2 and explicit owner approval; H5 www decision.
- No public production release unless every BLOCKERS HIGH item is closed and the owner explicitly approves.

## Phase 3 — Launch prep (GATED)
Production deploy (human go), custom domain attach via `routes` (config prepared), Search Console/Bing, HSTS ramp after 1–2 stable weeks, privacy/terms lawyer review. AdSense only after content exists and strategy (H10) is chosen — **ads are not enabled and the tool routes stay ad-free by policy**.

## Phase 4 — Growth (LATER, evidence-driven)
Additional preset pages only on Search Console evidence; (PDF/document tools are NOT in scope until the owner decides); optional WASM encoder; Cloudflare Web Analytics only after a consent decision.

## Standing rules
Never purchase, change DNS, enable ads or publish production without explicit approval. `pnpm run verify` stays green. Every indexable page passes `verify:html`; launch also needs `STRICT=1`.

## Update after the build sprint (2026-11-12 afternoon)
**Done locally (see `BUILD_STATUS.md`):** engine (A2/A3), range UI + statuses (A6), signature mode (A7), launch copy + OG + About/Terms (A8), cross-browser lab via iOS Simulator (A9, simulator only), STRICT gate green except owner markers (A10 partial), Preact swap (A1, executed after engine work; kept), axe-core accessibility audit, quality samples, independent reviews.
**Revised remaining work (work-package order; realistic 3–5 days of elapsed time because most items are yours):**
1. You: fill markers (BLOCKERS H1), real-device tests (H2), Firefox/WebKit approval+run (H3), trademark/legal (H4), human quality review (H10), screen-reader pass (H11).
2. You: GitHub repo + ruleset + CI (H5), decide staging (H6), zone/account + mailbox (H7), www (H8), og image (H9).
3. Agents (after your results): fix real-device findings (limits tuning), engine quality tuning backlog (`QA/QUALITY_SAMPLES.md`), re-run all gates, `verify:html:final`.
4. Launch only with your explicit approval; then HSTS/Search Console (H13). Ads only per H12 and never on tool pages.
**Scope guard:** no PDF/document tools in this phase; the earlier "PDF/doc size tools" growth idea is deferred beyond launch and requires an owner decision.
