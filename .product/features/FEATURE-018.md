---
type: feature-spec
id: FEATURE-018
opportunity: OPP-030
status: ready
product_revision: 3
created: 2026-11-17
---

# QR code generator


## 1. Feature overview

Generate static QR codes in the browser (URL, text, Wi-Fi) with PNG and SVG export, using an MIT-licensed library.

## 2. Problem statement

Users make QR codes for links, Wi-Fi and text; autocomplete shows "qr code generator". [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=qr+code+generator; 2026-11-17] That the SERP is very strong is a hypothesis; Canva and Adobe appear in suggestions. [E: hypothesis; low; search:not SERP-checked; 2026-11-17]

## 3. Business justification

Objective: a high-volume everyday tool for the portfolio. Owner approved on 2026-11-17 (user: 'Rest can be approved', reply to the portfolio-pass decision sheet). The opportunity is Low confidence; approval does not upgrade the evidence. Originating opportunity: OPP-030 (score 56, Needs evidence, Low confidence, effort M).

## 4. Target users and personas

- **Everyday user** — needs a QR code for a link or Wi-Fi without an account or watermark.

## 5. User stories

- As a user, I want a QR code for my link so that I can print or share it.
- As a user, I want PNG and SVG downloads so that I can use it in documents.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Generate QR codes for URL, text and Wi-Fi in the browser. | [Approved] |
| FR-2 | Download as PNG and SVG. | [Approved] |
| FR-3 | Static codes only; no tracking or redirect service. | [Approved] |
| FR-4 | Use an MIT-licensed library (node-qrcode MIT, last push 2024-08-23; bwip-js MIT, 2026-08-19). | [Suggestion] |
| FR-5 | Error-correction level and size options. | [Suggestion] |
| FR-6 | Warn that a QR code should be tested before printing. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | No regression of first-load size on existing pages. | `verify:html` size budget unchanged; new code loads only on the new page. |
| NFR-2 | No third-party origins; no file content leaves the device. | `pnpm run verify:privacy` passes. |
| NFR-3 | Accessible UI matching the image tool. | Axe specs pass on the new page; keyboard operable. |

## 8. User journeys and expected UX

Choose a type, enter content, see a live preview, adjust size and error correction, download PNG or SVG.

## 9. Technical considerations

**Constraints from the existing system:** static page with a Preact island; no new origins. [E: fact; high; repo:astro.config.mjs; 2026-11-17] node-qrcode and bwip-js are MIT. [E: fact; high; https://api.github.com/repos/soldair/node-qrcode; 2026-11-17] [E: fact; high; https://github.com/metafloor/bwip-js/blob/master/LICENSE; 2026-11-17] OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** a URL **When** a code is generated **Then** a standard QR reader decodes the same URL. |
| AC-2 | FR-1 | **Given** Wi-Fi details **When** a code is generated **Then** a reader offers to join with the entered network. |
| AC-3 | FR-2 | **Given** a code **When** PNG or SVG is downloaded **Then** the file opens and scans. |
| AC-4 | FR-3 | **Given** a session **When** network requests are logged **Then** none carries the entered content. |
| AC-5 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** budgets are unchanged for existing pages. |

## 11. Edge cases

- Very long content → warn about density and scanning.
- Special characters → encoded correctly.

## 12. Error and failure scenarios

- Content too long for the code → message to shorten.

## 13. Security and privacy considerations

Content (including Wi-Fi passwords) stays on the device; no storage.

## 14. Out of scope

- Dynamic QR codes with tracking.
- QR scanning from camera.
- Logo embedding.

## 15. Dependencies

- OPP-005 (multi-tool platform note) applies once a second tool page is committed; check it before adding navigation or shared layout.
- FEATURE-012 hub and guide template.

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Indexed QR page | none | none set | Search Console |

## 17. Research references

- Originating opportunity: OPP-030
- [E: fact; high; https://api.github.com/repos/soldair/node-qrcode; 2026-11-17] Library licence.

## 18. Unresolved decisions

- Which library to use (not blocking; both MIT, implementer chooses).
- Whether to measure usage (not blocking).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `src/components/`, `src/pages/`, `astro.config.mjs`
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1 and AC-2 via a decoder library in tests; AC-3 network log; AC-4 `pnpm run verify:html`.

