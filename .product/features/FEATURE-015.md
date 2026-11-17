---
type: feature-spec
id: FEATURE-015
opportunity: OPP-024
status: ready
product_revision: 3
created: 2026-11-17
---

# Image to text (OCR) in the browser


## 1. Feature overview

Extract text from an image in the browser with tesseract.js (Apache-2.0), with the worker, core WASM and language data self-hosted and loaded only on the OCR page. English first, a few more languages later.

## 2. Problem statement

Users extract text from screenshots and scans; autocomplete shows "image to text converter". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=image+to+text+converter; 2026-11-17] No user statement was gathered. [E: assumption; low; search:no user statement found on OCR needs; 2026-11-17]

## 3. Business justification

Objective: a large keyword family and another tool for the portfolio. Incumbent strength is not checked. [E: unknown; low; search:not SERP-checked; 2026-11-17] Owner approved on 2026-11-17 (user: 'Rest can be approved', reply to the portfolio-pass decision sheet). The opportunity is Low confidence; approval does not upgrade the evidence. Originating opportunity: OPP-024 (score 58, Needs evidence, Low confidence, effort M).

## 4. Target users and personas

- **Student or applicant** — has text in an image and wants it as editable text without uploading it.

## 5. User stories

- As a user, I want to get text out of an image in my browser so that my file stays private.
- As a user, I want to copy or download the text so that I can use it elsewhere.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Recognise text in a picked image in the browser. | [Approved] |
| FR-2 | Show the text with copy and download as .txt. | [Approved] |
| FR-3 | No upload of file content. | [Approved] |
| FR-4 | Self-host worker, core WASM and language data; load them only when the OCR page is used, with a progress message. | [Suggestion] |
| FR-5 | English first; additional languages as separate downloads. | [Suggestion] |
| FR-6 | State that accuracy varies for photos and handwriting. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Drop an image, press Recognise, see progress, then the text with Copy and Download buttons and an accuracy note.

## 9. Technical considerations

**Constraints from the existing system:** verifiers forbid third-party origins, and tesseract.js defaults to a CDN, so worker, core and language paths must be set to self-hosted files. [E: fact; high; https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md; 2026-11-17] tesseract.js is Apache-2.0, last pushed 2026-05-17, and tessdata_fast is Apache-2.0. [E: fact; high; https://api.github.com/repos/naptha/tesseract.js; 2026-11-17] WASM and language-file sizes were not found. [E: unknown; low; search:tesseract.js core wasm size; 2026-11-17] OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

**Suggested approach [Suggestion — implementer may choose otherwise]:** lazy dynamic import on the OCR page; measure download size before committing to extra languages.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** an image with clear printed text **When** recognised **Then** the text is returned within an accuracy threshold agreed on a fixture set. |
| AC-2 | FR-2 | **Given** a result **When** the user clicks Copy or Download **Then** the text is copied or saved as .txt. |
| AC-3 | FR-3 | **Given** a session **When** network requests are logged **Then** only same-origin requests occur and none carries file content. |
| AC-4 | FR-4 | **Given** the build **When** `verify:privacy` runs **Then** it passes with the OCR assets self-hosted. |
| AC-5 | NFR-1 | **Given** other pages **When** loaded **Then** no OCR file is requested and `verify:html` budgets are unchanged. |
| AC-6 | NFR-2 | **Given** a low-RAM phone **When** a typical image is recognised **Then** the tab is not killed. |

## 11. Edge cases

- Image with no text → empty result with a message.
- Handwriting or low contrast → low accuracy note.
- Very large image → downscale before recognition.

## 12. Error and failure scenarios

- Asset load failure → retry message; other tools unaffected.
- Out of memory → message to use a smaller image.

## 13. Security and privacy considerations

Images may contain personal data; processed locally; no retention.

## 14. Out of scope

- PDF OCR.
- Server-side OCR.
- Handwriting recognition guarantees.
- Translation.

## 15. Dependencies

- Self-hosted tesseract.js assets.
- Real-device memory test.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Accuracy on the fixture set | unknown | agreed before build | fixtures |
| Indexed OCR page | none | none set | Search Console |

## 17. Research references

- Originating opportunity: OPP-024
- [E: fact; high; https://api.github.com/repos/naptha/tesseract.js; 2026-11-17] Library licence and activity.

## 18. Unresolved decisions

- WASM and language-data download sizes and the budget they must fit (not blocking; implementer measures and owner confirms).
- Which languages to ship (not blocking).
- Whether to measure usage (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1 on fixtures; AC-2 e2e; AC-3 network log; AC-4 `verify:privacy`; AC-5 `verify:html`; AC-6 device test.

