# SizeTune compression engine (`src/lib/engine/`)

Everything runs in the browser. The engine never does network I/O, never logs image data or metadata, and never creates object URLs. Spec source: `docs/reviews/compression-review.md` §7–8, ADR D11.

## 1. API

```ts
import { processImage, cancelProcessing, disposeEngine, engineMode, canEncode, DEFAULT_LIMITS,
         EngineError, createObjectUrlSlot, outputFileName, formatKb, PRIVACY_NOTE } from '../lib/engine';

const r = await processImage(file, {
  format: 'jpeg',            // 'auto' | 'jpeg' | 'png' | 'webp'
  strategy: 'quality-first', // or 'dimensions-first'
  lockAspect: true, fit: 'contain', background: 'white',
  maxKb: 50, minKb: 20,      // optional; window = [minKb*1024, maxKb*1000] bytes
  // width, height, maxWidth, maxHeight, crop, quality, stripIcc, allowEnlarge
}, { signal, onProgress });
// r.status: 'ok' | 'raised' | 'below_min' | 'above_max' | 'above_max_fixed'
// r.blob (the real bytes; r.bytes === r.blob.size), r.mime (verified by magic bytes), r.message, r.notes (MUST be shown)
```

| Export | Purpose |
|--|--|
| `processImage(file, opts, hooks?)` | Default engine. **Latest call wins**: a new call rejects the previous one with `EngineError('cancelled')`. |
| `cancelProcessing()` / `disposeEngine()` | Cancel the running job / also terminate the worker. |
| `engineMode()` | `'worker'` or `'main-thread'` (decided once, by feature detection). |
| `inspectFile(file, limits?)` | Header-only facts for the UI at file pick: `{ mime, width, height, orientation, alphaPossible, hasGps }`. Same `too_large_bytes` / `too_many_pixels` / `unsupported_type` / `corrupt` errors and limits as `processImage`; no decode, no object URL. Reads the header bytes plus a bounded metadata scan (JPEG APP1 Exif in the first 256 KB, PNG `eXIf` before IDAT, WebP `EXIF` chunk via ≤ 64 chunk headers) for an EXIF GPS IFD. It also runs the same completeness check as processImage (§2 step 4), so a truncated file fails **at pick** with the same `corrupt` "incomplete" message (cost: the 64 KB tail, plus a 1 MB-window forward scan only when the end marker is not in the tail; a 16 MP JPEG cut at 90 % is refused in ~9 ms in Chrome). Fuzz-tested (1,500 mutated/truncated/random inputs: only EngineError). |
| `canEncode('jpeg'\|'png'\|'webp')` | Cached capability probe (2×2 canvas encode + magic-byte check). Safari → `webp: false`. |
| `createEngine({ createWorker, limits, idleMs, reuseMaxSourcePixels })` | Separate engine instance (own worker, own limits). |
| `createObjectUrlSlot()` | UI helper: holds one object URL, revokes the previous on `set()` and on `revoke()`. |
| `outputFileName(name, mime)` | Download name with the extension of the **verified** output type. |
| `readHeader`, `sniffType`, `byteWindow`, `resolveGeometry`, `formatKb`, `NOTES`, `PRIVACY_NOTE` | Pure helpers (also used by tests). |
| `DEFAULT_LIMITS` / `resolveLimits` | See §4. |

`EngineError.code`: `unsupported_type`, `corrupt`, `too_large_bytes`, `too_many_pixels`, `timeout`, `cancelled`, `out_of_memory`, `encode_unsupported`, `invalid_options`, `worker_failed`, `encode_failed`. Messages are user-safe English sentences and never echo raw browser text.

**Unreadable files.** If reading the file fails (e.g. it was moved or changed on disk after it was picked: `NotReadableError`), every entry point (`readHeader`, `inspectFile`, `processImage`, the completeness check) reports `corrupt` with "This file could not be read. It may have been moved or changed after you chose it; please choose it again."

