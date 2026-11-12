# SizeTune quality samples (2026-11-12)

Human-reviewable compression samples produced by the **real engine** (`src/lib/engine`, bundled with esbuild, same worker path as production) in **real system Chrome 157.0.8103.52** (Playwright `channel: 'chrome'`, headless). Nothing was committed, deployed, uploaded or downloaded; every request outside the fake origin is aborted (0 were attempted).

**Open `QA/quality-samples/index.html`** (double-click; self-contained, no scripts): every case shows source preview next to the output with its metrics. Raw numbers: `QA/quality-samples/results.json`. Outputs are `NN-<case>.jpg|png|webp`; `src-*.jpg` are 640 px source previews. Whole folder is about 2 MB; every output is under 250 KB.

## Reproduce

```
cd sizetune
export PATH=$HOME/.nvm/versions/node/v24.12.0/bin:$PATH
node QA/quality-samples/run.mjs        # about 15 s; overwrites NN-*.*, src-*.jpg, index.html, results.json
```
The script converts the macOS wallpapers with `sips` (HEIC to JPEG) into an OS temp dir, generates the two synthetic images (deterministic PRNG), uses `tests/fixtures/*` (runs `scripts/gen-fixtures.mjs` only if they are missing), then runs all cases. It edits nothing in `src/`, `tests/` or configs.

## Inputs

| key | what |
|--|--|
| photo-landscape | REAL photo: macOS "Sonoma Horizon" wallpaper (vineyard, conifers, fog), 3840x2160, JPEG q90 conversion (2.1 MB) |
| photo-detailed | REAL photo: 1600x1200 crop of the same image, dense conifer foliage (high-frequency detail) |
| smooth-gradient | macOS "Sonoma" wallpaper (vector-like smooth gradients), 3000x3000, banding stress test |
| synthetic-doc-scan | **SYNTHETIC** 1240x1754 "document scan": bar-shaped printed text (not real glyphs), blue handwriting-like looped strokes, paper grain, 0.6 degree skew |
| synthetic-passport | **SYNTHETIC** 630x810 passport-style stand-in: flat cartoon face + shoulders on a gradient, blur + noise. **There are no real face photos on this machine**, so facial-detail quality is NOT covered. |
| signature-1200x400 / -140x60, transparent, noise-256 | fixtures from `scripts/gen-fixtures.mjs` |

## Results

Columns: `opts` = non-default options (all cases: quality-first, lockAspect, fit contain, background white unless listed; maxKb/minKb are KB, window is min*1024..max*1000 bytes); bytes are `blob.size`; quality is what the engine picked; ms = engine `elapsedMs` (decode + all encodes, in Chrome headless on this Mac); SSIM = see Caveats.

