# SizeTune compression-engine review (2026-11-12)

Scope: `src/lib/compress.ts`, `compress.worker.ts`, `ImageCompressor.tsx`, N1 specs. No product code was changed. Scratch harness and raw JSON: `/private/tmp/claude-501/-Users-sourav-workspace-personal-automated-niche-website-discovery/9c0cb90c-faaa-4eaf-bcd2-863c04cd34b0/scratchpad/compression/` (`web/lib.js`, `web/exp.js`, `out/*.json`, `out/posted.jsonl`).
Tags: **VERIFIED** = measured here; **ASSUMPTION** = not measured here. Nothing was uploaded or downloaded; images are system wallpapers (`DefaultAerial.jpg` 3840x2160 photo, `Sonoma.heic` 6016x6016 via `sips`, aerial upscaled to 8000x6000 = "48 MP"), plus synthetic fixtures (EXIF-6+GPS JPEG, transparent PNG, signature PNG, 200x230, noise).

## Test environments (what was actually run)
| Env | Details | Verdict |
|--|--|--|
| Desktop Chrome | 157.0.8103.52 via Playwright `channel:'chrome'`, macOS arm64, RSS = ps of Chrome process tree | VERIFIED |
| iOS Safari | **iOS Simulator** iPhone 17 Pro, iOS 26.3, Safari 26.3, fetched from `http://127.0.0.1:<port>`; results POSTed to my own local server | VERIFIED for WebKit behaviour; NOT for device memory/speed (runs on Mac RAM) |
| Android Chrome | **Throwaway AVD** `sizetune_lowram` (android-36 google_apis arm64, hw.ramSize=1536; guest reported 2.5 GB MemTotal), Chrome 133 (`com.android.chrome`). AVD and process were removed afterwards; the user's `vulncon_pixel` was not touched | VERIFIED for Chrome-Android decode/encode semantics; NOT for real-phone RAM, thermals, speed |
Caveats: quality metric = luma SSIM (8x8 windows) at a 640 px viewing size, no faces in the corpus (so "photo of a person at 20 KB" is NOT assessed); the 36/48 MP files are smooth (rendered/upscaled), so real noisy 48 MP sensor files will cost more time and memory.

## 1. Executive summary
1. **Search core is sound in the reachable range, but the scale ladder + last resort is a real bug.** Chrome: 8 MP photo, target 20 KB -> result 8.9 KB (44% fill, SSIM 0.835) while a continuous search gives 18.9 KB, SSIM 0.947. 48 MP at 50 KB -> 40.4 KB, q=0.05, SSIM 0.89 (vs 48.3 KB, SSIM 0.972 with pre-downscale). Android Chrome: 17.7 KB for a 50 KB target. **iOS Safari: `fits=false` at 61.5 KB / 160.4 KB for 50 KB targets** (36/48 MP, ladder exhausted at q=0.05). Cause: the ladder stops at 0.3 of the original, which is not "small" for a 6000 px image, and last resort jumps to q=0.05.
2. **Encoders differ a lot per browser.** Same quality value, same pixels: Safari output is 1.4x-1.9x larger than Chrome (8 MP, scale 1: q0.4 539 vs 385 KB; q0.7 1192 vs 628 KB; q0.9 1761 vs 1189 KB). Chrome writes optimized Huffman tables; Safari writes standard tables + restart markers. Never hardcode a quality->size model; always search per browser.
3. **A min–max window is feasible and honest** in most real cases by raising quality (q 95->100 steps), e.g. 200x230 px photo with 20-50 KB: 21.4 KB at q97, fixed dims. It is **not** feasible when the image is simply too simple (140x60 px signature caps at 4.6 KB at q100). Padding is technically valid but should not be default (section 8).
4. **Memory: decode at reduced size.** 36 MP: full decode+ladder peaks +1046 MB (2.3 s), `createImageBitmap(file,{resizeWidth,resizeHeight})` to ~4 MP peaks +320 MB (0.9 s). 48 MP: +1398 MB / 3.2 s vs +436 MB / 1.0 s. Android Chrome **silently downsizes decodes above ~20 MP** (6016x6016 decoded as 4512x4512), so bitmap.width is not the true image size.
5. **Privacy VERIFIED:** canvas re-encode strips EXIF Make/Model/GPS in Chrome, Android Chrome and Safari (fixture had Make, Model, GPS IFD). Caveat: Safari leaves a 76-byte Exif stub + 56-byte Photoshop APP13, Chrome adds a 472-byte ICC APP2 (strippable, see 4).
6. **Orientation VERIFIED safe in all three engines**: `createImageBitmap(blob)` applies EXIF orientation 6 by default (300x400 result, correct pixels), also in a Worker, also with `resizeWidth`. `imageOrientation:'none'` does NOT disable it any more (still 300x400).
7. **Output format:** WebP encode works in Chrome and Android Chrome, **not in Safari** (silently returns PNG); Safari `toBlob('image/avif')` returns `blob.type=image/avif` with PNG-sized bytes (looks mislabelled). Many portals require JPEG anyway; offer WebP/PNG only on the generic tool and verify by magic bytes.

