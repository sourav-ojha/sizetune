# QA / PRODUCT_READINESS.md — SizeTune (2026-11-12)

Status legend: ✅ done & evidenced · 🟡 partly · ❌ not done · 👤 needs human/device. Evidence files: `docs/reviews/*.md`. Nothing here claims legal compliance.

## 1. Gate summary
| Gate | Status | Evidence / gap |
|--|--|--|
| G1 Architecture (static Astro + island, Workers static assets) | ✅ conditional | ADR v2; spike 8/8; 4 domain reviews + final independent review (conditional; findings fixed, second pass in ADR §8b) |
| G2 Generated-HTML SEO gate | ✅ tooling (tripwire) / ❌ content | `verify-html` rewritten + hardened after review; 41 negative-fixture tests prove each rule can fail; it is a build-time tripwire, not proof; `STRICT=1` fails on placeholder copy by design |
| G3 Privacy: no upload, no third-party origins on tool routes | ✅ | e2e: zero non-GET/off-origin requests; CSP e2e zero violations; verify rule P1 |
| G4 CSP | 🟡 | Astro built-in meta CSP (hashes) + `frame-ancestors` header; tested Chrome only; ad-route CSP untested draft |
| G5 Compression engine production-ready | ❌ | see §2–3; spike has known defects |
| G6 Real-device compression | 👤❌ | see §3 |
| G7 Content (launch set copy, about, terms, privacy) | ❌ | placeholder copy |
| G8 Cloudflare deployment | 🟡 | local workerd verified; no deploy; first deploy = production; repo/ruleset pending (BLOCKERS H1–H4, H12) |
| G9 Performance (Lighthouse/CrUX, mobile) | ❌ | only bundle sizes measured (71.8 KB gz tool page JS; 0 on content pages) |
| G10 Accessibility | ❌ | basic labels only; no audit |
| G11 Legal/brand (IP India TM, policies) | 👤❌ | USPTO exact search: no "sizetune" hits (screening only) |

## 2. Compression engine — production requirements (from `docs/reviews/compression-review.md`)
**Verified facts (measured 2026-11-12):** Chrome 157 (macOS), Android Chrome 133 (throwaway emulator, deleted afterwards; user AVD untouched), Safari 26.3 (iOS Simulator). Corpus: system wallpapers + synthetic fixtures; luma SSIM at 640 px; no faces.
- Current spike algorithm fits the target only in the middle range; **ladder floor 0.3 + q=0.05 last resort**: 20 KB target → 8.9 KB, SSIM 0.835 (continuous search: 18.9 KB, 0.947). 48 MP @ 50 KB → SSIM 0.89. iOS Safari: `fits=false` at 36/48 MP (encoder output 1.4–1.9× larger at same quality).
- Chrome quality is integer percent; use integer bisect. Size ≈ monotone in q (rare violation). Chrome emits 4:2:0 except q=1.0 (4:4:4, size jump) and a 472 B ICC profile (strip = −474 B, 0 pixel difference).
- Memory: full decode 36 MP ≈ +1.0 GB RSS (2.3 s) vs decode-at-reduced-size ≈ +0.32 GB (0.9 s); 48 MP +1.4 GB vs +0.44 GB. Android Chrome silently decodes >~20 MP at reduced size. iOS Simulator allocated 8192² canvases (Mac RAM) — **real iPhone limits unverified**.
- EXIF orientation 6 applied automatically in all three engines (also in Worker, also with `resizeWidth`); `imageOrientation:'none'` no longer disables it. Re-encode strips Make/Model/GPS everywhere (Safari leaves a 76 B Exif stub).
- Transparency: JPEG needs a background (white default, user-selectable); PNG/WebP keep alpha; **WebP encode unsupported in Safari** (silently PNG) and AVIF mislabelled → check `blob.type` **and** magic bytes after every encode. WebP is not better than a well-searched JPEG on tested photos.
- Min/max windows: raising JPEG quality (≤q100) is an honest way to reach a minimum (1500×1960 → fixed 200×230: 17.1 KB@q95 → 21.4 KB@q97). A 140×60 signature caps at 4.65 KB at q100: **below_min is reported, not faked**.
- **Padding policy:** metadata/COM padding is technically valid (decodes) but adds no image information and vanishes on any re-encode. **Not shipped by default.** Only as an explicit, opt-in, disclosed "advanced" option after a product/legal decision (human).