| # | file | source | case | opts | status | bytes | dims | q | ms | mode | SSIM |
|--|--|--|--|--|--|--|--|--|--|--|--|
157.0.8103.52
| 01 | [01-max20kb-land.jpg](01-max20kb-land.jpg) | photo-landscape (3840x2160, 2149 kB) | max 20 KB, JPEG, quality-first | maxKb:20 | ok | 19451 | 586x329 | 60 | 339 | worker | 0.921 |
| 02 | [02-max50kb-land.jpg](02-max50kb-land.jpg) | photo-landscape (3840x2160, 2149 kB) | max 50 KB, JPEG, quality-first | maxKb:50 | ok | 49274 | 980x551 | 60 | 306 | worker | 0.967 |
| 03 | [03-max100kb-land.jpg](03-max100kb-land.jpg) | photo-landscape (3840x2160, 2149 kB) | max 100 KB, JPEG, quality-first | maxKb:100 | ok | 96695 | 1387x780 | 60 | 300 | worker | 0.979 |
| 04 | [04-max200kb-land.jpg](04-max200kb-land.jpg) | photo-landscape (3840x2160, 2149 kB) | max 200 KB, JPEG, quality-first | maxKb:200 | ok | 197876 | 2033x1143 | 60 | 314 | worker | 0.984 |
| 05 | [05-max20kb-land-dimsfirst.jpg](05-max20kb-land-dimsfirst.jpg) | photo-landscape (3840x2160, 2149 kB) | max 20 KB, JPEG, dimensions-first | format:jpeg,strategy:dimensions-first,lockAspect:true,fit:contain,background:white,maxKb:20 | ok | 19652 | 414x233 | 85 | 157 | worker | 0.903 |
| 06 | [06-range20-50kb-land.jpg](06-range20-50kb-land.jpg) | photo-landscape (3840x2160, 2149 kB) | range 20-50 KB, JPEG | minKb:20,maxKb:50 | ok | 49274 | 980x551 | 60 | 299 | worker | 0.967 |
| 07 | [07-max20kb-detail.jpg](07-max20kb-detail.jpg) | photo-detailed (3840x2160, 2048 kB) | max 20 KB, JPEG, quality-first | maxKb:20 | ok | 19398 | 587x330 | 60 | 303 | worker | 0.923 |
| 08 | [08-max50kb-detail.jpg](08-max50kb-detail.jpg) | photo-detailed (3840x2160, 2048 kB) | max 50 KB, JPEG, quality-first | maxKb:50 | ok | 49591 | 983x553 | 60 | 288 | worker | 0.967 |
| 09 | [09-max100kb-detail.jpg](09-max100kb-detail.jpg) | photo-detailed (3840x2160, 2048 kB) | max 100 KB, JPEG, quality-first | maxKb:100 | ok | 96857 | 1390x782 | 60 | 323 | worker | 0.979 |
| 10 | [10-max200kb-detail.jpg](10-max200kb-detail.jpg) | photo-detailed (3840x2160, 2048 kB) | max 200 KB, JPEG, quality-first | maxKb:200 | ok | 198507 | 2038x1147 | 60 | 299 | worker | 0.985 |
| 11 | [11-max20kb-detail-dimsfirst.jpg](11-max20kb-detail-dimsfirst.jpg) | photo-detailed (3840x2160, 2048 kB) | max 20 KB, JPEG, dimensions-first | format:jpeg,strategy:dimensions-first,lockAspect:true,fit:contain,background:white,maxKb:20 | ok | 19384 | 413x232 | 85 | 148 | worker | 0.902 |
| 12 | [12-range20-50kb-detail.jpg](12-range20-50kb-detail.jpg) | photo-detailed (3840x2160, 2048 kB) | range 20-50 KB, JPEG | minKb:20,maxKb:50 | ok | 49591 | 983x553 | 60 | 286 | worker | 0.967 |
| 13 | [13-fmt-jpeg-50kb-land.jpg](13-fmt-jpeg-50kb-land.jpg) | photo-landscape (3840x2160, 2149 kB) | max 50 KB, JPEG (WebP comparison) | maxKb:50 | ok | 49274 | 980x551 | 60 | 288 | worker | 0.967 |
| 14 | [14-fmt-webp-50kb-land.webp](14-fmt-webp-50kb-land.webp) | photo-landscape (3840x2160, 2149 kB) | max 50 KB, WebP (WebP comparison) | format:webp,strategy:quality-first,lockAspect:true,fit:contain,background:white,maxKb:50 | ok | 48458 | 1140x641 | 60 | 2593 | worker | 0.957 |
| 15 | [15-fmt-jpeg-50kb-detail.jpg](15-fmt-jpeg-50kb-detail.jpg) | photo-detailed (3840x2160, 2048 kB) | max 50 KB, JPEG (WebP comparison) | maxKb:50 | ok | 49591 | 983x553 | 60 | 299 | worker | 0.967 |
| 16 | [16-fmt-webp-50kb-detail.webp](16-fmt-webp-50kb-detail.webp) | photo-detailed (3840x2160, 2048 kB) | max 50 KB, WebP (WebP comparison) | format:webp,strategy:quality-first,lockAspect:true,fit:contain,background:white,maxKb:50 | ok | 47938 | 1138x640 | 60 | 2589 | worker | 0.957 |
| 17 | [17-max50kb-smooth-banding.jpg](17-max50kb-smooth-banding.jpg) | smooth-gradient (3000x3000, 759 kB) | max 50 KB, JPEG, smooth gradient (banding check) | maxKb:50 | ok | 49582 | 1632x1632 | 60 | 379 | worker | 0.993 |
| 18 | [18-max20kb-smooth-banding.jpg](18-max20kb-smooth-banding.jpg) | smooth-gradient (3000x3000, 759 kB) | max 20 KB, JPEG, smooth gradient (banding check) | maxKb:20 | ok | 19980 | 779x779 | 60 | 305 | worker | 0.990 |
| 19 | [19-png-alpha-keep-png-30kb.png](19-png-alpha-keep-png-30kb.png) | transparent (800x600, 28 kB) | PNG with transparency, keep alpha (PNG out), max 30 KB | format:png,strategy:quality-first,lockAspect:true,fit:contain,background:keep,maxKb:30 | ok | 16244 | 800x600 | - | 16 | worker | 1.000 |
| 20 | [20-png-alpha-keep-webp-30kb.webp](20-png-alpha-keep-webp-30kb.webp) | transparent (800x600, 28 kB) | PNG with transparency, keep alpha (WebP out), max 30 KB | format:webp,strategy:quality-first,lockAspect:true,fit:contain,background:keep,maxKb:30 | ok | 12118 | 800x600 | 95 | 44 | worker | 0.999 |
| 21 | [21-png-alpha-jpeg-white-30kb.jpg](21-png-alpha-jpeg-white-30kb.jpg) | transparent (800x600, 28 kB) | PNG with transparency, JPEG, fill white, max 30 KB | maxKb:30 | ok | 28840 | 800x600 | 95 | 13 | worker | 0.999 |
| 22 | [22-signature-1200x400-max20kb.jpg](22-signature-1200x400-max20kb.jpg) | signature-1200x400 (1200x400, 10 kB) | signature scan, max 20 KB, JPEG | maxKb:20 | ok | 18971 | 1044x348 | 60 | 31 | worker | 0.993 |
| 23 | [23-signature-1200x400-max20kb-png.png](23-signature-1200x400-max20kb-png.png) | signature-1200x400 (1200x400, 10 kB) | signature scan, max 20 KB, PNG | format:png,strategy:quality-first,lockAspect:true,fit:contain,background:white,maxKb:20 | ok | 19881 | 489x163 | - | 24 | worker | 0.985 |
| 24 | [24-signature-1200x400-10to20kb.jpg](24-signature-1200x400-10to20kb.jpg) | signature-1200x400 (1200x400, 10 kB) | signature scan, range 10-20 KB, JPEG | minKb:10,maxKb:20 | ok | 18971 | 1044x348 | 60 | 21 | worker | 0.993 |
| 25 | [25-signature-140x60-min10kb.jpg](25-signature-140x60-min10kb.jpg) | signature-140x60 (140x60, 1 kB) | tiny signature 140x60, min 10 KB (max 20 KB), JPEG | minKb:10,maxKb:20 | below_min | 8862 | 140x60 | 100 | 9 | worker | 1.000 |
| 26 | [26-signature-140x60-min10kb-enlarge.jpg](26-signature-140x60-min10kb-enlarge.jpg) | signature-140x60 (140x60, 1 kB) | tiny signature 140x60, min 10 KB (max 20 KB), JPEG, allowEnlarge | minKb:10,maxKb:20,allowEnlarge:true | raised | 10721 | 170x73 | 100 | 23 | worker | 0.980 |
| 27 | [27-doc-scan-max100kb.jpg](27-doc-scan-max100kb.jpg) | synthetic-doc-scan (1240x1754, 695 kB) | synthetic document scan, max 100 KB, JPEG | maxKb:100 | ok | 97250 | 756x1069 | 60 | 113 | worker | 0.975 |
| 28 | [28-doc-scan-max50kb.jpg](28-doc-scan-max50kb.jpg) | synthetic-doc-scan (1240x1754, 695 kB) | synthetic document scan, max 50 KB, JPEG | maxKb:50 | ok | 49971 | 490x693 | 60 | 109 | worker | 0.966 |
| 29 | [29-doc-scan-max20kb.jpg](29-doc-scan-max20kb.jpg) | synthetic-doc-scan (1240x1754, 695 kB) | synthetic document scan, max 20 KB, JPEG | maxKb:20 | ok | 19644 | 268x379 | 60 | 109 | worker | 0.918 |
| 30 | [30-passport-max50kb.jpg](30-passport-max50kb.jpg) | synthetic-passport (630x810, 140 kB) | synthetic passport-style portrait, max 50 KB, JPEG | maxKb:50 | ok | 49596 | 630x810 | 75 | 60 | worker | 0.910 |
| 31 | [31-passport-max20kb.jpg](31-passport-max20kb.jpg) | synthetic-passport (630x810, 140 kB) | synthetic passport-style portrait, max 20 KB, JPEG | maxKb:20 | ok | 19071 | 630x810 | 43 | 50 | worker | 0.864 |
| 32 | [32-impossible-1kb-photo.jpg](32-impossible-1kb-photo.jpg) | photo-landscape (3840x2160, 2149 kB) | impossible: max 1 KB, JPEG | maxKb:1 | ok | 977 | 114x64 | 9 | 363 | worker | 0.623 |
| 33 | [33-impossible-1kb-noise.png](33-impossible-1kb-noise.png) | noise-256 (256x256, 197 kB) | impossible: max 1 KB on incompressible noise, PNG | format:png,strategy:quality-first,lockAspect:true,fit:contain,background:white,maxKb:1 | above_max | 12561 | 64x64 | - | 17 | worker | 0.103 |

