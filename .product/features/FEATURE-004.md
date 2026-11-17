---
type: feature-spec
id: FEATURE-004
opportunity: OPP-002
status: superseded
product_revision: 3
created: 2026-11-17
---
# HEIC input converted in the browser

## 1. Feature overview

Let users bring HEIC photos to SizeTune: size the real problem on iPhone first, then decode HEIC client-side (lazy-loaded, only when a HEIC file is picked), run the existing resize pipeline, and output JPEG. Optionally add a standalone "HEIC to JPG" page.

## 2. Problem statement

SizeTune detects HEIC and rejects it. [E: fact; high; repo:src/lib/engine/sniff.ts; 2026-11-17] The picker only offers JPEG, PNG and WebP, and iOS often hands over a converted JPEG in that case, so how many users hit a dead end is unknown and untested on real iPhones. [E: fact; high; repo:src/components/tool/Dropzone.tsx; 2026-11-17] [E: unknown; low; search:iOS Photos picker HEIC to JPEG automatic conversion when accept is image/jpeg; 2026-11-17]

## 3. Business justification

Removes a possible dead end for iPhone users and adds a high-intent query page for ad traffic. imresizer lists HEIC among accepted formats. [E: fact; medium; https://imresizer.com/resize-photo-to-20kb; 2026-11-17] Originating opportunity: OPP-002 (score 61, Needs evidence, Low confidence, effort M).

## 4. Target users and personas

- **iPhone user** — photo is HEIC; wants to upload it to a form and needs a JPEG under a KB limit.

## 5. User stories

- As an iPhone user, I want to select a HEIC photo so that I get a resized JPEG without converting it elsewhere.
- As the site owner, I want to know whether the problem is real before spending on a decoder.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Step 0 (validation): test HEIC from the iPhone Photos picker, the Files app and drag-and-drop on a real device or simulator, and record what the tool receives. | [Approved] |
| FR-2 | Decoding shall run in the browser; HEIC files shall not be uploaded. | [Approved] |
| FR-3 | The decoder shall load only when a HEIC file is picked. | [Approved] |
| FR-4 | A decoded HEIC shall go through the existing resize pipeline and be output as JPEG. | [Approved] |
| FR-5 | The decoder licence shall pass legal review before any build. | [Approved] |
| FR-6 | Optional standalone "HEIC to JPG" page, the stronger search angle if the in-tool problem is small. | [Suggestion] |
| FR-7 | Set a decoded-pixel and file-size limit for phones, with a clear message when exceeded. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | The decoder does not affect first load. | Existing first-load budget (39 KB) unchanged; decoder fetched only on HEIC pick. [E: fact; high; repo:BLOCKERS.md; 2026-11-17] |
| NFR-2 | No third-party origins. | `verify:privacy` passes; decoder is self-hosted. |
| NFR-3 | No crash on low-memory phones. | Limit enforced (FR-7); real-device test passes. |

## 8. User journeys and expected UX

Pick a HEIC photo; the tool shows a short "converting" state, then continues exactly as for a JPEG. A HEIC file over the limit shows a message and no processing. Reuse existing Dropzone and error patterns (`src/components/tool/errors.ts`).

## 9. Technical considerations

**Constraints from the existing system:** `sniff.ts` rejects HEIC and `Dropzone.tsx` restricts `accept`; both change only if Step 0 shows a real gap. [E: fact; high; repo:src/lib/engine/sniff.ts; 2026-11-17] heic2any is MIT, last published 2023-03, and its bundled decoder licence is unverified; libheif-js is LGPL and bundling WASM into one file may conflict with LGPL terms. [E: fact; medium; https://github.com/alexcorvi/heic2any; 2026-11-17] Real-device behaviour is untested. [E: fact; high; repo:BLOCKERS.md; 2026-11-17]

**Suggested approach [Suggestion — implementer may choose otherwise]:** Dynamic import of the decoder in a Worker; self-host the WASM; keep it separate from the main bundle.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** an iPhone or simulator **When** HEIC is selected via Photos picker, Files and drag-and-drop **Then** the results are recorded in a test note before any decoder work. |
| AC-2 | FR-5 | **Given** a decoder candidate **When** the licence review ends **Then** the owner has recorded accept or reject. |
| AC-3 | FR-2 | **Given** a HEIC file **When** processed **Then** no network request carries file content. |
| AC-4 | FR-3 | **Given** a normal JPEG session **When** the page loads and a JPEG is processed **Then** no decoder file is requested. |
| AC-5 | FR-4 | **Given** a valid HEIC **When** processed with a feasible target **Then** the output is a JPEG at or under the target. |
| AC-6 | FR-7 | **Given** a HEIC above the limit **When** selected **Then** a clear message appears and no decode starts. |

## 11. Edge cases

- HEIC with alpha or burst/live-photo container → use primary image; document behaviour.
- HEIF with an unsupported codec → clear error.
- Misnamed file (a JPEG named .heic) → sniffer decides by content, as today.

## 12. Error and failure scenarios

- Decoder fails to load (offline) → message to retry; tool otherwise unaffected.
- Decode out of memory → message to use a smaller photo; page stays usable.

## 13. Security and privacy considerations

Data: user photos, processed locally, no retention. Abuse: malformed HEIC files against a WASM decoder; run in a Worker with size limits. Legal: LGPL or unknown bundled decoder licence (blocking until reviewed).

## 14. Out of scope

- Other formats (AVIF, TIFF, RAW).
- Server-side conversion.
- Changes to the compression engine's search.

## 15. Dependencies

- Real-device or simulator test (Step 0).
- Legal check of the decoder.
- Limits policy for decoded pixels.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| HEIC rejected-file rate | unknown (no analytics) | none set until baseline exists | Step 0 test; optional analytics decision |
| HEIC pages' Search Console impressions (if FR-6) | not published | set after publishing | Search Console |

## 17. Research references

- Originating opportunity: OPP-002
- [E: fact; high; repo:src/components/tool/Dropzone.tsx; 2026-11-17] Picker restricts type.
- [E: fact; medium; https://github.com/alexcorvi/heic2any; 2026-11-17] Candidate decoder.

## 18. Unresolved decisions

- [BLOCKING] Decoder choice and licence acceptance (heic2any vs libheif-js), pending legal review.
- [BLOCKING] Result of Step 0: whether the in-tool problem is real; if small, go to the standalone HEIC-to-JPG page (FR-6) or stop.
- Maximum decoded pixel count and file size for phones (not blocking; implementer proposes, owner confirms).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `src/lib/engine/sniff.ts`, `src/components/tool/Dropzone.tsx`, `src/components/tool/errors.ts`, `BLOCKERS.md`, `docs/engine/ENGINE.md`.
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1 manual device test note; AC-2 owner record; AC-3, AC-4 Playwright network log; AC-5, AC-6 engine fixtures and e2e.
