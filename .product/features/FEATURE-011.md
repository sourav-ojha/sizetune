---
type: feature-spec
id: FEATURE-011
opportunity: OPP-008
status: draft
product_revision: 3
created: 2026-11-17
---

# Passport and visa photo maker with size specs


## 1. Feature overview

A browser-only tool that crops a portrait to a chosen passport or visa specification (pixel size, head position guide, background colour) and meets a KB target. Country and exam presets are suggestions, not yet fixed. This spec is a draft: two blocking decisions (liability stance and background-removal library) must be settled by the owner before implementation.

## 2. Problem statement

Applicants need photos that meet pixel size, head position, background and KB limits; whether SizeTune users need a combined tool is unproven. [E: unknown; low; search:visa passport photo upload file size forum; 2026-11-17]

## 3. Business justification

Objective: high-intent queries adjacent to the existing audience, for ad revenue. imresizer's navigation lists passport and visa tools. [E: fact; medium; https://imresizer.com/resize-photo-to-20kb; 2026-11-17] Visafoto already offers a KB-size option with an acceptance guarantee, which a free tool cannot match. [E: fact; low; https://www.visafoto.com; 2026-11-17] Owner approved this despite its tier (user: 'lets add them, so we ll have more tools in our arsenal', 2026-11-17); the evidence below stays weak and is not upgraded by the approval. Originating opportunity: OPP-008 (score 52, Backlog, Low confidence, effort L).

## 4. Target users and personas

- **Visa or passport applicant** — needs a photo with a required pixel size, background and KB limit, without an account.

## 5. User stories

- As an applicant, I want to crop my photo to a specified size with a guide so that it matches the requirement.
- As an applicant, I want the result under a KB limit so that the portal accepts it.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | A crop tool with a fixed aspect and pixel size from a chosen specification and an on-screen head-position guide. | [Approved] |
| FR-2 | Output meets the chosen KB target using the existing engine. | [Approved] |
| FR-3 | Processing entirely in the browser; no upload. | [Approved] |
| FR-4 | Preset list limited to a small number of specifications (suggested: 3 to 5), each with a primary source and checked date. | [Suggestion] |
| FR-5 | Optional solid background replacement, only if a permissively licensed library or an approach without a model is chosen. | [Suggestion] |
| FR-6 | Clear disclaimer that acceptance by an authority is not guaranteed. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Choose a specification, drop a photo, adjust the crop against the guide, pick a KB target, download. Reuse the existing crop and size-picker patterns.

## 9. Technical considerations

**Constraints from the existing system:** SizeTune already has crop and pixel fields. [E: fact; high; repo:src/components/SignatureTool.tsx; 2026-11-17] A common browser background-removal library is AGPL-3.0 and a common model is non-commercial. [E: fact; medium; https://api.github.com/repos/imgly/background-removal-js; 2026-11-17] Wrong specs create liability (inference). [E: inference; medium; https://www.uniquephoto.com/community/qa/why-can-a-passport-style-photo-pass-the-state-department-photo-tool-but-still-be-rejected-by-uscis-upload; 2026-11-17] OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

**Suggested approach [Suggestion — implementer may choose otherwise]:** ship crop, guide and KB target first (no background removal); add background replacement only after the licence decision.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a portrait and a chosen specification **When** the crop is confirmed **Then** the output has the specification's pixel dimensions. |
| AC-2 | FR-2 | **Given** a feasible KB target **When** processed **Then** the output is at or under the target and the achieved size is shown. |
| AC-3 | FR-3 | **Given** a session **When** network requests are logged **Then** none carries file content. |
| AC-4 | FR-4 | **Given** a preset **When** displayed **Then** it shows a primary source link and checked date. |
| AC-5 | FR-6 | **Given** a result **When** shown **Then** the disclaimer is visible. |
| AC-6 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** existing budgets are unchanged. |

## 11. Edge cases

- Photo with no detectable face → guide still shown; no automatic claim of compliance.
- Low-resolution photo → warning.
- Specification differs by portal → page says to check the authority's current rules.

## 12. Error and failure scenarios

- Decode or memory failure → user-safe engine message.
- Preset becomes outdated → corrected in the preset list.

## 13. Security and privacy considerations

User face photos, which may be identity documents; processed locally only, no retention, no analytics on content. Legal: liability if a spec is wrong; AGPL or non-commercial models excluded unless the owner decides otherwise.

## 14. Out of scope

- Guarantees of acceptance or refunds.
- Automatic face landmark compliance checks.
- Paid tiers or accounts.
- Printing sheets (4x6) unless requested later.

## 15. Dependencies

- Owner decision on liability wording and preset policy.
- Permissive-licence background approach if background replacement is included.
- Real-device test for memory on phones.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Preset accuracy | unverified | every preset has a primary source | reviewer check |
| Indexed passport pages | none | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-008
- [E: fact; low; https://www.visafoto.com; 2026-11-17] Incumbent with KB option and guarantee.
- [E: fact; medium; https://api.github.com/repos/imgly/background-removal-js; 2026-11-17] Licence of a common library.

## 18. Unresolved decisions

- [BLOCKING] Liability stance: which specifications may be offered and what disclaimer wording the owner accepts.
- [BLOCKING] Whether background replacement is in scope and, if so, which permissively licensed approach is acceptable (AGPL excluded unless the owner decides otherwise).
- Which 3 to 5 specifications first (not blocking once the liability stance is set).
- Whether to measure usage (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`, `src/components/SignatureTool.tsx`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1, AC-2 via Playwright e2e and fixtures; AC-3 network log; AC-4 and AC-5 by reviewer; AC-6 `pnpm run verify:html`.