Case notes: 14/16 WebP has the same size target as 13/15 JPEG. 19-21 compare keeping alpha (PNG, WebP) with JPEG filled white (note "Transparent areas were filled with white" is emitted). 25 is `below_min`: at 140x60 the largest honest result (q100) is 8,862 B < 10,240 B and the engine says so; 26 repeats it with `allowEnlarge` -> `raised` by enlarging to 170x73. 33 is `above_max` (noise PNG cannot go under 1 KB; best effort returned).

## What the owner should look at

1. **Blocking at 20 KB** (cases 01, 07, 18, 29, 31): zoom to 100%. Look for 8x8 blocks in sky/fog gradients, ringing around branch edges, chroma smear on the red/orange tree. Compare 01 (quality-first, q60 at 586 px) with 05/11 (dimensions-first, q85 at 414 px): which looks better at the size you would actually display it?
2. **Text and handwriting legibility** (27-29, 22-24): are the blue strokes still distinct from the printed bars at 50 KB and 20 KB? At 20 KB the A4 scan is only 268x379 px: judge whether a real page of text would still be readable (synthetic bars cannot answer that, use a real scan on a real device).
3. **Faces** (30, 31): only a cartoon stand-in; judge skin-tone smoothness and eye/mouth edge ringing, but do not treat as evidence for real portraits. Please run 2-3 real passport photos at 20/50 KB yourself.
4. **Banding** (17, 18): smooth gradient at 50/20 KB. Check the red-to-violet sky transitions and dark-green shadows for contour steps.
5. **Alpha** (19-21): the PNG/WebP keep-alpha results should show the transparent quadrant (checkerboard in index.html), the JPEG should be white there.
6. **Signature** (22-26): stroke thickness and edges; 25/26 show how the minimum is handled.
7. **Impossible target** (32, 33): 32 "succeeds" at 114x64 q9 under 1 KB; confirm you are happy it returns `ok` rather than a warning that this is not a usable image (the only disclosure is the note "may look blocky").

