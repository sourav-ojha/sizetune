---
type: feature-spec
id: FEATURE-016
opportunity: OPP-027
status: ready
product_revision: 3
created: 2026-11-17
---

# Date and time calculators (age, days between dates, timestamp converter)


## 1. Feature overview

A small set of date and time tools in the browser: age calculator, days between dates and a timestamp converter, built as one distinct workbench with its own tabs, not one page per variant.

## 2. Problem statement

Everyday date maths; autocomplete shows "days between dates". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=days+between+dates; 2026-11-17] (The other phrases, age calculator and timestamp converter, come from the research agent's own fetches and were not re-checked.) Large head terms are probably held by giants. [E: unknown; low; search:not checked; 2026-11-17]

## 3. Business justification

Objective: cheap breadth for the portfolio. Owner approved on 2026-11-17 (user: 'Rest can be approved', reply to the portfolio-pass decision sheet). The opportunity is Low confidence; approval does not upgrade the evidence. Originating opportunity: OPP-027 (score 55, Needs evidence, Low confidence, effort S).

## 4. Target users and personas

- **Everyday user** — needs a quick date calculation without ads in the way of the answer.

## 5. User stories

- As a user, I want my exact age from a date of birth so that I can fill a form.
- As a user, I want the days between two dates.
- As a user, I want to convert a Unix timestamp to a date and back.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Age calculator from a date of birth (and an optional as-of date). | [Approved] |
| FR-2 | Days between two dates. | [Approved] |
| FR-3 | Timestamp to date and date to timestamp, with a time zone choice. | [Approved] |
| FR-4 | Everything computed in the browser; no network use. | [Approved] |
| FR-5 | Built as one workbench: One distinct workbench; no per-keyword, per-variant or per-currency pages (review gate for scaled-content and doorway risk). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17] | [Suggestion] |
| FR-6 | Each tool has distinct inputs, outputs and a short explanation. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

One page with tabs or sections for the three tools; clear inputs, instant results, copy buttons.

## 9. Technical considerations

**Constraints from the existing system:** static Astro page with a Preact island; no new origins. [E: fact; high; repo:astro.config.mjs; 2026-11-17] Use built-in date APIs (Intl, Date); no live data needed. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a date of birth and an as-of date **When** calculated **Then** years, months and days are correct, including leap years. |
| AC-2 | FR-2 | **Given** two dates **When** calculated **Then** the difference in days is correct in both orders. |
| AC-3 | FR-3 | **Given** a Unix timestamp **When** converted **Then** the date matches the chosen time zone, and the reverse conversion returns the timestamp. |
| AC-4 | FR-4 | **Given** the page **When** used **Then** no network request carries user input. |
| AC-5 | FR-5 | **Given** the build **When** pages are counted **Then** the three tools live on one workbench page. |
| AC-6 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** budgets are unchanged for existing pages. |

## 11. Edge cases

- Invalid or future dates → clear message.
- Seconds versus milliseconds timestamps → detected or selectable.
- Time zone daylight-saving transitions → handled by Intl.

## 12. Error and failure scenarios

- Empty input → inline hint, no crash.

## 13. Security and privacy considerations

No personal data stored or sent; no new trust boundary.

## 14. Out of scope

- Per-keyword pages.
- Calendar integrations.
- Live data.

## 15. Dependencies

- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.
- FEATURE-012 hub and guide template.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Indexed workbench page | none | none set | Search Console |

## 17. Research references

- Originating opportunity: OPP-027
- [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=days+between+dates; 2026-11-17] Query exists.

## 18. Unresolved decisions

- Whether to split into more than one page later (not blocking; only if each page has distinct content).
- Whether to measure usage (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `src/components/`, `src/pages/`, `astro.config.mjs`, `.product/features/FEATURE-012.md`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1 to AC-3 via unit tests; AC-4 network log; AC-5 build check; AC-6 `pnpm run verify:html`.

