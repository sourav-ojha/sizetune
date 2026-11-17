---
type: feature-spec
id: FEATURE-037
opportunity: OPP-052
status: draft
product_revision: 3
created: 2026-11-18
---

# Photos to video, slideshow, JPG to MP4 and MP4 to JPG


## 1. Feature overview

Make a video from images and extract frames from a video in the browser. Draft: codec and library licences are unresolved.

## 2. Problem statement

Users make videos from photos; autocomplete returns suggestions for "photos to video online". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=photos+to+video+online; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'Approve all six'), overriding the relatedness rule and the unresolved items below. The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-052 (score 43, Backlog, Low confidence, effort L). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Casual user** — wants a slideshow video or a frame from a video.

## 5. User stories

- As a user, I want my photos turned into a video.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Build an MP4 slideshow from images with duration per image. | [Approved] |
| FR-2 | Extract a frame from a video as JPG. | [Approved] |
| FR-3 | No upload of file content. | [Approved] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Add images or a video, set options, create, download.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout. WebCodecs reaches 95.92% of users globally, partial on some mobile browsers; the ffmpeg.wasm core follows LGPL or GPL terms and Mediabunny is MPL-2.0. [E: fact; medium; https://caniuse.com/webcodecs; 2026-11-17] [E: fact; high; https://ffmpegwasm.netlify.app/docs/faq; 2026-11-17]

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** three images **When** a slideshow is made **Then** an MP4 plays them in order. |
| AC-2 | FR-2 | **Given** a video **When** a frame is requested **Then** a JPG of that frame is produced. |
| AC-3 | FR-3 | **Given** a session **When** network requests are logged **Then** none carries file content. |
| AC-4 | NFR-1 | **Given** other pages **When** loaded **Then** no encoder is requested. |

## 11. Edge cases

- Large video → refuse with a limit message.
- Browser without WebCodecs → message.

## 12. Error and failure scenarios

- Encoding failure → message.

## 13. Security and privacy considerations

Processed locally in the browser; no file content leaves the device; no retention; no new trust boundary.

## 14. Out of scope

- Video editing.
- Audio tracks.

## 15. Dependencies

- OPP-033 overlap.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-052
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- [BLOCKING] Encoder choice and licence: WebCodecs only, or a library whose licence the owner accepts after legal review.
- Size limits (not blocking; set after a device test).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

