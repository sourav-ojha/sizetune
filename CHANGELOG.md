# CHANGELOG — SizeTune (local only; nothing released or deployed)

## Unreleased — autonomous product build sprint (2026-11-12)
### Added
- **Compression engine** (`src/lib/engine/`, docs `docs/engine/ENGINE.md`): JPEG/PNG/WebP input validated by magic bytes; dimensions read from file headers before decoding; reduced-size decode for large sources; byte-window targeting `[min·1024, max·1000]` with integer-quality bisect + continuous scale search (≤20 encodes); statuses `ok | raised | below_min | above_max | above_max_fixed`; real `blob.size` and magic-byte verification for every candidate; no metadata padding (`allowPadding` rejected); alpha never flattened silently (disclosure notes); WebP capability probe `canEncode()`; Web Worker client with cancellation, timeout, stale protection; main-thread fallback by feature detection only; optional ICC strip; EXIF orientation + GPS/Make/Model stripping verified by tests.
- **Image tool UI** (`src/components/ImageTool.tsx`, `src/components/tool/*`): drag-and-drop + picker, presets 10/20/30/50/100/200 KB + custom, min–max range, advanced options (dimensions with aspect lock, max dimensions, fit, strategy, transparency background, enlarge), before/after compare, honest impossible-target warnings, cancel/reset, object-URL ownership.
- **Signature tool** (`src/components/SignatureTool.tsx`): crop overlay (pointer + keyboard), numeric crop, auto-trim, output size, presets/range, signature guidance.
- **Launch content**: `/`, `/resize-image-to-20kb/`, `/resize-signature/`, one guide, `/privacy/`, `/about/`, `/terms/`, 404; OG image; WebApplication/Article JSON-LD (no FAQPage). Owner-input markers: `[[HUMAN: …]]`.
- **Verification**: parse5-based `verify-html` (FAIL / LAUNCH / PLACEHOLDER rules; `STRICT=1`, `STRICT=2`), `verify-privacy` (third-party origins, trackers, JS network primitives), 300+ mutation tests (`docs/verification/VERIFIERS.md`).
- **Test infrastructure**: engine browser tests (`e2e/engine`), iOS Simulator harness (`e2e/engine/sim`, simulator results only), fixture generator incl. `--device-pack` for phone tests, UI/a11y e2e, opt-in Firefox/WebKit Playwright projects (`PW_ALL_BROWSERS=1`).
- `QA/REAL_DEVICE_TEST_PLAN.md` (manual phone checklist; NOT run).
### Changed
- Islands migrated React 19 → **Preact 11.2.0 (compat)** (`@astrojs/preact` 6.1.5, pinned exactly); first-load JS on tool pages ≈95–98 KB → ≈39–42 KB gzip; verifier allow-list re-audited and anchored.
- Review-driven fixes: output limits (16 MP), header-first rejection at file pick, reduced-size preview, truncated-file detection, narrowed `out_of_memory`, keep-original secondary + GPS note, Escape cancels, 44 px crop handles, accessibility audit (axe-core 4.14.0, test-only).
- `engines.node` >=24; `sharp` pinned as devDependency (fixtures/OG generation only).
- `.nvmrc` = 24; `npm run verify` now also runs `verify:html:strict` and `verify:privacy`.
- Spike compression code (`src/lib/compress.ts`, old worker, `ImageCompressor.tsx`) removed; superseded by the engine.
### Not changed (by decision)
- Astro static output, Workers static assets (config only, nothing deployed), ad-free tool pages, no analytics. (Islands were React; migrated to Preact 11 compat after evaluation and independent review — see below.)
