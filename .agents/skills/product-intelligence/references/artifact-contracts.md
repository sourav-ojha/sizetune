# Artifact contracts, approval gates and lifecycle

All state lives in `.product/` in the **target project** (never inside this skill):

```
.product/
├── PRODUCT.md          approved product baseline
├── opportunities.md    market landscape, opportunity registry, decision log
├── features/FEATURE-NNN.md   specs, only for approved opportunities
└── config.json         optional overrides (weights, freshness, model tiers)
```

Use `node <skill-dir>/core/scripts/pi.mjs` (below `pi`) for every gate-sensitive change. It exists because gates must not depend on
model discipline. Run `pi validate` before presenting anything to the user and fix every ERROR.

## Gate 1 — product context approval

- `PRODUCT.md` frontmatter: `status: draft|approved`, `revision`, `approved_by`, `approved_at`, `content_hash`, `last_reviewed`.
- You write the draft. You **never** set `status: approved` yourself. After the user confirms in chat (explicit "approved", "looks right", or equivalent
  after seeing it), run `pi approve-product --by "<user name>"`. Corrections from the user are applied to the draft, shown again, and approved separately.
- The hash covers the body (not Revision History). Editing an approved file makes `pi validate` fail. To change an approved baseline: get the user's
  agreement on the change first, `pi reopen-product --by …`, edit, show the diff, wait for confirmation, `pi approve-product`.
- Revision history is append-only in the file and in git. Its last approval row must match `revision`, `approved_by` and `approved_at`, or validation fails.
- If the baseline is merely stale and unchanged, run `pi confirm-product --by … ` after the user re-confirms it: it resets the review age without a new revision. Decisions and `Proposed` transitions are refused while the baseline is draft, reopened or modified.
- Optional hardening: `gates.human_confirmation: "tty"` in config makes the user-only commands require a person at an interactive terminal.
- Phases 2–7 must not start without an approved, unmodified PRODUCT.md. The helper enforces this for `decide`, `transition … Proposed`, `transition … "Ready for Implementation"` and `new-feature`; for the other commands the validator reports it and you must check `pi status` yourself.

## Gate 2 — opportunity decisions

Lifecycle: `Discovered → Under Evaluation → Proposed → Approved | Rejected | Deferred → Ready for Implementation → Implemented → Validated`.

| Move | Who | Command |
|---|---|---|
| Discovered ↔ Under Evaluation, → Proposed | agent | `pi transition OPP-001 "Under Evaluation"` |
| Proposed → Approved / Rejected / Deferred / back to Under Evaluation | **user only** | `pi decide OPP-001 approve\|reject\|defer\|research\|modify --by "<user>" --note "<reason>"` |
| Rejected/Deferred reconsidered | **user only** | `pi decide OPP-001 research --by … --note "<new evidence>"` |
| Approved / Ready reversed | **user only** | `pi decide OPP-001 reject\|defer\|research …` (the linked spec becomes `superseded`; re-approval revives it as a draft) |
| Approved → Ready for Implementation | agent, after spec validates | `pi transition OPP-001 "Ready for Implementation"` |
| Implemented → Validated | implementation/QA skill or user | `pi transition …` |

- Only run `decide` after the user states the decision in chat. `--by` is their name; `--note` is required and quotes their words. Each log row also seals a digest of the opportunity's title, scores and detail block (the `Content` column): if that text changes after the user approved it, validation fails, so re-propose and get a new decision. `decide` refuses to append to a log that already fails its integrity check. The Decision Log is hash-chained and the validator requires every status to agree with the latest logged decision: hand edits are detectable, so never make them (and note they are detectable, not impossible: you are trusted to follow this rule). Never infer approval from silence, from "ok" to a
  different question, or from a background notification.
- "Modify" and "research" send the opportunity back to Under Evaluation; revise, re-review, re-propose.
- `pi transition … Proposed` is refused while `review_mode` is `pending`.
- Rejected and deferred opportunities stay in the registry with their reasons. Do not re-propose them without new evidence; if you have some, tell the user
  what changed and let them reopen it.

## Gate 3 — specifications

`pi new-feature OPP-001` refuses unless the opportunity is Approved (or later) and PRODUCT.md is approved. It allocates `FEATURE-NNN`, links the registry
row, and stamps `product_revision`. A spec is `status: draft` until the validator is clean and no `[BLOCKING]` unresolved decisions remain; then `status: ready`.

## Freshness

`pi status` reports product review age, research age, awaiting decisions and a suggested next step. Defaults: product review every 90 days, market
refresh every 30 days. Nothing runs in the background; freshness is only checked when the skill is invoked. Say so if the user asks about monitoring.

## Existing conventions

If the project already has equivalent product docs (PRD, product brief, roadmap), read them as evidence and ask the user whether to link, import or
ignore them. Do not create duplicate artifacts that say the same thing, and never overwrite them.

## Temporary data

Sub-agent outputs are returned in messages and are not persisted. If you must save intermediate material, put it in the system temp directory, never in the project,
and delete it when done. Condense evidence into the artifacts; do not retain raw research dumps.
