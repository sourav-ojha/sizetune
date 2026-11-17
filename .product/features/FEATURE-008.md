---
type: feature-spec
id: FEATURE-008
opportunity: OPP-015
status: implemented
delivery: complete
product_revision: 3
created: 2026-11-17
---

# "Will this file pass?" image checker


## 1. Feature overview

A page where a user picks a file and optionally enters a form's rules (KB range, pixel range, accepted type). The tool shows real format (from file bytes), dimensions, size and a pass or fail per rule, with a one-click link to the resizer. Rule-entry based; no maintained list of exam presets.

## 2. Problem statement

Upload systems reject files whose real type differs from the extension or whose size or pixels fall outside rules; evidence is vendor articles and unopened support-thread snippets. [E: fact; low; search:photo upload rejected invalid file format jpg actually png webp heic; 2026-11-17] One applicant's correctly sized signature was still rejected as invalid. [E: fact; low; https://www.careers360.com/question-why-is-my-jee-form-saying-that-signature-jpg-is-not-valid-despite-correct-size-24kb-its-the-same-with-my-category-certificate-pdf-too-uploaded-size-286kb-but-my-photo-was-uploaded-successfully-kindly-answer-this-asap; 2026-11-17]

## 3. Business justification

Objective: keep users on the site and add checker entry pages for ad revenue. photoresizer.in already offers a compliance checker next to exam presets, so this angle is not clear of competition. [E: fact; medium; https://photoresizer.in/; 2026-11-17] Owner approved this despite its tier (user: 'lets add them, so we ll have more tools in our arsenal', 2026-11-17); the evidence below stays weak and is not upgraded by the approval. Originating opportunity: OPP-015 (score 60, Needs evidence, Low confidence, effort M).

## 4. Target users and personas

- **Applicant whose upload was rejected** — wants to know why a file fails before trying again.
- **Applicant preparing a file** — wants to confirm a file meets a form's rules.

## 5. User stories

- As an applicant, I want to see my file's real format, size and dimensions so that I understand why a portal rejects it.
- As an applicant, I want to enter a form's rules and see pass or fail per rule so that I know what to fix.
- As the site owner, I want a fix-it link into the resizer when a rule fails.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Show real file type (from bytes, not extension), size in KB and pixel dimensions for a chosen file, in the browser. | [Approved] |
| FR-2 | Optional rule entry (KB range, pixel range, accepted type) with pass or fail per rule. | [Approved] |
| FR-3 | A one-click link into the resizer pre-filled where possible. | [Approved] |
| FR-4 | No upload of file content. | [Approved] |
| FR-5 | DPI shown only if the file contains it; if absent, say so (no guess). | [Suggestion] |
| FR-6 | A note that a portal may have hidden rules, so passing here does not guarantee acceptance. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Pick a file; a results panel lists type, size, dimensions (and DPI if present). A collapsible rules form lets the user add limits; each rule shows pass or fail with the measured value. A "Resize to fit" button appears on failure. Reuse existing components.

## 9. Technical considerations

**Constraints from the existing system:** header reading and sniffing already exist for dimensions and orientation. [E: fact; high; repo:src/lib/engine/header.ts; 2026-11-17] DPI would be new code; header.ts does not read it today. [E: fact; high; repo:src/lib/engine/header.ts; 2026-11-17] Overlaps the checking part of deferred OPP-011; this version is rule-entry based. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

**Suggested approach [Suggestion — implementer may choose otherwise]:** reuse sniff and header code in a read-only path with no decode; add JFIF/EXIF DPI read only if cheap.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a JPEG named .png **When** checked **Then** the tool shows the real type as JPEG. |
| AC-2 | FR-1 | **Given** a valid image **When** checked **Then** size in KB and pixel dimensions are shown. |
| AC-3 | FR-2 | **Given** rules of 20 to 50 KB and a 30 KB file **When** checked **Then** the size rule shows pass; with a 60 KB file it shows fail with the measured value. |
| AC-4 | FR-3 | **Given** a failed rule **When** the user clicks the fix link **Then** the resizer opens with the file or target carried over where supported. |
| AC-5 | FR-4 | **Given** a check **When** network requests are logged **Then** none carries file content. |
| AC-6 | FR-5 | **Given** a file without DPI metadata **When** checked **Then** DPI is reported as not present, not guessed. |

## 11. Edge cases

- Unsupported or corrupt file → clear message, no crash.
- Rule fields left empty → those rules are skipped.
- HEIC or AVIF → reported as detected type; no decode.

## 12. Error and failure scenarios

- Header read failure → user-safe message.
- File over the existing size limit → existing message.

## 13. Security and privacy considerations

Local processing; no retention. Bytes are read only; no decode of untrusted data beyond the existing header parser.

## 14. Out of scope

- Maintained exam presets (see OPP-011).
- PDF checking.
- Metadata editing or stripping.

## 15. Dependencies

- Existing sniff and header modules.
- Decision on OPP-011 (overlap; not blocking).
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Checker page impressions | none | none set until a baseline exists | Search Console |
| Share of checks that continue to the resizer | unknown (no analytics) | none set | needs an analytics decision |

## 17. Research references

- Originating opportunity: OPP-015
- [E: fact; medium; https://photoresizer.in/; 2026-11-17] Competing checker.
- [E: fact; medium; https://www.metadata2go.com; 2026-11-17] Generic EXIF and type checkers exist.

## 18. Unresolved decisions

- Whether DPI is in scope for the first release (not blocking; suggested yes only if the file carries it).
- How this relates to OPP-011 if that is revived (not blocking).
- Whether to measure usage (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`, `src/lib/engine/header.ts`, `src/lib/engine/sniff.ts`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1 to AC-3, AC-5 via unit tests on fixtures and Playwright e2e; AC-4 network log; AC-3 link by e2e.

## Delivery log
| Date | Branch / PR | Delivered | Pending (code) | Pending (non-code) | Notes |
|---|---|---|---|---|---|
| 2026-11-17 | feat/tools-converter-rotator-checker (commits 9512042, 0885e42) | AC-1 to AC-6: /check-image-size/ | none | owner review of page copy; Search Console impressions | DPI read from JFIF, EXIF resolution and PNG pHYs (WebP not read). KB rules report borderline when 1,000 vs 1,024 bytes disagree. Fix link carries ?max= and ?min= (ImageTool reads them after mount); the file and pixel rules are not carried. OPP-011 overlap untouched |
