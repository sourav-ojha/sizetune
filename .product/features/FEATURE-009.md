---
type: feature-spec
id: FEATURE-009
opportunity: OPP-016
status: implemented
delivery: complete
product_revision: 3
created: 2026-11-17
---

# Social media image resizers (Instagram, LinkedIn, YouTube)


## 1. Feature overview

A small set of preset modes for common social image sizes (crop, pad, blur-background fit) built on the existing engine, in at most 3 to 5 pages, not one page per size. YouTube thumbnails can also use the existing byte target (2 MB on mobile, 50 MB on desktop).

## 2. Problem statement

Creators need images in platform sizes; only a few independent complaints were found (one 2019 thread). [E: fact; low; https://community.adobe.com/questions-712/frustrated-instagram-upload-dimensions-1076234; 2026-11-17] Autocomplete order suggests size-lookup intent more than resizer intent (weak proxy). [E: inference; low; https://suggestqueries.google.com/complete/search?client=firefox&q=linkedin%20banner%20size; 2026-11-17]

## 3. Business justification

Objective: a wider audience and ad topics. Canva, Kapwing and Adobe Express offer free resizers. [E: fact; low; https://www.kapwing.com/resize-image; 2026-11-17] YouTube's byte cap changed within a year, so presets need upkeep. [E: inference; medium; https://blog.youtube/news-and-events/youtube-updates-october-2025/; 2026-11-17] Brand fit with a KB-limit tool is weak. Owner approved this despite its tier (user: 'lets add them, so we ll have more tools in our arsenal', 2026-11-17); the evidence below stays weak and is not upgraded by the approval. Originating opportunity: OPP-016 (score 46, Backlog, Low confidence, effort S).

## 4. Target users and personas

- **Creator posting an image** — needs the right dimensions and file size for a platform without an account.

## 5. User stories

- As a creator, I want to fit my image to a platform's size so that it posts without cropping surprises.
- As the site owner, I want few, well-differentiated pages so that search policy risk stays low.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Preset sizes for Instagram, LinkedIn and YouTube thumbnails with fit modes: crop, pad and blurred background. | [Approved] |
| FR-2 | At most 3 to 5 pages in total; no page per size. | [Approved] |
| FR-3 | Processing entirely in the browser; no upload. | [Approved] |
| FR-4 | Each preset shows its source and a "last checked" date, and a single list of presets is used so updating one place updates all pages. | [Suggestion] |
| FR-5 | Where a platform publishes a byte cap, the existing KB target can be applied. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Pick a preset, choose a fit mode, preview, download. Reuse Dropzone, SizePicker patterns and the existing crop component where it fits.

## 9. Technical considerations

**Constraints from the existing system:** the engine already does crop and pixel sizing. [E: fact; high; repo:src/components/SignatureTool.tsx; 2026-11-17] Third-party platform specs conflict across sources, so presets need a primary source. [E: inference; medium; https://blog.youtube/news-and-events/youtube-updates-october-2025/; 2026-11-17] Many near-identical pages risk Google's doorway and scaled-content policy. [E: fact; high; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17] OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

**Suggested approach [Suggestion — implementer may choose otherwise]:** a data file of presets, three to five pages grouped by platform.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** an image and the Instagram square preset **When** processed with crop mode **Then** the output has the preset's pixel dimensions. |
| AC-2 | FR-1 | **Given** an image with a different aspect ratio **When** processed with pad or blur mode **Then** the full image is visible within the preset dimensions. |
| AC-3 | FR-2 | **Given** the build **When** pages are counted **Then** there are no more than 5 social-resizer pages. |
| AC-4 | FR-3 | **Given** a session **When** network requests are logged **Then** none carries file content. |
| AC-5 | FR-4 | **Given** a preset **When** displayed **Then** it shows a source link and checked date. |
| AC-6 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** budgets are unchanged for existing pages. |

## 11. Edge cases

- Tiny source image → warning about upscaling quality.
- Transparency in PNG → pad mode uses a chosen background.
- Very large source → engine limits apply.

## 12. Error and failure scenarios

- Decode failure → user-safe engine message.
- A preset becomes outdated → fixed by editing the single preset list.

## 13. Security and privacy considerations

Local processing; no retention; no new trust boundary.

## 14. Out of scope

- Per-size pages for every platform size.
- Video or animation resizing.
- Text overlays, templates or design features.
- Scheduling or posting integrations.

## 15. Dependencies

- Engine, crop and picker components.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Indexed social pages | none | none set until a baseline exists | Search Console |
| Preset accuracy | unverified | every preset has a primary source | reviewer check of each preset's source |

## 17. Research references

- Originating opportunity: OPP-016
- [E: fact; medium; https://support.google.com/youtube/answer/72431; 2026-11-17] YouTube thumbnail byte limits.
- [E: fact; high; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17] Doorway and scaled-content policy.

## 18. Unresolved decisions

- Which 3 to 5 pages to ship first (not blocking; suggested Instagram, LinkedIn, YouTube thumbnail).
- Who maintains presets and how often (not blocking; owner decision before launch).
- Whether to measure usage (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`, `src/components/SignatureTool.tsx`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1, AC-2 via Playwright e2e; AC-3 network log; AC-4 by reviewer; AC-5 pages count in build; AC-6 `pnpm run verify:html`.

## Delivery log
| Date | Branch / PR | Delivered | Pending (code) | Pending (non-code) | Notes |
|---|---|---|---|---|---|
| 2026-11-17 | feat/social-resizers (commits 7b16ad2 and the review-fix commit) | AC-1 to AC-6: /instagram-image-resizer/, /linkedin-image-resizer/, /youtube-thumbnail-resizer/ plus a sources guide /guides/social-image-sizes/ (9 presets, each from an official help page read 2026-11-17) | none | owner decision: who maintains the presets and how often (spec section 18); owner review of page copy; Search Console impressions; real-device check of large-photo decode | Deviation: AC-5 source link goes to the on-site sources guide, not the official page, because verify-privacy forbids third-party URLs on tool pages. Left out on purpose: Instagram Stories and profile picture (no size on the official pages read), LinkedIn Page cover (sources disagree), LinkedIn profile photo (no verified page). YouTube default cap 2,000 KB (mobile 2 MB, desktop 50 MB). Crop, pad and blur are new canvas code, not engine options. JPEG output only |
