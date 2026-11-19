# 90-day growth roadmap: SizeTune

Generated 2026-11-19 by the growth-strategy helper from approved items only. Review: independent (second growth plan reviewer subagent, R-002, PASS WITH CHANGES; current).
Impact is a qualitative judgment, not a traffic forecast. Owner `human` items are tasks for a person (posting, submissions, outreach); nothing here is done automatically.

## Weeks 1-4

| ID | Type | Item | Owner | Effort | Impact | Evidence | Status | Sources |
|---|---|---|---|---|---|---|---|---|
| GRO-001 | measurement | Update privacy copy and add privacy-friendly usage analytics | implementer | M | H | fact, high | handed-off | [S-036](https://sizetune.com/), [S-038](https://sizetune.com/privacy/), S-045 |
| GRO-002 | internal-linking | Link every tool page to its guide and link the orphan guide | implementer | S | M | fact, medium | handed-off | [S-037](https://sizetune.com/resize-image-to-50kb/), S-040, S-043 |
| GRO-003 | technical-seo | Fix sitemap lastmod, guide authorship and stale SEO doc | implementer | S | L | fact, high | handed-off | [S-035](https://sizetune.com/sitemap-0.xml), S-041, S-042 |
| GRO-004 | measurement | Run the measurement routine: Search Console, India SERP check, Keyword Planner | human | S | H | fact, high | approved | [S-035](https://sizetune.com/sitemap-0.xml), [S-001](https://www.google.com/search?q=resize+image+to+20kb+online), [S-004](https://www.google.com/search?q=SSC+photo+signature+size+requirement+kb+resize+tool) |
| GRO-005 | landing-page | Add /resize-signature-to-20kb and signature KB presets | implementer | S | H | inference, medium | handed-off | [S-007](https://www.google.com/search?q=resize+signature+to+20kb+for+online+form), [S-002](https://www.google.com/search?q=reduce+signature+size+to+10kb+online), [S-027](https://suggestqueries.google.com/complete/search?client=firefox&q=signature%20resize%20to%20), S-033 |
| GRO-006 | content | Make preset pages (20/50/100 KB, signature 10 KB) unique and useful | implementer | M | H | inference, medium | handed-off | S-041, [S-001](https://www.google.com/search?q=resize+image+to+20kb+online), [S-003](https://www.google.com/search?q=photo+size+50kb+for+form+upload+resize), [S-016](https://www.google.com/search?q=resize+image+to+100kb) |
| GRO-007 | landing-page | Verify official photo/signature specs for four forms (SSC, IBPS, India Post GDS, PAN) | human | S | H | inference, medium | approved | [S-004](https://www.google.com/search?q=SSC+photo+signature+size+requirement+kb+resize+tool), [S-014](https://www.google.com/search?q=signature+size+for+gds+post+office+photo+signature+kb), [S-015](https://www.google.com/search?q=IBPS+clerk+photo+signature+size+kb+resize), [S-018](https://www.google.com/search?q=PAN+card+photo+signature+size+kb+resize+online+NSDL) |

## Weeks 5-8

_No approved items._

## Weeks 9-13

_No approved items._

## Item details

### GRO-001: Update privacy copy and add privacy-friendly usage analytics

No analytics or tool events exist, so organic landing pages, tool success and download rates cannot be measured; referrals from distribution cannot be attributed. Privacy copy must change before any analytics or ads, per the owner constraint.

Owner: implementer. Acceptance:
- Given the privacy page is updated, When a visitor reads it, Then it states which analytics run, what is collected and that images are never sent anywhere
- Given a visitor completes a resize, When the tool succeeds or fails or the file is downloaded, Then an event with tool name and outcome (no file data) is recorded
- Given the network tab is open on a tool page, When an image is processed, Then no request carries image bytes

Risks:
- Tool choice (cookieless analytics vs GA4 with consent) changes the consent needs; "nothing is uploaded" trust copy must stay true

### GRO-002: Link every tool page to its guide and link the orphan guide

The live 50 KB page links only to the guides hub; about 24 tool pages have no specific guide link and the 200 KB PDF guide has only guide-to-guide inbound links. Tool to guide to tool links help crawling and ad-quality content depth.

Owner: implementer. Acceptance:
- Given any tool page, When it renders, Then it shows at least one link to a relevant specific guide, not only the hub
- Given the reduce-pdf-to-200kb guide, When the site is built, Then at least one non-guide page links to it
- Given the build, When verify:html runs, Then it passes

Risks:
- Links added to unrelated guides add noise; keep them topical

### GRO-003: Fix sitemap lastmod, guide authorship and stale SEO doc

Sitemap has no lastmod, guide Article markup names only an Organization author, and SEO_ARCHITECTURE.md still says preset pages are held back and og:image is missing. Small hygiene that supports freshness signals and keeps team docs true.

Owner: implementer. Acceptance:
- Given the built sitemap, When an entry is read, Then it carries a lastmod date from content
- Given a guide page, When its JSON-LD is read, Then author is a real Person only if the owner approves, else the Organization stays
- Given SEO_ARCHITECTURE.md, When read, Then it matches live state for preset pages and og:image

Risks:
- Do not invent an author; owner must supply a real name and bio

### GRO-004: Run the measurement routine: Search Console, India SERP check, Keyword Planner

No query data exists at about 2 days old. Everything volume-related is unknown. A monthly Search Console export, a Keyword Planner export and an India-side check of six queries are the cheapest way to turn unknowns into evidence for refresh.

Owner: human. Done when:
- Done when the sitemap is submitted in Search Console, the owner has saved a query export to .growth/performance/ (or noted none exists yet), the six India queries are checked and recorded, and a Keyword Planner export is saved or declined

Risks:
- Search Console shows little until indexing happens; give it about 4 weeks before judging

### GRO-005: Add /resize-signature-to-20kb and signature KB presets

Autocomplete shows "signature resize to 20 kb" first and the SERP has only small tools, no big platform. SizeTune has a 10 KB signature page and a signature tool but no 20 KB page. Cover 15/30/50 KB as presets on the tool, not separate pages.

Owner: implementer. Acceptance:
- Given /resize-signature-to-20kb, When it loads, Then the signature tool opens preset to 20 KB with its own heading, title, copy and FAQ distinct from the 10 KB page
- Given the signature tool, When the user picks 15, 30 or 50 KB, Then the target updates without a new page
- Given the sitemap, When built, Then the new page is listed and verify:html passes

Risks:
- Near-duplicate of the 10 KB page; needs unique copy (when to use 10 vs 20 KB, examples)

### GRO-006: Make preset pages (20/50/100 KB, signature 10 KB) unique and useful

These four pages are presets of one tool and risk thin or doorway judgement (also for ad approval). Give each its own spec guidance, before/after example, common-form notes and FAQ; do not add FAQPage markup.

Owner: implementer. Acceptance:
- Given any of the four preset pages, When its text is compared to the others, Then it has at least a section of unique guidance not shared with the others
- Given each page, When read, Then it states what the limit is typically used for without claiming exam specs as fact
- Given verify:html near-duplicate checks, When run, Then they pass

Risks:
- Padding with generic text does not help; content must be genuinely useful

### GRO-007: Verify official photo/signature specs for four forms (SSC, IBPS, India Post GDS, PAN)

Competitor exam pages disagree on limits (for example signature 10-20 vs 20-100 KB). SizeTune should publish only what official notices say. A person must read current official notifications and record the spec, source URL and date per form.

Owner: human. Done when:
- Done when each of the four forms has a recorded spec (photo and signature size in KB and pixels), the official notification URL and its date

Risks:
- Specs change per notification cycle; record the notification date

## Not approved (recommendations only)

| ID | Type | Item | Owner | Effort | Impact | Evidence | Status | Sources |
|---|---|---|---|---|---|---|---|---|
| GRO-008 | landing-page | Ship four per-form pages (SSC, IBPS, GDS, PAN) using verified specs | implementer | M | H | inference, medium | proposed | [S-004](https://www.google.com/search?q=SSC+photo+signature+size+requirement+kb+resize+tool), [S-014](https://www.google.com/search?q=signature+size+for+gds+post+office+photo+signature+kb), [S-015](https://www.google.com/search?q=IBPS+clerk+photo+signature+size+kb+resize), [S-018](https://www.google.com/search?q=PAN+card+photo+signature+size+kb+resize+online+NSDL), [S-020](https://suggestqueries.google.com/complete/search?client=firefox&q=signature%20size%20for%20) |
| GRO-009 | landing-page | Add an "increase image size in KB" tool and page | implementer | M | H | inference, medium | proposed | [S-017](https://www.google.com/search?q=increase+image+size+in+kb+online), [S-023](https://suggestqueries.google.com/complete/search?client=firefox&q=increase%20image%20size%20in%20kb), S-045 |
| GRO-010 | landing-page | Add KB preset pages 30 KB and 15 KB, then 200 KB if indexed | implementer | S | M | inference, medium | proposed | [S-019](https://suggestqueries.google.com/complete/search?client=firefox&q=resize%20image%20to%20), [S-029](https://imageonline.io/compress-image-to-50kb/), [S-030](https://imresizer.com/resize-image-to-50kb), [S-005](https://www.google.com/search?q=compress+jpg+to+200kb+online) |
| GRO-011 | content | Write the guide: reduce image size in KB without losing quality; extend the forms guide | implementer | M | M | inference, medium | proposed | [S-011](https://www.google.com/search?q=how+to+reduce+image+size+in+kb+without+losing+quality), S-040 |
| GRO-012 | monetization | Prepare AdSense readiness: contact page, consent tool, policy copy, ad slots away from the tool | implementer | M | H | fact, high | proposed | [S-039](https://sizetune.com/ads.txt), [S-038](https://sizetune.com/privacy/), S-045 |
| GRO-013 | monetization | Apply for AdSense once content, policy and consent items are done | human | S | M | assumption, low | proposed | S-040, S-045 |
| GRO-014 | distribution | Post one Show HN and suggest AlternativeTo after owner reads their rules | human | S | M | fact, low | proposed | [S-046](https://news.ycombinator.com/showhn.html), [S-047](https://alternativeto.net/faq), [S-050](http://help.producthunt.com/en/articles/17734384-5-how-to-promote-your-launch-and-what-to-avoid) |
| GRO-015 | distribution | Read the rules of target Reddit, Quora and exam-forum communities, then answer questions | human | M | L | hypothesis, low | proposed | [S-056](https://redship.io/blog/reddit-self-promotion-rules), [S-057](https://www.singlegrain.com/search-everywhere-optimization/12-common-quora-marketing-mistakes-that-damage-brand-reputation/), [S-004](https://www.google.com/search?q=SSC+photo+signature+size+requirement+kb+resize+tool) |
| GRO-016 | content | Check demand and quality bar for Hindi and other-language pages before building | human | S | M | hypothesis, low | proposed | [S-020](https://suggestqueries.google.com/complete/search?client=firefox&q=signature%20size%20for%20), S-045 |
| GRO-017 | landing-page | Build JPG-to-PDF under X KB tool (only if GRO-018 decides yes) | implementer | L | M | inference, medium | proposed | [S-008](https://www.google.com/search?q=convert+jpg+to+pdf+under+100kb), [S-022](https://suggestqueries.google.com/complete/search?client=firefox&q=jpg%20to%20pdf%20under%20) |
| GRO-018 | landing-page | Decide whether to build JPG-to-PDF under X KB | human | S | M | inference, medium | proposed | [S-008](https://www.google.com/search?q=convert+jpg+to+pdf+under+100kb), [S-022](https://suggestqueries.google.com/complete/search?client=firefox&q=jpg%20to%20pdf%20under%20) |
