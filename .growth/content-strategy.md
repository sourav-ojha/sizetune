# Content strategy

<!-- Owned by the plan phase (lead). -->

## Summary
SizeTune already has the tools; growth needs (1) unique, useful pages for the intents people actually type, (2) a few high-quality guides, (3) tighter internal links. Volumes are unknown, so the plan favours specific long-tail tasks where large platforms are absent or thin (signature queries still show signNow programmatic pages plus small tools), and ships a few pages at a time then checks indexing. [E: inference; medium; S-002; 2026-11-19]

## Topic clusters
| Cluster | Primary keyword | Target page | Intent |
|---|---|---|---|
| Photo to 20/50/100 KB | resize image to 20kb | existing presets (GRO-006 makes them unique) | transactional |
| Signature KB | resize signature to 10kb, signature resize to 20 kb | existing + new 20 KB (GRO-005) | transactional |
| Exam and form presets | signature size for ssc, ibps, gds, pan | new per-form pages (GRO-007, GRO-008) | informational/transactional |
| Increase to a minimum | increase image size in kb | new tool (GRO-009) | transactional |
| More KB presets | resize image to 30kb, 15kb | new pages later (GRO-010) | transactional |
| Generic reduce | reduce image size in kb | home/tools; guide for the "without losing quality" how-to (GRO-011) | informational |
| KB/MB | kb to mb converter | existing; low commercial value | informational |
| JPG to PDF under KB | jpg to pdf under 100kb | decision GRO-018, build GRO-017 | transactional |
| Social and format | photo size for instagram post | existing; low priority | informational |
Compress-PDF-to-X-KB is dropped: vendor suites dominate and there is no PDF tool. [E: inference; medium; S-006; 2026-11-19]

## Landing-page roadmap
Order: GRO-005 (signature 20 KB), GRO-006 (make presets unique), GRO-007 and the India check in GRO-004 then GRO-008 (verified per-form pages), GRO-019 then GRO-009 (increase size), GRO-011 (guides), GRO-010 (more KB presets, only if earlier pages index), GRO-018 (decision), then GRO-017 only if yes; GRO-009 waits on the method decision GRO-019. Evidence is SERP and autocomplete observation only, served from the US. [E: inference; medium; S-001; 2026-11-19]

## Internal linking plan
Each tool page links to its specific guide and 4 related tools; guides link back to at least three tool pages; per-form pages hang off an exam hub linked from `/tools/` and the footer; no orphan guides (GRO-002). [E: fact; medium; S-037; 2026-11-19]

## Content quality rules
- One page per intent. A page that differs from another only by a number or exam name is a doorway page; each needs a real spec, instructions and FAQ text of its own.
- State specs only from official notices with source and date; never repeat competitor numbers as fact. [E: inference; medium; S-004; 2026-11-19]
- No FAQPage or rating markup (blocked by the verifier). [E: fact; high; S-044; 2026-11-19]
- Real examples (before/after sizes from the tool), no generic filler; ship a few pages, check Search Console for indexing and impressions, then add more.
- Translations only as real translated pages with hreflang; never machine-translated thin copies.
