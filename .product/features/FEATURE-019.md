---
type: feature-spec
id: FEATURE-019
opportunity: OPP-031
status: draft
product_revision: 3
created: 2026-11-17
---

# In-browser background remover


## 1. Feature overview

Remove image backgrounds in the browser with a permissively licensed model (for example MODNet via Transformers.js), self-hosted and lazy-loaded. Draft: the model weights' licence, size and quality need owner and legal confirmation before implementation.

## 2. Problem statement

Users remove backgrounds from photos; autocomplete shows "make image background transparent". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=make+image+background+transparent; 2026-11-17] No user statement was gathered. [E: assumption; low; search:no user statement found on background removal needs; 2026-11-17]

## 3. Business justification

Objective: large demand and a link to photo and passport use (OPP-008). Competition is heavy and unchecked. [E: unknown; low; search:not SERP-checked; 2026-11-17] Owner approved on 2026-11-17 (user: 'Rest can be approved', reply to the portfolio-pass decision sheet). The opportunity is Low confidence; approval does not upgrade the evidence. Originating opportunity: OPP-031 (score 56, Needs evidence, Low confidence, effort L).

## 4. Target users and personas

- **Applicant or seller** — needs a plain or transparent background on a photo without uploading it.

## 5. User stories

- As a user, I want my photo's background removed in my browser so that my image stays private.
- As a user, I want a transparent PNG or a solid colour background.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Remove the background of a picked image in the browser. | [Approved] |
| FR-2 | No upload of file content. | [Approved] |
| FR-3 | Output a transparent PNG and an optional solid-colour background. | [Suggestion] |
| FR-4 | Load the model and runtime only on this page, self-hosted, with a progress message. | [Suggestion] |
| FR-5 | State that quality is best for portraits. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Drop an image, press Remove background, see progress, preview on a checkerboard, choose background colour, download.

## 9. Technical considerations

**Constraints from the existing system:** verifiers forbid third-party origins, so the model and runtime must be self-hosted. [E: fact; high; repo:scripts/verify-privacy.mjs; 2026-11-17] Transformers.js is Apache-2.0 and active; Xenova/modnet states Apache-2.0 on its card. [E: fact; high; https://api.github.com/repos/huggingface/transformers.js; 2026-11-17] [E: fact; medium; https://huggingface.co/Xenova/modnet; 2026-11-17] imgly is AGPL and BRIA RMBG-1.4 is non-commercial, so both are excluded. [E: fact; high; https://github.com/imgly/background-removal-js; 2026-11-17] [E: fact; high; https://huggingface.co/briaai/RMBG-1.4; 2026-11-17] ONNX model size and general-object quality are unknown. [E: unknown; low; search:modnet onnx size; 2026-11-17] OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a portrait photo **When** processed **Then** the subject is kept and the background is removed or replaced. |
| AC-2 | FR-2 | **Given** a session **When** network requests are logged **Then** only same-origin requests occur and none carries file content. |
| AC-3 | FR-3 | **Given** a chosen colour **When** exported **Then** the background is that colour; with transparent chosen the PNG has an alpha channel. |
| AC-4 | NFR-1 | **Given** other pages **When** loaded **Then** no model file is requested and `verify:html` budgets are unchanged. |
| AC-5 | NFR-2 | **Given** a low-RAM phone **When** a typical photo is processed **Then** the tab is not killed or a clear limit message appears. |
| AC-6 | NFR-3 | **Given** the model and runtime **When** legal review ends **Then** the owner has recorded accept or reject of their licences. |

## 11. Edge cases

- Non-portrait images → quality warning.
- Very large image → downscale before inference.
- No WebGPU → fall back to WASM, slower, with a note.

## 12. Error and failure scenarios

- Model download fails → retry message.
- Out of memory → message to use a smaller image.

## 13. Security and privacy considerations

Photos may show faces; processed locally; no retention. The model file is a trusted self-hosted asset; verify its hash.

## 14. Out of scope

- Server-side removal.
- Video background removal.
- Face detection or passport compliance.

## 15. Dependencies

- Legal review of model weights and upstream data.
- Real-device memory test.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Quality on a fixture set | unknown | agreed before build | fixtures |

## 17. Research references

- Originating opportunity: OPP-031
- [E: fact; high; https://api.github.com/repos/huggingface/transformers.js; 2026-11-17] Runtime licence.
- [E: fact; high; https://huggingface.co/briaai/RMBG-1.4; 2026-11-17] Non-commercial model excluded.

## 18. Unresolved decisions

- [BLOCKING] Model choice and licence: owner must accept the weights' licence (MODNet upstream and training-data terms) after legal review.
- [BLOCKING] Model download size and mobile memory must fit an agreed budget; unknown today.
- Whether to offer solid-colour backgrounds in the first release (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1 on fixtures; AC-2 network log; AC-3 visual check; AC-4 `verify:html`; AC-5 device test; AC-6 owner record.

