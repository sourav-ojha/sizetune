# SizeTune UX, Accessibility and Performance Audit

- Target: https://sizetune-staging.subhamojha9.workers.dev/ (dev build, commit 8f0b204), audited 2026-11-14.
- Method: reproduced live against staging only; earlier QA docs not relied on. Playwright 1.65 + system Chrome (primary); Firefox and WebKit (Playwright builds) for a smoke pass of both tool workflows (load, axe, upload, resize, result). axe-core 4.14.0 (wcag2a/aa, 21a/aa, 22aa, best-practice). Lighthouse was not available offline: not run (metrics below come from Performance APIs and CDP).
- Evidence: `QA/screenshots/latest/ux/` (42 route screenshots `<route>-<width>.jpg`; state screenshots `*-state-*.png`; keyboard runs `kb-*.png`; zoom, forced-colors and cross-browser shots; raw JSON in `data/`; scripts in `scripts/`).
- Fixtures: repo fixtures plus `tests/fixtures/.generated` (12 MP 4000x3000 JPEG, 36 MP, 48 MP, 40 MB file). These are synthetic images; real camera JPEGs may time differently.
- Not tested / Requires real-device testing: VoiceOver, NVDA, JAWS, TalkBack, physical phones/tablets (touch gestures on crop handles, mobile Safari file picker/camera, real memory pressure), Windows High Contrast on real Windows (Playwright forced-colors emulation only), text-spacing override (WCAG 1.4.12), Lighthouse score.

## Summary

Overall the tool is in good shape: no axe violations on any route or tool state (light, dark, 1280 and 390), no horizontal overflow at any of 6 widths on 7 routes, no console errors, correct focus management and live-region behaviour, 200%/400% zoom reflows, reduced motion respected, and processing runs in a short-lived worker with zero main-thread long tasks. The confirmed defects are few and mostly medium/low.

Confirmed defects (Verified defective): A11Y-1, UX-1, UX-2, UX-3, UX-4, UX-5, A11Y-2, PERF-1.
Everything else is Verified working or a recommendation.

---

## Part A. Confirmed defects

