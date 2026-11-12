# QA/PRODUCT_READINESS.md — feature-by-feature readiness (2026-11-12, after the build sprint)

Legend: ✅ implemented + verified by automated evidence · 🟡 implemented, evidence partial (see note) · ❌ not implemented · 👤 needs your device/approval. "Evidence" paths are in this repo; counts are in `QA/TEST_RESULTS.md`. Nothing here claims legal compliance, WCAG conformance certification, or real-device verification.

## 1. Gates
| Gate | Status | Evidence / gap |
|--|--|--|
| Architecture (Astro static + Preact islands, Workers static assets) | ✅ | ADR v3; independent reviews; nothing deployed |
| Full local verify chain | ✅ | `pnpm run verify` exit 0: 672 unit, 188 browser (Chrome), verifiers OK |
| HTML/SEO structure | ✅ | parse5 verifier + ~320 mutation tests; STRICT=1 OK |
| Launch gate with owner markers | 👤 | STRICT=2 fails until the 4 remaining `[[HUMAN]]` markers are resolved |
| Privacy: no uploads / no third-party origins / no trackers / CSP | ✅ (Chrome, local) | e2e network + CSP-violation tests; verify:privacy; live edge untested |
| Accessibility (automated) | ✅ / 👤 | axe-core 0 violations on 8 pages×2 widths + 12 tool states; screen readers not done |
| Compression correctness in Chrome | ✅ | engine unit + browser tests; independent review |
| WebKit (simulator only) | 🟡 | engine harness 23 cases + UI smoke; Mac RAM; not a phone |
| Firefox 159 / Playwright WebKit 27.2 | ✅ | full e2e + engine suites pass (2026-11-13); not real Safari/iPhone, real devices deferred |
| Real phones | 👤❌ | `QA/REAL_DEVICE_TEST_PLAN.md` not run |
| Performance (Lighthouse/CrUX) | ❌ | only bundle sizes: first-load JS ≈39.1 KB (image pages) / ≈42.5 KB (signature) gzip, worker ≈13.1 KB on demand; 0 JS on content pages |
| Legal / trademark | 👤❌ | USPTO exact search no hits (screening); IP India + lawyer pending |
| CI / deploy | ❌ | no remote; CI file written, never run; Cloudflare unconnected |

## 2. Engine features (requirement → status)
| Requirement | Status | Evidence / note |
|--|--|--|
| JPEG/PNG/WebP input, magic-byte validation; SVG/HEIC/GIF rejected | ✅ | tests; Chrome + Simulator |
| JPEG/PNG/WebP output where supported | ✅ | WebP probe `canEncode`; Safari reports unsupported (simulator) |
| Maximum size | ✅ | window `[·, max·1000]`, verified on real bytes |
| Min–max range | ✅ | raise quality ≤q100 (and pixels only with `allowEnlarge`) |
| Target size behaviour | ✅ | aims at/below max; ok within window; best effort + honest status otherwise |
| Width/height, max dims, aspect lock default, fit modes, crop | ✅ | unit + e2e (signature crop pixel-exact) |
| Quality-first vs dimensions-first | ✅ | search tests; UI control |
| Actual Blob verification; never claims unmet target | ✅ | property tests; mutation review |
| Worker + main-thread fallback | ✅ / 🟡 | worker default; fallback by feature detection tested in Chrome only |
| Memory-conscious decode, large images | ✅ Chrome / 👤 phones | 36 MP→50 KB ≈0.33 s, +145–151 MB; header-first limits; 16 MP output cap |
| EXIF orientation | ✅ | Chrome + Simulator |
| Location metadata stripped | ✅ | test with GPS fixture; original-file download is secondary and warns when GPS present |
| Transparency disclosed, not silently flattened | ✅ / 🟡 | notes + UI choice; detection exhaustive ≤12 MP; >12 MP reduced-size decode can miss sub-pixel transparent areas → explicit note; opaque PNG→JPEG preselect is visible |
| Corrupt/unsupported/truncated/huge handling | ✅ | header fuzz; truncated JPEG/PNG/WebP → `corrupt`; Simulator-verified |
| Impossible-target detection/messaging | ✅ | `below_min`, `above_max(_fixed)`, tests + copy |
| Cancellation, stale-result protection | ✅ | unit + e2e |
| Object URL cleanup | ✅ | e2e balance tests |
| Limits (bytes/pixels/time/encodes) | ✅ | `limits.ts`; real-phone tuning pending (H2) |
| Padding | ✅ (disabled) | `allowPadding` rejected; never default |

## 3. Image tool UX
| Requirement | Status |
|--|--|
| Picker + drag-and-drop, formats and size cap shown | ✅ |
| Preview, before/after (touch + keyboard) | ✅ (very large sources: no preview by design) |
| Original/output dims + sizes + compression % | ✅ |
| Format selection, quality control | ✅ |
| Presets 10/20/30/50/100/200 KB + custom + range | ✅ |
| Dimension controls + aspect lock (Advanced `<details>`) | ✅ |
| Progress, cancel (Escape), download, reset | ✅ |
| Useful errors, impossible-target explanations | ✅ |
| Responsive mobile-first | ✅ (no horizontal scroll at 320/375 px in Chrome; simulator smoke) / 👤 phones |

## 4. Signature tool
Crop/position (pointer, keyboard, numeric), auto-trim, output size, aspect handling, presets/range, preview, download, guidance, impossible-minimum messaging: ✅. Drawing pad: ❌ (not in scope). No invented exam/government specs: ✅ (copy tells users to follow their form).

## 5. Content / SEO
Launch set built (7 pages + 404): ✅. Titles/descriptions/H1/canonical/OG/WebApplication+Article JSON-LD/no FAQPage/sitemap/robots/trailing slashes/noscript content: ✅ (verifier). Useful original copy: ✅ by verifier thresholds (unique words 936–1573 on tool/home/guide) and independent review; **human review of tone/accuracy recommended**. Owner facts: 👤 (9 markers). Rich-result/schema validation in Google tools: 👤. Search performance: unknowable before launch.

## 6. Security/privacy checks
No uploads ✅ · no third-party origins on tool pages ✅ · no ad/analytics code ✅ · CSP meta (hashes) + frame-ancestors header ✅ (local) · MIME/signature validation ✅ · malformed/huge inputs ✅ · no image logging ✅ · no storage/cookies ✅ · privacy/terms text honest about current behaviour ✅ (legal review pending 👤).

## 7. Known limitations (honest list)
See `BUILD_STATUS.md` "Implemented but not fully verified" and `BLOCKERS.md` §B. Highlights: no real-device evidence (deferred by owner); Safari sizes differ and WebP is unavailable there; quality on real faces unreviewed; sources >100 MP refused and >36 MP get no preview; output capped at 16 MP; main-thread fallback untested on real old browsers; verifiers are static analysis, not proof.
