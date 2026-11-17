---
type: feature-spec
id: FEATURE-035
opportunity: OPP-050
status: draft
product_revision: 3
created: 2026-11-18
---

# AI object, text and logo remover


## 1. Feature overview

Remove a selected object, text or logo from an image with an in-browser inpainting model. Draft: model licence, size and quality are unverified.

## 2. Problem statement

Users remove objects from photos; autocomplete returns suggestions for "remove object from photo online free". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=remove+object+from+photo+online; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'Approve all six'), overriding the relatedness rule and the unresolved items below. The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-050 (score 58, Needs evidence, Low confidence, effort L). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Image user** — wants an object or watermark-like mark removed.

## 5. User stories

- As a user, I want to paint over an object and have it removed.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Paint a mask and remove the area with an in-browser model. | [Approved] |
| FR-2 | No upload of file content. | [Approved] |
| FR-3 | Lazy-load the model only on this page. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Pick image, paint mask, Remove, compare, download.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout. imgly (AGPL) and non-commercial models are excluded. [E: fact; high; https://github.com/imgly/background-removal-js; 2026-11-17] No permissive inpainting model was verified. [E: unknown; low; search:none run; 2026-11-18]

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a masked area **When** processed **Then** the area is filled plausibly from its surroundings. |
| AC-2 | FR-2 | **Given** a session **When** network requests are logged **Then** only same-origin requests occur and none carries file content. |
| AC-3 | NFR-1 | **Given** other pages **When** loaded **Then** no model file is requested. |

## 11. Edge cases

- Large masks → quality warning.
- No WebGPU → slow WASM fallback with a note.

## 12. Error and failure scenarios

- Out of memory → message.

## 13. Security and privacy considerations

Processed locally in the browser; no file content leaves the device; no retention; no new trust boundary. Verify the model file hash.

## 14. Out of scope

- Server inference.
- Removing watermarks from images the user does not own (page should not promote that).

## 15. Dependencies

- OPP-031 shares model hosting work.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-050
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- [BLOCKING] Model licence: an inpainting model with a licence allowing commercial use must be identified and legally reviewed.
- [BLOCKING] Download size and mobile memory budget are unknown.
- Whether to restrict the page's wording on watermarks (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

