---
type: feature-spec
id: FEATURE-041
opportunity: OPP-056
status: implemented
delivery: complete
product_revision: 3
created: 2026-11-18
---

# Indian-language signature fonts


## 1. Feature overview

Add a language and script selector with open-licence Indic fonts to the signature maker (FEATURE-020), as one tool and not one page per language.

## 2. Problem statement

Users want a signature in their own script; autocomplete returns suggestions for "hindi signature maker" and "tamil signature generator". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=hindi+signature+maker; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'Approve all three'). The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-056 (score 60, Needs evidence, Low confidence, effort S). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Indian form applicant** — wants a signature in Hindi, Marathi, Tamil or another script.

## 5. User stories

- As a user, I want to type my name in Hindi and get a handwritten-style signature.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | A language selector offering Hindi, Marathi and Tamil first. | [Approved] |
| FR-2 | Typed names render in handwriting-style fonts of the chosen script. | [Approved] |
| FR-3 | Fonts are open licence (for example SIL OFL) and self-hosted, loaded only when the language is chosen. | [Suggestion] |
| FR-4 | No separate page per language. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

A dropdown on the signature maker page; fonts load on selection.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout. Indic font quality and licence are unchecked. [E: unknown; low; search:none run; 2026-11-18]

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** Hindi selected and a Devanagari name **When** rendered **Then** the signature shows in a Devanagari font. |
| AC-2 | FR-2 | **Given** a language not selected **When** the page loads **Then** its font file is not requested. |
| AC-3 | FR-3 | **Given** a session **When** network requests are logged **Then** none carries user text. |
| AC-4 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** budgets are unchanged. |

## 11. Edge cases

- Mixed scripts → use fallback glyphs and warn.
- Font missing a conjunct → fallback.

## 12. Error and failure scenarios

- Font load failure → fallback font.

## 13. Security and privacy considerations

Processed locally in the browser; no file content leaves the device; no retention; no new trust boundary.

## 14. Out of scope

- Per-language landing pages.
- Transliteration.

## 15. Dependencies

- FEATURE-020.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-056
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- Which fonts to ship (not blocking; open licence only; implementer proposes).
- Which languages after the first three (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

## Delivery log
| Date | Branch / PR | Delivered | Pending (code) | Pending (non-code) | Notes |
|---|---|---|---|---|---|
| 2026-11-19 | feat/feature-041-indian-language-signature-fonts | AC-1 to AC-4: a Language selector in the Type mode of the signature maker (English, Hindi, Marathi, Tamil in that order); Hindi and Marathi draw in Kalam (Devanagari), Tamil in Kavivanar; the chosen font's file is requested only after its language is chosen and text typed (network-tested); a note lists letters from another script and a fallback font draws them; the name box carries the language code; page copy and the fonts FAQ updated; no new page (FR-4) | none | owner review of page copy and of the two font choices; a native-speaker look at how Kalam and Kavivanar render real names (only rendering and the font being applied were tested, not typographic quality); decide whether to measure usage and which languages come next | rulings: fonts are Kalam and Kavivanar, both SIL OFL 1.1, added as @fontsource/kalam and @fontsource/kavivanar 5.3.0 (the same publisher and version as the three fonts already shipped): this is the one new dependency of the run, made because the spec requires self-hosted open-licence fonts and asks the implementer to propose them, so please review it; only the devanagari and tamil subsets are imported (no Latin subset), so Latin letters in an Indian-script name use the fallback and the note says so; the font-face rules are in the signature maker page only and the browser downloads a font file only when text in it is drawn; Indic fonts live in INDIC_FONTS apart from FONTS so the other tools that list FONTS are unchanged. also changed: tests/engine/audit3.test.ts fuzz test got a 60 s timeout (about 2 s alone, 5.7 s under the full parallel suite, over the 5 s default). verified: check 0 errors, build 0, verify:html(:strict) OK, verify:privacy OK, 1118 unit pass, e2e signature-maker 14/14 on each of chrome, webkit and firefox, axe desktop and mobile on all three; no independent reviewer was used, self-review only |
