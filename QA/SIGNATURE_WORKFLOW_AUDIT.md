# Signature tool: independent functional audit

- Target: https://sizetune-staging.subhamojha9.workers.dev/resize-signature/ (live, dev build 8f0b204 as stated by requester)
- Date: 2026-11-14. Audit only: no source changes, no commits, no deploys.
- Method: Playwright scripts against the LIVE URL (scripts in the session scratchpad `sig-audit/`, not in `src/`). Chrome (system, desktop + touch emulation via CDP), WebKit (Playwright build), Firefox (3 pipeline cases). Test images generated with sharp (14 + 8 images, incl. faint, shadow, grey paper, detached strokes, edge-touching, tiny, 4000x3000 photo, EXIF-rotated, transparent). Earlier QA reports and BLOCKERS.md were not used.
- Download check method: each result was downloaded via the real Download link, decoded with sharp, and compared (mean absolute error, 0-255 scale) with the ORIGINAL file cropped at the exact crop rectangle shown in the on-screen fields, resized to the downloaded size. Byte size and decoded format/dimensions compared with the on-screen result text.
- Evidence: `QA/screenshots/latest/signature/` (file names quoted per finding).
- Caveat on console noise: Chrome console was clean in every flow. WebKit/Firefox logs showed CSP "stylesheet"/"blob connect-src" errors; both were reproduced as artifacts of the harness (Playwright's own screenshot injection and my `fetch(blob:)` probe) and are NOT product defects. WebKit also logs a COEP/SharedArrayBuffer warning (see SIG-12).

## A. Confirmed defects (Verified defective)

### SIG-1 (high) Changing crop shape silently cuts off strokes
- Status: Verified defective (Chrome; same crop maths is browser independent, WebKit/Firefox 3:1 download also verified: crop 0,69,800x267).
- Repro: open page, upload `dark-white.png` (800x400, signature ink x197-763, y65-339 with an i-dot at the top and a flourish at the bottom right). Margin = Small, click "Auto-trim whitespace" (crop 180,48 600x308). Choose Crop shape "3 : 1".
- Expected: the box still contains the whole signature, or the user is warned that the chosen shape cannot contain it (or the frame is extended with background).
- Actual: crop becomes x0,y69,800x267. The ink is 274 px tall, so the dot and the flourish are clipped. No message appears. Resize produces a 800x267 JPEG whose ink touches the top and bottom edges (decoded ink box y0-267). 4:1 gives 800x200 at y102 (ink rows visible 145 of 274), 1:1 gives 400x400 at x280 (ink cut on both left and right, visible width 400 of 566). The 2:1 shape worked (616x308, whole ink kept).
- Evidence: `shape-3to1-clips-strokes-chrome.png`, `shape-3to1-result-chrome.png`, `shape-3to1-downloaded.jpg`, `C07-post.png` (4:1), `C05-post.png` (3:1).

### SIG-2 (medium) Auto-trim reports success when it did nothing
- Status: Verified defective.
- Repro A: upload `large-photo.jpg` (4000x3000, signature in the middle of a noisy photo), click Auto-trim. Repro B: upload `shadow.png` (soft grey shadow gradient over paper), Auto-trim with margin None.
- Expected: message says nothing was trimmed or trimming was only partial.
- Actual A: crop stays 0,0,4000x3000 (no trim at all) yet status reads "Cropped to the ink with a margin. Adjust it if needed." (also "Cropped tight to the ink" at margin None). Actual B: crop 0,0,763x339 (tight) / 786x362 (small), so left and top shadow remain, status claims "Cropped tight to the ink".
- Evidence: `autotrim-large-photo-msg-chrome.png`, `autotrim-shadow-chrome.png`.

### SIG-3 (medium) Touch: handles cover the middle of short crop boxes, so dragging the box resizes it
- Status: Verified defective in Chrome touch emulation (CDP touch events, 390x844, DPR 3). Requires real-device testing for feel on iOS/Android.
- Repro: upload `wide.png` (1600x200), margin Small, Auto-trim. On a 390 px viewport the box is 254x26 CSS px. Touch the middle of the box and drag down 25 px.
- Expected: box moves.
- Actual: `document.elementFromPoint` at the box centre returns the south handle (44x44 px touch handles overlap); crop height went 154 -> 178 (resize) instead of moving. In another run a vertical swipe at the centre of a 51 px tall box collapsed the crop to height 4. On `dark-white.png` (box 105 px tall) the centre is the box and moves correctly (22 -> 92 y shift). On a 4:1 box (274x69 px) 56 percent of the box area is un-obscured and move works.
- Evidence: `touch-short-box-wide-390.png`, `touch-short-box-dark-white-390.png`, `touch-small-box-390.png`, `touch-4to1-box-handles-390.png`.

### SIG-4 (low) Typed crop values: silent collapse and silent reverts
- Status: Verified defective (minor).
- Repro: with a crop of 113x66 at x325, type Left = 9999. Also type "abc", "12.5", "1e2" in any crop field and tab away.
- Actual: Left=9999 is clamped to 799 and the width is shrunk to 1 px with no message (a 1 px crop is then allowed to Resize). Non-integer or non-numeric text is ignored and the field silently reverts on blur; no error text.
- Expected: message when the value is clamped or rejected.

### SIG-5 (low) Auto-trim thresholds drop very light ink and 1 px edge pixels
- Status: Verified defective (limits; the page guidance partly warns of this).
- Repro A: `very-faint.png` (stroke #e0e0e0 on white, contrast 31 levels): Auto-trim answers "No signature was found to trim", crop stays full. Honest, but no way to lower the sensitivity. #b8b8b8 (contrast 71) and #bbb work.
- Repro B: `hairline.png` (1 px stroke): margin None gives crop x300-1139, real ink x299-1140; the first and last ink columns are cut. `wide.png` at margin None: crop x100-1499 vs ink x99-1500 (anti-aliased end pixels). Margins Small and above keep all ink in every image tested.
- Evidence: numbers in matrix; no screenshot beyond `autotrim-*`.

### SIG-6 (low) Black fill can hide dark ink; no warning
- Status: Verified defective (usability).
- Repro: `transparent.png` (ink #111, transparent paper). Choose JPEG, "Fill transparent areas with" Black, Resize.
- Actual: JPEG decoded corner (0,0,0), ink luminance about 17 on 0: signature practically invisible. The text only says the fill changes how it looks. White and custom red fills correct (corner 255,255,255 and 254,0,0).

## B. Behaviours that work as disclosed but can mislead (Verified working, with caveat)

### SIG-7 (low) Stretch and Cover change framing compared with the on-screen crop
- Status: Verified working as disclosed; potential surprise.
- Repro: crop 600x308 (aspect 1.948). (a) Untick "Keep the aspect ratio", type 140 x 60: fit defaults to "Stretch ... may distort"; output 140x60, aspect 2.333, so the signature is 19.8 percent wider relative to height, no result note. (b) With the lock on, fit "Fill the size (edges are cropped)", 200 x 100: output 200x100 trims about 8 source rows that the crop box showed, and the result notes are empty.
- Expected: result notes mention distortion or edge cropping.

### SIG-8 (low) Typing both width and height with the default lock gives a different size
- Status: Verified working as disclosed.
- Repro: crop 600x308, width 300 height 100: output 195x100 with a note "Aspect lock kept the shape: the result is 195 x 100 px, not the 300 x 100 px you typed." A form that needs exactly 300x100 requires unticking the lock and accepting distortion, or cropping to 3:1 first (see SIG-1).

## C. Verified working

- SIG-9 Download equals crop framing: for 24 non-resampled cases, mean absolute error between decoded download and original-cropped-at-the-on-screen-rectangle was 0 to 0.07 (JPEG noise), aspect ratios identical (e.g. 1.948 vs 1.948, 2.996 vs 2.996). Cases with resize 0.23-1.12 (resampling differences). EXIF-rotated JPEG (orientation 6): crop fields in post-rotation space, download 308x600, MAE 0.09 vs rotated crop.
- SIG-10 Result preview equals download: `signature-result-image.src` is the same blob URL as the Download link in every run; preview natural size equals decoded download size. Displayed bytes always equal the downloaded file bytes (e.g. "9.3 KB (9,508 bytes)" vs 9508; 19,569; 13,259 ...). Extension and magic bytes consistent: `*-sizetune.jpg` starts ffd8ff, `*-sizetune.png` is a decoded PNG. Blob MIME type itself could not be read (the page's CSP blocks fetch of blob URLs); the saved file type is correct.
- Overlay alignment: crop box overlay matched the numeric crop (percent of image) to within 0.1 px at zoom 1, 1.5, 2, 3, 4. Mouse drag of the box (+60,+30 CSS px at 3x zoom) moved the crop exactly 25,13 source px as predicted; SE handle +30,+15 gave +13,+6 as predicted. Touch drag: move +117,+29, SE resize -88,-29, NW resize +58,+23 all exact.
- Auto-trim kept detached strokes: `big-detached.png` (3000x1500, i-dot r=4, a 2 px flourish, far corner dot r=3) crop x296-2700, y195-1283 contains all of them; `far-speck.png` likewise. Margins None/Small/Medium/Large give 0/17/34/56-ish px padding as chosen and respect image edges (edge-touching signature stays at x0-800).
- Transparency: transparent PNG selects PNG by default and keeps alpha (decoded alpha true, MAE 0 on Chrome, Firefox, WebKit). JPEG choice shows the fill disclosure and a result note ("Transparent areas were filled with white/black/the colour #ff0000").
- File size: max 5 KB -> 4,995 bytes at 600x308; max 2 KB -> 1,984 bytes but pixels shrunk to 231x119; below-minimum case (min 15 KB on a source that cannot reach it) reports "below_min" honestly (13,259 bytes) and offers "Download anyway"; tiny 60x30 PNG gives a result larger than the original with a clear warning and "Keep your original instead".
- Errors: random bytes named .png, a .txt and an SVG all get the clear message "This file is not a JPEG, PNG or WebP image"; 9000x9000 JPEG shows the "too large to show" fallback with number fields.
- Keyboard (Chrome and WebKit): crop box is a tab stop right after the file input; Arrow = 1 px move, Shift = 10, Alt+Arrow resizes the right/bottom edge, Alt+Shift+Arrow 10 px; clamped at the image edge; arrow keys do not scroll the page; yellow 2 px focus outline present (computed `oklch(0.905 0.182 98.111) solid 2px`, `:focus-visible` true); aria-label rewrites with the live rectangle; handles are `aria-hidden`, not tabbable (number fields are the alternative); after Resize focus moves to the result heading and the polite status reads "Finished. The result is 3.0 KB (3,105 bytes)." Tab order Chrome: skip link, nav, file, crop box, zoom, shape, margin, x, y, width, height, lock, Auto-trim, Use whole picture, size presets, size field, width, height, aspect lock, JPEG, Advanced, Resize. (WebKit's default Tab skips buttons/radios/checkboxes per Safari settings; not a defect.)
- Responsive 320/375/390/768/1024/1440 in Chrome and WebKit: documentElement scrollWidth equals viewport at every width for both the loaded-crop state and the result state; no overflowing elements; touch handles measure 44x44 on touch (32x32 with mouse).
- Chrome console: 0 errors/warnings across every flow.

## D. Recommendations (not defects)

1. Shape change: if the requested shape cannot contain the ink, show a warning or pad the canvas with background colour rather than shrinking the box (SIG-1).
2. Make Auto-trim state the truth: "Nothing to trim" when the crop did not change; offer a sensitivity control or a "darkest 5 percent" fallback for faint or shadowed scans (SIG-2, SIG-5).
3. Touch: make handle hit areas shrink or move outside the box when the box is under about 90 CSS px tall; keep the centre drag zone at least 24 px (SIG-3).
4. Add result notes for Stretch and Cover, and show the distortion percent (SIG-7); consider a preset "exact pixel size" mode that pads instead of lock/stretch (SIG-8).
5. Announce keyboard moves in the live status region (aria-label changes on a `role=group` are not reliably spoken) and offer left/top edge resize keys (for example Ctrl+Arrow).
6. Warn when the fill colour is close to the ink colour (SIG-6).

## E. Not tested / needs real devices

- SIG-11 (Requires real-device testing) Real iOS Safari/Android touch and true two-finger pinch. In emulation a pinch started on the crop box did nothing in the app (app zoom stayed 2) and the browser visual viewport scale moved 1 -> 1.12; box and handles are `touch-action: none`, the app has no pinch handler. Pan-by-finger with Zoom 2 and "finger scrolls picture" checkbox: swipe on the box left the picture scroll at 0 and crop unchanged because the zoomed editor only overflowed by 274 px in my run; not conclusive.
- SIG-12 (low, Requires real-device testing) Playwright WebKit measures the Crop shape and Margin selects at 26 px height at 375 px wide (Chrome 44 px) and inline links at 22 px; confirm on real iOS. WebKit also logs a COEP/SharedArrayBuffer warning (informational, no behaviour change seen).
- Screen reader speech (VoiceOver/NVDA), high-contrast mode, drag-and-drop file drop, multiple-file drop, 25 MB cap, Quality slider, Dimensions-first strategy, Allow-enlarge, Cancel during processing, Firefox widths and touch, processing time (the harness wall time of about 30 s per case is dominated by page load and is not a tool measurement): Not tested.

## F. Tested-case matrix (Chrome unless noted; "MAE" = decoded download vs original cropped at the shown rect)

| ID | Image | Settings | Crop used (x,y,w,h) | Output (px, format) | Bytes shown = file | MAE | Result |
|---|---|---|---|---|---|---|---|
| C01 | dark-white.png 800x400 | trim Small | 180,48,600,308 | 600x308 JPEG | 9,508 | 0.06 | ok. WebKit 12,133, Firefox 13,510 (same dims) |
| C02 | dark-white.png | trim None | 197,65,566,274 | 566x274 JPEG | 9,356 | 0.07 | ink fills frame (0,0 offset) |
| C03 | dark-white.jpg | trim Medium | 163,31,634,342 | 634x342 JPEG | 10,560 | 0.07 | ok |
| C04 | dark-white.png | manual crop | 100,50,500,250 | 500x250 JPEG | 7,604 | 0.07 | shape shows 2:1 correctly; ink inside |
| C05 | dark-white.png | shape 3:1 | 0,69,800,267 | 800x267 | 9,380 | 0.05 | SIG-1, ink clipped; Firefox same crop |
| C06 | dark-white.png | shape 2:1 | 172,48,616,308 | 616x308 | 9,547 | 0.06 | ink kept |
| C07 | dark-white.png | shape 4:1 | 0,102,800,200 | 800x200 | 7,613 | 0.05 | SIG-1 |
| C08 | dark-white.png | shape 1:1 | 280,0,400,400 | 400x400 | 6,623 | 0.04 | SIG-1 (ink cut left and right) |
| C09 | dark-white.png | width 300 | 180,48,600,308 | 300x154 | 4,269 | 0.23 | aspect kept |
| C10 | dark-white.png | 300x100, lock | same | 195x100 | 2,760 | 0.57 | SIG-8 note shown |
| C11 | dark-white.png | height 80 | same | 156x80 | 2,365 | 0.78 | ok |
| C12 | dark-white.png | 140x60, lock off | same | 140x60 (aspect 2.333) | 2,046 | 1.12 | SIG-7 stretch |
| C13 | dark-white.png | max 5 KB | same | 600x308 | 4,995 | 0.38 | ok |
| C14 | dark-white.png | max 2 KB | same | 231x119 | 1,984 | 0.77 | pixels shrunk to fit |
| C15 | dark-white.png | max 20, min 15 KB | same | 600x308 | 13,259 | 0 | below_min, honest |
| C16 | shadow.png | trim Small | 0,0,786,362 | 786x362 | 18,085 | 0.07 | SIG-2 |
| C17 | grey-paper.png | trim Small | 180,48,600,308 | 600x308 | 8,438 | 0.07 | trim correct on grey (paper bg 154) |
| C18 | transparent.png | default | 180,48,600,308 | PNG alpha | 15,098 | 0 | alpha kept (WebKit 12,956, Firefox 9,900) |
| C18b | transparent.png | JPEG fill white/black/#ff0000 | same | 600x308 JPEG | 9,509 / 4,658 / 10,318 | n/a | corners 255,255,255 / 0,0,0 / 254,0,0; SIG-6 |
| C21 | exif-rot6.jpg 400x800 | trim Small | 44,180,308,600 | 308x600 JPEG | 11,699 | 0.09 (vs rotated) | orientation right |
| C22 | large-photo.jpg 4000x3000 | manual 1200,1100,1600,800 | same | 455x227 JPEG | 19,535 | noisy, not comparable | shrunk to fit 20 KB |
| C23 | tiny.png 60x30 | defaults | 0,0,60,30 | 60x30 | 1,261 | 0.3 | larger-than-original warning |
| C24 | edge-touch.png | trim None | 0,65,800,126 | 800x126 | 11,465 | 0.15 | ink touches left/right as in source |
| C25 | big-detached.png 3000x1500 | trim Small | 224,123,2548,1232 | 2024x979 | 19,569 | 0.07 | detached dots kept |
| C26 | dark-white.png | PNG | 180,48,600,308 | PNG | 14,928 | 0 | ok |
| C27 | transparent-shadow.png | trim Small | 187,147,394,113 | PNG alpha | 12,410 | 0.01 | semi-transparent shadow kept |
| C28 | light-ink.png (#bbb) | trim Small | 181,49,598,306 | 598x306 | 6,861 | 0.05 | ok |
| C29 | faint.png (#b8b8b8) | trim Small | 182,52,596,302 | 596x302 | 5,848 | 0.04 | ok |
| C30 | wide.png 1600x200 | trim Small | 58,22,1484,154 | 1484x154 | 12,627 | 0.06 | ok |
| T1 | very-faint.png | trim any | unchanged | n/a | n/a | n/a | "No signature found" (SIG-5) |
| T2 | hairline.png | trim None | 300,106,840,400 vs ink 299-1140 | n/a | n/a | n/a | SIG-5 |
| T3 | large-photo.jpg | trim any | 0,0,4000,3000 | n/a | n/a | n/a | SIG-2 |
| T4 | notimage.png / text.txt / s.svg | upload | n/a | n/a | n/a | n/a | clear error message |
| T5 | huge-9000.jpg | upload | 0,0,9000,9000 | n/a | n/a | n/a | "too large to show", fields usable |

Auto-trim (ground truth ink box measured independently from the source with sharp): dark-white 197,65,566x274 -> None gives exactly that; Small 180,48,600x308; Medium 163,31,634x342; Large 140,8,660x388. light-ink 198,66,564x272 -> exact. big-detached ink 297,197,2404x1085 -> crop 296,195,2404x1088.

Keyboard step results (from crop 100,100,300x150): Right x3 -> x103; Shift+Down -> y110; Alt+Right x5 -> w305; Alt+Shift+Down -> h160; Alt+Left x2 -> w303; Shift+Left x20 -> x0 (clamped). Same in WebKit.

Evidence files (all under `QA/screenshots/latest/signature/`): shape-3to1-*, C05-post.png, C07-post.png, autotrim-*, touch-*, zoom4-chrome.png, kbd-focus-cropbox-{chrome,webkit}.png, dims-lock-off-*, exif-result-chrome.png, resp-{crop,result}-{chrome,webkit}-{320,375,390,768,1024,1440}.png.
