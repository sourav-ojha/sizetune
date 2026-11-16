# Compression workflow audit (2026-11-13)

Method: code read of `src/lib/engine` (window, search, plan, messages, pipeline), ResultPanel, ImageTool, plus the existing real-browser suites re-run today (`pnpm run verify`: 676 unit, 196 Chrome e2e incl. 37 engine specs on a real encoder). No engine defect was found; the engine was **not** changed. Where the brief asked for behaviour that already exists, it is listed with its proof.

| Requirement | Evidence |
|--|--|
| Max mode | `window.ts`: `hi = floor(max*1000)`; engine spec "JPEG in, max 50 KB ... real bytes <= 50,000" |
| Range mode | `lo = ceil(min*1024)`; spec "range 20-50 KB on a 12 MP photo: in window, <= 20 encodes" |
| Min-only | `hi = Infinity`; `raise()` bisects the lowest quality reaching `lo`; spec "minimum reached by raising quality" |
| KB handling (actual bytes) | A pass means `min*1024 <= bytes <= max*1000`, so valid under 1000- and 1024-byte KB readings. Result panel shows "N bytes" next to KB and `Within/Over by/Under by N bytes`. Caveat now disclosed: when `min*1024 > max*1000` (e.g. 10-10 KB) the minimum falls back to `min*1000` with a note. A "20 KB" result displays as at most 19.5 KB (ceiling, often lower) |
| Success only when constraints hold | Status comes from the byte window; `ResultPanel.isSuccess` is true only for `ok`/`raised`. `below_min`, `above_max`, `above_max_fixed` show amber warning headings and "This file does not meet your target" |
| Under max but below min | `below_min` ("Minimum size not reached"), never green; gap in bytes shown |
| No padding | `allowPadding` rejected by `options.ts`; spec "tiny 140x60 signature with a 10 KB minimum: honest status ... no padding" |
| PNG | Lossless: pixels are the only knob; min-only on PNG cannot raise via quality (`lossless()` only enlarges if allowed); alpha preserved through the pipeline (spec "transparent PNG: auto keeps alpha") |
| JPEG + transparency | Never silent: `invalid_options` unless a background colour is chosen; fill disclosed in notes ("Transparent areas were filled with white") |
| WebP | `canEncode('image/webp')` feature probe; unsupported -> `encode_unsupported` or disclosed fallback; main-thread "toBlob returns PNG" is detected, so no wrongly named file |
| Extension matches MIME | MIME verified by magic bytes of the output; download name derived from it (`suggestFilename`) |
| Format wording consistent | Engine `auto` keeps format. UI preselects JPEG for an *opaque* PNG with a size limit, with a visible note and one-click undo (`ImageTool.tsx:36`). Pages now say exactly this (`c8ec1ea`) |
| Strategies, dims, aspect lock, crop, max dims | Engine specs "dimension-only", "crop rect", "output limits on the resolved geometry"; UI option tests |
| Large images | 12 MP repeated x10 (no slowdown, no unbounded RSS/heap); 36 MP reduced-size decode (~0.33 s, +145-151 MB RSS); 81 MP PNG header accepted with no decode (RSS +<150 MB); 400 MP header rejected at pick. **24 MP and 48 MP were not individually run.** Sources >100 MP refused, output >16 MP refused |
| Reduced decode | `planDecode` decodes at a reduced size when source > 12 MP and the target allows; disclosed note |
| Worker/fallback, cancel, stale, repeats | Specs: worker path, no-OffscreenCanvas main-thread path, cancellation terminates worker, newer request supersedes, timeout kills worker |
| Object URL cleanup | 2 created = 2 revoked per flow (privacy audit) |
| Browser support | Chrome 157, Firefox 159, Playwright WebKit 27.2 (previous sprint: 562 passed). Real Safari/iPhone **untested**; Safari encoder output 1-7x Chrome per iOS Simulator harness, so shrink-more-pixels results are expected there |

## Residual risks
Quality at 20 KB on real portraits unknown (SSIM only); pinned quality (~q60) means pixels shrink first for most targets; real-device memory limits; 24/48 MP interpolated, not measured.
