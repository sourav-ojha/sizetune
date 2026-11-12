# Cross-browser engine harness (Chrome, Safari, iOS Simulator)

**Simulator results are simulator results.** The iOS Simulator runs WebKit on the Mac's CPU and RAM: it proves WebKit *behaviour* (encoder output, formats, orientation, metadata, API support), **not** iPhone memory limits, tab kills or speed. Real-device proof = `QA/REAL_DEVICE_TEST_PLAN.md`.

## 1. How it works
The same esbuild bundle used by the Chrome e2e tests (`.tmp/engine-e2e/engine.js` + `worker-real.js`, built by `e2e/engine/global-setup.ts`) and the same page helpers (`e2e/engine/harness-page.js`) are served by a tiny local server:

```
node e2e/engine/sim/server.mjs 8799          # Node 24; bundles the engine, binds 127.0.0.1 only
xcrun simctl openurl booted http://127.0.0.1:8799/sim.html
# optional: ...sim.html?only=jpeg-max50,cancel
```
- `sim.html` runs every case in `e2e/engine/sim/cases.js` in order and POSTs one JSON line per case to `/report` on the **same local server**; lines are appended to `.tmp/engine-sim-results.jsonl` (git-ignored). Done when a `{"name":"done"}` line appears. The page also shows progress.
- The simulator shares the host network namespace, so `127.0.0.1` works without LAN exposure. Nothing is sent anywhere else; fixtures come from `tests/fixtures/` (+ `.generated/photo-12mp.jpg` from `node scripts/gen-fixtures.mjs`).
- Desktop Safari: open the same URL in Safari (Develop menu not needed). Desktop Chrome comparison: open the URL in Playwright (`chromium.launch({channel:'chrome'})`) and move the results file aside afterwards.
- Real phones (manual): run the server with `0.0.0.0` instead of `127.0.0.1` only on a trusted LAN, or prefer the product page from `QA/REAL_DEVICE_TEST_PLAN.md`.
- Playwright WebKit is **not** used (it would require a browser download, which this project forbids).

## 2. Measured 2026-11-12 — same case list, same fixtures
Environments: **desktop Chrome 157.0.8103.52** (headless, macOS arm64) and **iOS Simulator iPhone 17 Pro, iOS 26.3, Safari 26.3** (UA string reports "iPhone OS 18_7", which is WebKit's frozen UA). Both ran the engine in a **module worker** (`engineMode() = 'worker'`). `canEncode`: Chrome jpeg/png/webp = true/true/true; Safari = true/true/**false**.

| case | Chrome (bytes, dims, q, encodes, engine ms) | iOS Simulator Safari |
|--|--|--|
| 1200×800 JPEG, max 50 KB | ok 47,219 B, 1200×800, q58, 8, 103 ms | ok 48,671 B, 898×599, q60, 5, 234 ms |
| 12 MP photo, max 100 KB | ok 99,003 B, 3201×2401, q60, 5, 533 ms | ok 98,853 B, 1748×1311, q60, 5, 938 ms |
| 12 MP, range 20–50 KB | ok 49,997 B, 1917×1437, q60, 6, 414 ms | ok 48,710 B, 1084×813, q60, 6, 808 ms |
| 12 MP, range 19–20 KB | ok 19,913 B, 912×684, q60, 8, 384 ms | ok 19,964 B, 564×423, q60, 7, 680 ms |
| 36 MP generated, max 50 KB | ok 48,943 B, 752×752, q60, 6, 316 ms | ok 48,507 B, 472×472, q60, 7, 616 ms |
| 48 MP generated, max 50 KB | ok 49,733 B, 838×629, q60, 6, 354 ms | ok 49,970 B, 534×401, q60, 6, 665 ms |
| transparent PNG, auto/keep | ok PNG 16,244 B, alpha kept | ok PNG 17,067 B, alpha kept |
| transparent PNG → JPEG white | ok 14,488 B, corner 255,255,255, note shown | ok 30,674 B, corner 255,255,255, note shown |
| EXIF-6 orientation | 300×400, top red / bottom blue | 300×400, top red / bottom blue |
| GPS/Make/Model in output | absent; no APP1 | absent; **Exif APP1 stub present** (no Make/Model/GPS) |
| signature 140×60, 10–20 KB | below_min, 8,862 B at q100 | **raised**, 10,865 B at q100 (Safari's encoder is larger) |
| raise, fixed 200×230 (min = 1.12 × q95) | raised q97, 14,066 B (q95 = 10,632) | raised q100, 42,253 B |
| noise, max 0.5 KB, free | above_max 779 B at 64×64 q1 | above_max 1,147 B at 64×64 q1 |
| noise, max 0.5 KB, fixed 256² | above_max_fixed 1,891 B q1 | above_max_fixed 14,609 B q1 |
| format webp requested | ok WebP 48,066 B | **`encode_unsupported`** |
| WebP input, auto | ok WebP 44,232 B | ok **JPEG** 49,620 B + "WebP can't be saved in this browser…" note |
| stripIcc | 7,955 → 7,481 B (ICC removed) | 18,543 B both (Safari writes no ICC; no-op) |
| corrupt (garbage after SOF) | `corrupt` | `corrupt` |
| truncated JPEG | `corrupt` | ok (partial decode, grey remainder) — **fixed**: re-run after the completeness check: `corrupt` |
| truncated PNG / WebP (re-run) | `corrupt` / `corrupt` | `corrupt` / `corrupt` |
| JPEG + text tail / + 70 KB video-like tail (re-run) | ok 200×230 / ok | ok 200×230 / ok |
| `inspectFile(exif6-gps.jpg)` (re-run) | 300×400, orientation 6, hasGps true | same |
| SVG renamed .png | `unsupported_type` | `unsupported_type` |
| cancel at attempt 2 (36 MP) | `cancelled` 0 ms after abort | `cancelled` 2 ms after abort |
| 10 × 12 MP @ 100 KB (ms each) | 399–471 | 554–597 |

Observations: Safari picks smaller dimensions for the same byte target because its JPEG encoder output is larger at the same quality (as found in compression-review §1.2); the continuous search handles it with no `fits=false` at 36/48 MP (the old ladder failed there). Raised results can need q100 on Safari. Everything the contract promises (statuses only inside the window, magic-byte-verified type, orientation, no GPS, WebP detection) held in both.

## 3. Re-running / extending
- Add a case: append `[name, async () => summary]` to `e2e/engine/sim/cases.js` (keep summaries small; never post image bytes).
- Compare runs: each line is `{name, ms, r}`; a 10-line Python/Node script can diff Chrome vs Safari files.
- Not covered here (needs hardware): iPhone canvas/JetSam limits at 12–48 MP, Android low-RAM tab kills, in-app browsers, older iOS (< 16.4 lacks OffscreenCanvas 2D → main-thread fallback path, untested on a real old device).
