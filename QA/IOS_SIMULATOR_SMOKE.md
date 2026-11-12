# SizeTune: iOS Simulator smoke test (real WebKit, Mobile Safari)

Date: 2026-11-12. This is a SIMULATOR run on a Mac. It is NOT real-device verification. WebKit is the genuine iOS 26.3 engine, but CPU, memory pressure, tab-kill/reload behaviour, camera/HEIC handling, and the Photos picker's real-device transcoding are not representative of an iPhone. See "Still needs a real iPhone".

## Environment

| Item | Value |
|---|---|
| Simulator | iPhone 17 Pro (402 x 874 pt, 1206 x 2622 px), iOS 26.3 (26.3.1, build 23D8133) |
| Mobile Safari / WebKit | Safari 26.3, WebKit framework 8623.2.7.10.4 (from the simulator runtime bundle) |
| Host | Mac16,12 (Apple M4), 24 GB RAM, macOS 26.6.2, Xcode 27.1 |
| Site build | `npm run build` (8 pages, Astro 7 + Preact islands), served by `npx wrangler dev --port 8820 --ip 127.0.0.1`; Safari opened `http://127.0.0.1:8820/` (shared host network worked, no LAN IP needed) |
| Test images | `node scripts/gen-fixtures.mjs --device-pack` then `xcrun simctl addmedia booted <files>` |
| Driving | `mcp__Claude_Code_iOS_Simulator__control` (tap/swipe/touch_path/text/rotate) plus `xcrun simctl io booted screenshot` |

Safari note: the 3-tab-style floating URL bar of iOS 26 overlaps the bottom ~45 pt of the viewport and covers controls until scrolled; taps near it were lost a few times (test-harness issue, not a defect).

## Steps / commands

```
export PATH=$HOME/.nvm/versions/node/v24.12.0/bin:$PATH
npm run build
node scripts/gen-fixtures.mjs --device-pack
for f in 01 02 03 04 05 06 07 08 10 ...; do xcrun simctl addmedia booted tests/fixtures/.generated/device-pack/<file>; done
(nohup npx wrangler dev --port 8820 --ip 127.0.0.1 &)
xcrun simctl openurl booted http://127.0.0.1:8820/?t=N      # fresh page load per test (query string only to force a reload)
```

Media import results: 01, 02, 03, 04, 05, 06, 10 imported to Photos. `07-corrupt-truncated.jpg` also imported (Photos shows it as a half-grey image). `08-svg-renamed.png` FAILED in `addmedia` (NSException, as expected for non-media); `09-too-large-40mb.jpg` was not imported (not requested). Photos renames `.jpg` to `.jpeg` in the filename reported to the page. Non-media files were pushed to Files "On My iPhone" by copying into the simulator's `group.com.apple.FileProvider.LocalStorage/File Provider Storage/` directory (07 and 08), then picked through Browse > On My iPhone.

Page-picker flow: Choose image > Photo Library > thumbnail > blue check. Files flow: Choose image > Choose File > Browse > On My iPhone.

## Results

Evidence screenshots are in `QA/ios-smoke/` (JPEG, all under 80 KB).

