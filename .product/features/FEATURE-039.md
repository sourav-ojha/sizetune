---
type: feature-spec
id: FEATURE-039
opportunity: OPP-054
status: draft
product_revision: 3
created: 2026-11-18
---

# GIF tools, audio tool and invoice generator


## 1. Feature overview

Three unrelated tool families bundled in one opportunity: GIF maker or compressor, audio trim and convert, and an invoice generator. Draft: it must be split before it can be built.

## 2. Problem statement

pi7 runs separate GIF, audio and invoice sub-sites. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Only the GIF family was checked: autocomplete for "gif compressor" returns "gif compressor to 200kb", "to 500kb" and "to 1mb"; no check was run for audio or invoice. [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=gif+compressor; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'Approve all six'), overriding the relatedness rule and the unresolved items below. The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-054 (score 39, Backlog, Low confidence, effort L). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Casual user** — needs a GIF, an audio clip or an invoice.

## 5. User stories

- As a user, I want a GIF compressed under a size limit.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Treat GIF compression to a KB target first, because it reuses the KB idea. | [Suggestion] |
| FR-2 | Defer audio and invoice until separately scoped. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

One tool per page; no bundle page.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout. GIF encoding and audio need libraries whose licences are unchecked.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** the owner picks one sub-tool **When** a spec for it is written **Then** it follows the standard template. |
| AC-2 | NFR-1 | **Given** other pages **When** loaded **Then** no new library is requested. |

## 11. Edge cases

- Not applicable until split.

## 12. Error and failure scenarios

- Not applicable until split.

## 13. Security and privacy considerations

Not assessed until split.

## 14. Out of scope

- Building all three as one feature.

## 15. Dependencies

- OPP-033 overlap.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-054
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- [BLOCKING] Scope: this covers three unrelated tools; the owner must choose which one to build first so it can be specced on its own.

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