## 2. JPEG quality optimisation (item 1)
Method: `cur` = port of current algorithm; variants with q floor 0.2/0.6; `joint` = for q in {.5,.6,.7,.8,.9} bisect continuous scale, keep best SSIM (40 encodes). Target = requested*0.97 for all. Chrome, SSIM at 640 px:
| Image / target | cur q-floor .4 (KB, q, scale, SSIM, encodes) | joint best (KB, q, scale, SSIM, encodes) |
|--|--|--|
| portrait 1500x1960 / 20 KB | 19.2, .41, .30, .934, 16 | 19.2, .5, .28, .933, 40 |
| portrait / 50 KB | 48.3, .41, .50, .974, 14 | 48.3, .5, .47, .974, 40 |
| portrait / 100 KB | 96.8, .50, .70, .986, 12 | 96.6, .8, .51, .988, 40 |
| portrait / 200 KB | 193.6, .56, 1.0, .994, 9 | 178.4, .5, 1.0, .993, 33 |
| aerial 3840x2160 / **20 KB** | **8.9**, .05, .30, **.835**, 9 (last resort) | 18.9, .6, .15, **.947**, 40 |
| aerial / 50 KB | 47.9, .43, .30, .978, 16 | 48.1, .7, .24, .979, 40 |
| aerial / 100 KB | 95.7, .56, .40, .988, 15 | 96.4, .8, .30, .989, 40 |
| aerial / 200 KB | 194, .53, .60, .990, 13 | 189, .9, .35, .991, 40 |
Findings:
- VERIFIED: where the current algorithm reaches the target, joint search buys <= 0.003 SSIM for ~3x the encodes. The q floor matters little: floor .2 is slightly worse at 200 KB (.980 vs .994) and floor .6 collapses to the last resort at 20/50 KB on the aerial image. Best joint quality sits flat in q 0.5-0.8.
- VERIFIED: fill ratio is 94-97% of target (3% margin + coarse bisect). Chrome quality is **integer percent** (q .751 and .754 give identical bytes, .756 differs), so bisect on integers (6-7 steps), not 8 float steps.
- VERIFIED: size is monotone in q (1 violation in 100 steps on a 1200 px photo; 0 on signature/200x230). Safari: 0 violations, finer q steps (q .751/.754/.756 all differ).
- VERIFIED: bytes scale ~ pixels (aerial q.7: 628/421/258/125/35.5 KB at scale 1/.8/.6/.4/.2), so a one-probe size model can seed the scale and cut encodes from ~15 to ~8. Prototype `fitRange` (section 7) used 8-16 encodes, 0.2-0.3 s for 8 MP in Chrome, and reached 94-99% fill.
- **Chrome JPEG output details (VERIFIED):** baseline, optimized Huffman, 4:2:0 for q<1.0, **4:4:4 only at q=1.0** (size jumps 457 KB at q.95 -> 659 at q.98 -> 1371 at q1.0 on the portrait), 472-byte sRGB ICC APP2 always present. ICC strip: -474 bytes, **0 pixel differences** after decode in Chrome (matters at 10 KB: 4.6%).
- Progressive + optimize is ~3.5% smaller than optimized baseline (PIL/libjpeg-turbo, 3 qualities). A WASM encoder (mozjpeg/jpegtran lossless transcode) could add that; mozjpeg trellis gain is ASSUMPTION (not installed here, nothing downloaded). Recommend **not** in v1.
- **KB ambiguity (design):** 50 KB*1024*0.97 = 49,664 B passes both 1000 and 1024 readings. For ranges use the safe window `[min*1024, max*1000]` (satisfies both interpretations); show the user the exact bytes. If `min*1024 > max*1000` (e.g. "10-10 KB"), say the limits conflict under one reading and aim for max*1000 only.
- SSIM caveat: view-size luma SSIM under-penalises blocking/blur of faces at 20 KB; before launch run a human review on 5-10 real passport-style portraits.

