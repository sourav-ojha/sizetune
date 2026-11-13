# UX and accessibility audit (2026-11-13)

Chrome 157, Playwright 1.65, desktop 1440 and mobile 375 contexts (touch for the signature drag test). Screenshots: `QA/screenshots/<route>-<width>.jpg` and `tool-*` / `sig-*` state shots at 375.

## Verified OK (no change needed)
- Landmarks, skip link, one H1/route, `lang`, a single polite status region per tool; fieldsets with legends; visible 2 px focus rings.
- Focus: Cancel on run start (Escape cancels), result heading after completion; errors `role=alert` with `aria-invalid`/`aria-describedby`; result announced ("Finished. The result is 19.3 KB (19,786 bytes).").
- Progressive disclosure: `/` and `/resize-image-to-20kb/` show 15 controls on first load; the 20 KB route preselects 20; minimum, exact size, max dimensions, format, strategy sit in a collapsed Advanced block that auto-opens on an error there. Min > max: "The minimum must be smaller than the maximum." Bad numbers get inline messages.
- Result panel: original and result size in KB and bytes, dimensions, format, quality, % change, requested limit/range, "Within / Over by / Under by N bytes", notes, non-success headings and "Download anyway".
- `prefers-reduced-motion`: 0 animations/transitions (16 animated elements without it).
- axe-core 4.14: 0 violations on 7 routes + 404 (375 and 1440) and on empty, loaded, validation-error, result, upload-error, crop and signature-result states.

## Fixed this sprint (commit `3220309`)
| Issue | Fix | Test |
|--|--|--|
| Header links 32 px, footer links 20 px high | `min-h-11` on both | e2e "header and footer links are at least 24 px tall" (the floor the test enforces; CSS sets 44) |
| Signature crop: no zoom (1200 px source dragged at ~4.6 source px per screen px on a phone) | Zoom slider 100-400%, scrollable frame; geometry maths unchanged (uses the image's bounding rect); width via CSS variable (CSP safe) | e2e zoom test |
| No aspect presets | Crop shape menu (Free, 2:1, 3:1, 4:1, 1:1) using pure `fitAspect()` and locks the shape | 3 unit tests + e2e (box and downloaded output ratio) |
| Margin fixed at 3% | Auto-trim margin menu (None/Small/Medium/Large), re-applies after a trim | e2e |
| Output-size fieldset before size picker | Moved below it; DOM ids/test ids unchanged | existing + new e2e |
| Compare had no zoom | Fit / 2x / 4x in a scrollable frame, `aria-pressed` buttons | e2e |

## Open
- Live crop preview before Resize; two-finger pinch zoom on the crop editor (touch drag works; zoom is a slider). Medium.
- Focus after file pick remains on `body`; optionally announce "Image loaded". Low.
- Compare zoom is limited by the 1024 px preview of the original. Low.
- Screen-reader pass (VoiceOver, TalkBack, NVDA) is a human item (BLOCKERS H11). Manual contrast spot checks rely on axe (`color-contrast` passed).
