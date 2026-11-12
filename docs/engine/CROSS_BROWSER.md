# Cross-browser engine harness (Chrome, Safari, iOS Simulator)

**Simulator and Playwright-WebKit results are not real-device results.** The iOS Simulator runs WebKit on the Mac's CPU and RAM: it proves WebKit *behaviour* (encoder output, formats, orientation, metadata, API support), **not** iPhone memory limits, tab kills or speed. Real-device proof = `QA/REAL_DEVICE_TEST_PLAN.md`.

## 0. Playwright matrix (Chrome, Firefox, WebKit) — measured 2026-11-13
`PW_ALL_BROWSERS=1 pnpm exec playwright test -c e2e/engine/playwright.config.ts` adds `firefox` and `webkit` projects (Playwright builds; owner-approved install). Browsers: **Chrome 157.0.8103.52** (system), **Firefox 159.0**, **WebKit 27.2** (Playwright's macOS WebKit build — the Safari engine, **not Safari on a real iPhone**: no iOS memory limits, no JetSam, Mac CPU).

**Result (engine suite):** chrome 37 passed / 1 skipped; firefox 35 passed / 1 skipped; webkit 35 passed / 1 skipped. The skip in every project is the real-UI M6 loop (needs the built site; runs under the repo-wide config). Firefox/WebKit run 2 tests fewer because the two `@chromium-only` memory tests are excluded (they read process RSS via CDP `SystemInfo.getProcessInfo` and `performance.memory`, which only Chromium has; the functional 36 MP and 10× repeat tests run in every browser).

Before this round the coordinator's run had 16 Firefox / 45 WebKit failures across the whole repo; the engine slice was 3 Firefox + 30 WebKit. Classification:
| # | Failure | Class | Resolution |
|--|--|--|--|
| 1 | WebKit: almost every engine test `worker_failed` | (a) harness | Root cause `NotReadableError` in the worker: WebKit reads a Blob inside a Worker through an internal `blob:` URL load; the harness routed `**/*` and answered that `blob:http://engine.test/…` load with 404. The harness now routes only `http(s)` and copies fixtures into in-memory buffers. Product follow-up (c): a read failure (e.g. file moved/changed after picking) is now a typed `corrupt` "This file could not be read… please choose it again." instead of `worker_failed` (unit-tested). |
| 2 | WebKit: request check saw `blob:` URLs | (a) harness | Privacy invariant restated by protocol: every request is GET, every **network** (http/https) request goes to the harness origin; `blob:` loads are local. |
| 3 | WebKit: WebP in/out expected WebP | (b) browser | WebKit cannot encode WebP (`canEncode('webp') = false`, encoder returns PNG). Tests follow `canEncode`: `auto` → JPEG (PNG with alpha) + disclosure note; `format:'webp'` → `encode_unsupported`. |
| 4 | WebKit: Exif APP1 present in JPEG output | (b) browser | WebKit's encoder writes a small Exif stub. Invariant for every browser: no Make/Model strings and **no EXIF GPS block** (checked with `inspectFile` on the output). APP1 absence is asserted for Chromium/Firefox only. |
| 5 | Firefox + WebKit: 140×60 signature `raised` instead of `below_min` | (b) browser | Their q100 output is larger (10,810 / 10,865 B vs Chrome 8,862 B), so 10 KB is honestly reachable. Test asserts the invariant per status: `below_min` ⇒ bytes < min after q100 and the "at most … even at maximum quality" message; `raised` ⇒ min ≤ bytes ≤ max, q > 95, "We raised…" message; never padded. |
| 6 | Firefox + WebKit: CDP memory helpers | (a) harness | Memory measurement split into separate `@chromium-only` tests with a justification comment; functional parts run everywhere. |
| 7 | WebKit: JPEG with stray bytes between segments not `ok` | (b) browser | WebKit's own decoder rejects that file (`createImageBitmap` fails), Chrome/Firefox decode it. Invariant: the engine returns `ok` exactly when the browser itself decodes the file, else a typed `corrupt`. |
No engine decode/orientation/resize/alpha/abort/worker defect was found in Firefox or WebKit: orientation, truncation, crafted-header, alpha-hole, cancellation, stale protection, timeout, stubbed-WebP and resize-ignored tests pass unchanged in all three.

| case (engine e2e, worker path) | Chrome 157 | Firefox 159 | WebKit 27.2 |
|--|--|--|--|
| 1200×800 JPEG, max 50 KB | ok 47,219 B, 1200×800, q58, 8 enc, 105 ms | ok 46,108 B, 1200×800, q57, 8 enc, 60 ms | ok 48,602 B, 898×598, q60, 5 enc, 204 ms |
| 12 MP, 20–50 KB | ok 49,997 B, 1917×1437, 428 ms | ok 48,874 B, 1507×1131, 257 ms | ok 48,678 B, 1086×814, 386 ms |
| 12 MP, 19–20 KB | ok 19,913 B, 912 px wide | ok 19,876 B, 813 px | ok 19,933 B, 567 px |
| 36 MP generated, max 50 KB | ok 48,943 B, 752², 304 ms | ok 49,711 B, 705², 270 ms | ok 48,532 B, 472², 388 ms |
| 36 MP, resize-at-decode ignored (stub) | ok 49,154 B | ok 48,622 B | ok 48,528 B |
| raise, fixed 200×230 (min = 1.12 × q95) | q95 10,632 → q97 14,066 B | q95 16,094 → q96 19,149 B | q95 16,439 → q100 42,126 B |
| 140×60 signature, 10–20 KB | below_min 8,862 B (q100) | raised 10,810 B (q100) | raised 10,865 B (q100) |
| noise, max 0.5 KB free / fixed 256² | above_max 779 B / above_max_fixed 1,891 B | 689 B / 3,535 B | 1,146 B / 14,609 B |
| WebP encode | yes | yes | **no** → JPEG + note |
| JPEG output EXIF APP1 | none | none | stub (no GPS/make/model) |
| ICC strip | 7,955 → 7,481 B | no ICC written (8,102 B) | no ICC written (18,543 B) |
| stray-bytes JPEG | browser decodes → ok | ok | browser cannot decode → `corrupt` |
| truncated files at `inspectFile` (16 MP cut 90 %) | corrupt, 11 ms | corrupt, 4 ms | corrupt, 16 ms |
| 1 alpha-254 pixel: 11.9 MP / 13.6 MP | found (full scan) / note | found / note | found / note |
| cancel at attempt 2 | 0 ms after abort | 0 ms | 0 ms |
| 10 × 12 MP @ 100 KB (ms each) | 393–466 | 249–262 | 351–397 |
| memory (`@chromium-only`) | 36 MP peak +162 MB; 10× 12 MP RSS 882→929 MB, page heap 4→20 MB* | n/a | n/a |
\* The page-heap growth (~1.8 MB/run) is the harness's in-memory fixture copies (1.4 MB per run) awaiting GC since the WebKit fix; still under the 20 MB bound. Engine-side leak-freedom is covered by unit tests (bitmaps closed, worker terminated).

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
