---
type: feature-spec
id: FEATURE-014
opportunity: OPP-020
status: ready
product_revision: 3
created: 2026-11-17
---

# PDF to JPG or PNG with a KB target


## 1. Feature overview

Render PDF pages to images in the browser with pdf.js (Apache-2.0), then use the existing KB engine on each page image, with ZIP download for several pages.

## 2. Problem statement

People convert PDF pages to images and then must meet a KB limit; autocomplete shows "pdf to jpg converter 100 kb". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=pdf+to+jpg+converter+100+kb; 2026-11-17] No user statement was gathered. [E: assumption; low; search:no user statement found on PDF to image KB needs; 2026-11-17]

## 3. Business justification

Objective: combine a high-volume conversion with SizeTune's one differentiator, the KB target. Page one for the KB phrases included mid-size and small marketing sites. [E: inference; low; search:pdf to jpg converter 100 kb; 2026-11-17] Owner approved on 2026-11-17 (user: 'Rest can be approved', reply to the portfolio-pass decision sheet). The opportunity is Low confidence; approval does not upgrade the evidence. Originating opportunity: OPP-020 (score 61, Needs evidence, Low confidence, effort M).

## 4. Target users and personas

- **Form applicant with a PDF** — needs an image of a PDF page under a KB limit.

## 5. User stories

- As an applicant, I want to turn a PDF page into a JPG under a KB limit so that a portal accepts it.
- As an applicant, I want several pages in one ZIP so that I do not repeat steps.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Render selected PDF pages to JPG or PNG in the browser. | [Approved] |
| FR-2 | Apply the existing KB target engine to each rendered page. | [Approved] |
| FR-3 | No upload of file content. | [Approved] |
| FR-4 | ZIP download when more than one page is output (share the ZIP code with FEATURE-005). | [Suggestion] |
| FR-5 | Cap page count and file size with a clear message, set after a real-device test. | [Suggestion] |
| FR-6 | pdf.js worker and assets self-hosted; no third-party origins. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Drop a PDF, choose pages, choose JPG or PNG and a KB target, see per-page results, download one file or a ZIP.

## 9. Technical considerations

**Constraints from the existing system:** the image engine runs in a Web Worker with its own contract; a PDF render path needs its own contract. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] pdf.js is Apache-2.0 and active; its worker must be self-hosted. [E: fact; high; https://api.github.com/repos/mozilla/pdf.js; 2026-11-17] Verifiers assume images and forbid third-party origins. [E: fact; high; repo:scripts/verify-privacy.mjs; 2026-11-17] OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout. Sequencing with OPP-003 Phase 0 is an owner decision (attention item A-003).

**Suggested approach [Suggestion — implementer may choose otherwise]:** lazy-load pdf.js only on this page, render at a capped resolution, release canvases after each page.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a PDF **When** page 1 is rendered **Then** a JPG of that page is produced. |
| AC-2 | FR-2 | **Given** a feasible KB target **When** processed **Then** the output is at or under the target and the achieved size is shown. |
| AC-3 | FR-2 | **Given** an infeasible target **When** processed **Then** the UI says the target was not reached and shows the smallest achieved size. |
| AC-4 | FR-3 | **Given** a session **When** network requests are logged **Then** none carries file content. |
| AC-5 | FR-4 | **Given** several pages **When** done **Then** a ZIP contains every produced page. |
| AC-6 | FR-5 | **Given** a file above the cap **When** selected **Then** a clear message appears and no rendering starts. |
| AC-7 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** existing pages' budgets are unchanged; pdf.js loads only on this page. |

## 11. Edge cases

- Encrypted PDF → clear refusal.
- Very large pages → render scale capped.
- Scanned PDF → the page is already an image; quality warning.

## 12. Error and failure scenarios

- Corrupt PDF → clear message, no crash.
- Out of memory → message to try fewer pages.

## 13. Security and privacy considerations

PDFs may contain IDs; processed locally only; no retention. Malformed PDFs target the parser; run in a worker with limits.

## 14. Out of scope

- Image to PDF (OPP-013).
- PDF page edits (OPP-019).
- PDF compression to KB (OPP-003).
- Server-side processing.

## 15. Dependencies

- FEATURE-005 ZIP code.
- pdf.js self-hosting.
- OPP-003 Phase 0 sequencing decision.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Share of test PDFs rendered and reaching target | unknown | set after fixtures exist | engine fixtures |
| Indexed page impressions | none | none set | Search Console |

## 17. Research references

- Originating opportunity: OPP-020
- [E: fact; high; https://api.github.com/repos/mozilla/pdf.js; 2026-11-17] pdf.js licence and activity.

## 18. Unresolved decisions

- Page and size caps (not blocking; implementer proposes after device test).
- Order relative to OPP-003 Phase 0 (not blocking; owner decision A-003).
- Whether to measure usage (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1 to AC-3, AC-5 via fixtures and Playwright; AC-4 network log; AC-6 ZIP check; AC-7 `pnpm run verify:html`.

