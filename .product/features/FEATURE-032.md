---
type: feature-spec
id: FEATURE-032
opportunity: OPP-047
status: implemented
delivery: complete
product_revision: 3
created: 2026-11-18
---

# More social sizes


## 1. Feature overview

Add WhatsApp DP, YouTube banner and Instagram no-crop presets to the existing social resizers.

## 2. Problem statement

Users resize for social images; autocomplete returns suggestions for "whatsapp dp size" and "youtube banner size". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=whatsapp+dp+size; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'I approve all these - I would add all other as well from the https://image.pi7.org/'). The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-047 (score 53, Backlog, Low confidence, effort S). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Social user** — needs a correctly sized image.

## 5. User stories

- As a user, I want a WhatsApp DP size so that my picture is not cropped badly.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Add WhatsApp DP, YouTube banner and Instagram no-crop (padded) presets. | [Approved] |
| FR-2 | List them on the hub (FEATURE-012) rather than creating thin separate pages. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

New presets in the existing social resizer selector.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout. Platform dimensions must be checked against each platform's current documentation at build time; they are not verified here. [E: unknown; low; search:none; 2026-11-18]

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** the WhatsApp DP preset **When** applied **Then** the output matches the preset's stated pixel size. |
| AC-2 | FR-2 | **Given** Instagram no-crop **When** applied **Then** the whole image is kept with padding. |
| AC-3 | FR-3 | **Given** a session **When** network requests are logged **Then** none carries image content. |
| AC-4 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** budgets are unchanged. |

## 11. Edge cases

- Source smaller than preset → warn about upscaling.

## 12. Error and failure scenarios

- Unreadable image → message.

## 13. Security and privacy considerations

Processed locally in the browser; no file content leaves the device; no retention; no new trust boundary.

## 14. Out of scope

- Other platforms.
- Per-preset landing pages.

## 15. Dependencies

- FEATURE-009 social resizers.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-047
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- Exact dimensions (not blocking; check platform docs at build time).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

## Delivery log
| Date | Branch / PR | Delivered | Pending (code) | Pending (non-code) | Notes |
|---|---|---|---|---|---|
| 2026-11-19 | feat/feature-032-more-social-sizes | AC-1 for the YouTube banner (Channel banner, 2560 x 1440, 6,000 KB default cap, safe-area note, source: YouTube Help channel branding page) on the YouTube resizer; AC-2 Instagram no-crop (Feed photo, whole picture, 1,080 x 1,080, opens in colour-bars mode, leaving it returns to crop); AC-3 no request carries the image; AC-4 budgets unchanged; edge case upscaling flag works for the banner | none in the approved scope | a WhatsApp DP preset, withheld: no official WhatsApp page states a size (the help centre page could not be read and third-party sites disagree at 500, 640 and 192 px); owner decision 2026-11-19, user: 'Ship those two', so it is out of scope until WhatsApp publishes a size or the owner approves an unofficial one; owner review of page copy | rulings: presets stay limited to sizes a platform's own help page states (tests assert there is no WhatsApp preset); the banner source (support.google.com/youtube/answer/10456525) was read on 2026-11-19 and its numbers are checkedOn that date; the spec's FR-2 (list on the hub) is met by the existing resizer pages and the sources guide, no new page was made; a new optional `fit` on a preset sets colour bars only for the no-crop size and does not override the person's choice on other sizes. verified: check 0 errors, build 0, verify:html(:strict) OK, verify:privacy OK, 1122 unit pass, e2e social 25/25 on chrome and firefox and 24/25 on webkit locally: the one webkit failure is an existing 300 KB tight-limit test on the 3840 x 2160 thumbnail that fails the same way on a clean dev checkout on this machine (slow local WebKit), and CI's WebKit runs have passed it; axe on the social pages and sources guide passes on all three; no independent reviewer was used, self-review only |
