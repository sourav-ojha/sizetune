# Landing page strategy

## Rules (keep the repo's existing gates)
1. One URL = one intent = one canonical. If an existing page already defaults to the target value, retitle it; do not clone it (e.g. `/resize-signature/` already starts at 20 KB, so no `/resize-signature-to-20kb/`).
2. A new page must differ in preset **and** have ≥300 unique words, its own FAQ, and distinct advice (portrait vs document vs signature; what the limit means for that content). Not a number swap. Gate: `verify:html:strict` (Jaccard ≤0.35, unique-word floors).
3. Reuse existing tools via a `defaultMaxKb`-style prop: no new engine code per page.
4. Wave 1 is capped at 5 per-size pages (FEATURE-001 FR-5). Expansion is gated on Search Console evidence (a query seen with impressions) **and** distinct copy.
5. Exam pages: every number links to the primary notice and shows "last verified <date>"; skip any exam whose spec is unverified or conflicting.
6. No programmatic farms (per-KB 5-500, per-pixel, per-country passport) — competitors do this (imresizer ≈65 KB slugs) but scaled-content/doorway policy risk applies.

## Keyword → page map
| Query family | Page | Status |
|---|---|---|
| resize image to KB / photo resizer in kb | `/` | live |
| resize / compress image to 20 KB | `/resize-image-to-20kb/` | live |
| resize / compress image to 50 KB | `/resize-image-to-50kb/` | **new** |
| resize / compress image to 100 KB | `/resize-image-to-100kb/` | live |
| signature resize / signature 20 KB | `/resize-signature/` | retitled |
| signature 10 KB | `/resize-signature-to-10kb/` | live |
| webp→jpg, png→jpg | `/webp-to-jpg/`, `/png-to-jpg/` | live |
| rotate, check size | `/rotate-image/`, `/check-image-size/` | live |
| Instagram/LinkedIn/YouTube sizes; favicon | existing pages | live |
| photo/signature size for forms (general) | `/guides/photo-size-for-online-forms/` | live |
| compress without losing quality | guide (CONTENT_ROADMAP B) | planned |
| increase image size to X KB / range | one page `/increase-image-size-in-kb/` (explains min/range, uses existing min-KB field) | candidate, after 4 weeks of GSC |
| IBPS / SBI photo+signature+thumb+declaration | **one** hub `/guides/bank-exam-photo-signature-size/` (verified table), later tool presets | READY after re-verifying sources |
| NEET / JEE Main / CUET (KB-only specs) | one guide `/guides/nta-exam-photo-signature-size/` | READY after re-verifying |
| SSC CGL | section in a guide: live capture, signature 10-20 KB | READY |
| UPSC, RRB, PAN, passport digital | — | HOLD (conflicting/unverified) |
| cm/DPI sizes, HEIC, PDF, passport maker | — | need tool work |

Why guides before exam *tool* pages: the verified specs are reference content; a guide with the table + links to the existing tools satisfies the query honestly without a thin preset page. Promote to a dedicated tool page only when GSC shows exam-name queries landing on the guide.

## Page template (for any approved new page)
H1 states the task and limit · hero lead (what is preselected) · tool island · noscript note · 6-8 H2 sections with advice specific to the limit/audience · visible FAQ (5 questions from real failure modes) · RelatedTools · links to ≥3 sibling pages/guides. Metadata: title ≤60 chars, description 70-160, unique. JSON-LD `WebApplication` + `BreadcrumbList` (automatic). No FAQPage markup.
