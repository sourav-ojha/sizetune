# Growth strategy on Codex

Codex reads the same `SKILL.md` (Agent Skills format). `agents/openai.yaml` in the skill folder carries the display name and allows implicit invocation.

## Install
```bash
npx skills add sourav-ojha/agent-skills --skill growth-strategy -a codex        # project: .agents/skills/growth-strategy
npx skills add sourav-ojha/agent-skills --skill growth-strategy -a codex -g     # personal: ~/.agents/skills/growth-strategy
```

## Invocation
```
$growth-strategy init
$growth-strategy full
$growth-strategy research
$growth-strategy refresh
```
Plain language also works; the text after the skill name is part of your prompt and the first word selects the command. `/skills` lists it.

## Sub-agents
`adapters/codex/agents/gs-*.toml` are custom agents generated from the shared role registry (thin wrappers that read the role file). Install them with:
```bash
node .agents/skills/growth-strategy/core/scripts/install-agents.mjs --agent codex --scope project --project-dir .   # .codex/agents/
node ~/.agents/skills/growth-strategy/core/scripts/install-agents.mjs --agent codex --scope user                    # ~/.codex/agents/
```
By default `model` is omitted (agents inherit your model) and `model_reasoning_effort` follows the tier (reasoning=high, standard=medium, fast=low). Pin models under `models.codex` in `.growth/config.json` and re-run the installer.

## Limitations (stated, not hidden)
- Codex starts sub-agents only when asked; the skill asks explicitly ("spawn gs-search-researcher and gs-distribution-researcher in parallel"). If sub-agents are unavailable, research runs sequentially and the review is recorded as a self-review, which keeps decisions blocked unless you set `gates.require_independent_review` to false in `.growth/config.json` yourself.
- Codex agent files cannot carry a tool allow-list; read-only behaviour rests on the role instructions and your sandbox. Run with a read-only or workspace-write sandbox; only `.growth/` needs writes.
- Web search must be enabled for research; without it the skill marks market claims unknown.

## Approvals
Use an approval policy that prompts before shell commands and decline `gs.mjs approve-baseline`, `decide` and `supersede` unless you just made that decision in chat.

## Verify before relying on
Paths and keys follow the Codex docs used for product-intelligence's adapter (2026-11-16): `.agents/skills`, `~/.agents/skills`, `agents/openai.yaml`, `.codex/agents/*.toml`. If one is not picked up, check https://developers.openai.com/codex/skills and https://developers.openai.com/codex/subagents.
