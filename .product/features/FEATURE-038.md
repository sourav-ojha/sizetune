---
type: feature-spec
id: FEATURE-038
opportunity: OPP-053
status: implemented
delivery: complete
product_revision: 3
created: 2026-11-18
---

# Text to handwriting


## 1. Feature overview

Render typed text as a handwriting-style image on ruled or plain paper, with a choice of handwriting fonts.

## 2. Problem statement

Users render text as handwriting; autocomplete returns suggestions for "text to handwriting online". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=text+to+handwriting+online; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'Approve all six'), overriding the relatedness rule and the unresolved items below. The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-053 (score 47, Backlog, Low confidence, effort M). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Student or casual user** — wants text shown as handwriting.

## 5. User stories

- As a user, I want my text in a handwriting font on a page background.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Type text, pick a handwriting font, ink colour and paper style. | [Approved] |
| FR-2 | Export as PNG or JPG, optionally under a KB cap. | [Approved] |
| FR-3 | Ship open-licence fonts self-hosted. | [Suggestion] |
| FR-4 | Page note that handwritten work should not be passed off where handwriting is required. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Type text, choose style, preview pages, download.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout. Fonts must be open licence (for example SIL OFL).

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** typed text **When** rendered **Then** it appears in the chosen font on the chosen paper. |
| AC-2 | FR-2 | **Given** long text **When** rendered **Then** it paginates across images. |
| AC-3 | FR-3 | **Given** a session **When** network requests are logged **Then** none carries user text. |
| AC-4 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** budgets are unchanged and fonts load only on this page. |

## 11. Edge cases

- Characters missing from a font → fallback.
- Very long text → page cap.

## 12. Error and failure scenarios

- Font load failure → fallback font.

## 13. Security and privacy considerations

Processed locally in the browser; no file content leaves the device; no retention; no new trust boundary.

## 14. Out of scope

- Handwriting recognition.
- Per-font pages.

## 15. Dependencies

- FEATURE-020 shares fonts and canvas.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-053
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- Which fonts to ship (not blocking; open licence only).
- Academic-integrity wording on the page (not blocking; owner choice).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

## Delivery log
| Date | Branch / PR | Delivered | Pending (code) | Pending (non-code) | Notes |
|---|---|---|---|---|---|
| 2026-11-19 | feat/feature-038-text-to-handwriting | AC-1 to AC-4: /text-to-handwriting/ writes typed text (up to 5,000 characters) in Caveat, Dancing Script or Homemade Apple, in black or blue ink, on plain, ruled or squared A4-shaped paper (1240 x 1754 px) in three writing sizes; long text paginates (up to 10 pages) with page buttons; PNG or JPG of the page, a ZIP of all pages, and Resize to KB through the resizer on the page; characters outside the fonts are listed and drawn in a fallback font; the fair-use note (FR-4) | none | owner review of page copy and the fair-use wording (the spec's open academic-integrity wording); decide whether to measure usage | rulings: the three fonts already shipped for FEATURE-020 are reused, so no new dependency and no new licence notice (the page states their licences as the signature maker does); the fonts are declared only on the signature maker and this page (tests/handwriting-build.test.ts); a KB cap is applied to one page at a time through the resizer, the ZIP carries uncapped PNGs; layout is pure (src/lib/handwriting.ts) and measures with the real font in the browser; text lines are not jittered, so it reads as a handwriting font, not as a person's hand (stated on the page). verified: check 0 errors, build 0, verify:html(:strict) OK, verify:privacy OK, 1108 unit pass, e2e handwriting-tool 10/10 on each of chrome, webkit and firefox, axe desktop and mobile on all three; no independent reviewer was used, self-review only |
