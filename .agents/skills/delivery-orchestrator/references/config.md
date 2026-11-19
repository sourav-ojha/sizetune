# Project config: `.product/delivery.json`

Set the rules once per project. Create the file with `deliver config --write`, edit it, **commit it and merge it to the base branch**. `deliver config` validates it and shows the effective values.

```json
{
  "version": 1,
  "github": { "account": "work-login", "host": "github.com" },
  "base": "develop",
  "branch_prefix": "feat/",
  "features_dir": ".product/features",
  "protected_branches": ["main", "master", "prod", "production", "release/*"],
  "merge": { "mode": "squash", "allow_tier3": false },
  "checks": { "required": ["unit-tests", "build"], "ignored": ["e2e", "e2e-*"], "allow_without_ci": false },
  "local_checks": [ { "name": "unit tests", "command": ["npm", "test"], "timeout_s": 900 } ],
  "hold_paths": ["migrations/", "infra/"],
  "limits": { "max_fix_rounds": 2, "max_failures": 2, "ci_budget_s": 1800 },
  "implementer_notes": "No e2e infrastructure here: unit and integration tests only."
}
```

Every key is optional. An unknown key or a wrong type is an error, so a typo cannot silently weaken a rule.

| Key | Meaning | Default |
|---|---|---|
| `github.account`, `github.host` | Which `gh` login to use when several are logged in. Its token is used for every `gh` call (and for `git` over https), held in memory only. The helper checks the token really is that account and that it can write to the repo. For SSH remotes git uses your SSH key; the setting then applies to `gh` only | `gh`'s active account |
| `base` | The branch every feature starts from (always its latest tip, fast-forwarded before each feature) and every PR targets and merges into | the repo's default branch |
| `protected_branches` | Branch names (globs: `*` within a segment, `**` across) this skill **never merges into**. If `base` matches, PRs are opened and checked but left for a person. Flags cannot override it | `main`, `master`, `prod`, `production`, `release/*`, `release-*` |
| `merge.mode` | `pr-only`: open PRs, never merge. `squash`: standing authorisation to squash-merge (equivalent to `--merge` each run) | `pr-only` |
| `merge.allow_tier3` | Also merge T3 work (auth, data, migrations, public API) | `false` |
| `checks.required` | CI checks that must be reported and pass (exact names). Empty: the base branch's required checks from branch protection are used | `[]` |
| `checks.ignored` | CI checks that never fail or hold a feature, for suites the project does not have or does not trust (globs). GitHub's own branch protection can still block a merge | `[]` |
| `checks.allow_without_ci` | Allow merging when no required or named check exists, on local evidence | `false` |
| `local_checks` | Commands the orchestrator itself runs before a PR is opened (argument list, no shell; `timeout_s` 1-3600). A failure keeps the feature in `building` until fixed | `[]` |
| `hold_paths` | Paths (globs, a trailing `/` means the folder) whose change needs a person to review before merge. CI files, `CODEOWNERS` and this config file are always held | `[]` |
| `branch_prefix` | Feature branch prefix | `feat/` |
| `features_dir` | Where `FEATURE-NNN.md` specs live | `.product/features` |
| `limits` | CI fix rounds per feature; blocked features in a row before the run stops; total CI wait per feature (seconds) | 2, 2, 1800 |
| `implementer_notes` | Up to 500 characters shown to the implementer for every feature (for example which kinds of tests exist) | `""` |

## Safety of the file itself
- It must be **committed and identical to the copy on `origin/<base>`** when a run starts, so the rules in force are the ones that were reviewed and merged. A local edit, or a copy that only exists on a feature branch, is refused.
- A feature that changes it is held for a person, and the run keeps using the policy it started with.
- `local_checks` commands run on your machine as you. They come from the reviewed base branch; read them as you would a CI script.
- Flags (`--base`, `--merge`, `--checks`, `--no-ci`, `--merge-t3`, `--features-dir`, `--max-fix-rounds`, `--max-failures`, `--ci-budget`) override the config for one run, **except** `protected_branches`, which only the file can change.