## 3. PNG transparency (item 2) — VERIFIED (Chrome, Android, Safari identical)
Fixture: 800x600 RGBA (transparent corner, 50%-alpha white disc, 24%-alpha blue strip).
| Output | Chrome result | Notes |
|--|--|--|
| JPEG, white `fillRect` (current) | 255,255,255 in transparent area; 50% white disc becomes opaque white | 23.3 KB |
| JPEG, no fill | transparent area becomes **black** (0,0,0) | wrong default if fill removed |
| JPEG, custom bg #ccff00 | 204,255,0 | works |
| PNG | alpha preserved (0 / 60 / 128) | 16.3 KB |
| WebP q.9 | alpha preserved | 9.7 KB; Safari: returns PNG instead (15.3 KB) |
Product spec: detect alpha (draw to a canvas, scan alpha < 255, cheap on a down-sized copy). If alpha exists and the chosen output is JPEG, show "Transparent areas will be filled with [white v]" with a colour picker (white/black/custom). Offer "Keep transparency (PNG)" when the portal accepts PNG; PNG has no quality knob, so target search = scale only (or lossless-only message if it already fits). Do not silently flatten.

## 4. WebP (item 3)
- VERIFIED Chrome 157 / Android Chrome 133: `image/webp` encodes with quality; detect support by `blob.type==='image/webp'` (unsupported types fall back to PNG; AVIF falls back to PNG in both).
- VERIFIED Safari 26.3 (simulator): `canvas.toBlob`/`convertToBlob('image/webp')` returns **image/png** (87 KB for a 200x230 test), AVIF returns blob.type avif with PNG-sized payload. Rule: after every encode, check `blob.type` AND magic bytes (FFD8 / RIFF....WEBP / 89PNG); treat mismatch as unsupported. (Older Safari behaviour: ASSUMPTION.)
- Quality at equal bytes (Chrome, SSIM@640): portrait 50 KB: JPEG .975 vs WebP .967; 100 KB .987 vs .986; aerial 50 KB .978 vs .972; at 20 KB on the aerial image WebP (.9375) beat the **buggy** JPEG result (.835), but a fixed JPEG search gets .947. So WebP is **not better** than a well-searched JPEG on these images; value is alpha + compat convenience, not size. Keep JPEG default, WebP optional (Chrome/Android only), no AVIF.

