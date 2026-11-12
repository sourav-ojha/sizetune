# QA/TEST_RESULTS.md — actual commands and results

Date 2026-11-12 · the local `main` commit that adds these figures (`git log -1 -- QA/TEST_RESULTS.md`)  · Node 24.12.0 (`.nvmrc` = 24) · macOS arm64 · system Google Chrome 157 (Playwright `channel:'chrome'`) · Preact 11.2.0 islands · nothing deployed.
All numbers below are from actual runs (log: `pnpm run verify`, exit 0). Do not add the Playwright totals to the engine-only total: they overlap (see notes).

## 1. Full gate: `pnpm run verify` (exit 0)
Chain: `astro check` → `build` → `vitest run` → `verify:html` → `verify:html:strict` → `verify:privacy` → `playwright test` (all `e2e/`).
| Step | Result |
|--|--|
| `pnpm exec astro check` | 95 files · 0 errors · 0 warnings · 3 hints |
| `pnpm run build` | 8 pages built; sitemap-index + sitemap-0 written |
| `pnpm exec vitest run` | **23 files, 672 tests passed** (per-folder counts in §2 notes) |
| `node scripts/verify-html.mjs` | `verify:html OK`; reports 9 `[[HUMAN: …]]` placeholders as pending |
| `STRICT=1 node scripts/verify-html.mjs` | `verify:html OK (STRICT=1)` (no unmet launch rules; placeholders listed) |
| `STRICT=2 node scripts/verify-html.mjs` (`pnpm run verify:html:final`) | **FAILS by design** while the 9 owner markers remain (about 2, privacy 4, terms 3) — the pre-launch gate |
| `node scripts/verify-privacy.mjs` | `verify:privacy OK` (no third-party origins/trackers; JS network-primitive scan clean; allow-list external-url ≤ 6 namespace URLs in the Preact core chunk, dyn-import ≤ 1 proven literal) |
| `pnpm exec playwright test` (chrome project) | **188 passed, 0 failed** (~2.6 min) |

Notes: the 188 include the engine browser specs (`e2e/engine`, 35 incl. `m6-ui-repro`) because `testDir: 'e2e'` is recursive. `pnpm run test:engine:e2e` (engine-only config) last ran 35 passed, 1 skipped (`m6-ui-repro`, runs only under the repo-wide config). Unit test counts (vitest verbose, measured): tests/engine **198** · tests/ui **95** · verify-html **165** + verify-privacy **157** = 322 · source-conventions **49** · content-spacing **8** — total **672** (no other test files).

## 2. What the automated tests cover (all Chrome, simulated Cloudflare runtime via `wrangler dev`)
- **Engine unit tests (198):** header parsers (fuzz, truncated, malformed), magic-byte sniffing, window math (1000/1024), search with fake encoders (monotone, non-monotone, 4:4:4 jump, impossible min/max, fixed dims, ≤20 encodes, cancel), statuses never lie (property tests), alpha handling and disclosure notes, option validation, error mapping, completeness (truncated JPEG/PNG/WebP), inspectFile.
- **Engine browser tests (Chrome, real encoder, 35 specs):** JPEG/PNG/WebP in/out, transparent PNG (keep alpha vs fill with disclosure), tiny files, 36 MP on the fly (≈0.33 s, memory +145–151 MB, Playwright-launched browser only), corrupt/unsupported (by magic bytes), EXIF orientation 6, GPS/Make/Model stripped, max/range/impossible/minimum raise/below_min, dimension-only, 10 repeated runs (no sustained growth), cancellation, stale protection, WebP-unsupported path (stubbed), output limits (16 MP), error-mapping injection, ignore-resize-at-decode browsers.
- **UI (unit + e2e):** presets, custom max, range, impossible messaging, format switching (magic bytes), transparent PNG default, opaque-PNG→JPEG preselect with note, larger-than-original (keep original secondary), before/after by keyboard, cancel/Escape, reset, drag-and-drop, window drop guard, header-first rejection (400 MP header rejected at pick with zero object URLs), 81 MP PNG preview RSS bound, crop editor (pointer/keyboard/numeric tab-order, EXIF-rotated source, 44 px touch handles), signature output pixel-exact, `data-mode` worker / main-thread fallback, Preact event semantics, no-JS content, 404 + 307 + cache headers, no uploads / no off-origin / no non-GET, zero CSP violations, pre-hydration file pick, stale result, object-URL balance.
- **Accessibility (axe-core 4.14.0 via CDP, WCAG 2.0/2.1/2.2 A/AA + best-practice):** 8 pages × 2 widths and 12+ tool states: **0 violations**; harness self-test plants violations; 17 keyboard/reflow/semantics tests. Not covered: VoiceOver/TalkBack/NVDA, forced-colors/dark mode, real browser zoom, text-spacing overrides (`QA/ACCESSIBILITY.md`).
- **HTML/SEO/privacy verifiers:** parse5-based; each rule has negative mutation tests on temp copies of `dist/` (see `docs/verification/VERIFIERS.md`).

## 3. Other test evidence (not part of `pnpm run verify`)
| Evidence | Result | Scope |
|--|--|--|
| iOS Simulator (iPhone 17 Pro, iOS 26.3, Safari 26.3) engine harness, 23 cases (`docs/engine/CROSS_BROWSER.md`) | Statuses match Chrome; WebP encode unsupported → `encode_unsupported`; truncated JPEG/PNG/WebP now `corrupt`; Safari files 1–7× larger at same quality | **Simulator on Mac RAM, not a real phone** |
| iOS Simulator UI smoke (`QA/IOS_SIMULATOR_SMOKE.md`, 41 screenshots) | S1–S11, S13 pass; S12/S14 blocked; defects D1–D8 reported and fixed/triaged | Simulator only |
| Quality samples (`QA/QUALITY_SAMPLES.md`) | 33 real-engine cases for human eyeballing | Chrome, SSIM indicative, no real faces |
| Preact experiment (`docs/experiments/PREACT.md`) | first-load JS React 94.9/98.3 KB → Preact ≈35/38 KB gzip at merge time (now ≈39.1 KB image pages / ≈42.5 KB signature after the UI work added code; static import sums at gzip level 9; worker ≈13.1 KB on demand) | Chrome only |
| Independent reviews | engine (no false-success case, 24/30 mutants then fixes), UI/content, Preact migration, final audit (no prohibited actions, no weakened gates) | `docs/reviews/`, ADR |

## 4. NOT run / NOT verified
- **Real iPhone/Android phones** (`QA/REAL_DEVICE_TEST_PLAN.md`: not run). In-app browsers, low-RAM devices, real canvas/memory limits.
- **Firefox and Playwright-WebKit:** not installed (would need `pnpm exec playwright install firefox webkit`, a browser download I did not make without your approval). Config is ready: `PW_ALL_BROWSERS=1 pnpm exec playwright test`. Real WebKit evidence exists only from the iOS Simulator.
- GitHub Actions CI (no remote), Cloudflare build image Node version, live edge headers/CSP/certificate, Lighthouse/CrUX, screen readers, legal review, trademark (IP India), human portrait-quality review.