### A11Y-1 (medium) Crop-box focus ring is yellow on a near-white surface, about 1.3:1
- Status: Verified defective.
- Repro: `/resize-signature/`, upload `tests/fixtures/signature-1200x400.png`, Tab into the crop box (first stop after upload). The box shows a 2px `outline-yellow-300` (#fde047-like) ring drawn outside the full-picture box, over the white panel / paper-white scan.
- Evidence: `signature-crop-box-focus.png`. Contrast of yellow-300 on white is about 1.3:1, below the 3:1 non-text contrast required for a focus indicator (WCAG 1.4.11, also weak against 2.4.7). axe cannot flag this (outline colour, not rendered pixels).
- Fix: use a two-tone ring (dark teal outline plus white/yellow inner) or a dark outline on focus, as the other controls do (teal-700 2px). Source: `CropEditor.tsx` `focus-visible:outline-yellow-300`.

### UX-1 (medium) After choosing a file on mobile, the Resize button is far below the fold and nothing scrolls or points to it
- Status: Verified defective.
- Repro: 390x844, `/resize-image-to-20kb/`, pick `photo-12mp.jpg`. scrollY stays 0, Resize image is at y=1351 (about 500px below the viewport), beneath size presets, format and Advanced options. Status text "Image ready. Choose your settings, then resize." is screen-reader-only; sighted users get no cue.
- Evidence: `resize-image-to-20kb-state-uploaded-390.png`, `data/` run output.
- Fix: keep a sticky/inline primary action visible after selection, or scroll the settings into view, or add a visible "Next: pick a size, then Resize" line near the preview.

### UX-2 (medium) On mobile the result heading is visible but Download is about 700px lower, behind the compare widget
- Status: Verified defective.
- Repro: 390x844, 12 MP image, 20 KB. After the run the heading is focused and in view (top 534) but Download is at y=1246 (viewport 844) after the Compare slider/zoom controls and notes.
- Evidence: `resize-image-to-20kb-state-result-ok.png`.
- Fix: place the Download/primary action directly under the size summary (compare below it), or add a sticky Download bar on small screens.

### UX-3 (medium) "Your image is ready" is shown for a result shrunk to a tiny size with no pixel-reduction warning
- Status: Verified defective.
- Repro: Image tool, `photo-1200x800.jpg`, maximum 1 KB. Result is green "Your image is ready", 96x64 px, 996 bytes, quality 17; "Please note" only says quality went down and the image "may look blocky". Same at default 20 KB: 4000x3000 became 911x684 (default quality-first lowers pixels as well) with no note of the dimension reduction, only the Result row.
- Evidence: `resize-image-to-20kb-state-result-ok.png`, `data/states.json` (`oneKB`), `image-state-above-max.png` (noise-256 to 64x64 at 1 KB).
- Impact: a user with a form that also needs a minimum pixel size can miss that the picture was shrunk; success styling overstates.
- Fix: add an explicit note when output pixels are much smaller than the source (for example below 50% per side): "Reduced from 4,000x3,000 to 911x684 px to reach the size." Consider a neutral/amber frame when the picture is below a readable size.

### UX-4 (low) Result heading does not state whether the requirement is met when the result is larger than the original
- Status: Verified defective (messaging).
- Repro: `/resize-signature/`, `signature-1200x400.png` (9.6 KB), 20 KB. Amber "The result is larger than your original" heading and demoted Download button even though the target is met ("Within the target" appears only in the Target row). Original also fits, and a "Keep your original" button is offered, which is a reasonable choice, but the first line a user reads implies a problem.
- Evidence: `kb-resize-signature-result.png`.
- Fix: lead with the requirement outcome: "Within your 20 KB limit (18.5 KB). Note: it is larger than your original (9.6 KB)."

### UX-5 (low) Unmet-minimum advice points to a control hidden in collapsed Advanced options
- Status: Verified defective.
- Repro: signature `signature-140x60.png`, max 30, min 15 (entered in Advanced). Result: "Minimum size not reached ... or allow enlarging the image". The "Allow enlarging" checkbox lives in the Advanced disclosure, which is collapsed again after the result and the hint has no link or button. The hint also says "choose a larger output width and height" while the picture cannot reach 15 KB at 140x60.
- Evidence: `signature-state-below-min.png`, `data/a11y.json` (`unmet.belowMin`).
- Fix: add a "Allow enlarging and try again" button in the result, or open Advanced options when below_min is shown.

### A11Y-2 (low) Header logo link target is 358x32 px (below 44 px; passes WCAG 2.2 AA minimum 24 px)
- Status: Verified defective against the brief's 44 px goal; compliant with WCAG 2.2 AA 2.5.8.
- Repro: any route at 390 px; `A SizeTune` 358x32. Inline text links (about 22 px high) are exempt from 2.5.8 as inline. All other buttons, presets, radios/checkboxes (via 44 px labels), crop handles (44 px on coarse pointers), nav links measured at least 44 px.
- Evidence: `data/shots.json`, tap probe output.
- Fix: add vertical padding to the logo link.

### PERF-1 (low) Roughly 140 ms single-frame gap on file selection (main thread)
- Status: Verified defective (minor).
- Repro: Any 12 to 48 MP file: one rAF gap of 138 to 147 ms around file selection (preview creation), at both 1x and 4x CPU throttle; no entry reaches the 50 ms Long Task threshold at 1x. Selection itself takes 40 to 340 ms.
- Evidence: `data/perf.json` (`selectGaps`).
- Fix: only if desired, generate the preview in the worker or with a downscaled `createImageBitmap`. Not user-visible as a hang.

---

## Part B. Verified working (no defect)

### A11Y-3 Automated accessibility: no violations (Verified working)
- axe 4.14.0 on all 7 routes at 1280 and 390 px (light) and 1280 (dark): 0 violations. Tool states at 390 px: initial, unsupported file error, corrupt file error, too-large error, invalid input, unmet-target result, success result, below-minimum result: 0 violations on both tools. Firefox and WebKit (390 px): 0 violations before and after a result.
- axe returns `color-contrast` "incomplete" (31 to 81 nodes per page) because of the page gradient background. Supplementary check with my own contrast calculation (gradient treated as white, body-level only) on the tool pages in initial, uploaded+advanced and result states found no text below 4.5:1 (3:1 large). That check is approximate: Needs manual verification on the gradient regions with a contrast tool.
- Evidence: `data/a11y.json`, `data/states.json`.

### A11Y-4 Keyboard-only workflows (Verified working, with notes)
- Image tool: Tab order is skip link, brand, 7 nav links, file input (label shows a 2px teal ring), presets, custom size, format, Advanced, then Resize. Enter on the file input opens the chooser. After pick focus stays on the file input; Resize reached in 11 Tabs. Enter on Resize moves focus to Cancel (Escape also cancels; verified with 36 MP: focus returns to Resize, live text "Image ready..."). On result, focus moves to the result heading (h3, tabindex -1). Tab order then goes compare slider, zoom, view buttons, Download, Process another. Reset returns focus to the file input.
- Signature tool: after pick the first stop is the crop box (arrow keys move, Alt+arrow resize, announced by its label), then zoom, shape, margin, 4 numeric crop fields, lock, Auto-trim, whole picture, presets, size, width, height, aspect, format, Advanced, Resize: 25 Tab stops from the file input. Result focus lands on the heading; reset returns to the file input.
- Focus rings: custom 2px teal outlines everywhere except native range, radio and checkbox, which use the browser default ring (visible). Crop box exception is A11Y-1.
- Evidence: `kb-*.png`, console output in `scripts/keyboard.cjs`.
- Recommendation (low): 25 Tab stops to reach Resize in the signature tool; a "Skip to size settings" link or putting the Resize action earlier would help keyboard and switch users.

### A11Y-5 Live regions and alerts (Verified working in Chrome DOM; announcement itself Not tested)
- `role=status aria-live=polite` (data-testid status) exists on both tools and its text updates were observed with a MutationObserver: "Image ready. Choose your settings, then resize." then "Processing your image." then "Finished. The result is 19.4 KB (19,899 bytes)." Unmet: "Finished, but your size target was not met ... message". Errors use `role=alert` inserted into the DOM (fires; verified insertion). The crop section has a second `role=status` for auto-trim messages.
- Actual spoken output by VoiceOver/NVDA: Not tested / Requires real-device testing.

### A11Y-6 Structure, headings and landmarks (Verified working)
- Every route: single h1; header, nav (Main), main, footer, nav (Footer); skip link; `lang=en`; `aria-current=page` on the active nav item. Tool pages use an sr-only h2 "Resize your image/signature", result is h3 with notes h4: no skipped levels. Guides/about/privacy/terms have h1 then h2. Section labelled "Image resizer"/"Signature resizer".
- Terms/Privacy links inside the tool open in a new tab and say so in text.

### A11Y-7 Zoom, reflow, reduced motion, forced colors (Verified working in emulation)
- 200% (640x450 at DPR 2) and 400% (320x225 at DPR 4): no horizontal scroll on any route; header not sticky so it does not eat the viewport. Screenshots: `home-zoom200.jpg`, `home-zoom400.jpg`, `resize-signature-zoom*.jpg`.
- `prefers-reduced-motion: reduce`: 0 elements with animation or transitions (16 animate/transition in normal mode; a reduced-motion rule exists).
- `forced-colors: active` emulation: screenshots `home-forced-colors*.jpg`, `resize-signature-forced-colors.jpg` show controls, borders, focus and the progress/compare controls still visible. Real Windows High Contrast: Requires real-device testing.

### UX-6 Responsive layout (Verified working)
- 7 routes x 6 widths (320, 375, 390, 768, 1024, 1440): 0 horizontal overflow, 0 offscreen elements, 0 console/page errors (`data/shots.json`). Visual spot-checks of home, signature, 20 KB, guide at all widths show no clipped or overlapping text. The only elements flagged "clipped" are `sr-only` helpers.
- Mobile nav is 7 links wrapped on two rows (about 155 px header at 390): usable, no hamburger needed.

### UX-7 Error and recovery paths (Verified working)
- SVG-renamed-PNG, GIF-renamed, HEIC, truncated and garbage JPEG, 40 MB file: each gives a plain-language alert naming the problem and the remedy ("This image file looks incomplete or damaged ... Try saving or exporting it again."; "too large ... (the limit is 25 MB). Choose a smaller file."). The file picker remains available so the user can immediately choose another file. 36 MP and 48 MP files process successfully.
- Invalid size input ("abc", "0"): inline error "Enter a size between 1 and 50,000 KB, for example 20 or “20 KB”.", `aria-invalid`, plus "Fix the highlighted settings to continue." and Resize disabled.
- Changing the target after a result clears the stale result and keeps focus on the pressed preset. Cancel (Escape) mid-run leaves no result and returns focus to Resize.
- Not reproduced on staging: engine failures that offer Try again / Use JPEG instead (`worker_failed`, `encode_unsupported`); code paths read but not triggered. Status: Not tested.
- Unmet results (below_min with a 140x60 signature) say what happened, by how many bytes ("Under by 6,498 bytes"), and offer "Download anyway" with "This file does not meet your target." Good.

### UX-8 First-time user review (observations, mostly Verified working)
- Five-second comprehension: h1, a 3-step list and the drop zone explain the tool; "Choose image" is the single primary button and is above the fold at 390x844 and 1440x900 on `/` and `/resize-image-to-20kb/`.
- Advanced options are collapsed; the visible settings are 7 presets, a custom field and a format group: not overwhelming.
- The signature tool is distinct: its own h1, a "For a clean signature" checklist, crop editor with auto-trim, "Resize signature" button, preview on white. Weaker points are listed as recommendations below.

---

## Part C. Recommendations (not confirmed defects)

- UX-9 (low) Signature page on small viewports: the tips box pushes "Choose image" below the fold at 390x844 (button top 840) and 375x667 (873) and 320x568 (987). The 20 KB page has it at 630 on 390x844. Consider collapsing the tips on mobile.
- UX-10 (low) Redundant privacy copy: a hero badge, the drop-zone sentence ("Your image stays in this browser; the site's code does not upload it"), the consent paragraph under the Resize button, step cards, and the full "Your images stay in your browser" section repeat the same claim. The consent paragraph plus drop-zone sentence could be one.
- UX-11 (low) Labels: nav entries "Image resizer" and "20 KB" lead to near-identical tools (only the preselected maximum differs: 50 KB vs 20 KB); a first-time user cannot tell the difference. "Guide" is vague (`Photo size guide`). The home heading says "to a size in KB" while 50 KB is silently preselected.
- UX-12 (low) Signature results reuse generic copy: heading "Your image is ready", dropzone "Drag and drop an image here", status text "Image ready", although buttons say "signature".
- UX-13 (low) The disabled Resize button before a file is chosen has no stated reason and is natively disabled (skipped by Tab). Consider a hint "Choose an image first".
- UX-14 (low) "Please note" for large quality drops says "may look blocky" but offers no next step (raise the limit, allow smaller dimensions).
- PERF-2 (info) CLS on content pages is 0.006 to 0.016 (about/guide/terms), well under 0.1; probably font swap. No action needed.

---

## Part D. Performance results (Chrome, cache disabled, 390x844, no throttling)

Verified working. No third-party requests. Static assets are `immutable` with 1-year cache; HTML is `max-age=0, must-revalidate`.

| Route | Requests | JS transfer / decoded | CSS transfer / decoded | Font | Total transfer / decoded | FCP / LCP (ms) | CLS | TBT |
|--|--|--|--|--|--|--|--|--|
| / | 9 | 44.9 / 110.0 KB | 8.9 / 37.0 KB | 30.1 KB (1 woff2) | 95.6 / 214.7 KB | 604 / 604 | 0.0006 | 0 |
| /resize-image-to-20kb/ | 9 | 44.9 / 110.0 KB | 9.2 / 37.0 KB | 30.1 KB | 96.1 / 214.5 KB | 440 / 440 | 0.0005 | 0 |
| /resize-signature/ | 9 | 49.1 / 122.1 KB | 9.2 / 37.0 KB | 30.1 KB | 100.1 / 224.5 KB | 444 / 444 | 0.0005 | 0 |
| /guides/photo-size-for-online-forms/ | 4 | 0 | 9.2 / 37.0 KB | 30.1 KB | 47.5 / 86.8 KB | 500 / 500 | 0.0068 | 0 |
| /about/ | 4 | 0 | 9.2 / 37.0 KB | 30.1 KB | 43.8 / 77.9 KB | 444 / 444 | 0.016 | 0 |
| /privacy/ | 4 | 0 | 9.2 / 37.0 KB | 30.1 KB | 45.9 / 83.3 KB | 504 / 504 | 0 | 0 |
| /terms/ | 4 | 0 | 8.9 / 37.0 KB | 30.1 KB | 45.0 / 81.1 KB | 596 / 596 | 0.0122 | 0 |

(LCP is a text paragraph on every route. Chrome desktop on a fast link, not a phone; Lighthouse not run. The worker script loads only when processing starts and is not counted above.)

Processing (Chrome, tool route, 390x844; run time includes worker start, decode, search and encode):

| Image | CPU | Select (ms) | Run (ms) | Long tasks during run | Heap MB (start / selected / result / reset) | Worker |
|--|--|--|--|--|--|--|
| 12 MP | 1x | 119 | 463 | 0 | 1 / 3 / 4 / 3 | spawned, gone after result |
| 12 MP | 4x | 256 | 423 | 0 | same | same |
| 36 MP | 1x / 4x | 245 / 337 | 403 / 421 | 0 / 0 | same | same |
| 48 MP | 1x / 4x | 39 / 83 | 419 / 459 | 0 / 0 | same | same |
| 12 MP signature tool | 1x / 4x | 102 / 275 | 494 / 466 | 0 / 0 | same | same |

- Processing is off the main thread (a dedicated worker appears within about 60 to 120 ms of pressing Resize, is gone by the time the result shows, and none remain after Reset): Verified working. rAF gaps during the run: none over 100 ms.
- Main-thread JS heap stays 1 to 4 MB (the large bitmaps live in the worker); worker heap not measured. Real-device memory behaviour on large images: Requires real-device testing.
- Caveat: fixtures are synthetic, so real photographs with noise may take longer to search.

## Part E. What was exercised

All 7 routes at 6 widths; all internal links return 200 (home, 20 KB, signature, guide, about, privacy, terms; `mailto:` not exercised); 404 page loads ("Page not found"); nav `aria-current`; presets, custom target, format choices, Advanced disclosure, crop editor fields, Auto-trim path (via keyboard run), compare controls reachable by keyboard, Download, Process another, Start over, Cancel/Escape; unsupported/corrupt/oversize files; invalid input; unmet minimum and maximum. Drag-and-drop and multi-file drop: not exercised (the file input is single-file; multi-file drop notice read in code only): Not tested. Download file contents and save dialogs: Not tested here.
