---
type: feature-spec
id: FEATURE-025
opportunity: OPP-040
status: implemented
delivery: complete
product_revision: 3
created: 2026-11-18
---

# Crop shapes and aspect ratio workbench


## 1. Feature overview

One workbench with tabs for freehand crop, square crop, rounded corners, aspect-ratio change and zoom-out, exporting under a KB cap.

## 2. Problem statement

Users crop to free shapes, round corners or change aspect ratio; autocomplete returns suggestions for "freehand crop image online", "round corners image online" and "change aspect ratio of image online". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=freehand+crop+image+online; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'I approve all these - I would add all other as well from the https://image.pi7.org/'). The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-040 (score 63, Needs evidence, Low confidence, effort M). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Image user** — needs a shaped or re-proportioned image.

## 5. User stories

- As a user, I want to cut a freehand shape so that I keep only that area.
- As a user, I want rounded corners or a square crop.
- As a user, I want to change aspect ratio without stretching.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Freehand crop by drawing a path; PNG output with transparency outside it. | [Approved] |
| FR-2 | Square crop and rounded-corner export. | [Approved] |
| FR-3 | Change aspect ratio by crop or by padding. | [Approved] |
| FR-4 | Zoom-out that adds a border so the whole image fits a ratio. | [Suggestion] |
| FR-5 | Share the crop UI with the main tool and OPP-022 circle crop. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Tabs per mode on one page; preview; Download or Resize to KB.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout. Reuse existing crop code.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a drawn path **When** cropped **Then** pixels outside the path are transparent in the PNG. |
| AC-2 | FR-2 | **Given** a radius **When** exported **Then** corners are rounded. |
| AC-3 | FR-3 | **Given** a target ratio **When** applied by padding **Then** the image is not stretched. |
| AC-4 | FR-4 | **Given** a session **When** network requests are logged **Then** none carries image content. |
| AC-5 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** budgets are unchanged. |

## 11. Edge cases

- JPG output with transparency → fill with a chosen colour.
- Open path → close automatically.

## 12. Error and failure scenarios

- Unreadable image → message.

## 13. Security and privacy considerations

Processed locally in the browser; no file content leaves the device; no retention; no new trust boundary.

## 14. Out of scope

- Separate pages per mode (see gate).
- Circle crop and grayscale (OPP-022).

## 15. Dependencies

- OPP-022 overlap decided at build time.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-040
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- Whether circle crop (OPP-022) joins this workbench (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

## Delivery log
| Date | Branch / PR | Delivered | Pending (code) | Pending (non-code) | Notes |
|---|---|---|---|---|---|
| 2026-11-18 | feat/feature-025-crop-shapes-and-aspect-ratio-workbench (head 76866a4) | AC-1 to AC-5: /crop-shapes/ with a freehand cut-out (transparent outside the drawn line, cropped to its box), a centred square with a corner radius up to a circle, and an aspect ratio by cropping (focus sliders) or by adding a border (transparent, white or black) without scaling the picture; PNG and JPG download | none | owner review of page copy; circle crop (OPP-022) is covered by the square at maximum radius, so confirm it does not need its own page; decide whether to measure usage | rulings: geometry is pure and unit tested (src/lib/crop-geometry.ts); the existing CropEditor was not reused because it is tied to the resizer's crop box, so this tool has its own small canvas code; the drawn line is closed automatically and a new line replaces the old one; the drawing canvas has no keyboard path, so the square and ratio modes are the accessible alternative and the page says so; padding never scales the picture, which the e2e proves with single pixels; no resize-to-KB embed (not in the criteria): the page links to the KB resizer. verified: check 0 errors, build 0, verify:html(:strict) OK, verify:privacy OK, 985 unit pass, e2e crop-shapes 10/10 on each of chrome, webkit and firefox (4 repeats), axe on the page; drawing tested with the mouse only; no independent reviewer was used, self-review only |
