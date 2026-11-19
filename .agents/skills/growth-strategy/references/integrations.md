# Integration contracts

growth-strategy owns research, consolidation, strategic decisions (recorded from the user) and the roadmap. It reads other skills' artifacts and writes handoff files; it never runs another skill on its own and never writes into another skill's folder.

| Skill | Direction | Contract |
|---|---|---|
| product-intelligence | reads | If `.product/PRODUCT.md` has `status: approved`, use it as baseline input (product, audience, capabilities) and set `product_context` in the baseline. Competitor feature research stays there; growth-strategy researches search and distribution coverage only. Never writes `.product/`. |
| experience-audit | reads, recommends | Rendered-page SEO, accessibility and layout checks belong to experience-audit. If `.experience/findings.json` exists, cite the finding by id as a `repo` source (ref `repo:.experience/findings.json#F-xxxx`, no sha256: that ledger changes with every audit decision) in `seo-audit.md` instead of re-measuring; for approved fixes prefer the write-once `repo:.experience/fixes/FIX-NNN.md`. Page-level head and indexing checks are never repeated here. Recommend `experience-audit seo` for routes the audit could not check. |
| brainstorming | recommends | Approved landing pages with an open design (`needs_design: true`) say so in their handoff spec; the user explores them with brainstorming before implementation. growth-strategy does not design pages. |
| implementer | writes input | `gs handoff` writes `.growth/handoff/GRO-NNN.md` for approved items with owner `implementer`: frontmatter `id`, `status: ready`, `source: growth-strategy`, `item`; Goal, Given/When/Then acceptance criteria, Non-goals, Constraints, Open questions (the implementer's mini-spec shape). Written once, never regenerated, so the implementer's close-out (`delivery:`, `status: implemented`, Delivery log) is kept. `gs sync` reads it back and marks the item `done`. The user starts the implementer. |
| delivery-orchestrator | none | It consumes product-intelligence `FEATURE-NNN.md` specs only. Never place `GRO-NNN.md` files in its features folder and never start it from here. |
| skill-insights | emits | Helper commands log metadata to `.skill-runs/growth-strategy.jsonl` (shared run-log contract); `gs retro` adds the agent's self-report. `si export` bundles them. |

## What is never automated

Publishing pages, posting in communities, creating social or directory accounts, submitting sitemaps or listings, outreach emails, buying tools or ads, changing analytics or ad settings, and deploying. These appear only as owner-`human` items in the roadmap, for the user to do after approving them.
