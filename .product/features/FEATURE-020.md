---
type: feature-spec
id: FEATURE-020
opportunity: OPP-035
status: implemented
delivery: complete
product_revision: 3
created: 2026-11-18
---

# Signature maker (typed or drawn)


## 1. Feature overview

Let a user draw or type a signature in the browser and export a transparent PNG or white-background JPG, with a one-step handoff to the signature resizer.

## 2. Problem statement

Users who have no scanned signature search for a maker; autocomplete shows "signature maker online", "signature maker online jpg" and "signature maker online handwritten". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=signature+maker+online; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'I approve all these - I would add all other as well from the https://image.pi7.org/'). The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-035 (score 63, Needs evidence, Low confidence, effort M). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Form applicant without a scan** — needs a signature image to upload.

## 5. User stories

- As an applicant, I want to draw my signature so that I can upload it.
- As an applicant, I want to type my name in a handwriting font so that I get an image quickly.
- As an applicant, I want the result sent to the signature resizer so that I meet the KB limit.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Draw a signature on a canvas with mouse or touch, with undo and clear. | [Approved] |
| FR-2 | Type a name and choose from a few handwriting fonts. | [Approved] |
| FR-3 | Export PNG (transparent) or JPG (white background). | [Approved] |
| FR-4 | Send the result to the signature resizer without re-picking the file. | [Suggestion] |
| FR-5 | Ship open-licence fonts self-hosted. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Two tabs, Draw and Type; preview on white; Download or Resize to KB.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout. Fonts must be open licence (for example SIL OFL) and self-hosted. A signature the portal rejects as 'typed' is a risk the page should state.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a drawn stroke **When** exported as PNG **Then** the background is transparent and the stroke is visible. |
| AC-2 | FR-2 | **Given** typed text and a font **When** exported as JPG **Then** the text renders on white. |
| AC-3 | FR-3 | **Given** an export **When** Resize to KB is used **Then** the signature resizer opens with that image loaded. |
| AC-4 | FR-4 | **Given** a session **When** network requests are logged **Then** none carries image content. |
| AC-5 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** budgets are unchanged and font files load only on this page. |

## 11. Edge cases

- Very short or empty drawing → export disabled.
- Touch devices → no page scroll while drawing.

## 12. Error and failure scenarios

- Canvas unsupported → message.

## 13. Security and privacy considerations

Processed locally in the browser; no file content leaves the device; no retention; no new trust boundary. A signature is personal; never stored.

## 14. Out of scope

- Digital or legally binding e-signatures.
- Signing PDFs (separate idea).
- Per-form signature pages.

## 15. Dependencies

- Existing signature resizer.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-035
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- Whether typed signatures are acceptable to target portals (not blocking; add a plain note).
- Which fonts to ship (not blocking; implementer proposes open-licence options).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

## Delivery log
| Date | Branch / PR | Delivered | Pending (code) | Pending (non-code) | Notes |
|---|---|---|---|---|---|
| 2026-11-18 | feat/feature-020-signature-maker-typed-or-drawn (commits cd4a836..1e5bede) | AC-1 to AC-5: /signature-maker/ with draw (mouse, pen, touch; undo; clear), type (3 fonts), two inks, PNG (transparent) and JPG (white) download, and Resize to KB | none | owner review of page copy; decide whether to add Indian-language fonts (FEATURE-041); third-party font licence notices if the site publishes them; decide whether to measure usage | rulings: AC-3 is met on the same page, not by opening /resize-signature/: every way to carry an image between pages (sessionStorage, IndexedDB, BroadcastChannel, window.open, a URL) is flagged by verify:privacy and the privacy page promises none is used, so Resize to KB loads the exported JPG into the signature resizer embedded below the maker (SignatureTool gets an optional initialFile prop); fonts: Caveat and Dancing Script (OFL-1.1) and Homemade Apple (Apache-2.0) from @fontsource 5.3.0, latin subset, self-hosted, declared only in this page's HTML (tested); names are limited to 40 Latin characters; the drawing area has no keyboard path, so Type is the accessible alternative and the page says so; no clipboard use. verified: check 0 errors, build 0, verify:html(:strict) OK, verify:privacy OK, 938 unit pass, e2e signature-maker 21/21 on each of chrome, webkit and firefox (3 repeats), axe on the page, existing signature specs pass; no independent reviewer was used, self-review only |
