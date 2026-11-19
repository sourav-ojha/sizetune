# Feature states

```
queued ──next──► building ──built──► built ──pr──► pr_open ──ci──┬─ passed ──► ci_passed ──merge──► merged
   │                │                  │            ▲  ▲          ├─ failed ──► ci_failed ──fix──► fixing ──push─┘
   │                └───── blocked ◄───┘            │  │          └─ none/timeout (stays pr_open; "none" stops the run)
   └── skipped (dependency not merged, or by hand)  │  └── stale / behind: merge sends it back to pr_open
                                                    └── ci_passed ──hold──► awaiting_human (a person merges it)
```

| State | Meaning | Next command |
|---|---|---|
| queued | waiting its turn | `next` |
| building | branch created, implementer working | `built ID` |
| built | commits and `delivery: complete` verified | `pr ID` |
| pr_open | PR open, CI not yet passed | `ci ID` |
| ci_failed | a check failed | `fix ID` (while rounds remain) or `block ID` |
| fixing | fixing CI on the same branch | `push ID` |
| ci_passed | the head commit passed CI (or `--no-ci` and none exist) | `merge ID` |
| awaiting_human | held: not authorised, T3, CI/ownership files touched, branch protection, no CI evidence | a person acts; a PR they merge is noticed by the next `next`; for CI evidence, `retry ID --checks ...` or `--no-ci` |
| blocked | could not be delivered; work stashed, base checked out | `skip ID` or fix by hand |
| merged / skipped | terminal | |

The helper refuses any other jump (for example `queued` → `merged`), so the file cannot claim a merge that did not go through the merge command.

## Things the helper checks for you
- `built`: on the feature branch, clean tree, at least one commit ahead of the base, spec `delivery: complete`, tier known.
- `ci`: reads `gh pr checks`, with the PR head read before and after so checks of an older commit are never credited to a newer one. Any failed or cancelled check fails the feature. A pass needs every **required** check (from branch protection) or every `--checks` name to be reported and passing; a passing lint or secret scanner alone is not proof of tests and stops the run as `unconfirmed`.
- `merge`: PR open, from this repository (not a fork), right head and base branches, no auto-merge or queue, the head commit equals the commit CI passed, GitHub says it is mergeable (`UNKNOWN` is retried, `BEHIND` updates the branch at most twice). CI and ownership files are recomputed on that exact commit with renames included. The merge is `gh pr merge --squash --match-head-commit <sha>`: if anything was pushed after CI, GitHub refuses. The result is then verified on GitHub, so a gh error after a completed merge, or a crash before the state was saved, is recorded correctly. The remote branch is deleted by the helper, best effort.
