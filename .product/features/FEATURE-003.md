---
type: feature-spec
id: FEATURE-003
opportunity: OPP-003
status: ready
delivery: partial
product_revision: 3
created: 2026-11-17
---
# Client-side PDF compression to a target KB

## 1. Feature overview

A "compress PDF to N KB" tool that runs entirely in the browser: render or recompress embedded images, rebuild the PDF, and report honestly whether the target was reached. Because demand is unproven and a library licence is unresolved, delivery starts with a demand-validation step before the tool is built.

## 2. Problem statement

Portals that cap PDF upload size are assumed, not evidenced; no user statement about PDF limits was found. [E: hypothesis; low; user:no evidence found, chat 2026-11-17; 2026-11-17] Large incumbents gate large files behind accounts and paid plans. [E: fact; medium; https://www.ilovepdf.com/blog/ilovepdf-15-years-anniversary-milestones; 2026-11-17]

## 3. Business justification

Objective: broaden sizetune.com with client-side tools for ad revenue. PDF compression may have larger demand than image-to-KB queries; this is unquantified. [E: assumption; low; user:owner direction in PRODUCT.md, chat 2026-11-17; 2026-11-17] Client-side compress-to-KB tools already exist, so client-side processing is not a moat. [E: fact; medium; https://www.bentopdf.com/compress-pdf-to-200kb; 2026-11-17] Originating opportunity: OPP-003 (score 63, Needs evidence, Low confidence, effort L).

## 4. Target users and personas

- **Form applicant with a PDF** — a document must fit a KB limit; wants no upload and no account.

## 5. User stories

- As a form applicant, I want to compress my PDF to a stated size in my browser so that my document never leaves my device.
- As the site owner, I want evidence of demand before the large build so that effort is not wasted.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Phase 0 (validation): publish one or two PDF-size explainer pages (for example 100 KB and 200 KB) with no tool, and read Search Console impressions before Phase 1. | [Approved] |
| FR-2 | The tool shall process the PDF entirely in the browser, with no upload. | [Approved] |
| FR-3 | The tool shall reduce a PDF toward a user-chosen KB target and report whether it was reached. | [Approved] |
| FR-4 | The PDF library shall be permissively licensed (for example MIT or Apache-2.0); AGPL libraries such as mupdf.js are excluded (owner decision 2026-11-17). The implementer shall confirm the licence text of the chosen library. | [Approved] |
| FR-5 | Phase 1 builds the tool only if Phase 0 shows demand and a permissive library can recompress images to hit KB targets; otherwise the PDF tool is dropped and only the explainer pages remain. | [Approved] |
| FR-6 | Cap input size and page count, with a clear message when exceeded, for low-memory phones. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | Tool code loads only on the PDF page. | Existing image pages' first-load budget unchanged (`verify:html`). |
| NFR-2 | No third-party origins at runtime. | `verify:privacy` passes. |
| NFR-3 | Accessibility matches the image tool. | Axe specs pass on the new page. |

## 8. User journeys and expected UX

Phase 0: explainer page with honest advice on reducing a PDF to the target size, linking to the existing image tool where relevant. Phase 1 (if approved): pick a PDF, choose a target, see progress, get a result with achieved size and a statement if the target was not reachable. Reuse patterns of `ImageTool` (Dropzone, SizePicker, ResultPanel).

## 9. Technical considerations

**Constraints from the existing system:** The image engine runs in a Web Worker with an engine contract; a PDF engine needs its own contract. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Verifiers assume images and forbid third-party origins. [E: fact; high; repo:scripts/verify-privacy.mjs; 2026-11-17] mupdf.js is AGPL-3.0 unless a paid Artifex commercial licence is bought. [E: fact; high; https://github.com/ArtifexSoftware/mupdf.js; 2026-11-17] pdf-lib is MIT with no recent release; whether it can recompress images is unverified. [E: inference; low; ref:OPP-003 risks; 2026-11-17]

**Suggested approach [Suggestion — implementer may choose otherwise]:** Prefer a permissively licensed library if it can recompress images; otherwise raise the licence decision with the owner. Build after the multi-tool basics exist; OPP-005 (platform note) applies once a second tool is committed.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** Phase 0 **When** the explainer pages are live **Then** they are indexed and Search Console impressions are read and recorded before any tool work. |
| AC-2 | FR-4 | **Given** a library candidate **When** it is chosen **Then** its licence is permissive, the licence text is recorded in the spec or PR, and no AGPL code is in the bundle. |
| AC-3 | FR-2 | **Given** the Phase 1 tool **When** a PDF is processed **Then** no network request carries file content. |
| AC-4 | FR-3 | **Given** a PDF whose images can be recompressed **When** the tool runs with a feasible target **Then** the result is at or under the target and the UI shows the achieved size. |
| AC-5 | FR-3 | **Given** a PDF that cannot reach the target **When** the tool finishes **Then** the UI says the target was not reached and shows the smallest achieved size. |
| AC-6 | FR-6 | **Given** a file above the cap **When** selected **Then** a clear message appears and no processing starts. |

## 11. Edge cases

- Encrypted or password-protected PDF → clear refusal message.
- Text-only PDF with no images → report that little reduction is possible.
- Scanned PDF → rasterised recompression; quality warning.
- Very large file on a low-memory phone → capped (FR-6).

## 12. Error and failure scenarios

- Corrupt or unreadable PDF → error naming the problem, no crash.
- Out-of-memory in the worker → message suggesting a smaller file; page stays usable.

## 13. Security and privacy considerations

Data: the user's PDF, which may be an ID or financial document; processed locally only. No retention. Abuse: malformed PDFs targeting the parser; run in a Worker and cap size. Legal: AGPL libraries are excluded by FR-4.

## 14. Out of scope

- Other PDF tools (merge, split, convert).
- Server-side processing.
- Accounts or paid tiers.

## 15. Dependencies

- Permissive-licence library that can recompress images (to be proven).
- PDF engine choice.
- OPP-005 platform work once a second tool is committed.
- Phase 0 demand evidence.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Impressions on PDF explainer pages | none (not published) | non-zero before Phase 1 starts | Search Console |
| Share of test PDFs reaching target | unknown | set after library choice | engine test fixtures |

## 17. Research references

- Originating opportunity: OPP-003
- [E: fact; medium; https://www.bentopdf.com/compress-pdf-to-200kb; 2026-11-17] Client-side competitor exists.
- [E: unknown; low; search:compress pdf to 100kb search volume; 2026-11-17] Demand for target-KB PDFs not measured.

## 18. Unresolved decisions

- Resolved 2026-11-17: permissive library only; AGPL excluded (owner choice at the blocker walk-through). The implementer must show a permissive library can recompress images; if none can, Phase 1 is dropped.
- Phase 1 go or no-go is a defined gate after Phase 0 impressions are read (FR-5), not an open blocker; Phase 0 can start now.
- Where the tool lives (subpath or subdomain). Unresearched; decide before Phase 1. [E: unknown; low; search:none run on subdomain versus subdirectory ranking; 2026-11-17]

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `scripts/verify-privacy.mjs`.
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1 Search Console readout; AC-2 owner decision record; AC-3 Playwright network log; AC-4 to AC-6 engine fixtures and e2e.

## Delivery log
| Date | Branch / PR | Delivered | Pending (code) | Pending (non-code) | Notes |
|---|---|---|---|---|---|
| 2026-11-17 | PR #19, squash c8ad91f (commits d2a7242, 8aed0f8) | FR-1 pages only: /guides/reduce-pdf-to-100kb/ and /guides/reduce-pdf-to-200kb/ (no tool) | AC-2 to AC-6 (Phase 1 tool; gated by FR-5) | AC-1 readout: indexing and Search Console impressions for both guides; Phase 1 go/no-go; permissive PDF library proof; tool location decision | Phase 0 only; no tool, library or engine code added |
