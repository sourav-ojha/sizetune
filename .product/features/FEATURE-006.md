---
type: feature-spec
id: FEATURE-006
opportunity: OPP-012
status: ready
product_revision: 3
created: 2026-11-17
---

# Client-side image format converter pages (WebP and PNG to JPG)


## 1. Feature overview

Add a small set of converter pages, such as "WebP to JPG" and "PNG to JPG", that reuse the existing in-browser engine for the formats it already accepts and outputs (JPEG, PNG, WebP). No upload; each page links into the KB resizer. Bulk conversion is a later add-on that depends on FEATURE-005.

## 2. Problem statement

Portals are assumed to accept JPG only, so applicants would need a conversion; this is an assumption with no user evidence. [E: assumption; low; user:none found, owner direction to broaden tools; 2026-11-17] SizeTune accepts and outputs JPEG, PNG and WebP but has no dedicated converter pages. [E: fact; high; repo:src/components/tool/Dropzone.tsx; 2026-11-17] The engine detects and rejects AVIF. [E: fact; high; repo:src/lib/engine/sniff.ts; 2026-11-17]

## 3. Business justification

Objective: more entry pages and a first step toward a multi-tool site for ad revenue. iLoveIMG ranks first for "webp to jpg" at an estimated 201K searches in India (Semrush estimate). [E: inference; low; https://www.semrush.com/website/iloveimg.com/overview/; 2026-11-17] Competition is extreme; no differentiation beyond no-upload, which is common. Owner approved this despite its tier (user: 'lets add them, so we ll have more tools in our arsenal', 2026-11-17); the evidence below stays weak and is not upgraded by the approval. Originating opportunity: OPP-012 (score 57, Needs evidence, Low confidence, effort S).

## 4. Target users and personas

- **Applicant with the wrong format** — has a WebP or PNG and needs a JPG for a form; wants no upload and no account.

## 5. User stories

- As an applicant, I want to turn my WebP or PNG into a JPG in my browser so that a form accepts it.
- As the site owner, I want these pages to link into the KB resizer so that users continue to the main tool.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Converter pages for formats the engine already supports (at least WebP to JPG and PNG to JPG), each processing entirely in the browser. | [Approved] |
| FR-2 | Pages reuse the existing engine and picker components; no new codec. | [Approved] |
| FR-3 | No upload of file content. | [Approved] |
| FR-4 | Each page offers a clear next step into the KB resizer. | [Suggestion] |
| FR-5 | Each page has distinct, useful content (what changes, when quality is lost, what to do if the portal still rejects the file), written to avoid thin or doorway pages. | [Suggestion] |
| FR-6 | Keep the page count small (suggested: 2 to 4) until indexing is observed. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

User opens a converter page, drops a file, picks nothing else (output fixed by the page), and downloads the converted file with the size shown. Reuse Dropzone, Progress and ResultPanel patterns. A wrong input type shows the existing unsupported-file message.

## 9. Technical considerations

**Constraints from the existing system:** the engine decodes JPEG, PNG and WebP and outputs the same three; AVIF and HEIC are rejected. [E: fact; high; repo:src/components/tool/FormatPicker.tsx; 2026-11-17] PNG with transparency converted to JPG needs a background colour decision (see unresolved). OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

**Suggested approach [Suggestion — implementer may choose otherwise]:** static Astro pages that mount the existing tool with the output format fixed and the KB target optional.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a valid WebP **When** processed on the WebP to JPG page **Then** a JPEG is downloaded that opens correctly. |
| AC-2 | FR-1 | **Given** a valid PNG **When** processed on the PNG to JPG page **Then** a JPEG is downloaded. |
| AC-3 | FR-3 | **Given** a conversion **When** network requests are logged **Then** none carries file content. |
| AC-4 | FR-4 | **Given** a result **When** shown **Then** the page offers a link into the KB resizer. |
| AC-5 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** existing pages' budgets are unchanged and new pages are within budget. |
| AC-6 | FR-5 | **Given** each new page **When** reviewed **Then** it has content distinct from the other converter pages. |

## 11. Edge cases

- PNG with transparency → flattened onto a documented background (default white).
- Animated WebP or PNG → first frame only; page says so.
- HEIC or AVIF input → existing rejection message.

## 12. Error and failure scenarios

- Decode failure → user-safe message from the engine; page stays usable.
- Very large image → engine limits apply with the existing message.

## 13. Security and privacy considerations

User images processed locally; no retention. No new trust boundary.

## 14. Out of scope

- AVIF or HEIC input (OPP-002 deferred).
- Bulk conversion (follows FEATURE-005).
- PDF conversion.
- Server-side conversion.

## 15. Dependencies

- Engine and picker components.
- OPP-001 outcome is useful (proof that such pages get indexed) but does not block building.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Indexed converter pages | none | none set until a baseline exists | Search Console |
| Share of converter visits continuing to the KB resizer | unknown (no analytics) | none set | needs an analytics decision (not part of this feature) |

## 17. Research references

- Originating opportunity: OPP-012
- [E: fact; low; https://www.birme.net; 2026-11-17] Batch conversion in the browser is commoditised (vendor claim).
- [E: fact; high; repo:src/lib/engine/sniff.ts; 2026-11-17] AVIF is rejected today.

## 18. Unresolved decisions

- Background colour for transparent PNG to JPG (not blocking; suggested white).
- Which converter pages to ship first (not blocking; suggested WebP to JPG and PNG to JPG).
- Whether to add analytics to measure funnel (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`, `src/components/tool/FormatPicker.tsx`, `src/lib/engine/sniff.ts`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1 to AC-4 via Playwright e2e on each page; AC-3 via network log; AC-5 via `pnpm run verify:html`; AC-6 by reviewer.