| # | Case | Result | Evidence |
|---|---|---|---|
| S1 | Page loads, JS hydrates, tool interactive, presets respond | PASS | `s1-home.jpg`; the 10/20/30/50 KB presets toggle, file picker opens, the worker `compress.worker-*.js` loads on first run. First tap right after a fresh load was occasionally ignored (see D5) |
| S2 | Launch pages render without horizontal scroll, readable, nav works: `/`, `/resize-image-to-20kb/`, `/resize-signature/`, `/guides/photo-size-for-online-forms/`, `/privacy/`, `/about/`, `/terms/`, 404 | PASS (with defects D2, D3) | `s2-*-top.jpg`. For every page a 280 px horizontal swipe was issued and pre/post screenshots were byte-compared: no horizontal movement on any of the 8. Nav links wrap to two lines (Home..Privacy / Terms) with no overflow. Tapping "Signature" in the nav loaded the page (`s2-nav-tap-signature.jpg`, server log 200/304). 404 page lists useful links (HTTP 404 confirmed by curl). Only the top of each page was visually checked, not full-length |
| S3 | 12 MP photo (4000 x 3000, 1,394,885 B), max 50 KB, Auto | PASS | `s3-picked.jpg`, `s3-result-12mp-50kb.jpg`. On-screen: JPEG quality 60, 1,084 x 813 px, 47.6 KB (48,710 bytes), "97% smaller", "Within the target". Downloaded the file via the Safari download prompt (`s3-download-tap.jpg`): the file on the simulator disk is exactly 48,710 bytes, 1084 x 813, so the displayed size equals reality and is below 50,000. Time: finished within ~3 s of the tap (harness latency dominated; first screenshot after tap already showed the result) |
| S3b | Before/after control usable by touch | PASS | `s3-slider-dragged.jpg`: touch drag moves the split slider; "Show original / Split view / Show result" buttons present and large; native iOS "Do you want to download ..." prompt appears from the Download button |
| S4a | 36 MP photo (6000 x 6000, 3.56 MB), 50 KB | PASS | `s4-36mp-result.jpg`: JPEG q60, 946 x 946, 48.0 KB (49,123 bytes), "Within the target". Done in about 1 to 2 s on the M4; no page reload (wrangler log shows no new `GET /` and the result stayed on screen); no crash |
| S4b | 48 MP smooth image (8000 x 6000, 577 KB), 50 KB | PASS | `s4-48mp-result.jpg`: JPEG q60, 1,408 x 1,056, 48.2 KB (49,327 bytes). Done in under ~2 s; no reload/crash. NOTE: the Mac has 24 GB and a fast core; a real iPhone with canvas memory limits may behave differently (R3/R4 in the real-device plan stay open) |
| S5 | EXIF-rotated JPEG (300 x 400, Orientation 6) upright | PASS | `s5-exif-picked.jpg`, `s5-exif-result.jpg`, `s5-exif-result-2.jpg`: result 300 x 400 with red band at top (upright) in both the original and result halves. GPS/Make stripping from the output file was NOT inspected (see limitations) |
| S6 | Transparent PNG: default keeps transparency; JPEG shows disclosure + colour choice | PASS (partial inspection) | `s6-transparent-auto.jpg`: Auto selected, notice "This image has transparent areas. The chosen format keeps them transparent". `s6-transparent-jpeg-disclosure.jpg`: after choosing JPEG the notice changes to "...will be filled with the colour you choose below", with White / Black / Custom colour. `s6-transparent-jpeg-result.jpg`, `...-result2.jpg`: 20 KB limit gives JPEG q63, 800 x 600, 19.5 KB (19,994 B) and "Please note: Transparent areas were filled with white." I did not run the Auto/PNG result and inspect its alpha channel |
| S7 | WebP disabled/annotated in Safari | PASS | `s7-format-webp-disabled.jpg`: "WebP (not available)" radio is greyed, plus text "This browser cannot save WebP images, so WebP is switched off. JPEG and PNG work here." The Signature tool offers only JPEG / PNG |
| S8 | Tiny 140 x 60 signature, min 10 KB: honest, no padding | PASS (see note) | `s8-tiny-sig-min10kb-result.jpg`: with min 10 KB, Safari's JPEG encoder at quality 100 reaches 10.6 KB (10,865 B) for 140 x 60, so the minimum was genuinely reached, message "We raised JPEG quality to 100% to reach 10.6 KB". The fixture's expected "4 to 6 KB" is Chromium-encoder behaviour. To exercise the below-min path I set min 18 KB: `s8-below-min.jpg` shows "Minimum size not reached ... at most 10.6 KB even at maximum quality ... SizeTune will not pad a file with filler". PASS for honesty. File padding was not checked byte-wise |
| S9 | Cancel mid-run returns to idle | PASS | Runs are too fast on the M4 to cancel, so I loaded the Mac with 10 `yes` processes and ran 36 MP + PNG + 10 KB. Progress UI showed "Decoding the image..." with a Cancel button (`s9-running-36mp-png10kb.jpg`, taken from a run that finished in ~4 s). On a second run, tapping Cancel returned to idle (`s9-after-cancel-top.jpg`): drop zone shown again, no error, settings kept (10 KB, PNG). The loaded file is dropped (user must re-pick) |
| S10 | Signature tool: crop by touch, numeric fields, output, download | PASS | `s10-sig-cropper.jpg`, `s10-crop-after-drag-br.jpg` (drag bottom-right handle: crop 1200x800 becomes 787x513), `s10-crop-after-move.jpg` (drag box body: Left 359, Top 108), `s10-crop-numeric.jpg` (typed crop width 600 in the numeric field, box updated), `s10-sig-result.jpg` (result JPEG q44, 600 x 513, 18.1 KB = 18,573 B, honouring the numeric crop), `s10-sig-download.jpg` (Download + "Process another signature" buttons, white-paper preview). The Download button was not tapped here (done and verified for the main tool in S3) |
| S11a | SVG renamed .png rejected | PASS | `s11-svg-as-png.jpg`: "This file is not a JPEG, PNG or WebP image. SVG, GIF, HEIC and other formats are not supported." Picked from Files. |
| S11b | Truncated JPEG | PASS (info) | `s11-corrupt-jpeg.jpg`, `s11-corrupt-jpeg-result.jpg`: WebKit decodes it partially (1,200 x 900, lower part grey); the tool processes it normally ("Your image is ready", 47.7 KB) with no warning about damage. README says this outcome is browser-dependent and acceptable; see D4 |
| S12 | Console / JS errors | BLOCKED | Safari Web Inspector needs Mac Safari's Develop menu; Safari is a read-only tier for the automation here and `ios_webkit_debug_proxy` is not installed. Indirect signal only: no error banners seen, no failed requests in the wrangler log (all 200/304), worker script loaded |
| S13 | Landscape layout | PASS | `s13-landscape-home.jpg`, `s13-landscape-scrolled.jpg`: header nav fits on one row, tool card centred, no clipping or horizontal scroll visible. The result panel and the signature cropper were not re-checked in landscape |
| S14 | In-app browser behaviour | BLOCKED | Cannot emulate Instagram/WhatsApp/Gmail in-app WebViews here, and I did not fake it |

