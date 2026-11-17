---
type: feature-spec
id: FEATURE-010
opportunity: OPP-017
status: ready
product_revision: 3
created: 2026-11-17
---

# Favicon and app icon generator


## 1. Feature overview

One client-side tool with favicon and app-icon modes: from one source image, produce an ICO, a PNG set, a web manifest and a ZIP. A single tool, not two near-duplicate pages.

## 2. Problem statement

Developers and designers need icon sets from one image; free tools and CLIs already do this. [E: fact; medium; https://github.com/ionic-team/capacitor-assets; 2026-11-17] No user-problem evidence was found for a standalone tool. [E: unknown; low; search:favicon generator user complaints; 2026-11-17]

## 3. Business justification

Objective: add a tool with steady search interest for ad revenue. "favicon generator" appears in autocomplete. [E: inference; low; https://suggestqueries.google.com/complete/search?client=firefox&q=favicon+generator; 2026-11-17] realfavicongenerator.net leads (Semrush estimate of 556,300 visits in September 2026, low confidence). [E: inference; low; https://de.semrush.com/website/realfavicongenerator.net/overview/; 2026-11-17] The developer audience may block ads heavily (vendor claim; no RPM found). [E: fact; low; https://carbonads.net/blog/developer-advertising-guide-2026; 2026-11-17] Owner approved this despite its tier (user: 'lets add them, so we ll have more tools in our arsenal', 2026-11-17); the evidence below stays weak and is not upgraded by the approval. Originating opportunity: OPP-017 (score 49, Backlog, Low confidence, effort M).

## 4. Target users and personas

- **Developer or designer** — has one logo and needs favicon and app icons for a site or app, without installing a CLI.

## 5. User stories

- As a developer, I want to drop one image and get a favicon set so that I can paste it into my site.
- As a developer, I want a ZIP of all sizes and a manifest snippet so that setup is one step.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Accept one source image and produce a favicon set (ICO and PNG sizes) and app-icon mode outputs, in the browser. | [Approved] |
| FR-2 | Produce a web manifest and download everything as one ZIP. | [Approved] |
| FR-3 | One tool with two modes; not separate near-duplicate pages. | [Approved] |
| FR-4 | No upload of file content. | [Approved] |
| FR-5 | Use an MIT-licensed ZIP library (fflate); share it with FEATURE-005 if both ship. | [Suggestion] |
| FR-6 | Warn when the source is smaller than 512 px or not square; offer a pad or crop. | [Suggestion] |
| FR-7 | Size list follows primary platform guidance (Apple, Android, web manifest) with a source note; Apple's guidance specifies a 1024 px layout and says the system scales down. [E: inference; medium; https://developer.apple.com/design/human-interface-guidelines/app-icons.md; 2026-11-17] | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Drop a square image, choose Favicon or App icon mode, see previews of each size, download a ZIP with a short "how to add to your site" snippet.

## 9. Technical considerations

**Constraints from the existing system:** the engine resizes raster images in a worker; ICO encoding and adaptive-icon or Apple variants are new work. [E: inference; low; https://github.com/101arrowz/fflate; 2026-11-17] fflate is MIT. [E: fact; high; https://api.github.com/repos/101arrowz/fflate; 2026-11-17] OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

**Suggested approach [Suggestion — implementer may choose otherwise]:** encode PNGs with the existing path, assemble ICO by hand (PNG-in-ICO), build the ZIP lazily.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a square 1024 px PNG **When** processed in favicon mode **Then** an ICO and the PNG sizes in the size list are produced. |
| AC-2 | FR-2 | **Given** a processed set **When** the user clicks download **Then** a ZIP contains all files and a valid manifest. |
| AC-3 | FR-3 | **Given** the build **When** pages are counted **Then** favicon and app-icon are modes of one tool. |
| AC-4 | FR-4 | **Given** a session **When** network requests are logged **Then** none carries file content. |
| AC-5 | FR-6 | **Given** a non-square or small source **When** loaded **Then** a warning is shown and a fix option is offered. |
| AC-6 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** existing budgets are unchanged; ZIP code loads only on this page. |

## 11. Edge cases

- Transparent PNG source → transparency preserved in PNG outputs.
- SVG source → not accepted unless the picker supports it (out of scope).
- Very large source → engine limits apply.

## 12. Error and failure scenarios

- ICO encode failure → message and the PNG outputs remain downloadable.
- ZIP failure → individual file downloads remain.

## 13. Security and privacy considerations

Local processing; no retention; no new trust boundary.

## 14. Out of scope

- SVG input.
- Native app project integration (Xcode, Android Studio).
- Hosted icon CDN or accounts.
- Image editing or logo creation.

## 15. Dependencies

- Engine and picker components.
- fflate (MIT) or another MIT ZIP library.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Indexed favicon page | none | none set until a baseline exists | Search Console |
| Tool completions | unknown (no analytics) | none set | needs an analytics decision |

## 17. Research references

- Originating opportunity: OPP-017
- [E: fact; medium; https://github.com/ionic-team/capacitor-assets; 2026-11-17] Existing CLI.
- [E: fact; high; https://api.github.com/repos/101arrowz/fflate; 2026-11-17] ZIP library licence.

## 18. Unresolved decisions

- Exact size list for the first release (not blocking; implementer proposes from primary guidance and owner confirms).
- Whether to support SVG source later (not blocking; out of scope now).
- Whether to measure usage (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1, AC-2, AC-5 via Playwright e2e and fixtures; AC-3 build check; AC-4 network log; AC-6 `pnpm run verify:html`.

