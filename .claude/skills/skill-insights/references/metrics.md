# Reading the numbers

| Metric | Means | If bad, consider |
|---|---|---|
| Avg in / out | fresh tokens per run (input excludes cache) | trim `SKILL.md`; move rarely used text to references; shorter outputs |
| Avg cache-read | context re-read each turn; grows with run length and large results | fewer turns, smaller tool outputs, split phases so context resets |
| Total min | wall time with idle gaps removed | fewer round trips, batch tool calls, parallel where files are disjoint |
| Tool errors | failed tool calls in the skill window | wrong paths or commands in instructions; add the exact command; check helper location |
| Repeated reads | same skill file read twice in a run | inline the 3 lines that matter; reference less |
| Largest result | biggest single tool output | redirect output to a file and read the tail; add a `--summary` flag to helpers |
| Never used | installed, zero invocations in range | delete, merge, or keep only if seasonal |

Heuristics, not verdicts. Small samples (under 3 runs) show direction only. Always compare against the same skill before and after a change.
Standalone vs combined: filter `runs` by skill and compare sessions where other skills ran earlier in the same session.
