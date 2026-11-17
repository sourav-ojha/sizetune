# Claude Code adapter

The shared `SKILL.md` is a native Claude Code skill (Agent Skills format). This adapter adds optional scoped sub-agents and notes on Claude-specific behaviour.

## Invocation

```
/product-intelligence init
/product-intelligence research
/product-intelligence opportunities
/product-intelligence feature dark mode for the editor
/product-intelligence refresh
/product-intelligence handoff
/product-intelligence full
```

Claude also loads the skill automatically when your request matches its description ("who are our competitors?", "what should we build next?"). The arguments reach the skill as plain text; no placeholder is needed.
Verified against the Claude Code skills docs on 2026-11-16: `name`, `description`, `license`, `compatibility`, `metadata`, `argument-hint` are accepted.

## Sub-agents

`agents/pi-*.md` are Claude Code sub-agent definitions (`tools` allow-list, `model`), generated from `core/roles/roles.json` and the tier map in `core/config.default.json`
(`reasoning→opus`, `standard→sonnet`, `fast→haiku` aliases). Each is a thin wrapper that reads the shared role file, so the methodology exists once.

Install (optional; the skill falls back to generic sub-agents without them):

```bash
# personal (all projects)
node ~/.claude/skills/product-intelligence/core/scripts/install-agents.mjs --agent claude-code --scope user
# this project only
node .claude/skills/product-intelligence/core/scripts/install-agents.mjs --agent claude-code --scope project --project-dir .
```

Change models by editing `models.claude-code` in `.product/config.json` (project) and re-running the installer; a `null` or missing tier omits `model` so the agent inherits the session model.
Remove with `--remove`.

## Orchestration notes

- Launch independent researchers in **one message with several Agent calls** so they run in parallel; wait for all before consolidating.
- Agents `pi-*` have read/search/web tools only (the repository analyst also has `Bash` for `git log` and listing; its role file forbids writes and `pi verify-clean` is the backstop).
- Tools of the main session are unchanged: the skill relies on instructions plus `pi verify-clean`, not on restricting your session.
- Use your normal approval prompts for `node …/pi.mjs approve-product` / `decide`; they should only run after you explicitly confirmed in chat.
- Ask the user at gates in plain text (or the interactive question tool if available) and end your turn.

## Limitations

Sub-agent nesting and concurrency are governed by Claude Code settings; if parallel launch is unavailable the skill runs roles sequentially. Plugin-packaged agents ignore `hooks`/`mcpServers`/`permissionMode`, which these files do not use.

## Recommended permission rules (gates)

The skill runs `pi decide` / `pi approve-product` only after you decide in chat, but nothing in a shell can prove who typed a command. Make Claude Code ask you first, in `.claude/settings.json`:

```json
{ "permissions": { "ask": [
  "Bash(node *pi.mjs decide*)", "Bash(node *pi.mjs approve-product*)",
  "Bash(node *pi.mjs reopen-product*)", "Bash(node *pi.mjs confirm-product*)"
] } }
```

For a stricter barrier set `gates.human_confirmation` to `"tty"` in `.product/config.json` and run those four commands yourself in a terminal.

For `full auto` (unattended), the `approve-product` ask rule above will pause the run at Gate 1. Either answer that one prompt, or keep the rule only for `decide` and rely on the recorded delegation (`--delegated`, shown in `pi status`). Never allow-list `decide`: opportunity decisions must stay yours.