**Browser-error mapping (`errors.ts`, UI review M6).** `out_of_memory` only for genuine allocation failures: `RangeError`, `QuotaExceededError`, or a message matching "out of memory / allocation failed / failed to allocate / cannot allocate / insufficient memory"; or a canvas of ≥ 4 MP that cannot be created/encoded (Safari signals that with a null context/`toBlob(null)`). Everything else is typed by stage: decode → `corrupt`; canvas/encoder → `encode_failed` ("The browser could not save the image this time. Please try again." — transient, retry is safe). A canvas whose 2D context is null, lost (`isContextLost()`) or did not take the requested size is rebuilt **once** on a fresh canvas before failing (a targeted recovery of one primitive, not a pipeline retry).

### Contract extensions made by this work package (additive, `types.ts`)
- `ProcessOptions.allowEnlarge?: boolean` — allow more pixels than the source to reach `minKb` (free dims only; default false).
- `ProcessResult.mode?: 'worker' | 'main-thread'`, `originalFits?: boolean` (original file's size already in the window — the original still has its EXIF/GPS), `elapsedMs?: number`.
- `EngineErrorCode` adds `'worker_failed'` (worker script failed to load or crashed; not an image problem) and `'encode_failed'` (canvas/encoder failure that is not a memory problem; transient).

## 2. Pipeline (one job)
1. Validate options (`options.ts`): `allowPadding: true` → `invalid_options`; `format:'jpeg'` + `background:'keep'` → `invalid_options`; numbers/enums/crop checked. Default `background` is `'white'` for JPEG and `'keep'` for PNG/WebP/auto (so a PNG/WebP output never flattens unless a colour is passed).
2. `file.size > 25 MiB` → `too_large_bytes` (no bytes decoded).
3. Read the **header** (first 64 KB, more only if a big APP/ancillary segment precedes the frame header; max 8 MB): magic bytes decide the type (JPEG `FFD8FF`, PNG signature, `RIFF....WEBP`); SVG/GIF/HEIC/AVIF/BMP/TIFF/anything else → `unsupported_type` (MIME type and extension are ignored). JPEG SOFn (+ EXIF orientation; 5–8 swap w/h; like libjpeg's `next_marker()`, stray non-FF "extraneous" bytes, FF fill bytes and `FF 00` pairs (not a marker: 2 junk bytes) between segments are skipped, at most 64 KB in total; reserved markers `0x02`–`0xBF` are rejected as libjpeg does. Treating `FF 00` as a segment would let a COM payload hide a fake 1×1 frame header in front of a real 36 MP frame and bypass the pixel limits (audit N1; unit, fuzz and real-Chrome tests). The decoded-vs-header pixel check (step 5) remains a second guard.), PNG IHDR (+ `tRNS`/`acTL` via a chunk walk up to IDAT, up to 200,000 chunks; if the walk cannot reach IDAT within the read cap, alpha is assumed *possible* — never guessed absent), WebP VP8/VP8L/VP8X (+ alpha/animation flags). Malformed/truncated headers → `corrupt` (bounds-checked, never throws).
4. **Completeness** (`complete.ts`, before any decode): JPEG must have an EOI (`FFD9`) after the main image's first SOS (last 64 KB fast path, else a bounded forward scan in 1 MB windows — motion photos append video after EOI; an EOI inside an EXIF thumbnail does not count); PNG must have an `IEND` chunk (tail search, else a bounded chunk walk); WebP's RIFF size must fit in the file. Data after the end marker is accepted (and dropped by the re-encode). Otherwise `corrupt`: "This image file is incomplete; it may have been cut off while downloading or copying. Please use the original file." (Safari would otherwise decode a cut-off JPEG and paint the rest grey.)
   Header pixels > 100 MP → `too_many_pixels` (before decoding; message shows one decimal, e.g. "100.4 megapixels; the limit is 100.0").
   Then the **resolved** output geometry is checked (after width/height derivation, `lockAspect:false`, contain/cover, crop — and again if the bitmap's orientation forces a re-resolve): a user-fixed output above `maxSide` (16384 px) or `maxOutputPixels` (16 MP) → `invalid_options` with `This browser can't safely create images this big; the maximum is 16 megapixels (16384 px per side).` Free-dimension output is bounded by the decode size instead (≤ 12 MP). An empty byte window after the KB-conflict fallback (e.g. fractional 1.0005–1.0005 KB) → `invalid_options`.
5. Plan the decode: sources ≤ 12 MP decode at full size. Larger: `createImageBitmap(file, { resizeWidth, resizeQuality: 'high' })` (width only, so the browser keeps the oriented aspect ratio) to a size chosen from the goal — free dims: `clamp(67 × maxBytes, 2 MP, 6 MP)` (more, up to 12 MP, if a large `minKb` needs it); fixed dims: just enough for the requested output (can exceed 6 MP when the user asked for it). Orientation is applied by `createImageBitmap` (verified with this engine on Chrome desktop and iOS Simulator Safari; Android evidence is the earlier review spike on an emulator); the bitmap is the source of truth — if its aspect contradicts the header, dims are swapped and a note is added. A bitmap with more than 1 % more pixels than the header declares → `corrupt`. A bitmap bigger than the **planned reduced** size but within the header (a browser that ignores `resizeWidth`, e.g. an untested Firefox) is redrawn on a canvas at the working size and the full-size bitmap is closed at once — not an error (limits were enforced on the header, so a lying header must not slip a bigger image through).
6. Alpha: only when the header allows alpha. First a ≤ 1 MP downscaled probe; if it sees nothing and the decode is full size, every pixel is checked in ≤ 1 MP strips. The decode is full size for sources ≤ 12 MP, and for fixed output dimensions it can be up to ~16 MP (the output cap). Measured: the **whole** processImage call for an 11.9 MP PNG (decode, probe, full scan, JPEG encode) took ≈ 0.2 s in Chrome; the scan alone was not timed separately. A reduced decode (> 12 MP) cannot show sub-pixel holes, so when the probe saw nothing, the header allowed alpha and the output is JPEG, the result carries the note `Very small transparent areas in very large images may be filled with the background colour.` Detection is therefore exhaustive up to 12 MP and best-effort (disclosed) above.
7. Output format: `jpeg` (alpha input → fill with `background`, note added), `png`/`webp` (keep alpha with `background:'keep'`; an explicit colour flattens with a note), `auto` = keep the input format if encodable (JPEG→JPEG, PNG→PNG, WebP→WebP), WebP input on a browser that cannot encode WebP → PNG if alpha else JPEG, **with a note**. `auto` never picks WebP for non-WebP input. `webp` requested but unsupported → `encode_unsupported` (caller decides the fallback).
8. Size search (`search.ts`, below), ≤ 20 encodes, one reused canvas, every candidate's magic bytes verified (`encode_unsupported` on mismatch — e.g. Safari returning PNG for WebP).
9. Optional `stripIcc` (JPEG only): only a complete, single-chunk ICC profile whose colour space is RGB and whose description tag (`desc` v2 or `mluc` v4) names **sRGB** is removed (Chrome writes exactly that; decoders assume sRGB without a profile). Any other profile is kept. One probe (8×8 encode → strip → decode test). Only if the stripped file decodes is stripping applied to every candidate (sizes are measured after stripping); the final file is also structurally validated.
10. The final magic/structure checks are awaited through the same cancellation/deadline guard as every other step, and the job re-checks the AbortSignal immediately before returning (defence in depth; with the guarded awaits there is no observable window left, so a mutation removing only this line is equivalent).
11. `finally`: bitmap `close()`, canvas set to 0×0. Worker is terminated by the client per §5.

## 3. Search algorithm and statuses
Window: `lo = minKb×1024`, `hi = maxKb×1000` bytes, so a result satisfies both KB readings. If `minKb×1024 > maxKb×1000` (e.g. 10–10 KB) the minimum falls back to `minKb×1000` and a note says so.
- **Quality-first, Phase A (current dims):** q95 → if in window: done. If below min: **raise** (q100 probe; if q100 < min → `below_min`; else integer-bisect (95,100] for the **lowest** q reaching the minimum; accept if ≤ max). If above max: q40 → if it fits, integer-bisect [40,95] for the highest fitting q. Fixed dims and q40 too big → bisect [1,40) (a "may look blocky" note is added below q40); still too big → `above_max_fixed`.
- **Phase B (free dims):** continuous scale search at q60 (secant on log bytes vs log scale, safeguarded bisection; no ladder), then integer q refine [60,95] at that scale if fill < 94%. Floor: shorter side 64 px; at the floor q may go below 40; still too big → `above_max`.
- **Window gap** (no quality step lands in a narrow window): with free dims the next quality step is shrunk slightly into the window; with fixed dims → `below_min` with both neighbouring sizes in the message.
- **Dimensions-first:** keep q = `quality ?? 85`, shrink pixels only; minimum via the same raise.
- **PNG** (lossless): pixels are the only knob; `below_min` if too small (no raise possible); the message says only pixels shrink, and for opaque PNG with `format:'auto'` a note says JPEG would keep more pixels.
- **No target:** one encode at `quality ?? 85`.
- **`quality` option:** used only without a size target and as the fixed quality of `dimensions-first`. With a size target and `quality-first`, the search chooses the quality and `quality` is ignored (by design: a fixed quality would defeat the target).
- **Enlarge** (`allowEnlarge`, free dims, after q100 still < min): smallest scale > 1 reaching the minimum at q100 (max 4×, ≤ 16 MP) → `raised` + message "Enlarging adds pixels, not detail."
- Every candidate's size is remembered, but only three Blobs are kept alive (best in-window result, largest under the max, smallest above the max; peak 4 including the one just encoded, asserted by tests). The result is chosen from all candidates: any candidate in the window ⇒ success (normal results first: most pixels, then highest q; raised results: smallest honest raise). Otherwise `below_min` returns the largest result under the max, `above_max(_fixed)` the smallest. **`ok`/`raised` are impossible unless `lo ≤ blob.size ≤ hi`** (property-tested on 600 random encoders, asserted again in the pipeline). No padding, no metadata stuffing: `allowPadding:true` is rejected.

| status | meaning |
|--|--|
| `ok` | in the window (or no target) |
| `raised` | in the window, reached the minimum by higher quality (≤ 100) or, if allowed, more pixels |
| `below_min` | cannot reach the minimum honestly; `blob` is the largest result ≤ max |
| `above_max` | cannot get under the max even at the 64 px floor; `blob` is the smallest result |
| `above_max_fixed` | same, with user-fixed dimensions |

## 4. Limits (`limits.ts`)
| limit | default |
|--|--|
| `maxFileBytes` | 25 MiB |
| `maxPixels` (header) | 100 MP (`MAX_SOURCE_PIXELS`): covers 48/50/64 MP phone sensors; 108/200 MP full-resolution captures are refused with a clear message because decode memory is not bounded on every browser even with resize-at-decode |
| `maxWorkingPixels` (full decode up to) | 12 MP |
| `workingCapPixels` (reduced decode, free dims) | 6 MP |
| `maxOutputPixels` / `maxSide` | 16 MP (`MAX_OUTPUT_PIXELS`, all browsers: iOS Safari's canvas cap is 16,777,216 px) / 16384 px |
| `minSide` (free-dims floor) | 64 px |
| `timeoutMs` | 60 s (worker self-timeout; client kills the worker at +2 s) |
| `maxEncodes` | 20 |

## 5. Worker, cancellation, fallback
- Module worker `src/lib/engine/compress.worker.ts` created with the literal `new Worker(new URL('./compress.worker.ts', import.meta.url), { type: 'module' })` (Vite emits `compress.worker-*.js`).
- AbortSignal → immediate `cancelled` rejection, a `cancel` message, and `worker.terminate()` (decoded bitmaps die with the worker). Timeout → `timeout` + terminate. Error → terminate. After success the worker is kept for reuse only if the source was ≤ 4 MP, for at most 15 s idle; otherwise terminated (frees allocator memory deterministically).
- Main-thread fallback **only** when `supportsWorkerEngine()` is false (`Worker`, `OffscreenCanvas` with `convertToBlob` and a 2D context, `createImageBitmap`). It runs the same pipeline with a DOM canvas, yields to the event loop between encodes, honours the same timeout and AbortSignal. A worker that fails to load is reported as `worker_failed` — it is **not** retried on the main thread. No URL is built for detection (the HTML/privacy verifier forbids URL-like strings).
- Object URLs: the UI owns them; use `createObjectUrlSlot()` (one live URL, revoked on replace/unmount).

## 6. User-facing strings (`messages.ts`)
**KB basis for display: 1 KB = 1024 bytes, one decimal** (`formatKb`), while the window is `[min×1024, max×1000]`. Because a boundary result can look contradictory in one basis, every non-ok message also states exact bytes and the limit in bytes. The UI should show `r.bytes` exactly as well.

Numbers in the below_min / above_max / above_max_fixed rows are real outputs from the Chrome e2e run; the other rows show the template with illustrative numbers.

| case | template |
|--|--|
| ok (target) | `49.3 KB – within 20–50 KB. Quality 60%, 1004×565 px.` / `… – under the 50 KB limit. …` / `… – above the 20 KB minimum. …` |
| ok (PNG shrunk) | `… PNG (lossless), 500×400 px. PNG is lossless, so the size was reached by reducing the pixel dimensions only.` |
| ok (no target) | `123.4 KB. Quality 85%, 4000×3000 px.` |
| raised | `Your minimum is 20 KB. We raised JPEG quality to 97% to reach 21.4 KB. The picture looks the same; the file just stores more detail.` |
| raised (also reduced, narrow window) | `Your minimum is 20 KB. We raised JPEG quality to 97% and reduced the image to 780×520 px to land at 20.3 KB inside your range. The picture keeps its look; the file just stores more detail.` |
| raised (enlarged) | `Your minimum is 20 KB. We enlarged the image to 280×120 px to reach 21.4 KB. Enlarging adds pixels, not detail.` |
| below_min | `At 140×60 px this image is at most 8.7 KB (8,862 bytes) even at maximum quality, so the 10 KB minimum (10,240 bytes) cannot be met at these dimensions. Check whether the portal really requires these exact dimensions; larger dimensions would give a bigger file.` (free dims: `Use a larger original image, or allow enlarging the image.`) |
| below_min (PNG) | `PNG is lossless, so its size depends only on the pixels: at W×H px this image is X, below the N KB minimum (… bytes). …` |
| below_min (gap) | `No setting lands between 20 and 21 KB for this image: the closest results are 19.8 KB (20,275 bytes) and 21.3 KB (21,811 bytes). Try a slightly wider range.` |
| above_max | `Cannot go below 779 bytes for this image (smallest result: 64×64 px at quality 1%), which is above your 0.5 KB limit (500 bytes). Increase the limit or use a simpler image.` |
| above_max_fixed | `At 256×256 px the smallest JPEG is 1.8 KB (1,891 bytes) (quality 1%), which is above your 0.5 KB limit (500 bytes). Allow smaller dimensions or a higher limit.` (PNG: `PNG is lossless, so at W×H px it cannot be smaller than X, which is above … Choose JPEG, or smaller dimensions.`) |
| budget exhausted | `Could not get under … within 20 attempts; the smallest result is X.` |

Notes (`NOTES`, must be displayed): `Transparent areas were filled with white.` / `…with black.` / `…with the colour #ccff00.` · `Quality had to go down to 12% to fit, so the image may look blocky.` · `This large photo was opened at reduced size (W×H px of the original W×H px) to stay within browser memory limits, so the result can have less detail than the original.` (shown whenever the reduced decode limited the output — free dims at working size, or a crop of a large source with fixed output dims) · `WebP can't be saved in this browser, so the result is JPEG.` (or PNG) · `Only the first frame of the animated image was used.` · KB-conflict note · `This browser did not apply the photo’s rotation setting, so the result may appear sideways.` · `The colour profile could not be removed safely in this browser, so it was kept.` · `The requested dimensions are larger than the original, so the image was enlarged (no extra detail).` · `PNG is lossless, so only the pixel dimensions could shrink. JPEG would keep more pixels at this size.` · `Very small transparent areas in very large images may be filled with the background colour.`
`PRIVACY_NOTE`: `Camera and location details (EXIF/GPS) are not copied into the new file.` — true for the re-encode path only (Chrome: no APP1 at all; Safari keeps a small Exif stub without Make/Model/GPS). If the UI ever offers "keep original" (`originalFits`), the original keeps its metadata.

## 7. Tests
- `pnpm exec vitest run tests/engine` — 198 tests (incl. `review-fixes.test.ts` for review findings F1–F12; the per-attempt and final magic checks and the header-pixel check were each mutation-tested: deleting any one alone fails a test): header parser (SOFn, EXIF orientation 1–8 both byte orders, malicious IFD, truncation at every byte, need-more reads past 200 KB APP segments, PNG tRNS/acTL, WebP VP8/VP8L/VP8X), magic bytes, KB window maths, geometry (contain/cover/stretch, crop, no upscale), options validation, search with fake encoders (monotone, one non-monotone dip, 4:4:4 jump at q100, window gap, impossible min/max, fixed dims, ≤ 20 encodes, budget exhaustion, cancellation mid-search, cache, **600-case "never claims success wrongly" property test**, 200-case fill test: min fill > 90 %, median > 95 %), pipeline with a fake Env (limits before decode, decode error mapping, orientation reconciliation, reduced decode, alpha/flatten notes, WebP fallback, magic mismatch, crop mapping, abort mid-search/mid-decode with late-bitmap close, timeout), worker client with a fake Worker (reuse/idle/terminate, stale protection, foreign ids ignored, abort, timeout, error codes, no main-thread retry), ICC strip, messages, URL helper, real-fixture headers.
- `pnpm exec playwright test -c e2e/engine/playwright.config.ts` — 35 tests (+1 real-UI M6 loop that runs only under the repo-wide config) in system Chrome (`channel:'chrome'`), engine bundled by esbuild into `.tmp/engine-e2e/` and served via `context.route` on `http://engine.test` (all other requests aborted). The specs also run under the repo-wide `playwright.config.ts` (the harness bundles itself), but the dedicated config avoids the Astro build/wrangler web server.

## 8. Measured (Chrome 157, macOS arm64, worker path; `.tmp/engine-e2e-measurements.jsonl`)
Memory = RSS of **the Playwright-launched browser only** (process ids from CDP `SystemInfo.getProcessInfo`, RSS from `ps`; browser + renderer + GPU + utility processes; the worker runs in the renderer). Other Chrome instances are excluded. It is still whole-browser RSS with GC/allocator lag, so read it as an order of magnitude; three runs shown as ranges.
| case | result |
|--|--|
| 1200×800 JPEG, max 50 KB | ok 47,219 B, q58, 1200×800, 8 encodes, ~100 ms |
| 12 MP wallpaper photo, 20–50 KB | ok 49,997 B, q60, 1917×1437, 6 encodes, 414–587 ms |
| 12 MP, 19–20 KB (narrow) | ok 19,913 B, q60, 912×684, 8 encodes, ~380 ms |
| 36 MP generated, max 50 KB | ok 48,943 B, q60, 752×752, 6 encodes, 330–379 ms engine (438–530 ms wall); RSS baseline 1256–1285 MB (the page has just generated the 36 MP test image), **peak +145–151 MB** during the job (compression review, full decode: +1046 MB) |
| 48 MP generated, max 50 KB | ok 49,733 B, 838×629, 6 encodes, 354 ms |
| 10 × 12 MP @ 100 KB | RSS e.g. 961 → 971 MB over runs 1–5, drops ~120 MB (GC), 849 → 856 MB over runs 6–10: no sustained growth; page heap 2–3 MB; 396–539 ms each |
| raise, fixed 200×230 | q95 10,632 B → min 12 KB → raised q97 14,066 B (4 encodes) |
| ICC strip | 7,955 → 7,481 B (−474), pixel-identical |
| cancel at attempt 2 (36 MP) | rejected 0 ms after abort, worker closed |
| width 16384 on a 100×10000 source | `invalid_options` (before: Chrome `out_of_memory`) |

## 8b. UI review M6 investigation (intermittent "ran out of memory" on a 140×60 JPEG with a 10 KB minimum)
- Not reproduced, in Chrome 157: about 1,700 engine-level calls in the e2e harness (`e2e/engine/m6-repro.spec.ts`): sequential runs on a reused worker, rapid supersede, 5-call bursts, abort-then-new-job, fractional crops with fixed dims, and 4 pages sharing one GPU process with 36 MP jobs in parallel. Plus 100 runs of the real built signature tool (`e2e/engine/m6-ui-repro.spec.ts`, repo-wide config, incl. immediate re-clicks). Test-only wrappers around `createImageBitmap`, `getContext`, `drawImage` and `convertToBlob` in the worker recorded **zero** raw errors; all results were correct (`raised` / `below_min`).
- Cause (most likely, not proven): the old mapping turned **every** `convertToBlob` rejection, every null 2D context and any error text containing "memory"/"too large" into `out_of_memory`, whatever the canvas size. A transient encoder/GPU-context failure on a loaded machine (many browsers running) would surface exactly as reported: twice in a row, then never again. A 140×60 canvas cannot plausibly run out of memory.
- Fix: narrow mapping + one-time canvas rebuild (above). A failed or cancelled job always terminates its worker; the next job gets a fresh worker (unit-tested). Regression tests: `tests/engine/error-mapping.test.ts`, and in real Chrome (`m6-repro.spec.ts`) injected failures at specific widths: an `EncodingError` gives `encode_failed`, a `RangeError` gives `out_of_memory`, a null context is rebuilt and the job succeeds, and the next job after each failure succeeds.
- UI follow-up (lead): add copy for `encode_failed` ("…could not save the image this time. Please try again.") and `worker_failed` to `src/components/tool/errors.ts` (today they fall into the generic message).

## 9. Known limitations
- Crop on sources > 12 MP is taken from the reduced decode (≤ 12 MP total), so a small crop of a 48 MP photo has less resolution than the original region.
- Alpha detection is exhaustive only for full-resolution decodes (≤ 12 MP). Above that a single nearly-opaque pixel can be averaged away (measured: one alpha-254 pixel in a 4000×3400 PNG was not seen); the JPEG result then carries the disclosure note above instead of claiming there was no transparency.
- Completeness checks are structural (end markers / RIFF size). A file with a valid end marker but damaged data in the middle still decodes however the browser decodes it.
- A browser that ignores resize-at-decode still pays the full-size decode memory once (the redraw happens after it).
- WebP quality 100 in Chrome may switch to lossless; the search measures real sizes, so this only affects which q is chosen.
- Real-device memory/time (iPhone 2–4 GB, Android ≤ 3 GB, in-app browsers) is **not** verified here: see `QA/REAL_DEVICE_TEST_PLAN.md` and `docs/engine/CROSS_BROWSER.md` (simulator only).
- Quality assessment of faces at 20 KB was not done (needs human review, compression-review §2).
- One unexplained failure of the first e2e test in one of ~10 full runs (not reproduced in 12 targeted repeats; the machine was shared with other builds). Watch for it in CI.