**Spec adopted (`fitRange`):** byte window `[min·1024, max·1000]` (satisfies both KB readings; show exact bytes); Phase A fixed dims q95 → bisect q∈[40,95]; Phase B continuous scale bisect at q60 then integer q bisect [60,95]; if below min at q95 → probe q100 and bisect (95,100]; statuses `ok | raised | below_min | above_max | above_max_fixed`; ≤20 encodes, per-encode timeout, cancel on new file; never show success unless `lo ≤ size ≤ hi`; no ladder, no q=0.05 last resort; min side 64 px. Messages for each status are drafted in the review §7.

## 3. Roadmap and acceptance tests
| Stage | Scope | Acceptance | Owner |
|--|--|--|--|
| 0 | Fixture generators (script, no downloads): EXIF-6+GPS JPEG, RGBA PNG, signature PNG, 200×230, noise, 12 MP smooth | `npm test` regenerates; Playwright: orientation, no Make/Model/GPS bytes, RGBA corner colours | AGENT |
| 1 | Pure `fitRange()` + tests (fake monotone/non-monotone/4:4:4-jump encoders, window gap, statuses, ≤20 encodes) | vitest green; replaces ladder | AGENT |
| 2 | Worker pipeline: header dims read, resize-at-decode >12 MP, single canvas, `bitmap.close()` in `finally`, terminate on cancel, typed errors | 36 MP < 5 s, peak RSS Δ < 600 MB (Chrome), no leak after 5 runs | AGENT |
| 3 | Alpha detect + bg picker, PNG/WebP gated by magic bytes, optional ICC strip | exact pixel tests; stubbed PNG-for-WebP fallback handled | AGENT |
| 4 | UI: min+max inputs, dims presets, status messages, no primary Download unless `ok`/`raised` | e2e per status; aria-live; mobile viewport | AGENT |
| 5 | Cross-browser matrix (Chrome + Playwright WebKit as Safari proxy; iOS-simulator manual script) | matrix JSON committed; CI fails on `fits` regression | AGENT |
| 6 | **Real-device gate:** ≥3 phones (iPhone 2–4 GB, 2 Android ≤3 GB), 12 MP & 48 MP photos, in-app browsers (WhatsApp/Instagram), note time, success, OOM/tab kill | table of results; fail = lower max-pixel cap | 👤 HUMAN |
| 7 | Optional: WASM progressive/mozjpeg (+~3.5% measured for progressive); HEIC input; opt-in filler | decision after launch | later |
Human portrait review (5–10 passport-style photos at 20 KB) is needed because SSIM on landscapes under-penalises faces.

## 4. Other QA gates (before any public launch)
- `npm run verify` green on pinned Node in CI (first CI run pending H1).
- `STRICT=1 npm run verify:html` green with real copy; Rich Results/Schema check; Lighthouse mobile (LCP < 2.5 s, CLS < 0.1, INP < 200 ms) on the **local `wrangler dev` build** (no preview URL exists; real-edge/CrUX numbers only after the first production deploy); WCAG pass; keyboard-only use; screen reader on tool.
- Live headers check on `sizetune.com` **immediately after the first deploy** (there is no preview host by config; see BLOCKERS H12/B11): CSP meta, `frame-ancestors`, cache headers, 307/404.
- Privacy statements re-audited against final page set (security review §5) — no ad/analytics script on tool routes.