## 5. EXIF orientation and privacy (item 4)
Fixture: stored 400x300, EXIF Orientation=6, Make=TestCam, Model=Model9, GPS N/E.
| Check | Chrome 157 | Android Chrome 133 | Safari 26.3 sim |
|--|--|--|--|
| `createImageBitmap(blob)` | 300x400, red band on right (oriented) | same | same |
| `{imageOrientation:'from-image'}` / `'none'` | both 300x400 (`none` no longer disables) | same | same |
| `createImageBitmap(blob,{resizeWidth:150})` | 150x200 correct | same | same |
| `<img>.naturalWidth` | 300x400 | same | same |
| Same call inside a Worker | oriented, no EXIF | oriented, no EXIF | oriented, EXIF stub only |
| Re-encoded JPEG: Make/Model/GPS bytes | absent | absent | absent |
| Re-encoded JPEG: other segments | JFIF + 472 B ICC | same | JFIF + 76 B Exif stub (no tags we could find: no Make/Model/GPS) + 56 B APP13 |
Conclusion: no manual rotation code needed; the orientation fixture must be a permanent regression test. The old browsers that ignore orientation in `createImageBitmap` (Safari < 13.1 etc.) are ASSUMPTION/out of scope. Privacy copy "location and camera info are not copied into the compressed file" is supported for these 3 engines; only claim it for the re-encode path (if the original is returned unchanged because it already fits, EXIF/GPS **stays** - strip or warn). Not tested: HEIC input (Chrome cannot decode HEIC; Safari can - ASSUMPTION), CMYK/16-bit/progressive/animated-GIF inputs.

## 6. Large images and memory (items 5, 6) — Chrome desktop, worker, target 50 KB
| Image | Strategy | out KB (q, dim) | SSIM | encodes | time | peak RSS delta |
|--|--|--|--|--|--|--|
| 8 MP aerial | full decode + ladder (current) | 47.9 (.43, 1152x648) | .978 | 16 | 0.64 s | +360 MB |
| 36 MP | full decode + ladder | 48.0 (.51, 1805x1805) | .993 | 16 | 2.27 s | **+1046 MB** |
| 36 MP | resize-at-decode to <=4 MP, then ladder | 47.9 (.40, 2000x2000) | .989 | 9 | 0.92 s | +320 MB |
| 48 MP | full decode + ladder | **40.4 (q.05, 2400x1800)** | **.893** | 9 | 3.15 s | **+1398 MB** |
| 48 MP | resize-at-decode to <=4 MP | 48.3 (.53, 924x693) | .972 | 15 | 1.0 s | +436 MB |
RSS = sum over the Chrome process tree sampled every 150 ms, whole-browser, includes GC lag; use as order of magnitude. Decode itself is cheap: 8/36/48 MP full `createImageBitmap` 92/128/170 ms vs resized decode 135/290/248 ms (Chrome desktop).
- VERIFIED: terminating the worker after the 36 MP job dropped RSS ~1790 -> 1317 MB within 3 s (not to baseline ~1000: GC/allocator retention). `bitmap.close()` + `worker.terminate()` + `URL.revokeObjectURL` are all needed; current code does worker.terminate and revokes the result URL on replacement (OK) but the worker does not `close()` the bitmap on the error path.
- VERIFIED canvas allocation, Chrome desktop: 4096², 8192² (67 MP) and 12000² (144 MP, +3 GB RSS) all allocate and encode. **Do not rely on desktop numbers.**
- VERIFIED iOS Safari 26.3 **simulator**: canvas 4096², 4100² (16.8 MP, the historical cap), 5000², 6000², 8192x4096 and 8192² all allocated and encoded. So the historical iOS "16.7 MP / 256 MB" limit did not trigger in the simulator (Mac RAM). **ASSUMPTION: real iPhones still refuse or blank large canvases under memory pressure; needs a real device.**
- VERIFIED Android Chrome 133 emulator: 6000² canvas -> JPEG that decodes as 4500x4500; 8192² -> 4096x4096; the 6016² photo decodes as 4512x4512, 8000x6000 as 5000x3750 (~20 MP ceiling, silently). Treat `bitmap.width/height` as "working size" and read the true size from the JPEG SOF header (or `ImageDecoder`) if you ever need exact original dimensions.
- Time on Android emulator (host CPU, not a phone): 8 MP full+ladder 6.2 s, 36 MP 7.4 s; with decode-time resize 5.3 s (resizeWidth decode took 1.9 s on a 20 MP source). iOS simulator: 8 MP 1.3 s, 36 MP 2.2 s. Real low-end phones are ASSUMPTION: expect 3-10x slower.
- Recommended memory plan: (1) read dims from file header; (2) if pixels > 12 MP (or file > 8 MB), `createImageBitmap(file,{resizeWidth,resizeHeight,resizeQuality:'high'})` to the largest size that could plausibly be needed (pixels such that q=.4 output ~ 3x target; cap 6 MP, never above original); (3) work from that bitmap with a *single reused* OffscreenCanvas (resize rather than allocate); (4) never keep two full canvases; (5) terminate the worker after each job. Tiled/step-down scaling was NOT needed on Chrome (resize-at-decode is a single high-quality step); ASSUMPTION that Safari's `resizeQuality:'high'` is equally good (iOS SSIM .9856 vs .989 Chrome on 36 MP suggests yes).

