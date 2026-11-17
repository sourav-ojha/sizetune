---
type: feature-spec
id: FEATURE-013
opportunity: OPP-018
status: ready
product_revision: 3
created: 2026-11-17
---

# Print-unit and DPI controls (cm, inch, mm plus KB)


## 1. Feature overview

Add a unit selector (px, cm, mm, inch) and a DPI field to the existing resize tool, and a DPI changer that writes the JFIF or pHYs tag, so users can meet forms that state sizes in print units alongside a KB limit.

## 2. Problem statement

SizeTune offers pixel fields and a KB target; a search of src for dpi, cm and inch found no print-unit or DPI control. [E: inference; medium; search:grep dpi cm inch under repo src; 2026-11-17] That forms ask for cm or mm is inferred from autocomplete, which returns "resize image in cm and kb" with "and dpi" and "and pixel" variants. [E: inference; low; https://suggestqueries.google.com/complete/search?client=firefox&q=resize+image+in+cm+and+kb; 2026-11-17]

## 3. Business justification

Objective: extend the core tool toward long-tail queries without a new engine. A page-one read for related queries showed imresizer and small tools, no giants (a US-only search tool). [E: inference; low; search:resize image in cm and kb; 2026-11-17] Owner approved on 2026-11-17 (user: 'Rest can be approved', reply to the portfolio-pass decision sheet). The opportunity is Low confidence; approval does not upgrade the evidence. Originating opportunity: OPP-018 (score 62, Needs evidence, Low confidence, effort S).

## 4. Target users and personas

- **Form applicant** — has a size in cm or mm and a DPI requirement together with a KB limit.

## 5. User stories

- As an applicant, I want to enter a size in cm or mm so that I do not convert to pixels myself.
- As an applicant, I want to set the DPI of my image so that the form's DPI rule is met.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | A unit selector (px, cm, mm, inch) with a DPI field on the existing tool. | [Approved] |
| FR-2 | A DPI changer that writes the JFIF or pHYs tag in the output. | [Approved] |
| FR-3 | Processing in the browser; no upload. | [Approved] |
| FR-4 | Pixel size computed from the chosen unit and DPI, shown to the user before processing. | [Suggestion] |
| FR-5 | A note that some portals check pixels, not DPI. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Add the unit and DPI controls beside the existing size fields; show the computed pixel dimensions. Follow existing SizePicker patterns.

## 9. Technical considerations

**Constraints from the existing system:** the engine takes pixel dimensions and a KB target. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] DPI write is new work in the encode path; the engine contract in ENGINE.md governs changes. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

**Suggested approach [Suggestion — implementer may choose otherwise]:** convert units to pixels in the UI layer and write DPI as a post-encode metadata step.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a size of 35 by 45 mm at 300 DPI **When** processed **Then** the output is about 413 by 531 pixels. |
| AC-2 | FR-2 | **Given** a DPI of 200 **When** processed **Then** the output file's JFIF or pHYs tag states 200 DPI. |
| AC-3 | FR-3 | **Given** a session **When** network requests are logged **Then** none carries file content. |
| AC-4 | FR-4 | **Given** px selected **When** processed **Then** behaviour matches the current tool. |
| AC-5 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** the first-load budget is unchanged. |

## 11. Edge cases

- PNG and WebP → DPI written where the format supports it, else a note.
- Units that give non-integer pixels → rounded, with the result shown.

## 12. Error and failure scenarios

- Invalid or empty size → existing validation message.

## 13. Security and privacy considerations

Local processing; no retention; no new trust boundary.

## 14. Out of scope

- Exact-size passport crop (OPP-008).
- Per-size landing pages (OPP-001).
- Print layout or sheets.

## 15. Dependencies

- Existing engine.
- OPP-001 and OPP-008 for overlap.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Use of unit controls | unknown (no analytics) | none set | needs an analytics decision |

## 17. Research references

- Originating opportunity: OPP-018
- [E: inference; low; https://suggestqueries.google.com/complete/search?client=firefox&q=resize+image+in+cm+and+kb; 2026-11-17] Query variants exist.

## 18. Unresolved decisions

- Whether DPI applies to PNG and WebP output (not blocking; implementer proposes).
- Whether to add dedicated pages for these queries (not blocking; see OPP-001).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1 and AC-2 via unit tests and fixtures; AC-3 network log; AC-4 existing e2e; AC-5 `pnpm run verify:html`.

