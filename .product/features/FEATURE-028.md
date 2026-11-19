---
type: feature-spec
id: FEATURE-028
opportunity: OPP-043
status: implemented
delivery: complete
product_revision: 3
created: 2026-11-18
---

# Photo effects, borders and logo overlay


## 1. Feature overview

One workbench for borders, black and white, pixel art and a logo overlay, exported under a KB cap.

## 2. Problem statement

Users add frames and effects; autocomplete returns suggestions for "add border to photo online". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=add+border+to+photo+online; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'I approve all these - I would add all other as well from the https://image.pi7.org/'). The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-043 (score 59, Needs evidence, Low confidence, effort M). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Image user** — wants a quick border, effect or logo on a photo.

## 5. User stories

- As a user, I want a border or logo so that my photo looks finished.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Add a coloured or white border of chosen width. | [Approved] |
| FR-2 | Black and white, grayscale and pixel-art effects. | [Approved] |
| FR-3 | Overlay a user-supplied logo with position and size. | [Approved] |
| FR-4 | Export under a KB cap. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Pick image, choose effect tab, adjust, preview, download.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a border width and colour **When** applied **Then** the output grows by that border. |
| AC-2 | FR-2 | **Given** black and white **When** applied **Then** all pixels are grey. |
| AC-3 | FR-3 | **Given** a logo **When** placed **Then** it appears at the chosen position and size. |
| AC-4 | FR-4 | **Given** a session **When** network requests are logged **Then** none carries image content. |
| AC-5 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** budgets are unchanged. |

## 11. Edge cases

- Logo with transparency → keep alpha.
- JPG output → flatten.

## 12. Error and failure scenarios

- Unreadable logo → message.

## 13. Security and privacy considerations

Processed locally in the browser; no file content leaves the device; no retention; no new trust boundary.

## 14. Out of scope

- Filters beyond the listed effects.
- Separate pages per effect.

## 15. Dependencies

- OPP-022 overlap (watermark, grayscale).
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-043
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- Whether to merge with OPP-022 at build time (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

## Delivery log
| Date | Branch / PR | Delivered | Pending (code) | Pending (non-code) | Notes |
|---|---|---|---|---|---|
| 2026-11-18 | feat/feature-028-photo-effects-borders-and-logo-overlay (head 4fb0d11) | AC-1 to AC-5: /photo-effects/ with grayscale, black and white (cut-off slider) and pixel art (pixel size and palette), a border of 0 to 500 px in six colours, an optional logo (corner or centre, 5 to 60% of the width), PNG and JPG download and Resize to KB | none | owner review of page copy; decide whether to merge with the crop workbench (the spec's open question: left as separate pages); decide whether to measure usage | rulings: effects are applied to the photo only, then the border, then the logo on top, so neither keeps an effect; logo position is relative to the whole picture including the border, margin 2% of the shorter side; effects are pure pixel functions in src/lib/effects.ts (the pixel-art step reuses pixelate from the redaction library); the same in-page resizer approach as FEATURE-020 to 027; a border over the 16 MP canvas limit gets a message. verified: check 0 errors, build 0, verify:html(:strict) OK, verify:privacy OK, 1043 unit pass, e2e effects-tool 12/12 on each of chrome, webkit and firefox (6 repeats) incl. downloaded PNG and JPG pixel checks, axe on the page; no independent reviewer was used, self-review only |