## 7. Range targets, impossible targets, and the recommended algorithm (item 7)
Prototype `fitRange` (in `web/lib.js`, window `[lo,hi]` bytes, optional fixed dims) was run on 12 cases with the real encoder (Chrome; Safari re-run of the same suite: same statuses except one edge). Highlights:
| Case | Result (Chrome) |
|--|--|
| 8 MP photo, 20-50 KB, dims free | ok, 49.3 KB (q60, 1004x565, SSIM .979), 16 encodes, 0.3 s |
| 8 MP photo, window 19-20 KB | ok 20.3 KB (q60, 605x340), SSIM .949. Safari: missed min by 16 bytes (scale-bisect tolerance) -> add final +/- refine |
| 1500x1960 portrait to fixed 200x230, 20-50 KB | **ok_raised, 21.4 KB at q97** (q95 gave 17.1 KB; q100 > max) - raising quality is legitimate here |
| 200x230 source already exact, 20-50 KB | q95 = 18.2 KB, raised to q97+ in window (Safari 21.2 KB, SSIM .996) |
| signature 1200x400 PNG, 10-20 KB | ok 19.7 KB at q87 (SSIM .9997) |
| signature 140x60 fixed, 10-20 KB | **below_min**: 4.65 KB even at q100 (Safari 5.8 KB) |
| signature, 30-60 KB window | ok_raised 33 KB at q99 (visually lossless) |
| photo, max 1.5 KB, free dims | above_max: smallest 1.96 KB at 75x98 px (SSIM .69) |
| photo, max 1.5 KB at fixed 200x230 | above_max_fixed: smallest 1.5 KB at q5 (SSIM .68) |
**Algorithm (spec):**
1. Inputs: bitmap (EXIF-applied), `max` and optional `min` KB (user-entered), dims rule {free | max px | exact WxH}, format {jpeg default}, bg colour. Convert to byte window `[min*1024, max*1000]`; keep `hi_target = hi` (no extra 3%; the 1000/1024 gap is the margin) and **verify real blob.size**.
2. If the original file already lies in the window and EXIF-free output is not required, offer "already within limits - keep original" (but warn that EXIF/GPS remain).
3. Phase A (dims fixed at working dims): encode q=95. If size<=hi and >=lo -> done (cap at 95; q96-99 only as "raise" below). If size>hi: encode q=40; if <=hi, integer-bisect q in [40,95] for highest fitting q.
4. Phase B (only when dims may shrink and q40 > hi): bisect continuous scale at q=60 (8 steps, seeded by `scale0 = sqrt(hi/size_q60)^1/0.9`), then integer-bisect q in [60,95] at that scale for fill. No fixed ladder, no q=0.05 last resort; floor = min side 64 px.
5. If size<lo at q95: probe q100; if q100<lo -> status `below_min`; else integer-bisect q in (95,100] for the lowest q with size>=lo; accept if <=hi (status `raised`). Note Chrome q100 switches to 4:4:4 (size jump), so "no step lands in window" is possible -> report it.
6. If even the floor is > hi -> `above_max`; with fixed dims `above_max_fixed`.
7. Always return the best attempt and the status; never claim success unless `lo<=size<=hi`. Budget: <= 20 encodes, per-encode timeout, cancel on new file.
**Messages (copy):**
- ok: "49.3 KB - within 20-50 KB. Quality 60%, 1004x565 px."
- raised: "Your minimum is 20 KB. We raised JPEG quality to 97% to reach 21.4 KB. The picture looks the same; the file just stores more detail."
- original below min: "Your original is only 12 KB, below the 20 KB minimum. Compression cannot add size honestly. Options: use a higher-resolution original, or (advanced) re-save at maximum quality (reaches X KB)."
- below_min at fixed dims: "At 140x60 px this signature is at most 4.7 KB even at maximum quality, so a 10 KB minimum cannot be met at these dimensions. Check whether the portal enforces the dimensions strictly; if it does not, enlarge the pixel size (we can export 280x120 = N KB)."
- above_max: "Cannot go below 1.96 KB for this image at 75x98 px. Increase the limit or use a simpler image."
- above_max_fixed: "At 200x230 px the smallest JPEG is 1.5 KB at very low quality (blocky); your 1.5 KB limit is barely reachable. Allow a smaller size or higher limit."
- fits=false must **never** render as success; the current UI says "could not reach your target; this is the smallest result" but still offers Download as the primary action and gives no number about how far.

