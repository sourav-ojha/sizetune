# Artifacts (`.growth/`, version 1)

Structured data where it is filtered, validated or exported; markdown where it is read. Raw research output is not stored: consolidate first, keep the cited essence. Commit `.growth/` except `performance/` (git-ignored by `gs init`).

| File | Kind | Written by | Content |
|---|---|---|---|
| `growth.json` | JSON | helper only | version, baseline (status, content hash, who approved and their words), phases (done date, stale), review summaries, decision log (append-only), refreshes, performance imports |
| `sources.json` | JSON | `gs add sources`, `gs import` | research provenance: `S-NNN`, type, URL or ref, title, accessed date, sha256 for files |
| `keywords.json` | JSON | `gs add keywords` | keyword research: cluster, intent, geo, language, metrics with provenance, SERP notes, competitors, target page, priority, evidence, sources, researched date, imported performance |
| `keywords.csv` | CSV | `gs export keywords` | spreadsheet export (formula-safe) |
| `items.json` | JSON | `gs add items`; status by `decide`, `handoff`, `sync`, `supersede` | roadmap candidates `GRO-NNN` |
| `seo-audit.md` | markdown | audit | technical SEO and product audit, analytics and consent |
| `competitors.md` | markdown | research | competitor search coverage and SERP observations |
| `distribution.md` | markdown | research | channels, directories, backlinks, partnerships, risks |
| `content-strategy.md` | markdown | plan | clusters, landing-page roadmap, internal links, quality rules |
| `measurement-plan.md` | markdown | plan | Search Console, analytics events, referrals, funnels, retention |
| `monetization.md` | markdown | plan | readiness, content quality, UX, consent and policy, ad placement |
| `reviews/R-NNN.json` | JSON | `gs review record` | full reviewer report bound to the plan hash; its sha256 is kept in `growth.json`, so an edited file is refused |
| `roadmap.md` | markdown | `gs roadmap` | 90-day roadmap from approved items; proposals listed separately |
| `decisions.md` | markdown | helper only | human-readable decision log |
| `handoff/GRO-NNN.md` | markdown | `gs handoff` | implementer specs; then edited by the implementer's close-out |
| `performance/` | user files | the user | raw Search Console or analytics exports (not committed) |
| `config.json` | JSON | the user | optional overrides of `core/config.default.json` |

Schemas: `core/schemas/records.schema.json` (baseline, source, metric, keyword, item, review), `core/schemas/artifacts.json` (required markdown sections per file and phase), `core/schemas/config.schema.json`. Examples: `templates/*.json`.

## Item lifecycle

```
proposed ─► approved ─► handed-off ─► done          (implementer items)
   │           └──────────────────────► (stays approved: human items)
   ├─► rejected | deferred | needs-research ─► (can be decided again)
   └─► superseded (by a newer item; any non-done state)
```

Helper-owned fields (`status`, `superseded_by`, keyword `performance`) cannot be set from input files, and an item status that disagrees with the decision log is a validation error. `gsc` and `analytics` sources are created only by `gs import`. These checks stop hand edits and hostile cloned state; an agent that rewrites every state file at once could still forge it, so the real gate stays the user reading `decisions.md`. A decided item cannot be edited; add a new one and supersede. Decisions, reviews and refreshes are append-only.

## Versioning

`version` in `growth.json` and the config is 1. A future format change will ship a migration in `gs` and a changelog entry; the helper refuses files it cannot read rather than guessing.