## Timings (simulator, Apple M4, not representative)

| Image | Limit | Time from tap to result | Result |
|---|---|---|---|
| 1200 x 800 (106 KB) | 50 KB | < 2 s | 41.6 KB (42,584 B), q41 |
| 12 MP | 50 KB | ~3 s (upper bound, harness latency) | 48,710 B |
| 36 MP | 50 KB | ~1 to 2 s | 49,123 B |
| 48 MP smooth | 50 KB | < 2 s | 49,327 B |
| 48 MP smooth, PNG | 10 KB | < 1 s | 9,646 B at 101 x 75 px |
| 36 MP, PNG, 10 KB (CPU loaded) | 10 KB | ~4 s | 9,668 B at 69 x 69 px |

Timings come from screenshot polling (each screenshot adds ~0.5 to 1 s), so treat them as upper bounds with about 1 s of slop.

## Observed defects

| ID | Severity | Where | Description / repro |
|---|---|---|---|
| D1 | Low | Result messages (main tool and signature tool) | Doubled closing parenthesis in the "larger than your original" warning: "Your original (1.6 KB (1,643 bytes)) is already smaller..." and "(10.6 KB (10,865 bytes))". Repro: pick `06-exif-rotated-gps` at 50 KB and press Resize image |
| D2 | Low | `/about/` | Missing spaces around inline links: "Theprivacy page explains ... and thephoto size guide explains". Confirmed in `dist/about/index.html` source: `The<a href="/privacy/">`. Repro: open `/about/`, read "How it works" |
| D3 | Info / launch blocker already known | `/privacy/`, `/terms/`, `/about/` | Placeholders `[[HUMAN: legal review pending ... owner name ... contact email]]` are visible to users in the built output (grep finds them in dist privacy, terms, about). Not a smoke-test defect, but they ship as-is |
| D4 | Info | Truncated/corrupt JPEG | Safari decodes the damaged file partially and the tool reports success with no "this image may be damaged" hint; the output silently contains grey. Acceptable per README, but a decode-warning would be friendlier |
| D5 | Low (unconfirmed) | Fresh page load | In two instances the very first tap on "Choose image" (about 3 to 5 s after `openurl`) produced no menu; a second tap worked. Not reproduced when waiting longer. May be hydration timing or the simulator. Also, once on the very first run (1200 x 800, 50 KB, cold worker) the tool returned to the empty idle state with no result and no message after pressing Resize image; I could not reproduce it on the next 8 runs. Logged as an unexplained observation, not a confirmed bug |
| D6 | Low (UX) | Layout shift after state changes | When processing starts, and after "Process another image" / Cancel, the page height changes and the scroll position lands mid-article (e.g. in "What the tool does") instead of staying at the tool, so users must scroll back up. Repro: finish a run, tap "Process another image" |
| D7 | Info | Cancel | Cancel clears the loaded file, so the user must re-pick the photo (settings are kept) |
| D8 | Info | Tiny image cropper | For a 140 x 60 source the crop handles overlap the small drawn image, which would be hard to grab by touch (touch crop was verified on a 1200 x 800 image; the numeric fields are the fallback) |

