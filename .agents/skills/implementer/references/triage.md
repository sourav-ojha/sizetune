# Triage

Decide in one pass, from the spec and a quick look at the code. Write the tier and roles in one line. The user can override.

## Size × risk → tier

| Signal | Raises the tier |
|---|---|
| Files touched | 1 → T0/T1; 2-8 → T2; more than 8 or several modules → T2/T3 (architect first) |
| Open design questions (interfaces, data shape, new module) | needs the architect |
| Auth, permissions, money, personal data, secrets, public API, migrations, concurrency | T3 |
| Existing tests around the area | none → add risk to QA's work, not a bigger team |
| Spec quality | vague criteria → fix the spec first (mini-spec), do not guess |

## Role selection

- **Architect:** only if design decisions are open or the work must be split into parallel tasks. Not for a clear, contained change.
- **Engineer:** one per task; many only for tasks with disjoint owned files.
- **QA:** T2/T3 always; T1 the lead verifies with the real command.
- **Reviewer:** T2/T3. T0/T1 get the lead's own diff check.
- **Security / database lens:** only when the diff touches those concerns.

## Cost rules

- Default to the cheapest arrangement that still gives independent review for risky work.
- Cap parallel tasks (`impl batch --max N`, default 4). More agents never fix an unclear spec.
- Strong models for architect and reviewer, standard for engineer and QA, fast for pure inventory. Pass the model by tier.
- Hand agents file paths, not pasted text; they return short summaries and write artifacts to disk.
- Do not re-plan or re-review unchanged work.
