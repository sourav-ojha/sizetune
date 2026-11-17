---
type: feature-spec
id: FEATURE-040
opportunity: OPP-055
status: draft
product_revision: 3
created: 2026-11-18
---

# PDF security and signing tools


## 1. Feature overview

In-browser PDF tools: place a drawn or typed signature on a PDF, redact areas, and open password-protected PDFs. Draft: encryption support and genuine redaction are unresolved.

## 2. Problem statement

Users sign, lock and unlock PDFs; autocomplete returns suggestions for "sign pdf online free", "protect pdf with password online" and "unlock pdf online". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=sign+pdf+online+free; 2026-11-18] No user statement was gathered, so the need is an assumption. [E: assumption; low; search:no user statement found; 2026-11-18]

## 3. Business justification

Objective: add a related tool to the same site and engine, in line with the owner's breadth strategy and the relatedness constraint. A competitor (pi7) lists the tool; that shows it is buildable, not that it is searched. [E: fact; medium; https://image.pi7.org/; 2026-11-18] Owner approved on 2026-11-18 (user: 'Approve all three'). The opportunity is Low confidence and was not independently reviewed; approval does not upgrade the evidence. Originating opportunity: OPP-055 (score 58, Needs evidence, Low confidence, effort L). One distinct workbench; no per-keyword or per-variant pages (scaled-content and doorway gate). [E: inference; medium; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]

## 4. Target users and personas

- **Form applicant or office user** — needs to sign or secure a PDF.

## 5. User stories

- As a user, I want to place my signature on a PDF so that I can return it signed.
- As a user, I want to open a password-protected PDF I own.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Place a signature image (drawn or typed, from FEATURE-020) on chosen PDF pages. | [Approved] |
| FR-2 | Redact an area so that the underlying content is removed from the file. | [Approved] |
| FR-3 | Open a password-protected PDF with its password. | [Approved] |
| FR-4 | Add a password to a PDF only if a permissive library supports it. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

One PDF page with Sign, Redact and Unlock tabs.

## 9. Technical considerations

**Constraints from the existing system:** Astro static pages, Preact islands, a Web Worker engine that targets a KB size, and verifiers that forbid third-party origins. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-17] Any library or font must be self-hosted. OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout. PDF work uses a permissive library such as @cantoo/pdf-lib (MIT) or pdf.js (Apache-2.0); Ghostscript WASM is AGPL and excluded. [E: fact; medium; https://github.com/cantoo-scribe/pdf-lib; 2026-11-17] pdf-lib does not encrypt PDFs, so protect needs another approach. [E: unknown; low; search:none run; 2026-11-18]

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a PDF and a signature image **When** placed and saved **Then** the signature appears on the chosen page. |
| AC-2 | FR-2 | **Given** a redacted area **When** the output is text-searched **Then** the redacted text is not present. |
| AC-3 | FR-3 | **Given** a password-protected PDF and the correct password **When** opened **Then** pages can be processed. |
| AC-4 | FR-4 | **Given** a session **When** network requests are logged **Then** none carries file content. |
| AC-5 | NFR-1 | **Given** other pages **When** loaded **Then** no PDF library is requested. |

## 11. Edge cases

- Wrong password → clear message.
- Scanned PDF → redaction covers pixels only; state so.

## 12. Error and failure scenarios

- Corrupt PDF → clear error.

## 13. Security and privacy considerations

Processed locally in the browser; no file content leaves the device; no retention; no new trust boundary. Redaction must remove content, not just draw a box; the page must say what is guaranteed.

## 14. Out of scope

- Legally binding e-signatures.
- Server processing.
- Cracking passwords.

## 15. Dependencies

- FEATURE-020 signature maker.
- FEATURE-003 PDF engine decision.
- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Page indexed and receiving impressions | none (new page) | none set until a baseline exists | Search Console |

## 17. Research references

- Originating opportunity: OPP-055
- [E: fact; medium; https://image.pi7.org/; 2026-11-18] Competitor listing.

## 18. Unresolved decisions

- [BLOCKING] Protect (add password) needs an encryption-capable permissive library; none verified. Owner must accept dropping protect or approve a library after review.
- [BLOCKING] Redaction claim: owner must accept the wording of what the page guarantees.
- Which tab ships first (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `docs/engine/ENGINE.md`, `src/components/ImageTool.tsx`, `src/components/tool/`, `BLOCKERS.md`, `scripts/verify-privacy.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** Each AC via unit tests, Playwright e2e and the network log; NFR via `pnpm run verify:html` and `verify:privacy`.

