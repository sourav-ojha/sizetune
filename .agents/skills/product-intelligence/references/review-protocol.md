# Independent review and presentation (Phases 5–6)

## Review (Phase 5)

Run before anything is `Proposed`, and again after material revisions. Delegate to the **independent-reviewer** role (`core/roles/independent-reviewer.md`, tier `reasoning`).

1. Give the reviewer: the paths of the landscape/opportunity artifacts, the approved PRODUCT.md, and today's date. **Do not give your reasoning, search log or conclusions in the message** (the reviewer runs its own searches first). Re-review rule: after fixing findings, re-run the reviewer if you changed any rating, confidence, recommendation or added/removed an opportunity; if the fixes were only factual corrections, say so in the Review Summary instead.
2. Collect findings (template `templates/review-report.md`). Severities: Critical, High, Medium, Low.
3. **Resolve every Critical and High finding**: fix the artifact, gather missing evidence, downgrade or drop the opportunity, or rebut with evidence. Re-run the reviewer on changed items. Maximum 3 rounds; unresolved Critical findings
   after round 3 are shown to the user verbatim.
4. Write a concise **Review Summary** into opportunities.md (what was challenged, what changed, what remains open). Set `review_mode: independent`.
5. If you could not launch another agent: perform a visibly separate self-review pass with the same checklist, set `review_mode: self-review`, add `review_note: <why>`, and tell the user in your presentation.
   Never write `independent` unless a separate agent produced the review.

Evaluate the reviewer too: discard findings with no evidence; verify its claims before acting.

## Presentation (Phase 6)

Present a decision-ready shortlist (default ≤5). For each opportunity:

- Name and ID
- Problem statement
- Proposed solution
- Why it matters
- Supporting evidence (top 2–3, with confidence)
- Competitive context
- Expected user/business value
- Estimated effort
- Confidence and tier (never show a "Needs evidence" item as a recommendation)
- Risks
- Priority score

Lead with the recommendation order and the one-line reasoning. Flag anything the reviewer left open and the review mode. Then ask the user to decide per opportunity:

**Approve · Reject · Defer · Request further research · Modify the proposal**

Move items to `Proposed` with `pi transition` before presenting. Then **stop and wait**. Record each decision only with `pi decide` after the user states it, quoting their words in `--note`.
Approving one opportunity does not approve others. A "modify" decision returns the item to Under Evaluation: revise, re-review, re-present.
Never create a specification for an item that is not Approved.
