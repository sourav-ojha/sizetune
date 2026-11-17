---
type: feature-spec
id: FEATURE-031
opportunity: OPP-046
status: ready
product_revision: 3
created: 2026-11-18
---

# AVIF and JFIF to JPG converters


## 1. Feature overview

Extend the converter workbench with AVIF and JFIF input.

## 2. Problem statement

Users convert newer formats; autocomplete returns suggestions for "avif to jpg" and "jfif to jpg". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=avif+to+jpg; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'I approve all these - I would add all other as well from the https://image.pi7.org/'). The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-046 (score 63, Needs evidence, Low confidence, effort S). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Image user** — has an AVIF or JFIF file a portal will not accept.

## 5. User stories

- As a user, I want AVIF turned into JPG so that I can upload it.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Accept AVIF and JFIF input and output JPG (and PNG). | [Approved] |
| FR-2 | Report when the browser cannot decode AVIF. | [Approved] |
| FR-3 | Reuse the shipped converters workbench. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Same as the existing converters page, with new accepted types.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout. The engine rejected AVIF previously, so decoding goes through the browser or a self-hosted decoder; decide by test. [E: fact; medium; repo:.product/attention.md; 2026-11-17] HEIC stays deferred (OPP-002).

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** an AVIF file in a browser that decodes AVIF **When** converted **Then** a JPG is produced. |
| AC-2 | FR-2 | **Given** a browser that cannot decode AVIF **When** used **Then** a clear message appears. |
| AC-3 | FR-3 | **Given** a JFIF file **When** converted **Then** a JPG is produced. |
| AC-4 | FR-4 | **Given** a session **When** network requests are logged **Then** none carries image content. |
| AC-5 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** budgets are unchanged. |

## 11. Edge cases

- Animated AVIF → first frame with a note.
- Large file → warn.

## 12. Error and failure scenarios

- Decode failure → message.

## 13. Security and privacy considerations

Processed locally in the browser; no file content leaves the device; no retention; no new trust boundary.

## 14. Out of scope

- HEIC (OPP-002).
- PNG to ICO (OPP-017).

## 15. Dependencies

- FEATURE-006 converters.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-046
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- Whether to ship a self-hosted AVIF decoder for older browsers (not blocking; decide after browser tests).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

