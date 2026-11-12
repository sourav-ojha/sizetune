# BUILD_STATUS.md — SizeTune autonomous build sprint (2026-11-12)

Commit: local `main` (see `git log`; latest at time of writing `5283e60` + docs). **Not pushed, not deployed, no remote, no ads/analytics, no DNS change, nothing purchased.** Evidence: `QA/TEST_RESULTS.md`. Honest status vocabulary: **V** = implemented and verified by automated tests/evidence listed; **P** = implemented, not fully verified; **N** = not implemented; **H** = needs your device/approval.

## Summary
A functional, locally committed product candidate: browser-only image resizer + signature resizer, production-style compression engine, 7 launch pages + 404, hardened HTML/privacy/CSP gates, Preact 11 islands, accessibility audit with axe-core. It is **not launch-ready**: the owner markers, real-device tests, legal review and repo/CI/deploy decisions remain (see `BLOCKERS.md`).

## Implemented and verified (V)
| Area | What | Evidence |
|--|--|--|
| Engine | JPEG/PNG/WebP in (magic bytes), JPEG/PNG/WebP out (WebP only where encodable), max, min–max, window `[min·1024, max·1000]`, integer-quality bisect + continuous scale, quality-first/dimensions-first, width/height/max dims/aspect lock/fit/crop, real blob.size + magic-byte verification of every candidate, statuses ok/raised/below_min/above_max/above_max_fixed, **no padding** (`allowPadding` rejected), alpha never silently flattened, EXIF orientation, GPS/Make/Model stripped (re-encode), ICC strip option (sRGB only), header-first limits (25 MB, 100 MP source, 16 MP output), reduced-size decode, truncated-file detection, cancellation/timeout/stale protection, worker + feature-detected main-thread fallback, typed errors incl. narrowed `out_of_memory` | 187 engine unit tests, 31 Chrome browser specs, independent engine review (no false-success case found), iOS Simulator harness (simulator only) |
| Image tool | picker + drag-and-drop, formats/limits info, header-first rejection, reduced-size preview, before/after (keyboard), original/output dims + sizes + %, format picker (WebP disabled where unsupported), presets 10/20/30/50/100/200 KB + custom, optional min–max, Advanced (dims, aspect lock, max dims, fit, strategy, enlarge, transparency background), progress + Cancel/Escape, download, reset, honest impossible-target warnings (never shown as success), larger-than-original handling, error mapping, object-URL cleanup | 87 UI unit tests, ≈70 UI e2e, a11y suite, independent UI review (fixes applied) |
| Signature tool (`/resize-signature/`) | crop overlay (pointer/keyboard/numeric/auto-trim), output size, presets/range, JPEG default (PNG if alpha), impossible-minimum messaging, guidance; pixel-exact crop test incl. EXIF-rotated source | e2e (`e2e/ui/signature.spec.ts`) |
| Launch content | `/`, `/resize-image-to-20kb/`, `/resize-signature/`, guide, `/privacy/`, `/about/`, `/terms/`, 404; unique words 936–1573 (tool/home/guide), titles/descriptions, one H1, canonical (none on noindex 404), OG image, WebApplication + Article JSON-LD (no FAQPage), visible FAQ, noscript content, contextual links, sitemap/robots | `verify:html` STRICT=1 OK; independent content review (copy fixes applied) |
| Gates | parse5 HTML verifier + privacy verifier (third-party origins, trackers, CSP strictness, JS network primitives) with ~320 mutation tests; STRICT=1/2 semantics | `npm run verify` exit 0 |
| Accessibility | axe-core (WCAG 2.0–2.2 A/AA + best practice) on 8 pages × 2 widths and 12+ tool states: 0 violations; keyboard/reflow/semantics tests | `QA/ACCESSIBILITY.md` |
| Preact | migrated and kept: first-load JS ≈38.4 KB (image pages) / ≈41.8 KB (signature) gzip vs 94.9/98.3 KB with React at merge time; allow-list narrower and anchored; deps pinned exactly; independent review (keep-with-fixes, fixes applied) | `docs/experiments/PREACT.md` |
| Privacy/security | no uploads; zero non-GET/off-origin requests in e2e; CSP meta + `frame-ancestors` header; no inline styles/handlers; no storage/cookies; no third-party origins | e2e + verifiers |

## Implemented but not fully verified (P)
- **Safari/WebKit behaviour:** engine harness (23 cases) and UI smoke only in the iOS Simulator (Mac RAM); WebP encode unsupported there; Safari output sizes 1–7× Chrome. Real iPhone memory/canvas limits unknown.
- **Firefox:** nothing run (not installed; no download made).
- **Main-thread fallback:** tested in Chrome by deleting OffscreenCanvas; not on real old browsers.
- **Scroll anchoring fix (iOS)**: tested only in Chrome with scroll anchoring disabled.
- **Compression quality at 20 KB on real portraits:** no real face images available; SSIM indicative only (`QA/QUALITY_SAMPLES.md` for your eyeballing). Observed design point: quality is pinned (≈q60) when q40 cannot fit, so size targets mostly vary pixels.
- **Engine memory numbers:** Chrome desktop (Playwright-launched browser only), not phones.
- **CSP:** meta policy tested in Chrome; header + live edge unverified; no Report-Only possible for the meta policy.
- **Workers static assets config:** `wrangler.jsonc` prepared (custom domain route, workers.dev/previews off); only exercised locally via `wrangler dev`.

## Not implemented (N)
Deployment/staging (explicitly out of scope), GitHub repo/CI run, real analytics (none by decision), ads, HEIC/GIF/AVIF/SVG input, PDF utilities (out of scope), bulk processing, exact-pixel "form presets", metadata padding (deliberately never default), WASM encoders, Hindi/other languages, additional preset pages (50/100 KB etc.), Search Console setup.

## Requires you (H)
Fill the 9 `[[HUMAN: …]]` markers; real-device tests; Firefox/WebKit install approval; trademark (IP India) + legal review; repo + ruleset + CI; staging decision; www; og:image approval; contact mailbox; AdSense strategy. Exact steps: `BLOCKERS.md`.

## Sprint work log (commits on local main, oldest→newest, abridged)
baseline → engine contract → real-device test plan → launch content → parse5 verifiers → UI → engine → review-fix rounds (F1–F13, M1–M6, L1–L5) → Preact merge (+reviews) → audit fixes (F1–F11: header-first rejection, truncated files, keep-original secondary, data-mode) → iOS smoke defects → axe-core audit → quality samples → docs. `git log --oneline` for hashes.
