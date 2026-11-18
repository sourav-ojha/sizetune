---
type: feature-spec
id: FEATURE-024
opportunity: OPP-039
status: implemented
delivery: complete
product_revision: 3
created: 2026-11-18
---

# Merge photo and signature into one image


## 1. Feature overview

Stack a photo and a signature on one canvas at set sizes and export the result under a KB cap.

## 2. Problem statement

Autocomplete for this exact phrase returned no suggestions, so there is no query evidence; the tool is listed by a competitor only. [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=merge+photo+and+signature+in+one+image; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'I approve all these - I would add all other as well from the https://image.pi7.org/'). The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-039 (score 48, Backlog, Low confidence, effort S). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Form applicant** — must submit photo and signature in one file.

## 5. User stories

- As an applicant, I want my photo and signature in a single image so that a one-file form accepts it.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Place a photo and a signature on one canvas, stacked or side by side. | [Approved] |
| FR-2 | Set output size and a KB cap. | [Approved] |
| FR-3 | Hand the result to the KB resizer. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Add photo, add signature, choose layout, preview, download.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout. Shares canvas code with OPP-041.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a photo and a signature **When** merged **Then** both appear in the chosen layout without overlap. |
| AC-2 | FR-2 | **Given** a KB cap **When** exported **Then** the file is at or under the cap or a message explains why not. |
| AC-3 | FR-3 | **Given** a session **When** network requests are logged **Then** none carries image content. |
| AC-4 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** budgets are unchanged. |

## 11. Edge cases

- Different aspect ratios → fit with padding.
- One image missing → export disabled.

## 12. Error and failure scenarios

- Unreadable file → message.

## 13. Security and privacy considerations

Processed locally in the browser; no file content leaves the device; no retention; no new trust boundary.

## 14. Out of scope

- Per-form pages.
- Automatic signature cleanup (FEATURE-020 may cover drawing).

## 15. Dependencies

- OPP-041 shared code.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-039
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- Whether there is any real demand (not blocking; Search Console after launch is the test; stop if none).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

## Delivery log
| Date | Branch / PR | Delivered | Pending (code) | Pending (non-code) | Notes |
|---|---|---|---|---|---|
| 2026-11-18 | feat/feature-024-merge-photo-and-signature-into-one-image (head 5e7c27c) | AC-1 to AC-4: /merge-photo-and-signature/ with two image slots, stacked or side-by-side layout (no overlap, shapes kept), output width, size limit, live preview, and the merged JPG loaded into the image resizer on the same page | none | owner review of page copy; spec says to stop if there is no real demand, so check Search Console after launch; decide whether to measure usage | rulings: as in FEATURE-020 and FEATURE-023, the KB limit is applied by the image resizer embedded on this page (ImageTool initialFile and defaultMaxKb) because moving an image between pages is blocked by verify:privacy; the photo always goes first (above or left); a white background is drawn behind both pictures; output width 200 to 4,000 px, with a message when photo plus signature would exceed the 16 MP canvas limit. The resizer's own 'not reached' wording is what shows when a limit cannot be met (Chrome and Firefox reach 1 KB on random pixels by shrinking to a few dozen pixels, WebKit misses and says by how much). verified: check 0 errors, build 0, verify:html(:strict) OK, verify:privacy OK, 965 unit pass, e2e merge-tool 9/9 on each of chrome, webkit and firefox (6 repeats), axe on the page; no independent reviewer was used, self-review only |
