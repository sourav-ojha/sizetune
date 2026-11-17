# Opportunity discovery and prioritization

## Discovery (Phase 3)

Directions: internal product gaps · competitive feature gaps · competitor weaknesses · unresolved user problems · adjacent market opportunities · technology-driven opportunities.

Categories: feature parity · UX improvement · performance and reliability · differentiation · product extension · monetization · automation · technical enablement.

Admission test — an opportunity enters the registry only if you can fill all of:
1. an **actual user problem** (who, in what situation, with what evidence);
2. a **business objective** it serves (from PRODUCT.md or user-stated goals; if unknown, ask);
3. a **link to an existing capability or limitation** in the product;
4. **research evidence** (tagged);
5. an **expected value** (user and business).

"Competitor X has it" alone fails the test. Prefer a handful of meaningful opportunities. Zero is acceptable: see "No actionable opportunities".

## Scoring (Phase 4)

Weighted score from ratings 1–5 per criterion (defaults; configurable in `.product/config.json` under `scoring.criteria`):

| Criterion | Default weight |
|---|---:|
| user_value | 25% |
| strategic_alignment | 20% |
| market_opportunity | 15% |
| competitive_differentiation | 15% |
| business_impact | 15% |
| implementation_feasibility | 10% |

`score = Σ (rating / 5 × weight) / Σ weight × 100`. Compute with `pi score --ratings "user_value=5,…" --confidence Medium`; put the same ratings on the opportunity's `Ratings:` line.
The validator recomputes the score and tier; they must match. Weights are normalized, so custom weights need not sum to 1.

Rating guidance: 5 = strong, evidenced, central; 3 = plausible/moderate; 1 = weak or contradicted. Rate each criterion from evidence, one line of justification each in the detail. Competitor parity is at most 3 on differentiation.
Feasibility is rated against the real architecture in PRODUCT.md, not an idealized one.

## Evidence confidence caps the tier

Confidence (Low/Medium/High) is assessed separately from the score, from the quality of the evidence behind the ratings (see evidence-standards.md).

| Score | Confidence ≥ Medium | Confidence Low |
|---|---|---|
| ≥ 70 (`recommend_min`) | **Recommend** | Needs evidence |
| 55–69 (`consider_min`) | Consider | Needs evidence |
| < 55 | Backlog | Backlog |

A "Needs evidence" opportunity is not presented as a recommendation. Either gather more evidence (targeted research) or present it explicitly as a hypothesis.

## Confidence is bounded by the cited evidence (enforced by the validator)

The registry confidence of a Proposed-or-later opportunity may not exceed what its detail block's evidence tags support:
**High** needs at least 2 distinct primary sources (an `https` URL or an existing `repo:` file; line numbers of one file are one source) cited as `fact` at medium+ confidence; **Medium** needs at least 1; otherwise **Low**. `search:` and `ref:` sources, absence claims, hypotheses and unknowns do not count toward this.

## Also capture

Estimated effort (XS/S/M/L/XL with the basis), strategic risks, dependencies, expected outcomes (ideally measurable).

## Optional frameworks

Use **RICE** (reach × impact × confidence ÷ effort) when reach is quantifiable and the user cares about throughput; use an **Opportunity Solution Tree** (outcome → opportunities → solutions → experiments)
when the user's goal is an outcome rather than a feature list. Record the framework used beside the ratings. Do not force either onto every project; the weighted rubric is the default.

## Registry rules

- Every considered opportunity gets an ID (`pi next-id opportunity`) and stays in the registry, including discarded-after-review ones kept as `Discovered` with a reviewer note, so they are not rediscovered.
- Check the registry and Decision Log before adding anything: do not re-propose Rejected/Deferred ideas without new evidence, and say what is new.
- Present at most the top handful (default ≤5) per round.

## No actionable opportunities

A legitimate result. Set `conclusion: no-actionable-opportunities` in the frontmatter and write a `## Conclusion` section: what was examined, why nothing clears the bar, which evidence would change the answer
(tagged). Do not pad the list to look useful.
