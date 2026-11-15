# Image tool functional audit (independent)

Target: https://sizetune-staging.subhamojha9.workers.dev/ , routes `/` and `/resize-image-to-20kb/`. Date 2026-11-14. The commit label (8f0b204) could not be confirmed from the served HTML, so this is "whatever staging served on this date".
Method: throwaway Playwright scripts (outside the repo) drove the live URL in Chrome (system), WebKit and Firefox (Playwright builds). Every result was downloaded through the Playwright download event (Firefox/WebP: see IMG-9) and the saved file was decoded with sharp. Earlier QA reports were not used as evidence. Screenshots: `QA/screenshots/latest/image/` (chrome-* and webkit-*).
Fixtures: own sharp-generated files (3000x2000 JPEG, opaque PNG, RGBA PNG with 75 % non-opaque pixels, lossy WebP, alpha WebP, noise PNG, 8000x5000, 96/100/110 MP solid PNGs, corrupt/renamed/oversize files) plus repo `photo-12mp.jpg`, `exif6-gps.jpg`, device-pack 36 MP and 48 MP JPEGs.

## Checks applied to every download
Real bytes = displayed bytes (`data-bytes` and text); magic bytes = displayed format = file extension = saved name; pixel dimensions = displayed; limit checked as bytes <= max x 1000 (the tool's documented basis; also KiB), min as bytes >= min x 1024; success status vs actual constraints; alpha kept or flattened with the correct colour (pixel sampled); console errors; `URL.createObjectURL`/`revokeObjectURL` balance.

## Summary
| ID | Severity | Status | Title |
|--|--|--|--|
| IMG-1 | medium | Verified defective | Requested width x height not met under aspect lock, yet green "Your image is ready" |
| IMG-2 | low | Verified defective | "Quality had to go down to N% to fit" shown for a user-chosen quality with No limit |
| IMG-3 | medium | Verified defective (design gap) | Safari/WebKit: transparent WebP in Auto becomes a tiny PNG (183x128 from 1000x700) under a green success heading, with no warning before the run |
| IMG-4 | low | Verified defective | "KB"/"MB" are really KiB/MiB (size shown 18.7 KB for 19,172 B; "25 MB" cap = 26,214,400 B); max limit is x1000 but min is x1024 |
| IMG-5 | low | Verified defective | Aspect lock off + width only silently stretches (400x2000 from 3000x2000, no note) |
| IMG-6 | low | Verified defective | Over-limit pixel size (16000x16000, or 6000 px wide from 8000x5000) is only rejected after Resize, with a generic "settings cannot be used together" message and no retry/fix affordance |
| IMG-7 | low | Verified defective | Empty (0 byte) file reports "not a JPEG, PNG or WebP"; minimum within 1 KiB-ish of the maximum accepted but usually unreachable |
| IMG-8 | low | Verified defective | Min-only (No limit + minimum) pushes quality to 95-100: 2.66 MB output from a 2.19 MB original for a 100 KB minimum |
| IMG-9 | info | Verified harness limit | Playwright Firefox cannot download any `image/webp` blob (control page without the app fails identically); bytes were verified from the in-page Blob instead. Real Firefox download: Requires real-device testing |
| IMG-10 | info | Verified working | Everything else listed in the matrix and "Verified working" section |

No critical or high defects were found. No size/format/extension mismatch, no success shown with an unmet max or min, no stuck state, no leaked object URL, no console error.

## Confirmed defects

### IMG-1 (medium) Dimension request unmet but success styling
Repro: `/`, upload 3000x2000 JPEG, preset 100 KB, Advanced, Width 800, Height 600, aspect ratio kept, fit "Fit inside" (default), Resize.
Expected: either 800x600 (crop/pad offered) or a non-success/amber state, because a portal that demands 800x600 would reject the file.
Actual (all 3 browsers): heading "Your image is ready" with a green tick, file 800x533 (Chrome 99,362 B q95; WebKit 97,628 B q61; Firefox 96,514 B q86). The only disclosure is a line under "Please note": "Aspect lock kept the shape: the result is 800 x 533 px, not the 800 x 600 px you typed." Status is `ok`. Evidence: `chrome-dim-lock-800x600-mismatch-shown-as-ready.png`. Max-size constraint was met; the dimension constraint was not.

### IMG-2 (low) Misleading quality note
Repro: choose No limit, set Quality 30, Resize (3000x2000 JPEG). Actual: 203,725 B q30 (Chrome), note "Quality had to go down to 30% to fit, so the image may look blocky." Nothing had to fit; the user picked 30. Same with quality 1 (note says "had to go down to 1%"), all browsers. Quality 100 shows no note. Evidence `chrome-nolimit-q30-misleading-quality-note.png`.

### IMG-3 (medium) WebKit: no WebP encoder, transparent WebP becomes tiny PNG
Repro: WebKit, upload 1000x700 alpha WebP (77 KB), 50 KB, format Auto. WebP radio is disabled with an explanation, but nothing is said about the Auto fallback before the run. Result: PNG 183x128, 48,533 B, heading "Your image is ready"; the note says only "WebP can't be saved in this browser, so the result is PNG." Chrome/Firefox give WebP 746x522 / 1000x700 for the same input. The "PNG shrinks pixels" tip is not shown because the image has alpha. Opaque WebP in WebKit falls back to JPEG 612x459 (disclosed in notes, acceptable).

### IMG-4 (low) Unit wording
Result "18.7 KB (19,172 bytes)" for a 20 KB limit; source "2.09 MB (2,186,401 bytes)" (Finder would say 2.2 MB); cap text "Up to 25 MB" and error "the limit is 25 MB" while the code limit is 25 MiB = 26,214,400 B (a file of 26,214,400 B was accepted, 26,214,401 B rejected; Finder shows 26.2 MB for the accepted one). The page does state "1 KB = 1,024 bytes" and the exact bytes, and the max limit is applied as x1000, so no limit is ever exceeded; this is wording only. Mixed bases (max x1000, min x1024) are explained in the Target line.

### IMG-5 (low) Unlock + single dimension
Aspect off, Width 400 only, 3000x2000 source, 100 KB: output 400x2000 (Chrome 98,052 B). No note, though the picture is distorted. Evidence `chrome-unlock-width-only-distorts.png`. The empty Height field shows the natural height as placeholder, so it is arguably consistent; flagged as low surprise.

### IMG-6 (low) Late, vague rejection of huge output size
Width 16000 x Height 16000 (aspect off) on a 640x480 file, or Width 6000 on 8000x5000 (22.5 MP > 16 MP): field validation accepts it (limit 16,384 per side), Resize then returns: "Some settings cannot be used together (This browser can't safely create images this big; the maximum is 16 megapixels (16384 px per side).). Check the size, dimensions and format options." No retry button (editing a field clears the error and the next run succeeded: 130,998 B Chrome). Double punctuation and no pointer to the offending fields. Evidence `chrome-settings-error-16000px.png`.

### IMG-7 (low) Messages
Zero-byte file: "This file is not a JPEG, PNG or WebP image." (should say empty). Min 19.5 / max 20 KB is accepted by the form (19,968 B <= 20,000 B) but a 32-byte window is not reachable: Chrome 19,940 B, WebKit 19,591 B, Firefox 19,882 B all honestly `below_min` (that part is correct). Min 10 / max 10.5: WebKit below_min 9,918 B.

### IMG-8 (low, product) Min-only behaviour
No limit + minimum 100 KB on the 3000x2000 JPEG gives status ok, 2,657,249 B at q95, larger than the 2,186,401 B original (the UI does flag "larger than your original" and offers the original). On a 640x480 (43 KB) file the same setting returns 170,895 B at q100 ("raised"). Honest, but 1.7x to 26x above the requested minimum.

### IMG-9 Harness limit (not an app defect)
Firefox: click on Download for any WebP result hangs; a bare test page with an `image/webp` blob and `download` attribute behaves identically. WebP-in-Firefox results were validated from the page's Blob (same bytes the link would save) - see matrix.

## Verified working (reproduced, no defect)
- Presets 10/20/30/50/100/200 KB on JPEG: all <= preset x 1000 B (Chrome 9,608 / 19,172 / 29,126 / 48,180 / 98,212 / 193,676 B); /resize-image-to-20kb/ preselects 20 KB (19,172 B in Chrome, 19,368 WebKit, 19,191 Firefox).
- Custom sizes 1, 15, 37.5, "20 KB", "1,000", 50000; invalid 0, -5, abc, 0.5, 50001, empty, 1e3 are blocked with Resize disabled.
- Min/max range, min > max, min = max blocked; min-only, unreachable minimum -> `below_min` amber; unreachable maximum (noise, 1 KB, fixed 3000x2000 at 10 KB -> `above_max_fixed`) -> amber with explanation and "Download anyway".
- Formats: JPEG/PNG/WebP in, JPEG/PNG/WebP out; opaque PNG with a limit preselects JPEG with a visible note; extensions follow actual output (.jpg/.png/.webp); `my photo (1).JPG`, no extension, unicode, `.jpg.png`, PNG-named-.jpg all produce correct extension.
- Transparency: PNG/WebP outputs keep alpha (75.5 % -> 75.5-75.9 % non-opaque, min alpha 0); JPEG flatten sampled at a transparent pixel = (255,255,255) white, (0,0,0) black, custom #ff0000 -> (254,0,0); disclosed in notes. RGBA-but-fully-opaque PNG treated as opaque.
- Dimensions: width-only, height-only, both with contain/cover/stretch, max width/height, upscaling to 4000 px, fixed size + limit (1200x800 at 10 KB -> 9,880 B q23), fixed size + min (below_min flagged), portrait; dimensions-first vs quality-first differ (20 KB: 593x395 q85 vs 949x633 q60).
- Large inputs: 12 MP, 8000x5000, 36 MP, 48 MP, 96 MP and exactly 100 MP PNG processed (reduced-size note, all browsers, each under 2 s); 110 MP rejected with clear message; 25 MiB accepted, 25 MiB + 1 rejected.
- EXIF orientation applied (400x300 stored -> 300x400) and GPS/EXIF text removed in all three.
- Corrupt/truncated, text, SVG-as-PNG, GIF-as-JPEG rejected before processing with recovery: uploading a valid file afterwards works.
- Cancel (button and Escape) during a heavy PNG search: no result, no error, Resize re-enabled, focus on Resize, re-run works (Chrome/WebKit/Firefox). Immediate Escape on 12 MP likewise.
- Reset/repeat: 10 consecutive upload-run-download-reset cycles per browser, every shown size = real size; object URLs created 26 = revoked 26, 0 live at the end; double-click Resize gives one result; changing any setting clears the stale result; "Only the first file was used" when two files are dropped; drag-and-drop works.
- Console: 0 errors/warnings in all runs and browsers.
- Result larger than original: heading changes, "Keep your original" offered.

## Not tested
Real devices / iOS Safari memory limits (Requires real-device testing); the 60 s timeout and out-of-memory paths; mobile viewport layout; keyboard/screen-reader flow; no-JS; real Firefox WebP download; commit hash of the deployment.

## Recommendations (not defects)
1. For IMG-1 use an amber state (or a one-click "crop to 800x600") when requested width/height are not achieved.
2. Suppress the quality note when the user set quality (IMG-2); fix punctuation in IMG-6 and validate pixel area (16 MP) in the form.
3. In WebKit show the Auto fallback before running and default transparent WebP to JPEG-with-fill or warn about PNG shrinking (IMG-3).
4. Use "KiB/MiB" or decimal consistently (IMG-4); separate message for empty files (IMG-7).
5. For min-only, aim near the minimum rather than quality 95-100 (IMG-8).

## Case matrix (measured, per browser)
Format: status, downloaded bytes (equal to displayed bytes in every case), dimensions, magic type, quality. `FLAG` = automated check failed; reviewed individually: webp-auto-50/range-webp-40-50/awebp-auto-50 in WebKit = no encoder (IMG-3), dim-800x600-lock-contain = IMG-1. "EXC ... Timeout" in WebKit = WebP radio is disabled, the case cannot be run there (expected). nolimit-png-q-ignored = harness error (quality slider is not shown for PNG). range-invalid-close-19-20 "NOT blocked" is correct (19,968 B < 20,000 B, see IMG-7). Firefox WebP rows were measured from the in-page Blob. Every pass row: bytes within max x 1000, min x 1024 where set, format/extension/name consistent.

| Case | Chrome | WebKit | Firefox |
|--|--|--|--|
| jpeg-preset-10 | ok 9608B 651x434 jpeg q60 | ok 9492B 231x154 jpeg q60 | ok 9647B 383x255 jpeg q60 |
| jpeg-preset-20 | ok 19172B 949x633 jpeg q60 | ok 19368B 347x232 jpeg q60 | ok 19191B 560x373 jpeg q60 |
| jpeg-preset-30 | ok 29126B 1137x758 jpeg q60 | ok 29890B 436x290 jpeg q60 | ok 29361B 707x471 jpeg q60 |
| jpeg-preset-50 | ok 48180B 1366x911 jpeg q60 | ok 47973B 572x381 jpeg q60 | ok 47755B 921x614 jpeg q60 |
| jpeg-preset-100 | ok 98212B 1726x1151 jpeg q60 | ok 97316B 824x549 jpeg q60 | ok 97348B 1347x898 jpeg q60 |
| jpeg-preset-200 | ok 193676B 2166x1444 jpeg q60 | ok 194218B 1183x789 jpeg q60 | ok 199396B 1958x1305 jpeg q60 |
| png-opaque-auto-20 | ok 19501B 786x590 jpeg q60 | ok 18848B 360x270 jpeg q60 | ok 19497B 588x441 jpeg q60 |
| png-opaque-keep-png-100 | ok 98290B 272x204 png | ok 96186B 269x202 png | ok 97149B 272x204 png |
| png-opaque-jpeg-100 | ok 99781B 1600x1200 jpeg q46 | ok 97555B 871x653 jpeg q60 | ok 94959B 1335x1001 jpeg q60 |
| png-opaque-webp-30 | ok 29788B 1112x834 webp q60 | EXC locator.check: Timeout 30000ms exceeded. | ok 29492B 1020x765 webp q60 |
| webp-auto-50 | ok 49158B 1414x1060 webp q60 | ok 49902B 612x459 jpeg q60 **FLAG** | ok 48050B 1361x1021 webp q60 |
| webp-to-jpeg-50 | ok 48126B 1208x906 jpeg q60 | ok 49902B 612x459 jpeg q60 | ok 47875B 984x738 jpeg q60 |
| webp-to-png-200 | ok 194950B 380x285 png | ok 193501B 370x277 png | ok 196927B 376x282 png |
| jpeg-to-webp-20 | ok 19208B 1358x905 webp q60 | EXC locator.check: Timeout 30000ms exceeded. | ok 18924B 620x413 webp q60 |
| jpeg-to-png-200 | ok 194775B 413x275 png | ok 196942B 397x265 png | ok 194517B 404x270 png |
| tpng-auto-200 | ok 193360B 402x268 png | ok 194103B 398x265 png | ok 193582B 412x275 png |
| tpng-png-100 | ok 96387B 284x189 png | ok 98039B 273x182 png | ok 96776B 284x189 png |
| tpng-webp-50 | ok 49010B 802x535 webp q60 | EXC locator.check: Timeout 30000ms exceeded. | ok 48438B 840x560 webp q60 |
| tpng-jpeg-white-50 | ok 48567B 1200x800 jpeg q79 | ok 46073B 1200x800 jpeg q50 | ok 49751B 1200x800 jpeg q76 |
| tpng-jpeg-black-50 | ok 49812B 1200x800 jpeg q79 | ok 46863B 1200x800 jpeg q50 | ok 48947B 1200x800 jpeg q75 |
| awebp-auto-50 | ok 47876B 746x522 webp q60 | ok 48533B 183x128 png **FLAG** | ok 48512B 1000x700 webp q60 |
| awebp-jpeg-50 | ok 46733B 1000x700 jpeg q87 | ok 49432B 1000x700 jpeg q63 | ok 49309B 1000x700 jpeg q86 |
| awebp-png-200 | ok 189932B 388x272 png | ok 193430B 388x271 png | ok 194985B 406x284 png |
| png-opaque-alphachannel-auto-50 | ok 46581B 600x400 jpeg q92 | ok 49677B 600x400 jpeg q74 | ok 38250B 600x400 jpeg q89 |
| custom-15 | ok 14453B 832x555 jpeg q60 | ok 14768B 294x196 jpeg q60 | ok 14991B 487x325 jpeg q60 |
| custom-1 | ok 994B 96x64 jpeg q14 | above_max 1126B 96x64 jpeg q1 | ok 994B 96x64 jpeg q23 |
| custom-37.5 | ok 36273B 1239x826 jpeg q60 | ok 36414B 491x327 jpeg q60 | ok 36670B 797x531 jpeg q60 |
| custom-"20 KB" | ok 19172B 949x633 jpeg q60 | ok 19368B 347x232 jpeg q60 | ok 19191B 560x373 jpeg q60 |
| custom-1,000 | ok 995331B 3000x2000 jpeg q80 | ok 984131B 3000x2000 jpeg q48 | ok 965839B 3000x2000 jpeg q69 |
| custom-50000 | ok 2657249B 3000x2000 jpeg q95 | ok 3129352B 3000x2000 jpeg q95 | ok 3155588B 3000x2000 jpeg q95 |
| custom-invalid-0 | blocked (run disabled) | blocked (run disabled) | blocked (run disabled) |
| custom-invalid-neg | blocked (run disabled) | blocked (run disabled) | blocked (run disabled) |
| custom-invalid-abc | blocked (run disabled) | blocked (run disabled) | blocked (run disabled) |
| custom-invalid-50001 | blocked (run disabled) | blocked (run disabled) | blocked (run disabled) |
| custom-invalid-0.5 | blocked (run disabled) | blocked (run disabled) | blocked (run disabled) |
| custom-invalid-empty | blocked (run disabled) | blocked (run disabled) | blocked (run disabled) |
| custom-invalid-1e3 | blocked (run disabled) | blocked (run disabled) | blocked (run disabled) |
| nolimit-q85-jpeg | ok 1770764B 3000x2000 jpeg q85 | ok 2787570B 3000x2000 jpeg q85 | ok 2004225B 3000x2000 jpeg q85 |
| nolimit-png-opaque | ok 3944042B 1600x1200 png | ok 3128840B 1600x1200 png | ok 3096981B 1600x1200 png |
| range-15-20 | ok 19172B 949x633 jpeg q60 | ok 19368B 347x232 jpeg q60 | ok 19191B 560x373 jpeg q60 |
| range-90-100 | ok 98212B 1726x1151 jpeg q60 | ok 97316B 824x549 jpeg q60 | ok 97348B 1347x898 jpeg q60 |
| range-invalid-min>max | blocked (run disabled) | blocked (run disabled) | blocked (run disabled) |
| range-invalid-close-19-20 | NOT blocked (run enabled) | NOT blocked (run enabled) | NOT blocked (run enabled) |
| range-min-eq-max | blocked (run disabled) | blocked (run disabled) | blocked (run disabled) |
| range-webp-40-50 | ok 49158B 1414x1060 webp q60 | ok 49902B 612x459 jpeg q60 **FLAG** | ok 48050B 1361x1021 webp q60 |
| min-only-nolimit-100 | raised 170895B 640x480 jpeg q100 | raised 219449B 640x480 jpeg q100 | ok 105013B 640x480 jpeg q95 |
| min-only-nolimit-100-enlarge | raised 170895B 640x480 jpeg q100 | raised 219449B 640x480 jpeg q100 | ok 105013B 640x480 jpeg q95 |
| min-only-blank-max | blocked (run disabled) | blocked (run disabled) | blocked (run disabled) |
| min-only-100-from-3000 | ok 2657249B 3000x2000 jpeg q95 | ok 3129352B 3000x2000 jpeg q95 | ok 3155588B 3000x2000 jpeg q95 |
| min-unreachable-tiny-4kb-min10 | below_min 8464B 120x90 jpeg q100 | below_min 9902B 120x90 jpeg q100 | below_min 9438B 120x90 jpeg q100 |
| min-unreachable-tiny-nolimit-min50 | below_min 8464B 120x90 jpeg q100 | below_min 9902B 120x90 jpeg q100 | below_min 9438B 120x90 jpeg q100 |
| min-png-sig | ok 291237B 461x346 png | ok 289174B 480x360 png | ok 290324B 485x364 png |
| dim-w800-lock-max100 | ok 99362B 800x533 jpeg q95 | ok 97628B 800x533 jpeg q61 | ok 96514B 800x533 jpeg q86 |
| dim-h300-lock-max100 | ok 25987B 450x300 jpeg q95 | ok 66611B 450x300 jpeg q95 | ok 68893B 450x300 jpeg q95 |
| dim-800x600-lock-contain | ok 99362B 800x533 jpeg q95 **FLAG** | ok 97628B 800x533 jpeg q61 **FLAG** | ok 96514B 800x533 jpeg q86 **FLAG** |
| dim-800x600-lock-cover | ok 90498B 800x600 jpeg q93 | ok 99175B 800x600 jpeg q60 | ok 99467B 800x600 jpeg q85 |
| dim-800x600-unlock-stretch | ok 95638B 800x600 jpeg q94 | ok 99921B 800x600 jpeg q60 | ok 99760B 800x600 jpeg q85 |
| dim-300x300-unlock | ok 15663B 300x300 jpeg q95 | ok 43143B 300x300 jpeg q95 | ok 45301B 300x300 jpeg q95 |
| dim-w400-unlock-only | ok 98052B 400x2000 jpeg q73 | ok 98405B 400x2000 jpeg q45 | ok 98171B 400x2000 jpeg q69 |
| dim-maxw500 | ok 31577B 500x333 jpeg q95 | ok 77484B 500x333 jpeg q95 | ok 79009B 500x333 jpeg q95 |
| dim-maxh400-maxw500 | ok 31577B 500x333 jpeg q95 | ok 77484B 500x333 jpeg q95 | ok 79009B 500x333 jpeg q95 |
| dim-maxw-nolimit | ok 65023B 1000x667 jpeg q85 | ok 300148B 1000x667 jpeg q85 | ok 162658B 1000x667 jpeg q85 |
| dim-fixed-3000-max10 | above_max_fixed 37545B 3000x2000 jpeg q1 | above_max_fixed 159623B 3000x2000 jpeg q1 | above_max_fixed 95952B 3000x2000 jpeg q1 |
| dim-fixed-1200x800-max10 | ok 9880B 1200x800 jpeg q23 | above_max_fixed 21000B 1200x800 jpeg q1 | above_max_fixed 15999B 1200x800 jpeg q1 |
| dim-fixed-1200x800-max200-min150 | ok 195689B 1200x800 jpeg q93 | ok 185826B 1200x800 jpeg q60 | ok 199622B 1200x800 jpeg q86 |
| dim-fixed-w100-min100 | below_min 21634B 200x133 jpeg q100 | below_min 36122B 200x133 jpeg q100 | below_min 34290B 200x133 jpeg q100 |
| dim-upscale-4000 | ok 195156B 4000x3000 jpeg q32 | above_max_fixed 258362B 4000x3000 jpeg q1 | ok 199305B 4000x3000 jpeg q7 |
| dim-upscale-16000-reject | error: Some settings cannot be used together (This browse | error: Some settings cannot be used together (This browse | error: Some settings cannot be used together (This browse |
| dim-w16385-invalid | blocked (run disabled) | blocked (run disabled) | blocked (run disabled) |
| dim-w0-invalid | blocked (run disabled) | blocked (run disabled) | blocked (run disabled) |
| dim-w800.5-invalid | blocked (run disabled) | blocked (run disabled) | blocked (run disabled) |
| dim-w>maxw-invalid | blocked (run disabled) | blocked (run disabled) | blocked (run disabled) |
| dim-portrait-w400 | ok 48118B 400x600 jpeg q92 | ok 49414B 400x600 jpeg q73 | ok 39669B 400x600 jpeg q89 |
| dim-dimsfirst-w1000 | ok 48371B 883x589 jpeg q85 | ok 48548B 401x267 jpeg q85 | ok 47867B 574x383 jpeg q85 |
| dim-dimsfirst-maxw | ok 48410B 884x589 jpeg q85 | ok 49035B 404x270 jpeg q85 | ok 47867B 574x383 jpeg q85 |
| strat-quality-first-20 | ok 19172B 949x633 jpeg q60 | ok 19368B 347x232 jpeg q60 | ok 19191B 560x373 jpeg q60 |
| strat-dims-first-20 | ok 18932B 593x395 jpeg q85 | ok 19534B 241x161 jpeg q85 | ok 19771B 354x236 jpeg q85 |
| strat-dims-first-w800-100 | ok 99362B 800x533 jpeg q95 | ok 97628B 800x533 jpeg q61 | ok 96514B 800x533 jpeg q86 |
| png-dims-w500-nolimit | ok 346462B 500x375 png | ok 312288B 500x375 png | ok 307750B 500x375 png |
| tpng-dims-w300-png | ok 109075B 300x200 png | ok 113169B 300x200 png | ok 101061B 300x200 png |
| noise-png-10 | ok 9939B 261x261 jpeg q60 | ok 9685B 113x113 jpeg q60 | ok 9714B 155x155 jpeg q60 |
| noise-png-10-png | ok 9806B 64x64 png | above_max 14123B 64x64 png | above_max 14103B 64x64 png |
| noise-png-100-png | ok 96580B 186x186 png | ok 96951B 168x168 png | ok 97080B 169x169 png |
| tiny-4kb-10 | ok 2461B 120x90 jpeg q95 | ok 3059B 120x90 jpeg q95 | ok 4079B 120x90 jpeg q95 |
| larger-than-original-200 | raised 170895B 640x480 jpeg q100 | raised 199305B 513x385 jpeg q100 | ok 105013B 640x480 jpeg q95 |
| exif6-50 | ok 1850B 300x400 jpeg q95 | ok 3563B 300x400 jpeg q95 | ok 4942B 300x400 jpeg q95 |
| photo12mp-100 | ok 99003B 3201x2401 jpeg q60 | ok 98890B 1748x1311 jpeg q60 | ok 99075B 2371x1778 jpeg q60 |
| photo12mp-20-dims-first | ok 19473B 586x439 jpeg q85 | ok 19926B 350x262 jpeg q85 | ok 19415B 565x424 jpeg q85 |
| big-8000x5000-20 | ok 19832B 1232x770 jpeg q60 | ok 18913B 699x437 jpeg q60 | ok 19345B 955x597 jpeg q60 |
| big-8000x5000-w6000 | error: Some settings cannot be used together (This browse | error: Some settings cannot be used together (This browse | error: Some settings cannot be used together (This browse |
| invalid-corrupt-truncated.jpg | rejected: This image file looks incomplete or damaged ( | rejected: This image file looks incomplete or damaged ( | rejected: This image file looks incomplete or damaged ( |
| invalid-zero-bytes.jpg | rejected: This file is not a JPEG, PNG or WebP image. S | rejected: This file is not a JPEG, PNG or WebP image. S | rejected: This file is not a JPEG, PNG or WebP image. S |
| invalid-text-as.jpg | rejected: This file is not a JPEG, PNG or WebP image. S | rejected: This file is not a JPEG, PNG or WebP image. S | rejected: This file is not a JPEG, PNG or WebP image. S |
| invalid-svg-as.png | rejected: This file is not a JPEG, PNG or WebP image. S | rejected: This file is not a JPEG, PNG or WebP image. S | rejected: This file is not a JPEG, PNG or WebP image. S |
| invalid-gif-as.jpg | rejected: This file is not a JPEG, PNG or WebP image. S | rejected: This file is not a JPEG, PNG or WebP image. S | rejected: This file is not a JPEG, PNG or WebP image. S |
| invalid-oversize-26mb.jpg | rejected: This file is too large to process in the brow | rejected: This file is too large to process in the brow | rejected: This file is too large to process in the brow |
| invalid-exactly-25MiB-plus1.jpg | rejected: This file is too large to process in the brow | rejected: This file is too large to process in the brow | rejected: This file is too large to process in the brow |
| invalid-solid-110mp.png | rejected: This image has too many pixels to process saf | rejected: This image has too many pixels to process saf | rejected: This image has too many pixels to process saf |
| invalid-notes.txt | rejected: This file is not a JPEG, PNG or WebP image. S | rejected: This file is not a JPEG, PNG or WebP image. S | rejected: This file is not a JPEG, PNG or WebP image. S |
| range-19.5-20 | below_min 19940B 967x645 jpeg q60 | below_min 19591B 352x235 jpeg q60 | below_min 19882B 570x380 jpeg q60 |
| range-19-20 | ok 19976B 964x643 jpeg q60 | ok 19538B 351x234 jpeg q60 | ok 19913B 569x379 jpeg q60 |
| range-10-10.5 | ok 10290B 682x454 jpeg q60 | below_min 9918B 250x167 jpeg q60 | ok 10296B 393x262 jpeg q60 |
| bg-hex-red | ok 49554B 1200x800 jpeg q79 | ok 47027B 1200x800 jpeg q50 | ok 48951B 1200x800 jpeg q75 |
| bg-white-default-check | ok 95202B 1000x700 jpeg q94 | ok 86535B 1000x700 jpeg q82 | ok 96249B 1000x700 jpeg q92 |
| nolimit-q30 | ok 203725B 3000x2000 jpeg q30 | ok 344622B 3000x2000 jpeg q30 | ok 288697B 3000x2000 jpeg q30 |
| nolimit-q100 | ok 4249889B 3000x2000 jpeg q100 | ok 5704870B 3000x2000 jpeg q100 | ok 5566056B 3000x2000 jpeg q100 |
| nolimit-q1 | ok 37545B 3000x2000 jpeg q1 | ok 159623B 3000x2000 jpeg q1 | ok 95952B 3000x2000 jpeg q1 |
| nolimit-webp-q50 | ok 229108B 2000x1500 webp q50 | EXC locator.check: Timeout 30000ms exceeded. | ok 228656B 2000x1500 webp q50 |
| nolimit-png-q-ignored | EXC locator.evaluate: Timeout 30000ms exceed | EXC locator.evaluate: Timeout 30000ms exceed | EXC locator.evaluate: Timeout 30000ms exceed |
| exactly-25MiB-accepted | ok 46906B 640x480 jpeg q85 | ok 49773B 640x480 jpeg q55 | ok 49410B 640x480 jpeg q83 |
| solid-96mp-50 | ok 20643B 2242x1495 jpeg q95 | ok 47757B 2112x1408 jpeg q60 | ok 47976B 2126x1418 jpeg q60 |
| solid-100mp-50 | ok 20599B 1830x1830 jpeg q95 | ok 48069B 1723x1723 jpeg q60 | ok 48152B 1737x1737 jpeg q60 |
| photo-36mp-20 | ok 19941B 783x783 jpeg q60 | ok 19432B 493x493 jpeg q60 | ok 19748B 703x703 jpeg q60 |
| smooth-48mp-20 | ok 19801B 1633x1225 jpeg q70 | ok 19659B 788x591 jpeg q60 | ok 19879B 1184x888 jpeg q60 |
| smooth-48mp-200-w5000 | ok 185262B 4000x3000 jpeg q89 | ok 199385B 4000x3000 jpeg q35 | ok 199882B 4000x3000 jpeg q65 |
| smooth-48mp-png-100 | ok 97191B 323x242 png | ok 97069B 334x251 png | ok 96030B 402x302 png |
| min-100-max-120-photo12mp | ok 119853B 4000x3000 jpeg q47 | ok 116553B 1951x1463 jpeg q60 | ok 117386B 2642x1981 jpeg q60 |
| 1KB-limit-png-alpha | above_max 13726B 96x64 png | above_max 14086B 96x64 png | above_max 13527B 96x64 png |
| 1KB-limit-noise | ok 959B 76x76 jpeg q60 | above_max 1312B 64x64 jpeg q1 | ok 985B 64x64 jpeg q14 |
