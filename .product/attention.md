---
generated: 2026-11-17
mode: auto
phases_completed: research (widened), opportunities
---

# Attention report

Written by an autonomous (`full auto widen override`) run. Items below need your eyes; nothing here is a gate. Approved items (OPP-001, OPP-003, OPP-004 and their specs) were **not edited**; conflicts are listed here for you.

## Needs your attention

| ID | Phase | Severity | What | Why the agent could not settle it | Assumed meanwhile | What you should do |
|---|---|---|---|---|---|---|
| A-001 | opportunities | High | FEATURE-002 (ads) vs new ad-network facts: Ezoic wants about 250K monthly users for new sites; Raptive reportedly wants 25K pageviews and a traffic-geography rule favouring US, CA, UK, AU, NZ (unconfirmed, page would not load); AdSense shows no traffic minimum. OPP-004 text still says alternatives were "not researched". | Strategy and money: only you choose the ad network, and "geography does not matter" (your answer) conflicts with premium-network geography rules. | AdSense stays the network in the spec (FR-8); no change made. | Decide whether AdSense-only is enough, or reopen OPP-004 to add a network-choice step. Say "modify OPP-004" to re-evaluate. |
| A-002 | opportunities | High | FEATURE-001 (per-size pages) sets a 300-word floor. Competitor per-KB pages run about 1,200 to 3,300 words with FAQ, and Google's doorway and scaled-content policy names substantially similar pages. | The word floor is a project tripwire, not a Google rule; what is enough is a judgement about content you will write or review. | Spec unchanged; the cap of 5 pages and manual curation remain. | Consider raising the per-page floor or requiring genuinely different guidance per page before implementation. |
| A-003 | opportunities | Medium | OPP-013 (image-to-PDF, now Backlog) would commit a PDF engine path before FEATURE-003's Phase 0 shows demand. | Sequencing is your call. | OPP-013 not presented; Phase 0 remains first. | Keep PDF work gated on Phase 0, or say so if you want image-to-PDF considered separately. |
| A-004 | opportunities | Medium | OPP-011 (exam presets) is contingent on FEATURE-001 wave 1 (exam-named pages are held back in its wave 2 gate). | Depends on Search Console data that does not exist yet. | Presented as Proposed with Low confidence. | Decide on OPP-011 (decision sheet in the final report). |
| A-005 | research | Medium | Licences for HEIC (LGPL only), Ghostscript WASM (AGPL), and several WASM codec chains are verified only at metadata level. | Legal review is not something an agent can do. | Permissive-only for PDF (per your FEATURE-003 choice); HEIC stays Deferred. | Get a legal read before any decoder or PDF library ships. |
| A-006 | research | Low | Competitor "no upload" and ad-network claims were not network-tested; ad checks used page HTML only, and a reviewer could not confirm them. Reddit, Quora, Stack Overflow, Play Store review text, Bing and Google Trends were unreachable. | Web access limits. | All such claims kept at Medium or Low confidence. | Re-check with Search Console and real-device/network tests after launch traffic exists. |
| A-007 | housekeeping | Low | Branch `claude/product-intelligence-init-3c164d` now has a local merge of `origin/dev` and uncommitted `.product/` edits; nothing pushed. | Pushing and committing are yours to request. | Left local. | Say "commit and push" if wanted. |
| A-008 | opportunities | Medium | The scaled-content and doorway policy risk applies to approved FEATURE-001 as well as to deferred or backlog ideas (OPP-011, OPP-016): template pages with little unique content. | A judgement about how much unique content you will write. | No change to FEATURE-001. | Treat A-002 as covering this too. |
| A-009 | opportunities | Low | Your seven proposed tools: bulk compressor is proposed as OPP-006; the others are Discovered (OPP-014 rotator, OPP-015 checker, OPP-016 social, OPP-017 favicon) or Backlog (OPP-008 passport, OPP-012 converters, OPP-013). | Weak or no user-problem evidence and strong free incumbents. | Not presented as options. | Say "research" or "approve" on any to override. |

## Resolved by the agent

| ID | Phase | What | Resolution and evidence | Confidence |
|---|---|---|---|---|
| R-001 | research | Ad-network and AdSense threshold unknowns from the first run | Ezoic threshold verified on its own page; Raptive and Mediavine from secondary sources (low); AdSense shows no minimum. See Market Landscape. | Medium |
| R-002 | research | Subdomain vs subdirectory (OPP-005 unknown) | Google documentation lists trade-offs and a 2018 statement says it treats them the same but prefers keeping content together; subdirectories are the safer default. | Medium |
| R-003 | opportunities | Whether new candidates duplicated existing features | Checked the repo: SizeTune has crop, pixel fields, minimum KB and format choice, but no exam presets, no compliance check, no background cleaning, no Hindi, and its engine rejects AVIF and HEIC. | High |
| R-004 | opportunities | OPP-012 premise (AVIF) and OPP-013 ratings | Fixed after independent review; both returned to Discovered, OPP-013 is Backlog (53). | High |
| R-005 | housekeeping | "Update with latest dev" | `dev` is the base (PR 16 and 17 were merged there); merged `origin/dev` into this branch with no conflicts. Only `.github/workflows/ci.yml` changed; no application source changed. | High |

## Delegated approvals

- PRODUCT.md was already approved by you (revision 3, 2026-11-17). This run did not use delegated approval and did not change it.
- Opportunity decisions: none made in this run. OPP-001, OPP-003 and OPP-004 stay Approved, OPP-002 stays Deferred; those are yours.
