---
type: feature-spec
id: FEATURE-027
opportunity: OPP-042
status: implemented
delivery: complete
product_revision: 3
created: 2026-11-18
---

# Pixelate, blur and censor regions


## 1. Feature overview

Draw regions on an image and pixelate, blur or black them out in the browser.

## 2. Problem statement

Users hide parts of an image; autocomplete returns suggestions for "pixelate image online" and "blur face in photo online". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=pixelate+image+online; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'I approve all these - I would add all other as well from the https://image.pi7.org/'). The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-042 (score 59, Needs evidence, Low confidence, effort S). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Image user** — needs to hide part of an image.

## 5. User stories

- As a user, I want to pixelate an area so that it is unreadable.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Draw rectangular or brush regions. | [Approved] |
| FR-2 | Apply pixelate, blur or solid fill with an intensity control. | [Approved] |
| FR-3 | Export with optional KB target. | [Suggestion] |
| FR-4 | State that this is not a guarantee of secure redaction. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Pick an image, draw regions, choose effect, preview, download.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout. Automatic face detection is excluded; a permissive in-browser detector would need a separate decision.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a drawn region **When** pixelate is applied **Then** that area is pixelated and the rest is unchanged. |
| AC-2 | FR-2 | **Given** the black-out option **When** exported **Then** the region is solid with no recoverable detail. |
| AC-3 | FR-3 | **Given** a session **When** network requests are logged **Then** none carries image content. |
| AC-4 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** budgets are unchanged. |

## 11. Edge cases

- Region partly outside image → clamp.
- Very mild blur → warn it may be reversible.

## 12. Error and failure scenarios

- Unreadable image → message.

## 13. Security and privacy considerations

Processed locally in the browser; no file content leaves the device; no retention; no new trust boundary. Weak blur can be reversed; the page must say so.

## 14. Out of scope

- Automatic face detection.
- Video blur.

## 15. Dependencies

- OPP-022 blur overlap.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-042
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- Whether to add face detection later (not blocking; licence check first).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

## Delivery log
| Date | Branch / PR | Delivered | Pending (code) | Pending (non-code) | Notes |
|---|---|---|---|---|---|
| 2026-11-18 | feat/feature-027-pixelate-blur-and-censor-regions (head 6d951ee) | AC-1 to AC-4: /blur-pixelate-censor/ with rectangle and brush regions; pixelate, blur or black out (black or white) with a strength control; Undo and Clear; PNG and JPG download; Resize to KB; the not-guaranteed-redaction warning shown next to the controls and in the page copy | none | owner review of page copy and of the warning wording; face detection is out of scope (spec: licence check first); decide whether to measure usage | rulings: masks are binary, so a black-out pixel is entirely inside or outside a region and no edge pixel keeps the original (unit tests: two different pictures give byte-identical black-out regions; every masked pixel is the fill colour); pixel operations are in src/lib/redact.ts and run on the pixel buffer, not through canvas filters, because ctx.filter is missing in Safari; a new region is applied on top of the previous result and Undo or Clear rebuild from the original; the saved file is a new picture without the original's EXIF; Resize to KB embeds the image resizer on the same page as in FEATURE-020 to 026; the brush and rectangle need a pointer (mouse, pen or finger) and the page says so. verified: check 0 errors, build 0, verify:html(:strict) OK, verify:privacy OK, 1018 unit pass, e2e redact-tool 12/12 on each of chrome, webkit and firefox (5 repeats) incl. downloaded PNG and JPG pixel checks, axe on the page; drawing tested with the mouse only | 
| 2026-11-18 | feat/feature-027-pixelate-blur-and-censor-regions (review fixes) | independent Opus review (read-only, fresh context) before merge: verdict MERGE AFTER FIXES. HIGH finding fixed: pixelate on a brush area (and rectangles with a remainder of 1 on the block grid) left original pixels exactly as they were, because edge squares could hold one masked pixel whose average was itself (reviewer measured 95 of 200 random strokes affected). Pixelate now uses a fixed grid over the whole picture, averages each whole square (masked or not), merges a leftover shorter than half a block into its neighbour so no square is under half a block, and writes only to masked pixels; new unit tests use a black/white checkerboard (any kept pixel is 0 or 255, a block average is about 128) over 200 random strokes and many rectangles, and they fail against the old code; an e2e checks the same in a browser. Also fixed: brush mask tests pixel centres; blur uses 8-bit buffers (a quarter of the memory); the cache of applied regions is compared by identity, not count; a cancelled pointer drops the half-drawn area; transparency test for black out | none | none new | not fixed: very large pictures (16 MP) can still take seconds and a lot of memory for a full-picture blur because the work runs on the main thread and masks are full size; the page already refuses pictures over 16 MP; a Worker and bounding-box masks would be the follow-up |
| 2026-11-18 | feat/feature-027-pixelate-blur-and-censor-regions (second review round) | the same independent reviewer re-verified in a fresh pass: verdict MERGE, confidence medium-high; its re-measurement of about 900 randomised cases (300 brush strokes, 300 rectangles, remainder-1 rectangles, tiny and edge regions, small pictures) found the High finding fixed (one masked pixel equal to its block average by chance, not a leak). Hardening it suggested and applied: the brush mask now covers every pixel the round pen touches at all (radius plus half a pixel diagonal), and the minimum pixelate block is 6 (was 3) so a lone masked pixel cannot be reconstructed from its neighbours | none | none new | not fixed, as stated before: 16 MP full-picture blur runs on the main thread (about 4 s in Node); a Worker and bounding-box masks are the follow-up; transparent-picture tests exist for black out only |
