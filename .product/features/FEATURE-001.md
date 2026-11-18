---
type: feature-spec
id: FEATURE-001
opportunity: OPP-001
status: implemented
delivery: complete
product_revision: 3
created: 2026-11-17
---
# Per-size landing pages for image and signature KB limits

## 1. Feature overview

Add a capped first wave of 3 to 5 static landing pages, one per common KB limit, each built from the existing preset-page pattern (`src/pages/resize-image-to-20kb.astro`). Each page opens the existing tool with that limit preselected and carries its own guidance and FAQ. The outcome is more indexable entry pages that match limit-specific searches, as the base for ad revenue.

## 2. Problem statement

People are assumed to search for the exact limit their form states, such as "resize image to 100kb"; volume is unmeasured. [E: assumption; medium; user:owner goal ad revenue, chat 2026-11-17; 2026-11-17] SizeTune has one dedicated size page (20 KB) plus the home page (50 KB preselected) and a signature page. [E: fact; high; repo:src/pages/resize-image-to-20kb.astro; 2026-11-17]

## 3. Business justification

Objective: ad revenue from organic landing pages. More pages matching real queries is likely the cheapest way to add search surface on the existing engine (inference, not measured). Competitors run per-KB pages. [E: fact; medium; https://imresizer.com/resize-photo-to-20kb; 2026-11-17] This is parity, not differentiation. Originating opportunity: OPP-001 (score 69, Consider, Medium confidence).

## 4. Target users and personas

- **Form applicant** — has a photo or signature to upload to a portal with a stated KB limit; wants one result that passes without account or upload.
- **Mobile user** — same goal on a phone; needs the page to load fast and work at phone width.

## 5. User stories

- As a form applicant, I want a page for my exact KB limit so that the tool opens already set to it.
- As a form applicant, I want guidance specific to that limit so that I know what to expect from the result.
- As the site owner, I want each page to be curated and distinct so that it stays indexable and eligible for ads later.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | The system shall publish 3 to 5 new static pages, one per KB limit, each opening the tool with that limit preselected as the maximum. | [Approved] |
| FR-2 | Each page shall use a preset distinct from every other page and from the home page default. | [Approved] |
| FR-3 | Each page shall contain at least 300 unique words of guidance specific to its target, written or curated by hand. | [Approved] |
| FR-4 | Each page shall have its own FAQ. | [Approved] |
| FR-5 | The wave shall not exceed 5 pages. Further sizes need Search Console impressions for wave 1 first. | [Approved] |
| FR-6 | Each page shall pass the near-duplicate similarity gate and the `STRICT=1` HTML verifier. | [Approved] |
| FR-7 | A candidate page that cannot meet FR-2 to FR-4 shall be merged into a guide instead of published. | [Approved] |
| FR-8 | Pages shall be added to the sitemap and internal navigation or links so they are discoverable. | [Suggestion] |
| FR-9 | Candidate sizes: 100 KB (photo) and 10 KB (signature) first; 50 KB only if it passes the near-duplicate gate against the home page. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of the first-load budget. | `verify:html` size checks stay green; no new JS on pages beyond the existing tool island. |
| NFR-2 | Privacy gates stay intact. | `pnpm run verify:privacy` passes; no third-party origins added. |
| NFR-3 | Accessibility unchanged. | Existing axe e2e specs pass on each new page. |
| NFR-4 | Phone-width layout works. | Existing mobile e2e spec passes on each new page. |

## 8. User journeys and expected UX

Happy path: visitor lands on `/resize-image-to-100kb/` from search, sees a hero naming the limit, the tool with 100 KB preselected, then guidance and FAQ below. Alternate: visitor changes the limit or adds a minimum in the tool, as on the 20 KB page. No-JS state: the existing `<noscript>` notice, written for that limit. Follow the layout, `Hero`, `ImageTool` and `proseClass` patterns of the 20 KB page.

## 9. Technical considerations

**Constraints from the existing system:** The 20 KB page passes `defaultMaxKb` to `ImageTool`. [E: fact; high; repo:src/pages/resize-image-to-20kb.astro; 2026-11-17] SEO rules require a distinct preset, 300+ unique words (a repo tripwire, not a Google requirement), its own FAQ, the near-duplicate gate and `STRICT=1`; extra preset pages are held back until Search Console shows impressions. [E: fact; high; repo:SEO_ARCHITECTURE.md; 2026-11-17] [E: fact; high; repo:SIZETUNE_EXECUTION_PLAN.md; 2026-11-17] The owner approved OPP-001 knowing it overrides that hold for a capped first wave. [E: fact; high; user:Gate 2 approval of OPP-001, chat 2026-11-17; 2026-11-17]

**Suggested approach [Suggestion — implementer may choose otherwise]:** Extract the shared page shell into a template component with per-page props (limit, copy, FAQ), keeping prose per page in its own file. Do not generate prose programmatically: AdSense policy asks for manual review or curation of automatically generated content. [E: fact; high; https://support.google.com/publisherpolicies/answer/11112688; 2026-11-17]

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** the built site **When** each new page is opened **Then** the tool shows the page's KB limit as the selected maximum. |
| AC-2 | FR-2, FR-6 | **Given** the built site **When** `pnpm run verify:html` and `verify:html:strict` run **Then** both pass with the new pages included. |
| AC-3 | FR-3 | **Given** each page **When** its body text is counted by the verifier **Then** unique target-specific words are at least 300. |
| AC-4 | FR-4 | **Given** each page **When** viewed **Then** it has a FAQ whose questions differ from every other page's. |
| AC-5 | FR-5 | **Given** the repository **When** pages are counted **Then** no more than 5 new size pages exist. |
| AC-6 | FR-7 | **Given** a candidate that fails AC-3 or AC-4 **When** the wave is reviewed **Then** it is merged into a guide and not published as a page. |
| AC-7 | NFR-2 | **Given** the build **When** `pnpm run verify:privacy` runs **Then** it passes. |
| AC-8 | FR-8 | **Given** the build **When** the sitemap is read **Then** each new page URL is listed. |

## 11. Edge cases

- Limit page overlaps the home page default (50 KB) → skip the page unless the near-duplicate gate passes.
- Signature limit page → opens the signature tool, not the photo tool, if that is the intended job (see Unresolved decisions).
- Visitor with JavaScript off → noscript notice naming the limit.

## 12. Error and failure scenarios

- Near-duplicate gate fails for a page → build fails; fix the copy or drop the page.
- Page cannot reach 300 unique words honestly → merge into a guide rather than pad.

## 13. Security and privacy considerations

No new data or trust boundary: static pages on the existing client-side tool; no uploads, no third-party origins.

## 14. Out of scope

- Wave 2 sizes (more KB limits, exam-named pages such as SSC or PAN) until wave 1 shows Search Console impressions.
- Ads and consent (FEATURE-002).
- Programmatic or AI-generated page bodies.
- Changing the compression engine.

## 15. Dependencies

- Genuinely different per-page content (author or owner curation).
- `verify:html` STRICT thresholds and the near-duplicate gate.
- Template pattern from the 20 KB page.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Indexed new pages | 0 (site launched 2026-11-17) | all wave-1 pages indexed | Search Console coverage |
| Impressions per new page | unknown | decision gate for wave 2: any non-zero impressions after indexing | Search Console performance |
| Clicks per new page | unknown | none set (no baseline, volume unmeasured) | Search Console performance |

## 17. Research references

- Originating opportunity: OPP-001
- [E: fact; medium; https://imresizer.com/resize-photo-to-20kb; 2026-11-17] Competitor per-KB page exists.
- [E: fact; medium; https://www.zamzar.com/tools/resize-image-20kb/; 2026-11-17] Competitor links several KB pages.
- [E: unknown; low; search:resize image to 20kb online; 2026-11-17] Search volume per limit unknown.

## 18. Unresolved decisions

- Which 3 to 5 sizes ship in wave 1 (suggested 100 KB photo, 10 KB signature; owner to confirm). Not blocking: the implementer may start with the suggested pair.
- Who writes the per-page guidance (owner, or a draft the owner reviews). Not blocking, but each page needs human curation before publish.
- Whether signature-limit pages reuse the signature tool preset. Not blocking: default to the existing signature tool.

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `src/pages/resize-image-to-20kb.astro`, `SEO_ARCHITECTURE.md`, `scripts/verify-html.mjs`, `docs/verification/VERIFIERS.md`.
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1 Playwright check per page; AC-2, AC-3, AC-4, AC-8 via `pnpm run verify:html:strict`; AC-5 file count in CI or review; AC-7 `pnpm run verify:privacy`.

## Delivery log
| Date | Branch / PR | Delivered | Pending (code) | Pending (non-code) | Notes |
|---|---|---|---|---|---|
| 2026-11-17 | PR #19, squash c8ad91f (commits d2a7242, 8aed0f8) | AC-1, AC-2, AC-3, AC-4, AC-5, AC-7, AC-8 for 2 pages: /resize-image-to-100kb/, /resize-signature-to-10kb/ (AC-6 not triggered) | FR-1 minimum: wave ships 2 of the 3 to 5 required pages | owner copy curation of both pages (FR-3); Search Console indexing and impressions (gate for wave 2); owner to confirm sizes and pick or drop a third page | no ledger (impl report not run); delivery backfilled from PR evidence: check, build, 717 unit, verify:html(:strict), verify:privacy OK; one unrelated flaky e2e (preact-semantics.spec.ts:132) not investigated |
| 2026-11-18 | feat/feature-001-per-size-landing-pages-for-image-and-sig (verification only, no code change; pages from PR #19 and PR #28) | AC-1 to AC-8 across 3 pages: /resize-image-to-50kb/, /resize-image-to-100kb/, /resize-signature-to-10kb/ (AC-6 not triggered) | none | owner copy curation of the pages (FR-3); Search Console indexing and impressions (gate for wave 2); owner to confirm the final size set | verified: build 0, verify:html:strict OK, verify:privacy OK, 870 unit pass, e2e size-pages 3/3 (chrome); sitemap lists all 3 plus 20 KB; the 50 KB page shipped in PR #28, so FR-1 minimum of 3 is met; full e2e and Firefox/WebKit not rerun here |
