# Implementer on Claude Code

## Install the skill
```bash
npx skills add <repo-or-path> --skill implementer          # project
npx skills add <repo-or-path> --skill implementer -g       # global
```
Or copy `skills/implementer` to `.claude/skills/implementer` (project) or `~/.claude/skills/implementer` (global).

## Optional native agents
Adds role-scoped tools and per-tier models. Without them the lead delegates to generic sub-agents using the role files.
```bash
node <skill-dir>/core/scripts/install-agents.mjs --scope project     # writes .claude/agents/impl-*.md
node <skill-dir>/core/scripts/install-agents.mjs --scope user        # writes ~/.claude/agents/impl-*.md
node <skill-dir>/core/scripts/install-agents.mjs --scope project --remove
```
Tiers map to model aliases in `core/config.default.json` (`reasoning: opus`, `standard: sonnet`, `fast: haiku`). Pass `--config` for your own.
Read-only roles (architect, reviewer, security, database) get no edit or shell tools.

## Use
`/implementer docs/spec.md` or `/implementer add rate limiting to the upload API`. Add `--no-tdd` to waive TDD, `--pr` to allow a PR.

## Tips
- Add `.implementation/` to `.gitignore` (the lead never commits it).
- Parallel writers use git worktrees; the lead integrates and commits.
- Optional: if gstack is installed, the lead may use its `/review` or `/ship`; otherwise it does both inline. Nothing here depends on gstack.
- Ledger integrity is tamper-evident, not tamper-proof: the real gate is the user reading the plan, diff and rulings.

## Where the helper lives
Installed skills live in `<project>/.claude/skills/implementer` (project install) or `~/.claude/skills/implementer` (global). `impl` is
`node <that folder>/core/scripts/impl.mjs`; it is not copied into your project. Project-level `pi` is in `.claude/skills/product-intelligence`.
Update both with `npx skills update`.
