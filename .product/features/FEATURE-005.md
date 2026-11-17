---
type: feature-spec
id: FEATURE-005
opportunity: OPP-006
status: ready
delivery: partial
product_revision: 3
created: 2026-11-17
---
# Bulk image resize and compress with one ZIP download

## 1. Feature overview

Let a user add several images to the existing image tool, process each to the same target settings (KB limit, optional minimum, size and format options), and download all results as one ZIP with a per-file status. Everything stays in the browser. The outcome is less repetition for users with several documents (photo, signature, ID) and a competitor-parity feature.

## 2. Problem statement

Users with several documents must repeat the flow per file. BUILD_STATUS lists bulk processing as not implemented. [E: fact; high; repo:BUILD_STATUS.md; 2026-11-17] Squoosh's multi-file request (#301) has 115 reactions and was closed in 2020 with a pointer to its CLI. [E: fact; medium; https://github.com/GoogleChromeLabs/squoosh/issues/301; 2026-11-17] A later request (#1406) is open with about 58 reactions. [E: fact; medium; https://github.com/GoogleChromeLabs/squoosh/issues/1406; 2026-11-17] How many SizeTune users need more than one or two files is unknown. [E: unknown; low; search:none run, no analytics; 2026-11-17]

## 3. Business justification

Objective: ad revenue through engagement and parity with competitors. imresizer offers a free 12-image batch. [E: fact; medium; https://imresizer.com/resize-photo-to-20kb; 2026-11-17] Free in-browser bulk tools already exist, so the only unproven gap is per-file KB targeting in a batch. [E: inference; low; https://www.birme.net; 2026-11-17] Originating opportunity: OPP-006 (score 57, Consider, Medium confidence, effort M).

## 4. Target users and personas

- **Multi-document applicant** — has a photo, signature and ID that each need a KB limit; wants one pass and one download.
- **Phone user** — same goal on a low-memory phone; must not crash the tab.

## 5. User stories

- As a multi-document applicant, I want to add several images at once so that I do not repeat the flow for each.
- As a multi-document applicant, I want to see which files met the target so that I know which to re-check.
- As a phone user, I want large batches to be limited or queued so that my browser does not crash.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | The image tool shall accept multiple files in one selection or drop. | [Approved] |
| FR-2 | Files shall be processed through a queue, under memory limits, using the existing engine. | [Approved] |
| FR-3 | The tool shall offer one ZIP download of the results, and show per-file status (reached target, not reached, failed, cancelled). | [Approved] |
| FR-4 | Processing shall stay entirely in the browser; no file content is sent anywhere. | [Approved] |
| FR-5 | The same target settings shall apply to every file in a batch; a single-file session shall behave exactly as today. | [Suggestion] |
| FR-6 | Limits on file count and total bytes, with a clear message when exceeded (initial suggestion: concurrency of 1, a small file cap, to be set after the real-device test). | [Suggestion] |
| FR-7 | Use an MIT-licensed ZIP library (fflate; JSZip only under its MIT option). | [Suggestion] |
| FR-8 | Individual downloads per file remain available. | [Suggestion] |
| FR-9 | Scope is the image tool; the signature tool and any per-file target values are out of scope for this feature. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size for single-file use. | `verify:html` size budget unchanged; the ZIP code loads only when a batch is started. |
| NFR-2 | No third-party origins. | `pnpm run verify:privacy` passes. |
| NFR-3 | Batch does not exhaust phone memory. | Real-device test: batch within the chosen cap completes on an iPhone and a low-RAM Android without a tab kill. |
| NFR-4 | Accessible batch UI. | Axe specs pass; per-file status is announced to screen readers; keyboard operable. |

## 8. User journeys and expected UX

Happy path: user drops 4 images, settings apply to all, a list shows each file with a status as it finishes, a "Download all (ZIP)" button appears when done, and each row also offers its own download. Alternates: user cancels mid-batch (finished files stay downloadable); one file fails (others continue, the failure is listed with the engine's user-safe message). Follow the existing Dropzone, Progress and ResultPanel patterns.

## 9. Technical considerations

**Constraints from the existing system:** The engine uses one module worker with cancellation, a timeout and idle reuse only for sources up to 4 MP; sources above 36 MP get no preview and above 100 MP are refused. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] [E: fact; high; repo:BLOCKERS.md; 2026-11-17] Real phones are untested. [E: fact; high; repo:BLOCKERS.md; 2026-11-17] The Dropzone only accepts JPEG, PNG and WebP. [E: fact; high; repo:src/components/tool/Dropzone.tsx; 2026-11-17] fflate is MIT and runs in browsers. [E: fact; high; https://api.github.com/repos/101arrowz/fflate; 2026-11-17] JSZip is dual-licensed MIT or GPL, so use it under MIT if chosen. [E: fact; high; https://raw.githubusercontent.com/Stuk/jszip/main/LICENSE.markdown; 2026-11-17]

**Suggested approach [Suggestion — implementer may choose otherwise]:** Process files one at a time through the existing engine instance, build the ZIP incrementally, and release each result's memory as soon as it is added. Avoid decoding several large photos at once.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** the image tool **When** the user selects or drops several valid images **Then** all are listed as queued. |
| AC-2 | FR-2 | **Given** a queued batch **When** processing runs **Then** files are processed one after another and each shows a status when done. |
| AC-3 | FR-3 | **Given** a finished batch **When** the user clicks "Download all" **Then** a ZIP is downloaded containing every successfully produced file, each at or under the target where the engine reported success. |
| AC-4 | FR-3 | **Given** a file that cannot reach the target **When** the batch finishes **Then** its row says the target was not reached and shows the achieved size. |
| AC-5 | FR-4 | **Given** a batch run **When** network requests are logged **Then** none carries file content. |
| AC-6 | FR-5 | **Given** a single file **When** processed **Then** behaviour and results match the current tool. |
| AC-7 | FR-6 | **Given** a selection above the cap **When** added **Then** a clear message explains the limit and no processing starts for the excess files. |
| AC-8 | FR-3 | **Given** a running batch **When** the user cancels **Then** processing stops, finished files remain downloadable and the UI shows cancelled for the rest. |
| AC-9 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** the single-file first-load budget is unchanged. |
| AC-10 | NFR-3 | **Given** a real iPhone and a low-RAM Android **When** a batch at the cap runs **Then** the tab is not killed and results are produced. |

## 11. Edge cases

- Mixed valid and invalid files (unsupported type, corrupt) → valid ones process; invalid ones are listed with the reason.
- Duplicate filenames → ZIP names are made unique (for example a numeric suffix).
- HEIC files → still rejected with the existing message (HEIC is deferred, OPP-002).
- Very large photo in a batch → engine limits apply per file and a failure does not stop the others.

## 12. Error and failure scenarios

- Worker fails or times out on one file → that row fails with the engine's user-safe message; the queue continues.
- Out of memory → the batch pauses or stops with a message to try fewer or smaller files; finished files stay downloadable.
- ZIP creation fails → individual downloads remain available and a message explains.

## 13. Security and privacy considerations

Data handled: user images, processed locally; no retention beyond the page session; no new network use. Abuse: very large or many files exhausting memory; mitigated by caps and per-file engine limits. No new trust boundary.

## 14. Out of scope

- Per-file different target settings.
- Signature tool batching.
- HEIC or other new input formats.
- Server-side processing or accounts.
- Format conversion pages (OPP-012).

## 15. Dependencies

- Real-device testing on iOS and low-RAM Android (also gates the cap).
- An MIT-licensed ZIP library.
- Existing engine and Dropzone.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Share of sessions with more than one file | unknown (no analytics) | none set until a baseline exists | needs an analytics decision (not part of this feature) |
| Batch completion without tab crash on test devices | untested | 100% at the chosen cap | AC-10 device test |

## 17. Research references

- Originating opportunity: OPP-006
- [E: fact; medium; https://github.com/GoogleChromeLabs/squoosh/issues/301; 2026-11-17] Squoosh multi-file request.
- [E: fact; medium; https://tinypng.com; 2026-11-17] TinyPNG free batch cap (20 images, 5 MB each).
- [E: fact; low; https://www.birme.net; 2026-11-17] Free in-browser bulk competitor (vendor claim).

## 18. Unresolved decisions

- File-count and total-size cap, and whether the cap differs on phones (not blocking: the implementer proposes after the device test and the owner confirms).
- ZIP library choice (suggested fflate; not blocking).
- Whether to measure batch usage (needs an analytics decision; not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/Dropzone.tsx`, `src/components/tool/ResultPanel.tsx`, `BLOCKERS.md`.
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1 to AC-4, AC-6 to AC-8 via Playwright e2e on the image tool; AC-5 via a network-log test; AC-9 via `pnpm run verify:html`; AC-10 manual on devices.

## Delivery log
| Date | Branch / PR | Delivered | Pending (code) | Pending (non-code) | Notes |
|---|---|---|---|---|---|
| 2026-11-17 | feat/zip-bulk-and-favicon (commits c1fab82 and the review-fix commit) | AC-1 to AC-8 and AC-9 in the browser: several files in one selection or drop form a batch, processed one at a time, per-file status, cancel, caps, individual downloads, one ZIP plus a report; single file unchanged | AC-10 is not code: it needs the device test | AC-10 real-device test (iPhone, low-RAM Android) at the cap; confirm or change the proposed caps (10 files, 60 MB total, in src/components/tool/batch.ts); owner review of copy; analytics decision for usage | Left `ready` because AC-10 is open. ZIP holds only files that reached the target, plus a report; files that missed the target have their own download. Deviation from NFR-1: the build gates forbid dynamic import, so batch and ZIP code ship in the ImageTool chunk on every tool page (about +3.2 KB gzip, 4.2 to 7.4 KB), not loaded on batch start. Two dropped files used to give an 'only the first file' notice; one e2e test was updated to the batch behaviour |
