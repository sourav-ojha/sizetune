# Codex adapter

Codex reads the same `SKILL.md` (Agent Skills format). `agents/openai.yaml` (inside the skill folder) carries Codex UI metadata and the implicit-invocation policy.
Optional custom sub-agents live as TOML files generated from the shared role registry.

## Invocation

```
$product-intelligence init
$product-intelligence research
$product-intelligence opportunities
$product-intelligence feature dark mode for the editor
$product-intelligence refresh
$product-intelligence handoff
$product-intelligence full
```

Plain language also works ("analyse this product and find competitors") because the skill description matches. Codex does not substitute arguments into the skill body; the text after the skill name is simply part of your prompt,
and the skill's first-word routing handles it. You can also run `/skills` to pick it.

## Sub-agents

`agents/pi-*.toml` are Codex custom agents (`name`, `description`, `developer_instructions`, optional `model` / `model_reasoning_effort`). Each is a thin wrapper that reads the shared role file.

```bash
# personal
node ~/.agents/skills/product-intelligence/core/scripts/install-agents.mjs --agent codex --scope user
# this project
node .agents/skills/product-intelligence/core/scripts/install-agents.mjs --agent codex --scope project --project-dir .
```

Files go to `~/.codex/agents/` or `<project>/.codex/agents/`.

Model selection: by default `model` is omitted (agents inherit your configured model) and only `model_reasoning_effort` is set per tier (reasoning=high, standard=medium, fast=low).
To pin models, set `models.codex.reasoning|standard|fast` in `.product/config.json` and re-run the installer. No model names are hardcoded in the methodology.

## Orchestration limitations (documented, not hidden)

- Codex spawns sub-agents **only when asked**. The skill text explicitly instructs delegation ("spawn pi-competitor-researcher …"); if your Codex build or policy blocks sub-agents, the skill runs roles sequentially itself and says so.
- Codex agent files cannot express a Claude-style `tools` allow-list, and per the docs `sandbox_mode` / `approval_policy` are not overridable per agent. Read-only behaviour therefore rests on the role instructions plus `pi verify-clean`.
  Run Codex with a read-only or workspace-write sandbox as you prefer; `.product/` writes are needed for the main session.
- Independent review requires a separate agent. If none can be launched, the skill records `review_mode: self-review` and tells you.
- Concurrency limits come from your `[agents]` settings (`max_concurrent_threads_per_session`).

## Verify before relying on

The Codex docs summary used for this adapter (2026-11-16) listed `.agents/skills` for repo skills and `~/.agents/skills` for user skills, `agents/openai.yaml` with `allow_implicit_invocation`, and `.codex/agents/*.toml` for custom agents.
Codex changes quickly; if a path or key is not picked up, check `https://developers.openai.com/codex/skills` and `https://developers.openai.com/codex/subagents`.

## Recommended approval settings (gates)

Use an approval policy that prompts before running shell commands, and decline `pi.mjs decide`, `approve-product`, `reopen-product` and `confirm-product` unless you just made that decision in chat. For a stricter barrier set `gates.human_confirmation` to `"tty"` in `.product/config.json`: those commands then refuse to run unless a person types `yes` in an interactive terminal, so you run them yourself.

For `full auto` (unattended), the `approve-product` ask rule above will pause the run at Gate 1. Either answer that one prompt, or keep the rule only for `decide` and rely on the recorded delegation (`--delegated`, shown in `pi status`). Never allow-list `decide`: opportunity decisions must stay yours.
