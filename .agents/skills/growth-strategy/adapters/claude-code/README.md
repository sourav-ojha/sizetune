# Growth strategy on Claude Code

## Install
```bash
npx skills add sourav-ojha/agent-skills --skill growth-strategy -a claude-code        # project
npx skills add sourav-ojha/agent-skills --skill growth-strategy -a claude-code -g     # global
```
The helper is `node <skill-dir>/core/scripts/gs.mjs`, where `<skill-dir>` is `.claude/skills/growth-strategy` (project) or `~/.claude/skills/growth-strategy` (global). It is not copied into your project. Update with `npx skills update`.

## Use
```
/growth-strategy init
/growth-strategy full
/growth-strategy research
/growth-strategy refresh
/growth-strategy status
```
Plain language works too: "find keywords and distribution channels for this site".

## Optional native agents
```bash
node <skill-dir>/core/scripts/install-agents.mjs --agent claude-code --scope project --project-dir .   # writes .claude/agents/gs-*.md
node <skill-dir>/core/scripts/install-agents.mjs --agent claude-code --scope project --project-dir . --remove
```
Generated from `core/roles/roles.json`; tiers map to the model aliases in `core/config.default.json` (override in `.growth/config.json` under `models.claude-code`). Committed copies live in `adapters/claude-code/agents/`. Without native agents the skill delegates to the general-purpose sub-agent with the role file as instructions.

| Role | Agent | Tools |
|---|---|---|
| product-seo-auditor | `gs-product-seo-auditor` | Read, Grep, Glob, WebSearch, WebFetch, Bash (read-only use) |
| search-researcher | `gs-search-researcher` | Read, Grep, Glob, WebSearch, WebFetch |
| distribution-researcher | `gs-distribution-researcher` | Read, Grep, Glob, WebSearch, WebFetch |
| growth-reviewer | `gs-growth-reviewer` | Read, Grep, Glob, WebSearch, WebFetch |

The independent review counts only when `gs-growth-reviewer` (or a general-purpose sub-agent given its role file) runs as a separate agent; record it with `--reviewer gs-growth-reviewer`.

## Gates and permissions
- Ask before running `gs.mjs approve-baseline`, `decide` and `supersede` unless you just gave that decision in chat; never allow-list them. They record your words (`--note`); the helper cannot prove who typed the command, so the real gate is you reading what was recorded.
- Research agents use web search and fetch. They must not use browser tools to sign in, post or submit; keep browser MCP tools out of their allow-lists.

## Tips
- Put Search Console exports in `.growth/performance/` (git-ignored) and run `gs.mjs import gsc --file .growth/performance/Queries.csv --period 2026-11`.
- If you use `experience-audit`, run its `seo` audit first; growth-strategy cites its findings instead of re-measuring.
- Hand approved implementer items to `/implementer .growth/handoff/GRO-001.md`, then `gs.mjs sync`.