No crashes, no blank pages, no unexpected reloads, no horizontal scrolling were observed.

## Limitations of this run

- Simulator on a 24 GB M4 Mac: canvas/memory limits, jetsam tab kills, thermal throttling and real "reload because of memory" behaviour are NOT represented. 36 and 48 MP success here says nothing about a 3 to 6 GB iPhone.
- The Photos picker in the simulator delivered the original bytes (filename sizes matched the fixtures); a real device may transcode HEIC to JPEG, apply orientation, or strip metadata.
- Output EXIF/GPS stripping and PNG alpha of the Auto result were not inspected.
- Not tested: S12 (console), S14 (in-app browsers), 40 MB "too large" rejection (`09-too-large-40mb.jpg`), WebP input, Take Photo / camera, drag and drop, iPad, dark mode, VoiceOver, offline, Reduce Motion, large text sizes.
- Only the top of each launch page was visually checked; full-length reading and bottom-of-page layout were not.
- Test keystrokes used the simulator's hardware keyboard path (a keyboard accessory bar appears); the soft keyboard layout may differ.
- Horizontal-scroll check was done by swiping and byte-comparing screenshots, not by reading `scrollWidth`.

## Still needs a real iPhone

- R3/R4 style stress: 36 MP and 48 MP at 50 KB on 2 or 3 real devices (incl. an older 3 to 4 GB model): time, tab reload, "too large for this device" messaging.
- Real camera photos (HEIC to JPEG, Live Photos, Portrait, ProRAW) and screenshots; confirm output has no GPS/Make/Model.
- Safari Web Inspector console on a real device (S12) and Chrome/Firefox for iOS (WebKit shells).
- In-app browsers (Instagram, WhatsApp, Gmail, Facebook) for file picker and download behaviour (S14).
- Real download flow end to end: Downloads folder vs Photos vs "Save to Files", file name, size on disk.
- Low Power Mode, backgrounding the tab mid-run, memory pressure from other apps, and real touch targets (finger vs injected taps) for the crop handles.
- Dark mode and Dynamic Type (not covered here).

## Cleanup

wrangler on port 8820 was stopped (connection refused afterward); the `yes` CPU-load processes were killed; the simulator was left booted (iPhone 17 Pro, portrait). Generated fixtures remain in `tests/fixtures/.generated/device-pack/` (not committed). Nothing was committed, pushed or deployed; no files under `src/`, `tests/` (other than the generated pack), or configs were edited.
