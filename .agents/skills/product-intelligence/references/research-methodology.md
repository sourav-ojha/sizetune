# Research methodology

Covers Phase 1 (product understanding), Phase 2 (market & competitive research), refresh runs, and one-off feature research.

## Phase 1 — Product discovery (`init`)

Goal: an accurate, user-approved `.product/PRODUCT.md` that distinguishes **observed facts, inferences, assumptions and unknowns**.

1. `pi status`. If an approved PRODUCT.md exists, do not redo onboarding: go to **Material change check** below. If only a draft exists, continue it.
2. Look for existing product docs (README, docs/, PRD, roadmap, ADRs). Read them as evidence; check them against code. Ask the user how to treat equivalent artifacts.
3. `pi init` to create the draft `.product/PRODUCT.md`, then `pi snapshot` (the baseline is stored in the OS temp directory, never in the project, and `pi verify-clean` compares against it). Size the repository (file count, languages, services) and pick agents per `orchestration.md`.
4. Investigate: purpose, problems solved, target users, value proposition, capabilities (complete/partial/stub), user journeys, architecture and stack,
   integrations, business model (if identifiable), limitations, incomplete functionality, product gaps. Typical focus areas: architecture, product, ux-journeys,
   business-model, quality-gaps.
5. Consolidate. Where README/marketing and code disagree, **record the conflict** with both locations; do not pick silently. Where the repo cannot answer (audience,
   pricing, goals), write `unknown` and add it to "Unanswered questions" for the user. Do not invent a business model.
6. Write `.product/PRODUCT.md` from `templates/product-understanding.md` (`pi init` creates the draft). Remove every placeholder. Tag claims.
7. `pi verify-clean`, `pi validate`.
8. **Present** a tight summary (overview, audience, top capabilities, biggest assumptions/conflicts, the specific questions you need answered) and point to the file.
   Ask the user to confirm or correct. **Stop.** Do not start Phase 2 in the same turn.
9. After corrections: update, show what changed, re-confirm. Only after an explicit confirmation: `pi approve-product --by "<name>"`.

### Material change check (later runs)

Compare PRODUCT.md `last_reviewed` and recorded commit with current repo state: `git log --since`, new top-level directories/services, dependency and manifest changes, new docs/README
changes, new routes/screens. If material changes exist, summarize them and **propose** a PRODUCT.md update to the user; do not edit an approved baseline silently.
If nothing material changed, say so and proceed. Use one repository-analyst or do it inline; this is not a full re-onboarding.

## Phase 2 — Market and competitive intelligence (`research`)

Requires approved PRODUCT.md. Goal: a concise **Market Landscape** in `.product/opportunities.md` (five categories) plus user pain points.

1. Derive the search brief from PRODUCT.md: the job-to-be-done, audience, alternatives users use today (including manual workflows), keywords, adjacent problems.
2. Discover candidates with differently-worded searches. Categories: **direct**, **indirect**, **open-source alternatives**, **emerging**, **adjacent**.
   Include non-obvious substitutes. Log the queries.
3. Delegate per `orchestration.md` (parallel). Competitor profiling dimensions and rules are in `competitor-analysis.md`.
4. Consolidate. Remove duplicates; keep up to `max_competitors_per_category` per category, prioritizing relevance to *this* product's audience. Note what was dropped and why in one line.
5. Write the landscape tables (templates/opportunity.md). If a category has nothing meaningful, write `None found — searched: …` with an evidence tag. Do not pad.
6. Set `last_research` to today. Validate.

Format notes: every landscape category must contain a table with at least one row, or a line starting `None found — searched: …` with an evidence tag; bullet lists fail validation. `pi init --registry` creates a template that is intentionally invalid until you fill it in (`last_research: never` is valid; unfilled placeholders and tags are not). Write registry rows and detail blocks yourself (`pi next-id opportunity` returns OPP-001 until a row exists). Run helper commands as `node <skill-dir>/core/scripts/pi.mjs …` directly; do not store the command in a shell variable that needs word splitting.

Valid outcomes include "no meaningful competitors found" and "market evidence is thin". State them plainly with confidence; do not manufacture competitors.

## Refresh (`refresh`)

1. Read the existing landscape and registry. Re-check each competitor's pricing, feature pages, release notes, and OSS repo activity since `last_research`; search for new entrants and new pain points.
2. Do not re-profile unchanged competitors in detail. Write only **Changes since previous research** (new, changed, removed, pricing moves, new OSS, new pain points) and update the tables.
3. Re-test each existing opportunity: still relevant? evidence changed? competitor shipped it? Update confidence/ratings. For deferred/rejected ones, flag only if new evidence materially changes the case, and let the user decide.
4. Identify previously overlooked opportunities. Update `last_research`. Review changed items (reviewer) before proposing anything new.

## One-off feature research (`feature <idea>`)

Requires approved PRODUCT.md. Treat the idea as a candidate opportunity, not as approved: research whether users need it, who else has it and how well, what the product's constraints are, then add it to the registry
as an opportunity (Discovered → Under Evaluation) with ratings, review and proposal like any other. The user bringing an idea is **not** approval to specify it.

## Quality bar

- Every significant finding has a source URL, accessed date, supporting evidence, confidence and a fact/inference/hypothesis class.
- Prefer primary sources; corroborate important claims with a second independent source.
- Report what you could not verify.
