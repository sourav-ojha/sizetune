---
type: feature-spec
id: FEATURE-012
opportunity: OPP-034
status: ready
product_revision: 3
created: 2026-11-17
---

# Tool hub, per-tool guide template and directory listings


## 1. Feature overview

Add the missing discovery and trust pieces for a multi-tool site: a tool hub page that lists every tool, a reusable per-tool guide section (how it works, FAQ, privacy note), internal links between related tools, and a short list of directories to submit to. Sitemap, About, Privacy and Terms already exist and are out of scope.

## 2. Problem statement

The site has no tool index page and no dedicated contact page (the about page has a contact section); it has a home page, about, privacy, terms, one guide route and a sitemap integration. [E: inference; medium; search:repo pages listing and astro.config.mjs; 2026-11-17] One indie author with 100-plus tools had zero Google clicks for 3 months until thin pages, a canonical error and weak trust signals were fixed. [E: fact; low; https://dev.to/tzhkai/i-spent-3-months-getting-zero-organic-traffic-then-one-fix-brought-40-users-in-24-hours-5a2; 2026-11-17]

## 3. Business justification

Objective: make every current and future tool easier to find and rank, and support ad-network review. The 200-tool author reports directory listings gave small steady referrals and a Domain Rating of 4.1 after 8 months. [E: fact; low; https://dev.to/ezytoolz/i-built-200-free-online-tools-heres-everything-i-learned-in-8-months-4c4h; 2026-11-17] Owner approved on 2026-11-17 (user: 'Rest can be approved', reply to the portfolio-pass decision sheet). The opportunity is Low confidence; approval does not upgrade the evidence. Originating opportunity: OPP-034 (score 67, Needs evidence, Low confidence, effort M).

## 4. Target users and personas

- **Visitor looking for a tool** — lands on one tool and wants to see what else exists.
- **Search engine and ad-network reviewer** — needs clear structure, navigation and useful per-tool content.

## 5. User stories

- As a visitor, I want a page listing all tools so that I can find the one I need.
- As the site owner, I want a repeatable per-tool guide block so that every tool page has useful, distinct content.
- As the site owner, I want a list of directories and where to submit so that link-building starts early.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | A tool hub page listing every tool with a short description and link. | [Approved] |
| FR-2 | A reusable per-tool guide section (how it works, FAQ, privacy note) that tool pages can include. | [Approved] |
| FR-3 | Internal links between related tools. | [Approved] |
| FR-4 | A list of directories to submit the site to (for example AlternativeTo, Toolify, Product Hunt), kept as a document in the repo or `.product` notes; submitting is the owner's action. | [Approved] |
| FR-5 | The hub updates from one tool list, so adding a tool needs one edit. | [Suggestion] |
| FR-6 | Reconcile with FEATURE-001 per-size pages, FEATURE-002 ads and content pages, and the existing guides to avoid duplicate pages. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

A hub page grouped by family (image, PDF, calculators, text). Each tool page ends with the guide section and a 'related tools' list. Follow existing layout and style.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, content collection for guides, `@astrojs/sitemap` already enabled. [E: fact; high; repo:astro.config.mjs; 2026-11-17] OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout. The hub must stay a static page with no new third-party origins.

**Suggested approach [Suggestion — implementer may choose otherwise]:** a single `tools` data file feeding the hub, the navigation and the related-tools block.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** the built site **When** the hub page is opened **Then** every published tool is listed with a working link. |
| AC-2 | FR-2 | **Given** a tool page **When** it includes the guide section **Then** it shows how-it-works, FAQ and privacy note. |
| AC-3 | FR-3 | **Given** a tool page **When** viewed **Then** it links to at least two related tools where they exist. |
| AC-4 | FR-4 | **Given** the repo **When** reviewed **Then** a directory list exists with submission steps. |
| AC-5 | FR-5 | **Given** a new tool added to the tools data **When** the site builds **Then** it appears in the hub and the sitemap without other edits. |
| AC-6 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** existing budgets are unchanged. |

## 11. Edge cases

- Tools that are not yet published must not appear (no 'coming soon' pages).
- A tool with no related tool → block is omitted, not empty.

## 12. Error and failure scenarios

- Broken internal link → caught by the existing link or build checks, otherwise by AC-1.

## 13. Security and privacy considerations

Static content only; no data collected; no new trust boundary.

## 14. Out of scope

- Writing the full per-tool articles (owner or content work).
- Link building and outreach (outside code).
- Contact form or backend.
- Sitemap, About, Privacy, Terms (exist).

## 15. Dependencies

- OPP-004 and FEATURE-002 for ad and content-page conventions.
- FEATURE-001 per-size pages.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Indexed hub and tool pages | unknown | none set until a baseline exists | Search Console |
| Directory listings submitted | 0 | owner's choice | checked list in repo |

## 17. Research references

- Originating opportunity: OPP-034
- [E: fact; low; https://dev.to/ezytoolz/i-built-200-free-online-tools-heres-everything-i-learned-in-8-months-4c4h; 2026-11-17] Directories and link building.

## 18. Unresolved decisions

- Which directories to submit to and when (not blocking; owner action).
- How much per-tool text is enough (not blocking; guidance only, no verified outcome data).
- Whether to add a dedicated contact page (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `astro.config.mjs`, `src/pages/`, `src/content/guides`, `.product/features/FEATURE-001.md`, `.product/features/FEATURE-002.md`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1, AC-3, AC-5 via build output and Playwright; AC-2 by reviewer; AC-4 file check; AC-6 `pnpm run verify:html`.

