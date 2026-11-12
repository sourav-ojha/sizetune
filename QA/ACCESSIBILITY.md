# SizeTune accessibility audit (2026-11-12)

Scope: WCAG 2.2 A/AA as far as automation and scripted keyboard tests can show. **No screen-reader testing (VoiceOver, TalkBack, NVDA, JAWS) has been done; that needs a human** (see "Not done").

## What is tested (all permanent, in `npx playwright test`)

| Spec | What it proves |
|---|---|
| `e2e/ui/axe.spec.ts` | axe-core 4.14.0 (exact-pinned devDependency, test-only, never shipped) with tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice` (includes `color-contrast` and `target-size`). Fails on **any** violation of any impact that is not in the justified allow-list in `e2e/ui/axe-helper.ts` (the list is empty). |
| `e2e/ui/a11y-flows.spec.ts` | Keyboard-only flow (file chooser opened from the keyboard, preset, run, result focus, download, reset), Escape and Cancel, crop editor by keyboard, a focus indicator on every control, no keyboard trap, reduced motion, reflow at 320 px and 640 px, accessibility-tree (`ariaSnapshot`) semantics. |
| `e2e/ui/a11y.spec.ts` (earlier) | Simple DOM assertions: accessible names, no duplicate ids, aria-live present, fieldset legends, target heights, keyboard flow, focus rings, reduced motion. |
| `e2e/mobile.spec.ts` | No horizontal scroll through the whole flow, primary controls at least 44 px, crop handles at least 44 px on touch. |

axe is run by **evaluating its source over CDP** (`page.evaluate(axe.min.js text)`), not by injecting a `<script>`, so the page CSP is never relaxed. A self-test in `axe.spec.ts` plants a nameless button, an image without alt, low-contrast text and a 10 px target and requires axe to report `button-name`, `image-alt`, `color-contrast` and `target-size`, so a silently non-working harness cannot produce "0 violations".

### axe coverage
- Pages, at 1280 px and 375 px: `/`, `/resize-image-to-20kb/`, `/resize-signature/`, the guide, `/privacy/`, `/about/`, `/terms/`, the 404 page (16 runs).
- Image tool states, at both widths: initial; file loaded; Advanced open (minimum, dimensions, Fit select, aspect lock on and off); field errors (`aria-invalid`); processing (progress and Cancel, held with a stalled worker request); ok result with before/after compare (and the "original shown" position); `below_min` warning; larger-than-original warning; error alerts (unsupported file, damaged file); transparency note, JPEG fill choice, custom colour, flattened result with notes; the default-JPEG note for an opaque PNG.
- Signature tool, both widths: initial, crop editor, after auto-trim, result on white.
- 36 runs in total, plus the harness self-test.

## Results
- **Violations found by axe: 0** (all impacts, including `color-contrast`, `target-size`, `aria-*`, `label`, `region`, landmark and heading rules) in every page and state above. The earlier accessibility work (labels, legends, 44 px targets, indigo-800 / slate-700 tokens, `sr-only` live region) already satisfied the rules, and the self-test shows the harness would have caught regressions. Because nothing needed fixing, there was nothing to allow-list; the allow-list is empty and a new entry needs a written reason.
- **axe "needs review" (incomplete) items**, checked by hand:
  - `color-contrast` on the decorative check/warning glyph (`aria-hidden`) inside the result heading: same colours as the heading text, which passes.
  - `color-contrast` on the "Original"/"Result" pills over the compare image: white text on slate-900 at 80% opacity. Worst case over a white image composites to about #3f4555 on white text, roughly 9.5:1, which passes; over dark images it is higher.

## Changes made in this task (real findings from the keyboard/semantics checks)
1. **Escape cancels a running resize** (and the Cancel button now advertises `aria-keyshortcuts="Escape"` and "(or press Escape)" to screen readers). Before, only the Cancel button worked. Focus returns to the Resize button, the file and settings are kept (tested for both paths).
2. **Focus is no longer stolen by the result**: the result heading receives focus only when focus was on the control that started the run (or on the page body), never when the user has already moved on. This removed a real race (a Tab press right after a run finished jumped back) that the new test exposed.
3. **Announcements are not doubled**: success and warnings go through the single polite `role="status"` region and the focused result heading; the result panel itself has no live region; errors use exactly one `role="alert"` and the status region is empty at that moment. Asserted with `ariaSnapshot` and role counts.

## Reflow, zoom, motion
- 320 px viewport (400% zoom equivalent) and 640 px (200% zoom): no horizontal scroll and no control outside the viewport in the empty, file-loaded, Advanced-open, result and compare states of both tools, including a very long file name and a long warning message.
- `prefers-reduced-motion: reduce`: no element has a transition or animation, smooth scrolling is not used, in the result state.
- Text-spacing overrides and a real browser zoom (as opposed to a narrow viewport) were not exercised.

## Known limits and remaining work
- **Screen readers (VoiceOver iOS and macOS, TalkBack, NVDA) not tested.** Names, roles, states and live-region behaviour are asserted from the accessibility tree only; real announcement order, verbosity and focus behaviour on `details`/`summary`, the range slider and the crop box can differ. A human pass is required before launch (suggested scripts: pick a file, change preset, resize, read the result, cancel, crop a signature with keyboard only).
- The crop box is a `role="group"` with arrow-key handling and a descriptive label, plus numeric fields as the primary accessible alternative. Pointer dragging has no keyboard-free equivalent beyond that, which is intentional; this has not been judged by an assistive-technology user.
- Disabled buttons use reduced opacity; WCAG exempts inactive controls and axe skips them, so their contrast was not measured.
- Dark mode and forced-colors mode are not supported or tested (the site is light only).
- Page-level issues for the lead/content agent: **none found** (axe reports no violations on any launch page at either width).
