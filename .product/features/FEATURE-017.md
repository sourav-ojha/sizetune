---
type: feature-spec
id: FEATURE-017
opportunity: OPP-028
status: ready
product_revision: 3
created: 2026-11-17
---

# Text counters and converters


## 1. Feature overview

A text workbench with a word counter, character counter, case converter and dummy-text (filler text) generator, running in the browser, as one distinct page rather than near-identical pages.

## 2. Problem statement

Writers and students count and transform text; autocomplete shows "word counter". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=word+counter; 2026-11-17] (The other tools' phrases come from the research agent's own fetches and were not re-checked.) A competitor name (wordcounter.net) appears in suggestions, which shows a brand exists, not SERP strength; incumbent strength is a hypothesis. [E: hypothesis; low; search:not SERP-checked; 2026-11-17]

## 3. Business justification

Objective: cheap breadth for the portfolio. Owner approved on 2026-11-17 (user: 'Rest can be approved', reply to the portfolio-pass decision sheet). The opportunity is Low confidence; approval does not upgrade the evidence. Originating opportunity: OPP-028 (score 55, Needs evidence, Low confidence, effort S).

## 4. Target users and personas

- **Writer or student** — needs counts or a quick text transform while writing.

## 5. User stories

- As a writer, I want live word and character counts so that I meet a limit.
- As a writer, I want to change text case in one click.
- As a designer, I want filler text of a chosen length.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Word and character counts (with and without spaces), live as the user types. | [Approved] |
| FR-2 | Case converter (upper, lower, title, sentence). | [Approved] |
| FR-3 | Filler text generator with a chosen length. | [Approved] |
| FR-4 | Everything in the browser; text is never sent anywhere. | [Approved] |
| FR-5 | Built as one workbench: One distinct workbench; no per-keyword, per-variant or per-currency pages (review gate for scaled-content and doorway risk). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17] | [Suggestion] |
| FR-6 | Handle non-Latin scripts in counts using Intl.Segmenter where available. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

One page with a text area and tool tabs; counts update live; copy buttons for outputs.

## 9. Technical considerations

**Constraints from the existing system:** static Astro page with a Preact island; no new origins. [E: fact; high; repo:astro.config.mjs; 2026-11-17] Built-in string and Intl APIs suffice. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** text typed or pasted **When** shown **Then** word and character counts update live and match a fixture. |
| AC-2 | FR-2 | **Given** text **When** a case option is chosen **Then** the output follows the option's rule, including accented characters. |
| AC-3 | FR-3 | **Given** a requested length **When** filler text is generated **Then** it has that many words, sentences or characters as chosen. |
| AC-4 | FR-4 | **Given** the page **When** used **Then** no network request carries the text. |
| AC-5 | FR-5 | **Given** the build **When** pages are counted **Then** the tools live on one workbench page. |
| AC-6 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** budgets are unchanged for existing pages. |

## 11. Edge cases

- Very long text → stays responsive.
- Emoji and combining characters → counted by grapheme where Intl.Segmenter exists, with a documented fallback.

## 12. Error and failure scenarios

- Clipboard blocked → message to copy manually.

## 13. Security and privacy considerations

User text is processed locally and not stored.

## 14. Out of scope

- Per-keyword pages.
- Grammar or plagiarism checks.
- Accounts or saved documents.

## 15. Dependencies

- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.
- FEATURE-012 hub and guide template.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Indexed workbench page | none | none set | Search Console |

## 17. Research references

- Originating opportunity: OPP-028
- [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=word+counter; 2026-11-17] Query exists.

## 18. Unresolved decisions

- Wording of the filler text (not blocking; use a neutral public-domain style).
- Whether to measure usage (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `src/components/`, `src/pages/`, `.product/features/FEATURE-012.md`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1 to AC-3 via unit tests; AC-4 network log; AC-5 build check; AC-6 `pnpm run verify:html`.

