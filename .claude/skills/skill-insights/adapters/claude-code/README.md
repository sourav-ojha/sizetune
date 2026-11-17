# Claude Code

Install: `npx skills add sourav-ojha/agent-skills --skill skill-insights -a claude-code` (add `-g` for all projects).
Update: `npx skills update skill-insights`.

Transcripts live in `~/.claude/projects/<project>/<session>.jsonl`. Slash-command runs appear as a command message followed by the skill
body; model-invoked runs appear as `Skill` tool calls. Both are detected. Installed skills: `~/.claude/skills` (global) and
`<project>/.claude/skills`.

Quick use: `node ~/.claude/skills/skill-insights/core/scripts/si.mjs report --since 2026-11-01`
