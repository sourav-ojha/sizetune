# Feature specification and handoff (Phase 7)

Only for opportunities the user approved. You never implement; the spec is the end of this skill's responsibility.

## Procedure (`handoff`)

1. `pi status` → `approved_without_spec`. If none, say so.
2. For each approved opportunity: `pi new-feature OPP-001` (creates `.product/features/FEATURE-NNN.md` from `templates/feature-specification.md`).
3. Gather what the spec needs: re-read the opportunity detail and its evidence; inspect only the relevant parts of the repository (read-only) to ground technical considerations, existing UX patterns and constraints.
   Use a repository-analyst for large areas.
4. Fill all 19 sections. Remove every placeholder.
5. Separate **[Approved]** requirements (derivable from the approved opportunity and user statements) from **[Suggestion]** implementation approaches. Anything that needs a product decision you cannot ground goes under
   **Unresolved decisions**; mark `[BLOCKING]` if implementation cannot start without it. **Do not invent product requirements to make the spec look complete.**
6. `pi validate`. Fix errors. Optionally run the reviewer on the spec (testable criteria, invented requirements, missing failure modes).
7. Show the user the spec summary and any unresolved decisions. When no `[BLOCKING]` items remain: set frontmatter `status: ready`, then `pi transition OPP-001 "Ready for Implementation"`.

## Quality rules

- **Acceptance criteria are testable**: Given/When/Then, observable outcomes, each linked to a requirement id. No "should be fast"; give a threshold or move it to NFRs with a measure.
- Every functional requirement has at least one acceptance criterion; every criterion traces to a requirement.
- Edge cases and failure scenarios name expected behavior, not just the case.
- Security/privacy: data touched, authorization, retention, abuse cases. If genuinely none, say why.
- Success metrics: baseline (or "unknown"), target, measurement method. Do not fabricate baselines.
- Out of scope is explicit; dependencies are named.
- Research references cite the originating OPP id and evidence tags.
- Written so an implementation/QA agent can consume it **without asking you** for requirements, and knows what to ask the user instead.

## Handoff contract

The spec's section 19 tells the implementer: product baseline revision, what to read first, definition of done, where questions go, suggested verification mapped to AC ids.
Status flow: `Approved → Ready for Implementation` (this skill) → `Implemented` → `Validated` (implementation/QA skill or the user, via `pi transition`).
If the baseline PRODUCT.md changes after a spec was written, `pi validate` warns; re-check the spec against the new revision.
