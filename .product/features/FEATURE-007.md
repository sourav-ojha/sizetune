---
type: feature-spec
id: FEATURE-007
opportunity: OPP-014
status: ready
product_revision: 3
created: 2026-11-17
---

# Image rotator and flipper


## 1. Feature overview

A page that rotates (90, 180, 270 degrees) and flips an image entirely in the browser, with a link into the KB resizer.

## 2. Problem statement

Some photos appear sideways or mirrored before upload. No applicant-specific complaint was found. [E: hypothesis; low; n/a; 2026-11-17] The engine already applies EXIF orientation on decode, and browsers do by default. [E: fact; high; repo:src/lib/engine/env.ts; 2026-11-17] OS viewers and phone galleries rotate natively (not sourced). [E: assumption; low; n/a; 2026-11-17]

## 3. Business justification

Objective: a cheap extra entry page and part of a multi-tool site for ad revenue. Free incumbents hold the head term. [E: fact; medium; https://www.img2go.com/rotate-image; 2026-11-17] The research agent judged it likely low-value filler. Owner approved this despite its tier (user: 'lets add them, so we ll have more tools in our arsenal', 2026-11-17); the evidence below stays weak and is not upgraded by the approval. Originating opportunity: OPP-014 (score 50, Backlog, Low confidence, effort S).

## 4. Target users and personas

- **Applicant with a sideways photo** — needs to fix orientation before uploading to a form.

## 5. User stories

- As an applicant, I want to rotate or flip my photo so that it is upright when uploaded.
- As the site owner, I want users to continue into the KB resizer after rotating.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Rotate by 90, 180 and 270 degrees and flip horizontally and vertically, on canvas, in the browser. | [Approved] |
| FR-2 | A link or hand-off into the KB resizer. | [Approved] |
| FR-3 | No upload of file content. | [Approved] |
| FR-4 | Output keeps the input format (JPEG, PNG, WebP); JPEG re-encoding uses a high quality default and the page says it re-encodes. | [Suggestion] |
| FR-5 | Show a live preview before download. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Drop a file, see a preview, click rotate or flip buttons (keyboard operable, labelled), download the result. Reuse Dropzone and ResultPanel patterns.

## 9. Technical considerations

**Constraints from the existing system:** EXIF orientation is applied on decode, so the tool must not rotate twice. [E: fact; high; repo:src/lib/engine/env.ts; 2026-11-17] The Dropzone accepts JPEG, PNG and WebP. [E: fact; high; repo:src/components/tool/Dropzone.tsx; 2026-11-17] OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

**Suggested approach [Suggestion — implementer may choose otherwise]:** canvas transform from the decoded bitmap, encode with the existing encoder path.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a valid image **When** the user rotates 90 degrees **Then** the downloaded image has swapped width and height and correct orientation. |
| AC-2 | FR-1 | **Given** a valid image **When** the user flips horizontally **Then** the result is mirrored. |
| AC-3 | FR-1 | **Given** a JPEG with EXIF orientation **When** loaded **Then** the preview matches how it appears in the system viewer and is not rotated twice. |
| AC-4 | FR-3 | **Given** a session **When** network requests are logged **Then** none carries file content. |
| AC-5 | NFR-3 | **Given** the page **When** axe runs **Then** there are no violations, and buttons work by keyboard. |

## 11. Edge cases

- Large images → engine limits apply with the existing message.
- PNG with transparency → preserved.
- Animated image → first frame only; page says so.

## 12. Error and failure scenarios

- Decode failure → user-safe engine message.
- Out of memory → message to use a smaller image.

## 13. Security and privacy considerations

Local processing; no retention; no new trust boundary.

## 14. Out of scope

- Arbitrary-angle rotation or crop.
- Batch rotation.
- HEIC input.

## 15. Dependencies

- Engine and picker components.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Indexed rotator page | none | none set until a baseline exists | Search Console |
| Share continuing to the KB resizer | unknown (no analytics) | none set | needs an analytics decision |

## 17. Research references

- Originating opportunity: OPP-014
- [E: fact; medium; https://www.img2go.com/rotate-image; 2026-11-17] Free incumbent.
- [E: fact; high; https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap; 2026-11-17] Browsers apply EXIF orientation by default.

## 18. Unresolved decisions

- Whether the page needs extra helpful content to avoid being thin (not blocking; suggested a short guide on fixing sideways uploads).
- Whether to measure usage (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`, `src/lib/engine/env.ts`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1 to AC-3 via Playwright e2e with an EXIF fixture; AC-4 network log; AC-5 axe spec.