## Caveats (honest)

- **No real faces**, and only 2 real photos (both from one wallpaper, so one scene type). Synthetic inputs are labelled and are idealised (flat colour, perfectly clean strokes, bars instead of glyphs).
- **SSIM is weak**: luma only, non-overlapping 8x8 windows, both images scaled to 640 px long side (output stretched to the source aspect), mean over windows, C1/C2 standard (0.01, 0.03 of 255). Indicative only: it ignores chroma, is insensitive to banding, overrates smooth images (the gradient scores 0.99 at 20 KB) and punishes sharp-edged noise. Use your eyes first.
- **Chrome only** (157, macOS, headless). **Safari/iOS encodes JPEG noticeably larger** at the same quality, so the engine will land on lower quality/smaller dimensions there; WebP is not encodable in Safari at all (falls back). Timings are headless desktop numbers, not phone numbers.
- Inputs are sRGB-converted from Display P3 wallpapers through macOS; engine output carries a 472-byte sRGB ICC profile (see observations).
- One run per case; the engine is deterministic except for timing.

## Observations / possible defects (not implemented)

1. **Quality is pinned at q60 for every photo that cannot fit at q40** (cases 01-04, 07-10, 13, 15, 17-18, 22, 24, 27-29), so the 4 photo targets only differ in pixels: 20 KB -> 586 px wide (0.19 MP), 50 KB -> 980, 100 KB -> 1387, 200 KB -> 2033. Quality is not tuned per content. Idea: after the scale search at q60, try a short refine of the (q, scale) pair along q in 45..75 and pick the best by a cheap proxy (e.g. SSIM or edge-energy on a 256 px thumbnail), or choose q by content (smooth images tolerate lower q, textured images more pixels).
2. **Inconsistent regime switch**: if q40 fits at full size the engine keeps full dimensions and goes as low as q40 (passport at 20 KB: 630x810 at q43, SSIM 0.864, the lowest of the non-degenerate cases; check the skin and shoulder gradients for blockiness), but just above that it shrinks the image and *raises* q to 60. Result: a 20 KB passport keeps 630x810 at q43 whereas a 20 KB photo drops to 586 px at q60. Idea: a smooth cost function (pixels x quality) or a q floor around 50 for portraits.
3. **A4 scan at 20 KB becomes 268x379** (case 29) and the handwriting is a smudge; at 50 KB 490x693. Colour is spent on a paper-grain noise floor the eye does not need. Ideas: a grayscale/low-chroma path for near-neutral pages, light denoise before encode for scans, and a "document" preset that prefers pixels over quality.
4. **dimensions-first at 20 KB** (05, 11) gives 414x233 at q85, SSIM 0.90 vs 0.92 for quality-first: smaller than the quality-first result and not obviously cleaner; the q85 default might be lower (q70-75) for a better pixel/quality trade-off.
5. **WebP is slow and not clearly better**: 2.6 s vs about 0.3 s for JPEG at the same 50 KB target (WebP encode via canvas is ~9x slower; every scale/quality probe pays it). It gets bigger dimensions (1140 vs 980) but lower SSIM (0.957 vs 0.967) because the same q60 pinning applies. Idea: seed the WebP search from the JPEG result's scale, and probe with a downscaled thumbnail encode before the final one.
6. **ICC profile costs 472 bytes** (about 2.4% of a 20 KB file) on every output (`stripIcc` exists but is off by default). At small targets that is worth about 1 quality step. Idea: strip by default when the source is sRGB or untagged, or when the target is below ~30 KB.
7. **Range targets collapse to the top** (06, 12, 24): 20-50 KB gives the same 49.3 KB file as max 50 KB; fine for "at most" semantics but means the minimum never matters unless the original is small.
8. **Tiny signature** (25): 140x60 cannot reach 10 KB; `below_min` with a clear message is correct. With `allowEnlarge` (26) it is enlarged to 170x73 at q100 (10.5 KiB): the file is larger but carries no extra detail, so keeping it off by default is right.
9. **Impossible 1 KB** (32): returns `ok` at 114x64 q9 (a nearly unrecognisable 114 px thumbnail). `ok` is technically true but arguably deserves a stronger "this is no longer a usable photo" warning than the generic blocky note (e.g. status `ok` + a degraded flag when q<20 or the shorter side is under ~100 px).
10. **PNG signature at 20 KB** (23) is shrunk to 489x163 (0.4x) while the JPEG keeps 1044x348 at q60: PNG is the wrong format for this target; the UI could suggest JPEG when a PNG hits a small max.
