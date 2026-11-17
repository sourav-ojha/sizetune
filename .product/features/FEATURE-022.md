---
type: feature-spec
id: FEATURE-022
opportunity: OPP-037
status: ready
product_revision: 3
created: 2026-11-18
---

# Increase PDF size to a minimum KB


## 1. Feature overview

Pad a PDF to a chosen minimum size in the browser without changing how it looks.

## 2. Problem statement

Some forms require a minimum PDF size; autocomplete shows "increase pdf size to 200kb" and "change pdf size to 200kb". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=increase+pdf+size+to+200kb; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'I approve all these - I would add all other as well from the https://image.pi7.org/'). The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-037 (score 61, Needs evidence, Low confidence, effort M). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Form applicant** — has a PDF below the portal's minimum size.

## 5. User stories

- As an applicant, I want to raise my PDF to 200 KB so that the portal accepts it.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Accept a PDF and a minimum KB target. | [Approved] |
| FR-2 | Increase the file size without altering the visible pages. | [Approved] |
| FR-3 | Report the final size. | [Suggestion] |
| FR-4 | Pad by a method that keeps the file valid in common viewers. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Pick a PDF, enter the minimum KB, press Increase, see the size, download.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout. PDF work uses a permissive library such as @cantoo/pdf-lib (MIT) or pdf.js (Apache-2.0); Ghostscript WASM is AGPL and excluded. [E: fact; medium; https://github.com/cantoo-scribe/pdf-lib; 2026-11-17] Padding must be tested against a validator and two viewers so the file is not corrupted.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a 60 KB PDF and a 200 KB target **When** processed **Then** the output is at least 200 KB. |
| AC-2 | FR-2 | **Given** the output **When** opened **Then** the pages look identical to the input. |
| AC-3 | FR-3 | **Given** an already larger PDF **When** processed **Then** it is returned unchanged with a message. |
| AC-4 | FR-4 | **Given** a session **When** network requests are logged **Then** none carries file content. |
| AC-5 | NFR-1 | **Given** other pages **When** loaded **Then** no PDF library is requested. |

## 11. Edge cases

- Encrypted PDF → message.
- Target far above size → cap with a message.

## 12. Error and failure scenarios

- Corrupt PDF → clear error.

## 13. Security and privacy considerations

Processed locally in the browser; no file content leaves the device; no retention; no new trust boundary.

## 14. Out of scope

- Compressing PDFs (FEATURE-003).
- Editing PDF content.

## 15. Dependencies

- FEATURE-003 and FEATURE-021 for the shared PDF library.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-037
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- Padding method (not blocking; implementer proposes and tests).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

