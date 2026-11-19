# Monetization readiness

<!-- Owned by the plan phase. -->

## Summary
Not ready. Blockers: no consent tool, no contact page, no `ads.txt`, privacy copy that must change first, and thin supporting content. Whether AdSense will approve is unknown. [E: fact; high; S-039; 2026-11-19]

## Readiness
| Check | State | Evidence |
|---|---|---|
| Unique helpful content beyond the tool | partial: 5 guides, ~4,400 words, preset pages near-duplicates | [E: fact; high; S-040; 2026-11-19] |
| Policy pages | about, privacy, terms exist; contact page 404 | [E: fact; high; S-039; 2026-11-19] |
| How files are handled | stated: processed in browser, nothing uploaded | [E: fact; high; S-038; 2026-11-19] |
| Navigation | tools, guides hub, footer; about 10 of 27 tools in nav | [E: fact; high; S-043; 2026-11-19] |
| Traffic quality | unknown: no data | [E: unknown; high; search:no analytics or Search Console data; 2026-11-19] |
| Consent tool and ads.txt | missing | [E: fact; high; S-039; 2026-11-19] |

## Content quality
Preset pages that differ only by a number are the main risk for both ranking and ad review; GRO-006 and GRO-011 address it. [E: inference; medium; S-041; 2026-11-19] Current ad network program policies were not fetched; the owner should read the live AdSense program policies before applying. [E: unknown; high; search:AdSense policies not fetched; 2026-11-19]

## User experience
Owner rule: ads on tool pages are allowed but never adjacent to the tool UI. Keep slots away from controls and result areas, reserve their space to avoid layout shift, and test mobile. In-browser processing can already stress the main thread; measure before and after. [E: assumption; medium; user:chat answer 2026-11-19; 2026-11-19]

## Consent and policy readiness
Privacy copy promises a policy update and a consent tool before ads; both need doing first (GRO-001, GRO-012). Privacy copy promises the consent tool first. [E: fact; high; S-038; 2026-11-19] A Google-certified consent management platform for EEA, UK and Swiss users is the usual route; Google's requirement page was not fetched, so check it before choosing one. [E: assumption; medium; n/a; 2026-11-19] Add `ads.txt` only after an ad account exists. Never click own ads or ask others to.

## Ad placement trade-offs
The live privacy page says the tools "are meant to stay free of ads". Tool-page ads need the owner to approve changing that sentence first, or ads stay on guides only (GRO-012). [E: fact; high; S-038; 2026-11-19]

Conservative start: guides and below-the-fold slots on tool pages, away from the tool. More slots earn more per view but cost task completion and speed; measure success rate (GRO-001) before and after. No revenue figure is predicted. [E: hypothesis; low; n/a; 2026-11-19]
