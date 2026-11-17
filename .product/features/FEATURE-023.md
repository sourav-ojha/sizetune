---
type: feature-spec
id: FEATURE-023
opportunity: OPP-038
status: ready
product_revision: 3
created: 2026-11-18
---

# Add name and date on a photo


## 1. Feature overview

Add a caption strip with a name and date below or over a photo in the browser, then optionally resize to a KB limit.

## 2. Problem statement

Several exam bodies ask for a photo with the candidate's name and date; autocomplete shows "add name and date on photo for psc" and "add name and date in photo for tnpsc". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=add+name+and+date+on+photo; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'I approve all these - I would add all other as well from the https://image.pi7.org/'). The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-038 (score 68, Needs evidence, Low confidence, effort S). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Exam applicant** — must upload a photo with name and date printed.

## 5. User stories

- As an applicant, I want to print my name and date on my photo so that it meets the exam rules.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Add a caption strip below the photo, or text over the photo, with name and date fields. | [Approved] |
| FR-2 | Controls for font size, colour and strip height. | [Approved] |
| FR-3 | Hand the result to the KB resizer. | [Suggestion] |
| FR-4 | A date field with a calendar picker and a free-text option. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Pick a photo, type name and date, adjust the strip, preview, download or Resize to KB.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout. Exam caption layouts are not verified here, so no exam presets are included; the user adjusts the strip.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a photo, name and date **When** applied **Then** the caption shows below the photo on a strip. |
| AC-2 | FR-2 | **Given** font size changed **When** previewed **Then** the caption updates live. |
| AC-3 | FR-3 | **Given** an export **When** Resize to KB is used **Then** the KB tool opens with the captioned image. |
| AC-4 | FR-4 | **Given** a session **When** network requests are logged **Then** none carries image content. |
| AC-5 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** budgets are unchanged. |

## 11. Edge cases

- Long names → shrink to fit or wrap.
- Non-Latin names → render with a font that supports them or warn.

## 12. Error and failure scenarios

- Font fails to load → fallback font.

## 13. Security and privacy considerations

Processed locally in the browser; no file content leaves the device; no retention; no new trust boundary.

## 14. Out of scope

- Exam-specific presets and compliance rules (OPP-011 deferred).
- Per-exam pages.

## 15. Dependencies

- OPP-022 shares text-on-canvas code.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-038
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- Which exam layouts to support later (not blocking; needs verified exam rules).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

