---
type: feature-spec
id: FEATURE-029
opportunity: OPP-044
status: ready
product_revision: 3
created: 2026-11-18
---

# Colour picker from an image


## 1. Feature overview

Click a pixel of an image to read its HEX, RGB and HSL values, with copy buttons.

## 2. Problem statement

Users read a colour from an image; autocomplete returns suggestions for "color picker from image" and "color picker from image online". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=color+picker+from+image; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'I approve all these - I would add all other as well from the https://image.pi7.org/'). The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-044 (score 58, Needs evidence, Low confidence, effort S). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Designer or student** — needs a colour code from an image.

## 5. User stories

- As a user, I want to click a pixel and copy its colour code.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Pick any pixel and show HEX, RGB and HSL. | [Approved] |
| FR-2 | Copy button for each value. | [Approved] |
| FR-3 | A small palette of the last picked colours. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Drop an image, click it, read the values, copy.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** an image with a known pixel **When** clicked **Then** the shown HEX matches that pixel. |
| AC-2 | FR-2 | **Given** a value **When** Copy is pressed **Then** it is on the clipboard. |
| AC-3 | FR-3 | **Given** a session **When** network requests are logged **Then** none carries image content. |
| AC-4 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** budgets are unchanged. |

## 11. Edge cases

- Pixel with alpha → show alpha.
- High-DPI screens → sample the correct pixel.

## 12. Error and failure scenarios

- Clipboard blocked → show text to copy by hand.

## 13. Security and privacy considerations

Processed locally in the browser; no file content leaves the device; no retention; no new trust boundary.

## 14. Out of scope

- Palette generation.
- Browser extension.

## 15. Dependencies

- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-044
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- None.

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