## 8. Minimum-size reality: is there any legitimate strategy? (hard constraint)
Yes, but limited, and each is disclosed:
1. **Raise JPEG quality (up to q100)** at the same dimensions. Valid and honest (VERIFIED: 17.1 -> 21.4 KB; signature 4.5 -> 5.8 KB at q100 only on Safari; signature at 1200x400 q99 -> 33 KB). Bounded by the image's natural complexity.
2. **Use more pixels** if the dims rule allows (up-scaling 140x60 -> 280x120 adds bytes but no detail). Valid only when the portal permits it; label as "enlarged".
3. **Lossless/4:4:4 output** (q100 switches to 4:4:4) - same family as 1.
4. **Padding** (COM segment). VERIFIED technically valid: a 20,000-byte COM segment inserted after SOI decodes fine in Chrome (13,204 -> 33,208 B, 200x230 decode OK) and is lost if the portal or any tool re-encodes (13,178 B after canvas re-encode). It adds no image information. **Recommendation: do not ship by default.** If product decides to ship it, it must be a separate opt-in switch ("Add N KB of empty filler data so the portal's minimum-size check passes. The image is identical.") shown only after 1-2 fail, never silent, never inside metadata that looks like camera data, and with the caveat that portals that re-save the image will remove it. Whether this is acceptable under each portal's terms is outside this review (ASSUMPTION: some portals treat it as tampering).
5. Otherwise tell the user the truth: the file cannot honestly reach the minimum at those dimensions; suggest a larger source/dimensions or check whether the portal really enforces the minimum.

## 9. Low-memory Android and iOS Safari (item 8)
Verified here: engine semantics only (section 6 and the table in "Test environments"). **Cannot be verified here and needs real devices:** (1) iPhone (2-4 GB class: SE 2/3, 11, 12) canvas allocation limit and tab-kill/"A problem repeatedly occurred" reload at 12-48 MP; JetSam behaviour with a Worker holding a 145 MB bitmap; (2) iOS 16/17/18 older WebKit: `OffscreenCanvas.convertToBlob` in workers (present on 26.3; older iOS ASSUMPTION), `createImageBitmap` options, WebP decode; (3) Android 2-3 GB phones (Redmi/Realme/Samsung A-series): OOM crash/reload of tab at 20-48 MP, time-to-result, thermal throttling; Chrome WebView in in-app browsers (WhatsApp/Instagram browsers are a big share of Indian traffic - ASSUMPTION); (4) files from the Android photo picker/camera (HEIC/HEIF/AVIF in gallery), iOS "Photos" HEIC conversion on `<input type=file accept=image/*>` (Safari converts to JPEG - ASSUMPTION); (5) Samsung Internet, Firefox Android, Opera Mini (no canvas encode; out of scope); (6) real camera EXIF GPS stripping on actual iPhone/Pixel images; (7) peak memory via `performance.measureUserAgentSpecificMemory` is unavailable without cross-origin isolation; use Xcode Instruments / `adb shell dumpsys meminfo`.

