---
type: feature-spec
id: FEATURE-042
opportunity: OPP-057
status: draft
product_revision: 3
created: 2026-11-18
---

# Face and skin retouching


## 1. Feature overview

Simple in-browser skin smoothing and blemish removal on a brushed area. Draft: the approach and any model licence are unresolved.

## 2. Problem statement

Users retouch portraits; autocomplete returns suggestions for "skin retouching online free" and "skin smoothing online free". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=skin+retouching+online+free; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'Approve all three'). The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-057 (score 43, Backlog, Low confidence, effort L). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Photo user** — wants a portrait softened or blemishes removed.

## 5. User stories

- As a user, I want to smooth skin in a brushed area.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Brush an area and apply smoothing or blemish removal. | [Approved] |
| FR-2 | No upload of file content. | [Approved] |
| FR-3 | A before and after compare control. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Pick image, brush area, adjust strength, compare, download.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout. A non-model approach (blur and healing on a brushed mask) avoids licences; a model-based one would need review. [E: inference; low; search:none run; 2026-11-18]

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a brushed area **When** smoothing is applied **Then** only that area changes. |
| AC-2 | FR-2 | **Given** a session **When** network requests are logged **Then** none carries image content. |
| AC-3 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** budgets are unchanged. |

## 11. Edge cases

- Strength too high → plastic look; cap the range.
- Brush on a non-skin area → applies the effect anyway; the user can undo.

## 12. Error and failure scenarios

- Unreadable image → message.

## 13. Security and privacy considerations

Processed locally in the browser; no file content leaves the device; no retention; no new trust boundary. Faces are personal data; never stored.

## 14. Out of scope

- Automatic face detection.
- Aging or body edits.

## 15. Dependencies

- OPP-050 if a model is chosen.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-057
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- [BLOCKING] Approach: brush-only (no model) or model-based; owner must choose, and a model needs a licence review.
- Wording on retouching of ID photos (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

