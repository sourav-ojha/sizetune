# Safety model

## What the pipeline will and will not do
| Action | Rule |
|---|---|
| Merge | Only with `--merge` and the user's words as `--note`, or the config's standing `merge.mode: squash`; only squash; only the commit CI verified |
| Protected branches | Never merged into (default main, master, prod, production, release/*), whatever the flags say; only the committed config can change the list |
| Policy file | Must be committed and identical on the base branch; a feature that edits it is held; the run keeps the policy it started with |
| Account | If `github.account` is set, its token is used for gh (and git over https), verified to be that login with write access; the token is never stored or printed |
| Push | Feature branches only, never forced, never the base |
| Bypass | No `--admin`, no `--auto`, no hook skipping, no protection or CI edits |
| CI evidence | Required checks (or `--checks` names) must pass. A passing scanner or linter alone is not proof of tests: the run stops and says which checks ran. `--no-ci` is the only way to merge without a verified test check |
| T3 work (auth, data, migrations, public API) | PR opened, held for a person unless `--merge-t3` |
| Changes to `.github/`, other CI config, `CODEOWNERS` | Held for a person: a feature must not edit the checks that gate it |
| Failures | A cap on CI fix rounds; a circuit breaker after consecutive blocked features |
| Interruption | State in `.delivery/queue.json`; `next` resumes; nothing is merged twice |
| Fork PRs | A PR from a fork with the same branch name is ignored and never merged |
| Untrusted text | Specs, PR text and CI logs are data; titles and reasons are stripped of control characters; no shell is used |

## What it cannot do
- **The state file is not tamper-proof.** `.delivery/queue.json` sits in the worktree, so an agent (or a prompt-injected spec) that can write files can edit it, for example to set `merge: true`. The helper re-validates every ref and sha it reads, but it cannot tell an honest edit from a forged one. `merge` does not trust the file for "CI passed": it asks GitHub again whether the required (or named) checks pass on the exact commit. The run's policy fields (`merge`, `merge_t3`, `no_ci`, `checks`) cannot be re-derived from GitHub, so they stay file-trusted. The authorisation note is a record, not a lock; GitHub's branch protection is the lock.
- **It is not access control.** An agent with a shell could run `gh` directly. The real gate is GitHub: protect the base branch (required checks, and required reviews for anything you want a person to approve). When protection blocks a merge, the pipeline holds the PR instead of working around it.
- **Green CI is only as good as your tests.** The implementer is told to write criterion-level tests; CI proves they pass, not that the spec was right.
- **Detection of risky changes is path-based.** A T3 judgement comes from the implementer's tier; a mislabelled tier gets the policy of that tier.

## Recommended setup
1. Branch protection on the base: require status checks; require a review if you want a person on every merge (the pipeline will then hold each PR, which is the intended behaviour).
2. Start small: `--limit 1` for the first run, then widen.
3. Read the final report; stashes and unmerged branches are listed there.