## 10. Staged implementation roadmap (independent agent tasks)
**Stage 0 - fixtures and gates (1 agent).** Add `tests/fixtures/` generators (script, no downloads): exif6+GPS JPEG, RGBA PNG, signature PNG, 200x230, noise, a 12 MP smooth JPEG. AC: `npm test` regenerates; Playwright asserts orientation 6 -> portrait pixels, no `Make/Model/GPS` bytes, RGBA corner white vs custom bg.
**Stage 1 - pure engine (1 agent, vitest).** New `fitRange()` in `compress.ts` per section 7 (integer q bisect, continuous scale, q100 raise, statuses, `1000/1024` window helper, remove ladder/last resort). Fake-encoder tests: monotone encoders, non-monotone encoder (1 violation), 4:4:4 jump at q100, window gap, `below_min`, `above_max`, `above_max_fixed`, <= 20 encodes, fill >= 93% on 200 fixtures. AC: all old tests updated; property test: result size never exceeds `hi` when status ok.
**Stage 2 - worker pipeline (1 agent).** Header-based dims read; resize-at-decode when > 12 MP; single reused OffscreenCanvas; `bitmap.close()` in `finally`; terminate on cancel/new file; typed error codes (decode, memory, timeout). AC (Playwright, Chrome): 36 MP fixture finishes < 5 s, peak RSS delta < 600 MB (script via ps tree), output <= max; cancel mid-run leaves no worker (`performance` check) and revokes URLs.
**Stage 3 - format/alpha (1 agent).** Alpha detection, background picker, PNG/WebP outputs gated by `blob.type`+magic bytes; JPEG ICC strip option (APP2 removal) default on when target < 30 KB. AC: transparent fixture -> white/custom/black exact pixels; Safari-type fallback simulated by stubbing `convertToBlob` to return PNG -> UI hides WebP; ICC strip: decode pixel-identical in Chrome.
**Stage 4 - UI/UX for ranges (1 agent).** Min + max inputs, KB basis note, dims presets (exact/max px), result card with exact bytes, status messages from section 7, no "Download" primary action when status != ok (secondary "download anyway"). AC: e2e for each status message, a11y (`aria-live`) check, mobile viewport.
**Stage 5 - cross-browser lab (1 agent).** Re-run the harness in this repo as `e2e/engine-matrix` against Chrome + WebKit (Playwright `webkit`, ASSUMPTION about parity with Safari) and document iOS-simulator manual script (`xcrun simctl openurl`). AC: matrix JSON committed under `docs/`, CI fails if `fits` regresses on the 36/48 MP fixtures in Chrome.
**Stage 6 - real-device gate (human).** Run section 9 list on >= 3 phones before launch; record time, success, OOM.
**Stage 7 - optional.** WASM progressive/mozjpeg transcode (+~3.5% measured for progressive, rest ASSUMPTION); HEIC input via Safari-only native decode; opt-in filler feature only after product/legal decision (section 8).

## 11. Immediate defects in the current code (for the spike owner)
- `compress.ts`: ladder floor 0.3 + `Q_LAST_RESORT=0.05` -> ugly/under-filled results (8.9 KB for 20 KB; 17.7-40 KB for 50 KB) and iOS `fits=false`; no min bound; float quality bisect (quality is integer percent in Chrome).
- `ImageCompressor.tsx`: `checkSize` does a full `createImageBitmap` just to read dims (a full 36-48 MP decode on the main thread, ~1 GB peak risk); rejects > 64 MP but the real danger is 12-48 MP on phones. Main-thread fallback has no `bmp.close()` on errors; worker request does not transfer the file.
- Worker: bitmap not closed on failure; 60 s timeout but no cancel UI.
- Download name is always `sizetune-compressed.jpg`, even if later formats differ.
