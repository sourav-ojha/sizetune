---
type: feature-spec
id: FEATURE-021
opportunity: OPP-036
status: ready
product_revision: 3
created: 2026-11-18
---

# Image or JPG to PDF under a KB limit


## 1. Feature overview

Turn one or more images into a PDF in the browser and tune image quality until the PDF fits a chosen KB cap.

## 2. Problem statement

Forms ask for a PDF under a size cap; autocomplete shows "jpg to pdf under 100kb" with many variants. [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=jpg+to+pdf+under+100kb; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'I approve all these - I would add all other as well from the https://image.pi7.org/'). The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-036 (score 76, Needs evidence, Low confidence, effort M). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Form applicant** — needs a document as a PDF under a KB limit.

## 5. User stories

- As an applicant, I want my photo as a PDF under 100 KB so that a portal accepts it.
- As an applicant, I want several images in one PDF.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Build a PDF from one or more images with page order controls. | [Approved] |
| FR-2 | Reduce image quality and size until the PDF is at or under the target KB, using the existing KB engine. | [Approved] |
| FR-3 | A KB target field with common presets (50, 100, 200, 500 KB). | [Approved] |
| FR-4 | Report the final size and warn if the target cannot be met. | [Suggestion] |
| FR-5 | Share PDF code with FEATURE-003 and FEATURE-022. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Add images, reorder, choose a KB cap, press Create, see the size, download.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout. PDF work uses a permissive library such as @cantoo/pdf-lib (MIT) or pdf.js (Apache-2.0); Ghostscript WASM is AGPL and excluded. [E: fact; medium; https://github.com/cantoo-scribe/pdf-lib; 2026-11-17] Sequencing: A-003 asks PDF engine decisions to follow FEATURE-003 Phase 0; the implementer should reuse that decision, not make a second one.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** two images and a 100 KB cap **When** created **Then** the PDF is at most 100 KB or a clear message states the minimum reachable size. |
| AC-2 | FR-2 | **Given** image order changed **When** created **Then** the PDF pages follow that order. |
| AC-3 | FR-3 | **Given** a created PDF **When** opened **Then** each image is on its own page without distortion. |
| AC-4 | FR-4 | **Given** a session **When** network requests are logged **Then** none carries file content. |
| AC-5 | NFR-1 | **Given** other pages **When** loaded **Then** no PDF library is requested. |

## 11. Edge cases

- Cap below what one page can reach → message with the achieved size.
- Very large image → downscale first.
- Transparent PNG → flatten on white.

## 12. Error and failure scenarios

- Corrupt image → skip with a message.

## 13. Security and privacy considerations

Processed locally in the browser; no file content leaves the device; no retention; no new trust boundary.

## 14. Out of scope

- Per-size landing pages for each KB cap (OPP-001 rules apply).
- OCR or editable PDFs.
- PDF compression of existing PDFs (FEATURE-003).

## 15. Dependencies

- FEATURE-003 PDF engine decision.
- OPP-013 overlap.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-036
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- Whether to wait for FEATURE-003 Phase 0 before building (not blocking; see A-003).
- Which PDF library (not blocking; permissive only, reuse FEATURE-003).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

