# Delivery orchestrator on Claude Code

## Install
```bash
npx skills add sourav-ojha/agent-skills --skill delivery-orchestrator -a claude-code
npx skills add sourav-ojha/agent-skills --skill implementer -a claude-code      # required
```
Add `-g` for all projects. You also need the GitHub CLI logged in (`gh auth status`) and a GitHub remote.

## One-time project setup
```bash
node <skill-dir>/core/scripts/deliver.mjs config --write     # creates .product/delivery.json from a template
```
Edit it (GitHub account, base branch, protected branches, required and ignored checks, local test commands), then commit it and merge it to the base branch. Reference: [references/config.md](../../references/config.md).

## Use
```
/delivery-orchestrator --dry-run                    # show the queue, change nothing
/delivery-orchestrator --limit 1                    # PRs only, one feature, no merge
/delivery-orchestrator --merge                      # you authorise squash merges for the whole queue
```
Say what you want in plain words as well: "deliver all the ready features, merge each when CI is green". The agent passes `--merge` only if you asked it to merge, and records your words.

The queue is every `FEATURE-NNN.md` in `.product/features/` with `status: ready` (what product-intelligence's `handoff` produces). Order comes from optional `depends_on: FEATURE-001, FEATURE-002` in a spec's frontmatter.

## Permissions
An unattended run needs shell access to `git`, `gh` and `node`. To keep a human in front of merges, leave `gh pr merge` on "ask" in your permission rules: the run pauses at each merge and you approve it. To let it run fully unattended, allow it, and rely on branch protection as the gate.

## Resuming
State is in `.delivery/queue.json`. In a new session say "continue the delivery run": the agent calls `deliver next`, which resumes the active feature. `deliver status` shows everything; `deliver reset --yes` discards the state (merged PRs stay merged).

## Tips
- Add `.delivery/` and `.implementation/` to `.gitignore` if you like; `init` already adds them to `.git/info/exclude`.
- A long queue is many sessions' worth of context; the agent can stop after any feature and be resumed.
