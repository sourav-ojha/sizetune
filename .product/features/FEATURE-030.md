---
type: feature-spec
id: FEATURE-030
opportunity: OPP-045
status: ready
product_revision: 3
created: 2026-11-18
---

# KB and MB size converter


## 1. Feature overview

A single small converter between bytes, KB, MB and GB tied to size limits, with a link to the resizer.

## 2. Problem statement

Users convert file sizes; autocomplete returns "convert mb to kb" with "pdf" and "photo" variants. [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=convert+mb+to+kb; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'I approve all these - I would add all other as well from the https://image.pi7.org/'). The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-045 (score 57, Needs evidence, Low confidence, effort S). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Form applicant** — wants to know a limit in KB.

## 5. User stories

- As a user, I want to convert 2 MB to KB so that I know the limit.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Convert between B, KB, MB and GB, showing both 1000 and 1024 conventions. | [Approved] |
| FR-2 | A link to the resizer with the KB value filled in. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Two fields and a unit selector; both conventions shown.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** 2 MB **When** converted **Then** the page shows 2000 KB and 2048 KB with the conventions labelled. |
| AC-2 | FR-2 | **Given** a result **When** the resizer link is used **Then** the resizer opens with the KB target set. |
| AC-3 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** budgets are unchanged. |

## 11. Edge cases

- Empty or negative input → no result.
- Very large numbers → no overflow.

## 12. Error and failure scenarios

- Invalid input → inline message.

## 13. Security and privacy considerations

No files involved; no data collected.

## 14. Out of scope

- Per-unit pages.
- Other unit converters.

## 15. Dependencies

- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-045
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- None.

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

