---
type: opportunity-registry
last_research: 2026-11-17
review_mode: independent
decision_count: 5
decision_head: d298aa39d8de
---
# Opportunities

> Registry of every opportunity ever considered, so rejected or deferred ideas are not rediscovered.
> Status changes: use `pi.mjs transition` (agent steps) and `pi.mjs decide` (user decisions). Do not hand-edit Status of decided rows.

## Market Landscape

Last researched: 2026-11-17. Search scope and queries: four parallel web-research agents (direct/indirect competitors, open source, emerging/adjacent/monetisation, user pain points); roughly 40 web searches and 60 page or API fetches. Live SERP rankings, search volumes and third-party traffic estimates were not obtainable, so demand is largely unquantified. Reddit, Quora, VisaJourney and Stack Exchange could not be read. Product context: client-side only, ad revenue goal, no traffic yet (see PRODUCT.md).

### Direct competitors

| Name | Positioning | Audience | Pricing | Key strengths | Key weaknesses | Evidence |
|---|---|---|---|---|---|---|
| ResizePixel | Free "reduce image in KB" tool with presets 10-500 KB and custom sizes | Form applicants with KB limits | Free, ad-supported | Dedicated KB landing page with presets 10-500 KB | Page says to upload to its website, so likely server-side (vendor page, not tested); no signature crop seen | [E: fact; low; https://resizepixel.com/reduce-image-in-kb; 2026-11-17] |
| imresizer | Browser-based resizer with a 20 KB page, also passport/visa and social sizes | Form, ID, scholarship and visa applicants | Free, no account, no watermark, ads shown, 12-image batch | Accepts HEIC, batch of 12, separate increase-size tool | Claims client-side processing (vendor claim, not tested); one fixed-target page per KB value; no min-max range or signature cleanup seen | [E: fact; medium; https://imresizer.com/resize-photo-to-20kb; 2026-11-17] |
| imageonline.io Resize Signature | Signature resizer to exact pixels plus KB range | Exam, bank and government form applicants | No pricing or ads mentioned on page | Min-max KB, paper cleanup and trim, closest feature overlap with SizeTune; claims no upload (vendor claim) | Signature-only; pixel size fixed; pads to reach minimum KB | [E: fact; medium; https://imageonline.io/resize-signature/; 2026-11-17] |
| PassportPhotoSnap signature tool | Crop, resize to 140x60 and compress a signature to 10-20 KB with SSC/IBPS/PAN presets | Exam applicants and passport-photo users | Free, no account, donation link, app promoted | Canvas-based quality search per its page, exam presets, crop; claims client-side (vendor claim) | JPEG/PNG input only, narrow scope | [E: fact; medium; https://www.passportphotosnap.com/tools/signature-resize-20kb; 2026-11-17] |
| Zamzar resize-image-20kb | Large converter brand with per-KB landing pages (10, 20, 100 KB) | General users | Pricing not stated on page; links to signup | Strong brand and per-KB landing pages | Page implies upload to Zamzar; retention not stated; no signature features | [E: fact; medium; https://www.zamzar.com/tools/resize-image-20kb/; 2026-11-17] |

Additional client-side exact-KB tools exist and were not profiled, for example a WASM MozJPEG exact-KB tool described in a 2025 post [E: fact; low; https://dev.to/dhaval_sisodiya_ba4f090f4/compress-images-to-an-exact-kb-size-offline-with-react-wasm-mozjpeg-live-demo-4jba; 2026-11-17], so a client-side, no-upload claim is common rather than unique.

SERP note: result lists mixed big brands (Zamzar, Cloudinary, Fotor, signNow), mid-size single-purpose tools, exam-form resizers and many clone sites on free hosting (pages.dev, vercel.app, netlify.app). Ranking order was not verified. [E: inference; low; search:resize image to 20kb online; 2026-11-17] Not profiled: compressjpeg, picresize (certificate error), reduceimages, imageresizer.com.

### Indirect competitors

| Name | Positioning | Audience | Pricing | Key strengths | Key weaknesses | Evidence |
|---|---|---|---|---|---|---|
| iLoveIMG and TinyPNG | General image compressors, not KB-target focused | General users | iLoveIMG free with ads, premium 500 INR/month (TinyPNG limits not verified) | Brand, batch, trusted | Server-side (iLoveIMG); TinyPNG retention and limits unverified; exact-KB target not confirmed | [E: fact; medium; https://www.iloveimg.com/pricing; 2026-11-17] |
| Windows Photos, Paint, Mac Preview | Built-in OS resizers, manual loop | Desktop users | Free | No install, no upload | No quality slider; users describe repeated resize-and-check cycles | [E: fact; medium; https://techcommunity.microsoft.com/discussions/windows10space/how-can-i-compress-photo-file-size-to-50kb-in-windows-10/4528769/replies/4528773; 2026-11-17] |
| Android photo-to-KB apps (STCodesApp, Greh) | Mobile apps for photo and signature KB targets | Phone users applying to exams | Ads plus in-app purchase | Native, gallery access | Ads; install counts of 105.6K+ and about 1.2K are from app-listing aggregators | [E: fact; low; https://appgoblin.info/apps/com.stcodesapp.image_compressor; 2026-11-17] |
| Cloudinary and Fotor tool pages | Editors and API vendors with KB landing pages | Designers, developers | Not profiled | Brand, many features | Heavier than a single-purpose tool | [E: fact; low; https://cloudinary.com/tools/reduce-image-size-in-kb; 2026-11-17] |
| WhatsApp, screenshot tricks, form-site built-in tools | Same job by other means | Form applicants | Free | Convenient | No independent sources found | [E: unknown; low; search:how to reduce photo size to 50kb without software Paint WhatsApp screenshot trick mobile app; 2026-11-17] |

### Open-source alternatives

| Project | License | Last release / commit | Maintained? | Usable commercially? | Relevance | Evidence |
|---|---|---|---|---|---|---|
| Squoosh | Apache-2.0 | Push 2026-10-22, no GitHub releases | Yes | Apache-2.0 for the app; bundled codec licenses not checked | Competitor (client-side WASM codecs) and encoder reference | [E: fact; high; https://github.com/GoogleChromeLabs/squoosh; 2026-11-17] |
| compressorjs | MIT | v1.4.0 on 2026-10-01 | Yes | Yes | Enabler; canvas-based like SizeTune | [E: fact; high; https://github.com/fengyuanchen/compressorjs; 2026-11-17] |
| jSquash | Apache-2.0 (jpeg package) | Push 2026-01-05, last npm publish of the jpeg package 2025-05 | Moderate | Unverified: upstream codec licenses (MozJPEG, libwebp) not checked, needs legal review | Enabler; Squoosh codecs as npm modules with finer size control | [E: fact; high; https://github.com/jamsinclair/jSquash; 2026-11-17] |
| mupdf.js | AGPL-3.0, or commercial licence from Artifex per its README | npm mupdf 1.28.6, modified 2026-11-09 | Yes, actively released | Flag AGPL unless a paid commercial licence is bought; cost unknown; needs legal review | Enabler for PDF render and compress | [E: fact; high; https://github.com/ArtifexSoftware/mupdf.js; 2026-11-17] |
| BentoPDF | AGPL-3.0, dual with paid commercial license | Not dated | Unknown | Flag AGPL; docs reportedly offer a one-time commercial license; needs legal review | Competitor toolbox: client-side PDF tools, including a compress-PDF-to-200KB page that says files never leave the device; its licensing page lists a $79 one-time commercial licence | [E: inference; medium; https://bentopdf.com/docs/licensing.html; 2026-11-17] |

Enablers outside the five-row cap: pdf.js (Apache-2.0, active), mediabunny (MPL-2.0, active, WebCodecs), ffmpeg.wasm (wrapper MIT, core license and size unverified), heic2any (MIT, last npm publish 2023-03, last push 2024-04, bundled decoder licence unverified), heic-to (reportedly LGPL-3.0 and maintained; not verified by me), libheif-js (LGPL), tesseract.js (Apache-2.0), wasm-vips (MIT), pdf-lib (MIT, no recent release), @imgly/background-removal (AGPL). Self-hosted server projects (Stirling-PDF open-core, ConvertX AGPL) conflict with the no-backend constraint. The licences and activity in this paragraph come from the open-source research agent and a reviewer's registry check; they are low confidence and every one needs legal review before use. [E: inference; low; https://github.com/mozilla/pdf.js; 2026-11-17]

### Emerging products

| Name | Positioning | Audience | Pricing | Key strengths | Key weaknesses | Evidence |
|---|---|---|---|---|---|---|
| FastFileTool | Browser suite for PDF, video, image and audio convert/compress via FFmpeg WASM | General | Free, no watermark or sign-up | Broad suite, local processing claim | Tiny traction (7 Product Hunt points) | [E: fact; medium; https://www.producthunt.com/products/fastfiletool; 2026-11-17] |
| Indie "100+ client-side tools" suites | Many small in-browser tools built on WASM | General | Mostly free | Cheap to build at scale | Self-reported, near-identical, dates unverified | [E: fact; low; https://www.indiehackers.com/post/i-got-tired-of-uploading-my-files-to-random-free-online-tools-so-i-built-129-of-them-that-never-leave-your-browser-27e58dffcb; 2026-11-17] |
| On-device AI background removers | Transformers.js with WebGPU or WASM running RMBG, MODNet or BiRefNet locally | General | Free | Open models, no upload | Speed varies (about 2 to 12 s, self-reported); no dated 2026 launch found | [E: fact; low; search:browser background remover on-device WebGPU transformers.js free no upload launch 2026; 2026-11-17] |
| Exam-form KB resizer sites | Preset 20/50 KB photo and signature resizers, some client-side | Exam applicants | Free | Exam presets, SEO-targeted | Presets conflict between sites; no launch dates | [E: fact; low; search:resize image to 20kb 50kb online free exam form photo signature new tool launched 2026; 2026-11-17] |

The client-side privacy-first suite is a crowded indie pattern, and its privacy claims are mostly unverifiable. [E: inference; medium; search:new browser-based file tools privacy files never leave your device WebAssembly launch 2026; 2026-11-17]

### Adjacent products and markets

| Name | Positioning | Audience | Pricing | Key strengths | Key weaknesses | Evidence |
|---|---|---|---|---|---|---|
| Compress or split PDF to N KB (ilovepdf, smallpdf, Adobe online) | PDF suites with "compress PDF to 100KB" guide pages | Job, government and university portal applicants | Freemium; ilovepdf says an account unlocks larger files, batch and Premium (prices not verified) | Big brands; vendor claims 860M+ yearly visitors for ilovepdf | Server-side upload; deletion windows vendor-stated | [E: fact; medium; https://www.ilovepdf.com/blog/ilovepdf-15-years-anniversary-milestones; 2026-11-17] |
| HEIC to JPG converters | Single-purpose sites such as heictojpg.com | iPhone users | Not verified | Single-intent organic demand; stale Semrush snippet reports about 1.88M visits in May 2025 | Exposed to AI Overviews and OS-native conversion | [E: inference; low; search:HEIC to JPG converter traffic Similarweb heictojpg OR heic.online OR cloudconvert monthly visits; 2026-11-17] |
| Image format converters and PDF merge/split/image-to-PDF (freeconvert, cloudconvert, pdf2go, TinyWow) | Converter suites with long-tail pages | General | TinyWow ad-funded; others freemium, not verified | Mature, many pages | Mostly server-side | [E: fact; low; search:ilovepdf OR smallpdf OR freeconvert OR photoaid business model ads premium files uploaded servers deleted; 2026-11-17] |
| Compress PDF head term | Demand anchor | General | n/a | Volume unverified: an earlier cited figure came from a page that redirects to a third-party look-alike domain (ahrefstop.com) and has been withdrawn | Dominated by incumbents; client-side PDF compress-to-KB pages already exist (BentoPDF and several small sites) | [E: fact; medium; https://www.bentopdf.com/compress-pdf-to-200kb; 2026-11-17] |
| Background remover, passport/visa photo maker, video compress | On-device clones exist; PhotoAid and Canva are incumbents | General | Not verified | Feasible client-side with WebGPU and WASM | Model download size; competition | [E: hypothesis; low; search:browser background remover on-device WebGPU transformers.js free no upload launch 2026; 2026-11-17] |

### User pain points (recent, independent)

Coverage is thin. The Trustpilot 1-star samples (first 20 reviews per site) are negatively biased.
- Hosted KB tools that report success but return an unchanged or unsmaller file: 2 of 5 App Store reviews of one app (2024-2025) and about 3 to 4 of the first 20 iLoveIMG 1-star reviews (counts differ slightly between two readings; small sample). [E: fact; low; https://ca.trustpilot.com/review/www.iloveimg.com?stars=1; 2026-11-17]
- Free-tool limits and paywalls: about 5 to 6 of the first 20 iLoveIMG 1-star reviews cite daily limits, a batch limit of 3 or premium gating (small sample). [E: fact; low; https://ca.trustpilot.com/review/www.iloveimg.com?stars=1; 2026-11-17]
- "Free" PDF tools that bill unexpectedly: 15 of 20 Smallpdf and 13 of 20 iLovePDF 1-star reviews (2026). Not KB-specific. [E: fact; medium; https://www.trustpilot.com/review/smallpdf.com?stars=1; 2026-11-17]
- HEIC photos rejected by an unrelated upload site (iNaturalist) that says it accepts them: one thread, 8 replies, 2025-2026; not about size limits. [E: fact; low; https://forum.inaturalist.org/t/heic-files-not-being-permitted/68333; 2026-11-17]
- Privacy motive for local tools: stated by builders of client-side tools in Show HN posts (2025), not by end users. [E: fact; low; https://news.ycombinator.com/item?id=45157159; 2026-11-17]
- Blur at tiny KB targets: one App Store review plus the vendor reply. [E: fact; low; https://apps.apple.com/us/app/image-compressor-mb-to-kb/id6477852307; 2026-11-17]
- Not found in user speech: signature turning black at 20 KB in JPG tools, watermarks, minimum-KB requirements, PDF size limits for forms. Absence here is a research gap, not evidence of no need. [E: unknown; low; search:reddit image size reduce to 20 KB signature photo upload form rejected; 2026-11-17]

### Monetisation facts

- AdSense can limit serving on screens with no publisher content or low-value content. [E: fact; high; https://support.google.com/publisherpolicies/answer/11112688; 2026-11-17]
- Ads must not sit near buttons or download links that cause accidental clicks, so keep clear of upload and download controls. [E: fact; high; https://support.google.com/adsense/answer/1346295; 2026-11-17]
- A Google-certified CMP is required to serve personalised ads in the EEA, UK (from 2024-01-16) and Switzerland (from 2024-07-31). [E: fact; high; https://support.google.com/adsense/answer/13554020; 2026-11-17]
- A developer reports a 65-tool site rejected as low-value content with no feedback; a single anecdote that attributes it to site age and traffic. [E: inference; low; https://toolpod.dev/blog/adsense-rejection-low-value-content; 2026-11-17]
- Ahrefs estimates the top result's CTR fell about 58% when an AI Overview appears, on informational keywords, not tool queries. [E: fact; medium; https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/; 2026-11-17]
- No public source found for utility-site RPM; treat as unknown, and geography drives it strongly. [E: unknown; low; search:AdSense RPM by niche utility tools sites average RPM published data; 2026-11-17]

### Changes since previous research

First research run.

## Registry

| ID | Title | Status | Score | Confidence | Tier | Effort | Updated | Feature |
|---|---|---|---|---|---|---|---|---|
| OPP-001 | Per-size landing pages for image and signature KB limits | Ready for Implementation | 69 | Medium | Consider | S | 2026-11-17 | FEATURE-001 |
| OPP-002 | Accept HEIC photos and convert them in the browser | Deferred | 61 | Low | Needs evidence | M | 2026-11-17 | FEATURE-004 |
| OPP-003 | Client-side PDF compression to a target KB | Ready for Implementation | 63 | Low | Needs evidence | L | 2026-11-17 | FEATURE-003 |
| OPP-004 | Ad and consent foundation for content pages | Ready for Implementation | 57 | Medium | Consider | M | 2026-11-17 | FEATURE-002 |
| OPP-005 | Multi-tool site platform (dependency note, not an option) | Under Evaluation | 65 | Medium | Consider | M | 2026-11-17 | - |
| OPP-006 | Bulk resize with one ZIP download | Under Evaluation | 57 | Medium | Consider | M | 2026-11-17 | - |
| OPP-007 | Evaluate whether WASM encoders improve quality at tiny KB targets | Under Evaluation | 54 | Low | Backlog | L | 2026-11-17 | - |
| OPP-008 | Passport and visa photo maker with size specs | Discovered | 55 | Low | Needs evidence | L | 2026-11-17 | - |
| OPP-009 | Serve minimum-size forms when the source is too small | Discovered | 56 | Low | Needs evidence | S | 2026-11-17 | - |
| OPP-010 | Localised pages for other languages | Discovered | 55 | Low | Needs evidence | L | 2026-11-17 | - |

## Review Summary

Independent review by separate sub-agents (general-purpose agent following the independent-reviewer role), three rounds on 2026-11-17. The reviewers ran their own searches and fetches and did not receive the author's reasoning.

- Round 1 (PASS WITH CHANGES, 0 Critical, 6 High): found client-side PDF-to-KB competitors that undercut OPP-003's differentiation, an unverifiable volume source (the cited Ahrefs page redirects to a look-alike domain, confirmed and withdrawn), inflated ratings for OPP-001, 002, 005 and 007, and a HEIC premise contradicted by the file picker's accept list. All resolved: ratings lowered, sources withdrawn or re-tagged, competitors added, HEIC premise re-tagged.
- Round 2 (PASS WITH CHANGES, 0 Critical, 3 High): untagged demand claims on OPP-003, a marginal OPP-001 Recommend, and a mis-sourced thin-content risk. Resolved: OPP-003 re-tagged as hypothesis, OPP-001 and OPP-003 ratings lowered, risk re-sourced to Google's policy.
- Round 3 (PASS WITH CHANGES, 0 Critical, 0 High, 7 Medium, 7 Low): source-attribution and rating consistency items. Applied: OPP-004 scoped to content pages first and business_impact lowered, OPP-007 business_impact lowered (now Backlog), OPP-005 relabelled as a dependency note, TinyPNG and enabler claims downgraded, per-claim citations fixed. The three-round maximum was reached, so these last edits were not re-reviewed by a fourth round.
- Still open: no search volumes, rankings, RPM or real-user data exist for any opportunity; competitor no-upload claims were not network-tested; Reddit, Quora, VisaJourney and Stack Exchange were unreadable; codec and decoder licences need legal review. Net effect: no opportunity reaches Recommend. The review pushed every score down, and the honest overall state is that demand is unmeasured.

## Decision Log

| Date | ID | Decision | By | Note | Content | Seal |
|---|---|---|---|---|---|---|
| 2026-11-17 | OPP-001 | approve | sourav | User chose Approve for OPP-001 in the Gate 2 question dialog, 2026-11-17 (reply to 'Give decisions') | dda34860f259 | b3ac762854f2 |
| 2026-11-17 | OPP-004 | approve | sourav | User chose Approve for OPP-004 in the Gate 2 question dialog, 2026-11-17 (reply to 'Give decisions') | eff54dd779de | bd80e10096b2 |
| 2026-11-17 | OPP-003 | approve | sourav | User chose Approve for OPP-003 in the Gate 2 question dialog, 2026-11-17 (reply to 'Give decisions') | 84e3d56d8210 | f43ac835cebf |
| 2026-11-17 | OPP-002 | approve | sourav | User chose Approve for OPP-002 in the Gate 2 question dialog, 2026-11-17 (reply to 'Give decisions') | 4ff7da1c23c6 | f4b1a448d25c |
| 2026-11-17 | OPP-002 | defer | sourav | User chose Defer HEIC at the FEATURE-004 blocker walk-through, 2026-11-17 | 4ff7da1c23c6 | d298aa39d8de |

## Opportunity Details

### OPP-001 — Per-size landing pages for image and signature KB limits

- **Category:** product extension
- **Source direction:** competitive gap
- **Problem:** People are assumed to search for the exact limit their form states ("resize image to 20kb", "50kb", "100kb"); volume is unmeasured. [E: assumption; medium; n/a; 2026-11-17] SizeTune has one dedicated size page (20 KB) plus the home page and a signature page, [E: fact; high; repo:src/pages/resize-image-to-20kb.astro; 2026-11-17] Which limit-specific queries are unserved is not measured; the home page preselects 50 KB. [E: inference; low; ref:one preset page exists; 2026-11-17]
- **Proposed solution:** Wave 1: 3 to 5 static pages from one template (for example 100 KB for photos and 10 KB for signatures; a 50 KB page overlaps the home page, which already preselects 50 KB, so it must pass the near-duplicate gate or be skipped), each opening the tool with that limit preset. Acceptance criteria from the project's own SEO rules: a distinct preset, at least 300 unique words of target-specific guidance (the repo calls this a tripwire, not a Google requirement), its own FAQ, the near-duplicate similarity gate, a passing STRICT=1 verifier run, and manual curation of each page; otherwise merge into a guide. Wave 2 (more sizes, exam-named pages such as SSC or PAN) only after Search Console shows impressions for wave 1. [E: fact; high; repo:SEO_ARCHITECTURE.md; 2026-11-17]
- **Why it matters:** Ad revenue depends on organic landing pages. More indexable pages that match real queries is likely the cheapest way to add search surface on the existing engine (inference, not measured).
- **Evidence:** Competitors run per-KB pages: imresizer [E: fact; medium; https://imresizer.com/resize-photo-to-20kb; 2026-11-17] and Zamzar, which links to several KB pages (10, 20, 100, 500 KB and others) [E: fact; medium; https://www.zamzar.com/tools/resize-image-20kb/; 2026-11-17]. That shows such pages exist, not that they rank or earn. ResizePixel uses one page with presets, so it is not a per-KB example. The project's own build status lists additional preset pages as not implemented [E: fact; high; repo:BUILD_STATUS.md; 2026-11-17]. Search volume per limit is unknown [E: unknown; low; search:resize image to 20kb online; 2026-11-17].
- **Competitive context:** Parity with imresizer, Zamzar and ResizePixel; no differentiation from the pages alone. Small clone sites on free hosting also rank in the tool's search results, which suggests new sites can be indexed [E: inference; low; search:resize image to 20kb online; 2026-11-17].
- **Expected value:** More long-tail entry pages; measurable through impressions and clicks per page in Search Console after indexing. No baseline exists because the site launched 2026-11-17.
- **Effort:** S — template and content for a handful of pages on the existing tool component and verifier gates.
- **Risks:** AdSense policy says not to place ads on automatically generated content without manual review or curation [E: fact; high; https://support.google.com/publisherpolicies/answer/11112688; 2026-11-17]. Template pages with little unique content may be treated as thin or scaled content; this is an inference, and Google's spam policy was not checked [E: inference; low; ref:AdSense policy 11112688; 2026-11-17]. The project's own plan holds extra preset pages back until Search Console shows impressions, which cannot exist yet, so this opportunity overrides that rule only for a capped first wave and needs the owner's explicit agreement [E: fact; high; repo:SIZETUNE_EXECUTION_PLAN.md; 2026-11-17].
- **Dependencies:** Content that is genuinely different per page; verify:html STRICT thresholds.
- **Ratings:** user_value=3, strategic_alignment=5, market_opportunity=3, competitive_differentiation=2, business_impact=3, implementation_feasibility=5
- **Reviewer notes:** Review round 1: market_opportunity lowered 4 to 3 (demand unknown); capped first wave and acceptance criteria added. Round 2: business_impact lowered 4 to 3 (no volume, revenue or ranking data), tier now Consider (69); re-sourced the thin-content risk to Google's policy. The evidence supports the low cost and the risk of a capped wave, not measured demand.

### OPP-002 — Accept HEIC photos and convert them in the browser

- **Category:** feature parity
- **Source direction:** internal gap
- **Problem:** SizeTune detects HEIC and rejects it. [E: fact; high; repo:src/lib/engine/sniff.ts; 2026-11-17] The file picker only offers JPEG, PNG and WebP, and iOS often hands over a converted JPEG in that case, so how many users actually hit a dead end is unknown and untested on real iPhones. [E: fact; high; repo:src/components/tool/Dropzone.tsx; 2026-11-17] [E: unknown; low; search:iOS Photos picker HEIC to JPEG automatic conversion when accept is image/jpeg; 2026-11-17]
- **Proposed solution:** First step: test HEIC from the iPhone Photos picker, the Files app and drag-and-drop on a real device or simulator to size the problem. Then decode HEIC client-side (lazy-loaded WASM only when a HEIC file is picked), then run the existing resize pipeline and output JPEG. Optionally a standalone "HEIC to JPG" page, which is the stronger search angle if the in-tool problem turns out small.
- **Why it matters:** Removes a dead end for a large phone user group and adds a high-intent query page for ad traffic.
- **Evidence:** One forum thread on an unrelated site shows HEIC uploads rejected although the site says HEIC is supported; weak and off-topic for size limits [E: fact; low; https://forum.inaturalist.org/t/heic-files-not-being-permitted/68333; 2026-11-17]. imresizer lists HEIC among accepted formats [E: fact; medium; https://imresizer.com/resize-photo-to-20kb; 2026-11-17]. HEIC-to-JPG sites have a stale traffic estimate of about 1.88M visits in May 2025 [E: inference; low; search:HEIC to JPG converter traffic Similarweb heictojpg OR heic.online OR cloudconvert monthly visits; 2026-11-17].
- **Competitive context:** Parity with imresizer and many HEIC converters; client-side processing is common among them. Single-step conversion queries may be exposed to AI answers and OS-native conversion [E: hypothesis; low; https://www.tryvizup.com/blog/generative-ui-reaches-ai-overviews; 2026-11-17].
- **Expected value:** Fewer abandoned sessions for HEIC users and a new entry page. Not measurable yet because there is no baseline.
- **Effort:** M — lazy-loaded decoder, size and memory limits on phones, new error paths, tests.
- **Risks:** heic2any is MIT, last published to npm 2023-03 with a last push in 2024-04, and its bundled decoder licence is unverified; libheif-js is LGPL and bundling a WASM decoder into a single file may conflict with LGPL terms. The legal check is a blocking dependency, not a formality. [E: fact; medium; https://github.com/alexcorvi/heic2any; 2026-11-17] WASM size affects the 39 KB first-load budget unless lazy-loaded. Large HEIC files could exhaust memory on low-RAM phones; real devices are untested [E: fact; high; repo:BLOCKERS.md; 2026-11-17].
- **Dependencies:** Legal check of the decoder; limits policy for decoded pixels.
- **Ratings:** user_value=3, strategic_alignment=4, market_opportunity=3, competitive_differentiation=2, business_impact=3, implementation_feasibility=3
- **Reviewer notes:** Review round 1: problem premise re-tagged (picker restricts type), user_value lowered 4 to 3, confidence lowered to Low until real-device test; tier now Needs evidence.

### OPP-003 — Client-side PDF compression to a target KB

- **Category:** product extension
- **Source direction:** adjacent market
- **Problem:** Portals that cap PDF upload size are assumed, not evidenced: no user statement about PDF limits was found. [E: hypothesis; low; n/a; 2026-11-17] Large incumbents gate batch and large files behind accounts and paid plans. [E: fact; medium; https://www.ilovepdf.com/blog/ilovepdf-15-years-anniversary-milestones; 2026-11-17] Client-side alternatives already exist, so the gap is not client-side processing itself.
- **Proposed solution:** A "compress PDF to N KB" tool that runs entirely in the browser (render pages, recompress embedded or rasterised images, rebuild the PDF), with the same honest reporting of whether the target was reached.
- **Why it matters:** The owner wants to broaden the domain with client-side tools, and PDF compression may have larger demand than image-to-KB queries (unquantified assumption, no verified volume). [E: assumption; low; n/a; 2026-11-17] [E: fact; high; user:chat answer 2026-11-17; 2026-11-17]
- **Evidence:** ilovepdf claims 20M+ daily users, account-gated larger files and Premium (vendor claim). A previously cited volume figure was withdrawn after the source redirected to a look-alike domain; no verified volume exists. Reviews of PDF tools mention billing and file-size failures: about 11 to 13 of the first 20 iLovePDF 1-star reviews are about billing or paywall and about 1 mentions a file-size failure (small sample) [E: fact; low; https://www.trustpilot.com/review/ilovepdf.com?stars=1; 2026-11-17]. Demand for "PDF to N KB" specifically was not measured [E: unknown; low; search:compress pdf to 100kb search volume; 2026-11-17].
- **Competitive context:** Dominated by ilovepdf and Smallpdf. Client-side compress-to-KB PDF tools already exist, e.g. BentoPDF's page that says files never leave the device [E: fact; medium; https://www.bentopdf.com/compress-pdf-to-200kb; 2026-11-17], so client-side is not a moat.
- **Expected value:** Possibly a large traffic lever, but unquantified. Cheapest validation before building: ship one or two PDF-size explainer pages (for example 100 KB and 200 KB) and read Search Console impressions, or check a keyword tool for the target-KB variants.
- **Effort:** L — PDF parsing and rebuild, quality control per target, memory limits, new engine contract and tests.
- **Risks:** mupdf.js is actively released but AGPL unless a paid Artifex commercial licence is bought (cost unknown); pdf-lib is MIT with no recent release; that it does not recompress images, that client-side quality for text-heavy scans may be poor, and that competition is the strongest of any option here are inferences, not verified. mupdf.js is AGPL-3.0 with a commercial licence from Artifex. [E: fact; high; https://github.com/ArtifexSoftware/mupdf.js; 2026-11-17] Current npm release 1.28.6 on 2026-11-09. [E: fact; high; https://www.npmjs.com/package/mupdf; 2026-11-17] Evidence for target-size demand is weak.
- **Dependencies:** Legal review of library licences; PDF engine choice; OPP-005 platform work.
- **Ratings:** user_value=3, strategic_alignment=5, market_opportunity=3, competitive_differentiation=2, business_impact=3, implementation_feasibility=2
- **Reviewer notes:** Review round 1: unverifiable volume source withdrawn; client-side competitors added; market 5 to 4, differentiation 3 to 2. Round 2: untagged demand and portal claims re-tagged as assumption/hypothesis; user_value 4 to 3, market 4 to 3, business_impact 4 to 3; score now 63. Confidence Low: a hypothesis to validate with one or two PDF explainer pages, not a recommendation.

### OPP-004 — Ad and consent foundation for content pages

- **Category:** monetization
- **Source direction:** internal gap
- **Problem:** The owner's goal is ad revenue, but the site has no ads, no consent tool and a privacy policy that says tools are meant to stay ad-free. [E: fact; high; repo:src/pages/privacy.astro; 2026-11-17]
- **Proposed solution:** Phase 1: AdSense-ready ad slots on content pages only (guides and landing text), not on tool pages. Tool-page ads are a later, separate decision: the project's own SEO notes warn that a third-party script on a page with a file input could in principle read the selected file, and the owner's answer that tools need not stay ad-free permits ads but does not remove that risk [E: fact; high; repo:SEO_ARCHITECTURE.md; 2026-11-17]. Also add a Google-certified consent tool for EEA, UK and Switzerland visitors, matching privacy and terms updates, and CSP and verifier changes for the ad origins.
- **Why it matters:** It is the route to the owner's ad-revenue goal (other monetisation routes were not researched). Policy compliance protects the account.
- **Evidence:** AdSense restricts ads on low-value screens [E: fact; high; https://support.google.com/publisherpolicies/answer/11112688; 2026-11-17]. Ads must not sit near buttons that cause accidental clicks [E: fact; high; https://support.google.com/adsense/answer/1346295; 2026-11-17]. A certified CMP is required for personalised ads in the EEA, UK and Switzerland [E: fact; high; https://support.google.com/adsense/answer/13554020; 2026-11-17]. RPM for utility sites is unknown [E: unknown; low; search:AdSense RPM by niche utility tools sites average RPM published data; 2026-11-17].
- **Competitive context:** ResizePixel and imresizer show ads. [E: fact; medium; https://resizepixel.com/reduce-image-in-kb; 2026-11-17] The owner's earlier plan kept tools ad-free. [E: fact; high; repo:src/pages/privacy.astro; 2026-11-17]
- **Expected value:** Enables revenue, but with zero traffic today the payoff is nil until pages rank. Sequence after OPP-001 and real content. Alternatives to AdSense and their traffic minimums were not researched [E: unknown; low; search:none run on ad network alternatives; 2026-11-17]. Analytics scope is a separate decision: Search Console already measures search performance, and any extra analytics would be a small follow-up. Third-party sources suggest AdSense has no minimum-traffic rule while other networks have thresholds, but this is low-confidence and unverified. [E: inference; low; search:AdSense approval small site Mediavine Ezoic minimum traffic 2026; 2026-11-17]
- **Effort:** M — consent integration, CSP and privacy-verifier gate changes, copy and legal updates, tests.
- **Risks:** Low-value-content rejection when content is thin; ads degrade the trust message ("Nothing is uploaded") and the privacy-first selling point; verify:privacy gates intentionally forbid third-party origins and must be redesigned; legal text needs the owner's review.
- **Dependencies:** Enough real content; legal review; decision on analytics scope.
- **Ratings:** user_value=2, strategic_alignment=5, market_opportunity=3, competitive_differentiation=1, business_impact=3, implementation_feasibility=3
- **Reviewer notes:** Round 3: business_impact lowered 4 to 3 (payoff nil at zero traffic), scope narrowed to content pages first. Round 1: business_impact lowered 5 to 4 (zero traffic, unknown RPM); sequencing note and analytics baseline added; ad scripts also conflict with the 39 KB first-load budget and current privacy gates.

### OPP-005 — Multi-tool site platform (dependency note, not an option)

- **Category:** technical enablement
- **Source direction:** technology
- **Problem:** Prerequisite, not a standalone feature. The owner wants to run many tools on sizetune.com or its subdomains. Today the site is built around two image tools, with the home page being the image tool and a fixed navigation of jobs. [E: fact; high; repo:src/layouts/Base.astro; 2026-11-17]
- **Proposed solution:** Introduce a tool registry and shared tool shell (layout, upload/download components, size picker, result panel), a hub or directory page, and a documented decision on subpath versus subdomain per tool family. Make the verifier gates per-tool rather than assuming images.
- **Why it matters:** Lowers the cost of each new tool and keeps the domain coherent for search and branding.
- **Evidence:** The owner states the intent. [E: fact; high; user:chat answer 2026-11-17; 2026-11-17] Indie suites with 60-170 tools exist, so the pattern is proven but crowded [E: fact; low; https://www.indiehackers.com/post/i-got-tired-of-uploading-my-files-to-random-free-online-tools-so-i-built-129-of-them-that-never-leave-your-browser-27e58dffcb; 2026-11-17]. No sourced evidence compares subpath and subdomain for search; that is an open question [E: unknown; low; search:none run on subdomain versus subdirectory ranking; 2026-11-17].
- **Competitive context:** Every incumbent is a multi-tool suite (iLoveIMG, ilovepdf, Zamzar); parity, not differentiation.
- **Expected value:** Speeds later tools (OPP-002, OPP-003, OPP-006) (inference). No direct user-visible value alone, so do the minimum refactor when the second new tool is committed rather than ahead of it.
- **Effort:** M — refactor shared components and gates without changing behaviour, plus a design decision.
- **Risks:** Over-engineering before a second tool exists; refactor risk on a green but real-device-untested site; unproven subdomain strategy.
- **Dependencies:** Owner choice of first additional tool.
- **Ratings:** user_value=2, strategic_alignment=5, market_opportunity=3, competitive_differentiation=2, business_impact=4, implementation_feasibility=4
- **Reviewer notes:** Review round 1: user_value lowered 3 to 2. Round 2: not an option for the owner to pick; presented as a dependency note attached to whichever new tool is chosen first, and not to start until a second tool is committed. Its only evidence is the owner's stated intent plus repo structure.

### OPP-006 — Bulk resize with one ZIP download

- **Category:** feature parity
- **Source direction:** competitor weakness
- **Problem:** Users with several documents (photo plus signature plus ID) must repeat the flow per file. Some competitors cap or gate batches; others offer free batches. BUILD_STATUS lists bulk processing as not implemented. [E: fact; high; repo:BUILD_STATUS.md; 2026-11-17]
- **Proposed solution:** Accept multiple files, process them with a worker queue under memory limits, and offer a ZIP download with per-file status.
- **Why it matters:** A differentiator against capped free tiers, increases session depth and the number of page views per visit.
- **Evidence:** imresizer offers a 12-image batch [E: fact; medium; https://imresizer.com/resize-photo-to-20kb; 2026-11-17]. about 1 of the first 20 iLoveIMG 1-star reviews mentions a batch limit of 3 files and about 1 a daily limit (small sample) [E: fact; low; https://ca.trustpilot.com/review/www.iloveimg.com?stars=1; 2026-11-17]. A builder says Squoosh lacks batch uploads [E: fact; low; https://news.ycombinator.com/item?id=46042122; 2026-11-17].
- **Competitive context:** Present in several tools, including imresizer's free batch of 12; the reviewer also reported other free uncapped client-side batch tools that were not verified here, so the "competitors cap or gate batches" premise is too broad. [E: fact; medium; https://imresizer.com/resize-photo-to-20kb; 2026-11-17]
- **Expected value:** Higher engagement for multi-file users; not quantified.
- **Effort:** M — queueing, memory management on phones, ZIP, UI states, tests.
- **Risks:** Memory crashes on phones (untested); form users usually need one or two files, so reach may be small.
- **Dependencies:** Real-device testing.
- **Ratings:** user_value=3, strategic_alignment=3, market_opportunity=3, competitive_differentiation=2, business_impact=3, implementation_feasibility=3
- **Reviewer notes:** Review round 1: differentiation lowered 3 to 2; review counts harmonised and tagged low.

### OPP-007 — Evaluate whether WASM encoders improve quality at tiny KB targets

- **Category:** differentiation
- **Source direction:** internal gap
- **Problem:** At small targets the engine pins quality near q60 and shrinks pixels, and Safari encoder output sizes vary from 1 to 7 times Chrome's, so results can look softer than needed and differ by browser. [E: fact; high; repo:BLOCKERS.md; 2026-11-17]
- **Proposed solution:** Evaluate lazy-loaded WASM JPEG/WebP encoders (for example MozJPEG through jSquash) to hit target sizes with better quality and consistent output across browsers, behind the existing engine contract and verification of real bytes.
- **Why it matters:** Output quality at 20 KB is the core promise, so better results might improve retention and word of mouth. The link to ad revenue is indirect and unproven; the premise that current results are softer than needed is a hypothesis. [E: hypothesis; low; n/a; 2026-11-17] Consistent output across browsers is an untested inference. Existing quality samples use synthetic and landscape images only, so their SSIM figures are not a quality verdict. [E: fact; high; repo:QA/QUALITY_SAMPLES.md; 2026-11-17]
- **Evidence:** The project records the pinned-quality behaviour [E: fact; high; repo:QA/QUALITY_SAMPLES.md; 2026-11-17] and the Safari size variance [E: fact; high; repo:BLOCKERS.md; 2026-11-17]. jSquash packages Squoosh codecs and is Apache-2.0 with a 2026-01-05 push [E: fact; high; https://github.com/jamsinclair/jSquash; 2026-11-17]. Users complain about blur at small targets in one app's reviews [E: fact; low; https://apps.apple.com/us/app/image-compressor-mb-to-kb/id6477852307; 2026-11-17]. Quality on real portraits has never been judged by a human [E: fact; high; repo:BLOCKERS.md; 2026-11-17].
- **Competitive context:** Squoosh uses the same codecs, and a WASM MozJPEG exact-KB tool already exists [E: fact; low; https://dev.to/dhaval_sisodiya_ba4f090f4/compress-images-to-an-exact-kb-size-offline-with-react-wasm-mozjpeg-live-demo-4jba; 2026-11-17]. How SizeTune's output compares with competitors was never measured, so the premise that results look softer than needed is untested.
- **Expected value:** Sharper results at the same size and fewer "too blurry" outcomes; measure by SSIM on a real-photo set and a human review.
- **Effort:** L — encoder integration, bundle size and memory budget, cross-browser tests, retuning the search.
- **Risks:** WASM weight could undo the 39 KB first-load advantage; codec licences unverified; real photos needed to prove the gain, and the owner's human quality review is still pending.
- **Dependencies:** Gate: complete the owner's human quality review (BLOCKERS H10) and a quality benchmark against two competitors on real photos before any build. Also a legal check of codec licences and real-device tests.
- **Ratings:** user_value=3, strategic_alignment=3, market_opportunity=3, competitive_differentiation=2, business_impact=2, implementation_feasibility=3
- **Reviewer notes:** Round 3: business_impact lowered 3 to 2 (link to ad revenue indirect and unproven), score 54, now Backlog until the benchmark and human review exist. Review round 1: differentiation lowered 4 to 3. Round 2: retitled as an evaluation; user_value 4 to 3, strategic 4 to 3, differentiation 3 to 2 (Squoosh and an existing WASM MozJPEG tool use the same codecs); confidence Low until a benchmark and the owner's human quality review show a real gap. Score 57.

### OPP-008 — Passport and visa photo maker with size specs

- **Category:** product extension
- **Source direction:** adjacent market
- **Problem:** Applicants need photos that meet pixel size, head position, background and KB limits. Passport-photo sites exist; whether SizeTune users need a combined tool is unproven.
- **Proposed solution:** A crop and background tool with country or exam presets and a KB target, all client-side.
- **Why it matters:** High-intent queries adjacent to the existing audience.
- **Evidence:** imresizer's navigation lists passport and visa tools [E: fact; medium; https://imresizer.com/resize-photo-to-20kb; 2026-11-17]. The PassportPhotoSnap page cited earlier is its signature tool and does not show passport features. Direct user requests were not found [E: unknown; low; search:visa passport photo upload file size forum; 2026-11-17]. On-device background removal exists but the main library is AGPL [E: hypothesis; low; https://github.com/imgly/background-removal-js; 2026-11-17].
- **Competitive context:** Incumbents (PhotoAid, Canva) and many small sites.
- **Expected value:** Unknown.
- **Effort:** L — face and head alignment, background replacement, presets maintenance.
- **Risks:** Spec accuracy liability if a photo is rejected; AGPL or heavy models; presets drift.
- **Dependencies:** Demand evidence.
- **Ratings:** user_value=3, strategic_alignment=3, market_opportunity=3, competitive_differentiation=2, business_impact=3, implementation_feasibility=2
- **Reviewer notes:** Review round 1: fails the admission test (no evidence of user problem or value). Kept as Discovered so it is not rediscovered; not presented and not counted among scored options.

### OPP-009 — Serve minimum-size forms when the source is too small

- **Category:** UX improvement
- **Source direction:** competitive gap
- **Problem:** Some forms require a minimum size as well as a maximum. SizeTune raises quality to reach a minimum but never pads, so a small source image may end below the minimum with a "below minimum" result. [E: fact; high; repo:BUILD_STATUS.md; 2026-11-17]
- **Proposed solution:** Offer a clearly explained optional path for these cases (for example allow enlarging pixels, or an explicit "pad metadata" opt-in with a warning), and a content page for "increase image size to N KB".
- **Why it matters:** Captures searches and users that competitors serve with separate tools.
- **Evidence:** imageonline.io pads to reach its minimum [E: fact; medium; https://imageonline.io/resize-signature/; 2026-11-17] and imresizer has a separate increase-size tool [E: fact; medium; https://imresizer.com/resize-photo-to-20kb; 2026-11-17]. No user statement asking for a minimum-KB tool was found [E: unknown; low; search:increase image size to minimum KB form upload forum; 2026-11-17].
- **Competitive context:** Competitors serve it, sometimes by padding, which SizeTune deliberately rejected.
- **Expected value:** Unknown; hypothesis only.
- **Effort:** S — mostly copy and an opt-in path; padding conflicts with a standing project decision.
- **Risks:** Padding contradicts the project's "no padding" rule; some portals may reject padded files.
- **Dependencies:** Owner decision on the padding policy.
- **Ratings:** user_value=3, strategic_alignment=3, market_opportunity=2, competitive_differentiation=3, business_impact=2, implementation_feasibility=4
- **Reviewer notes:** Added after review round 1 (reviewer finding 19). Hypothesis; fails the evidence test for a recommendation.

### OPP-010 — Localised pages for other languages

- **Category:** product extension
- **Source direction:** adjacent market
- **Problem:** The owner allows other languages and one competitor offers many, but no evidence shows demand by language. The repo holds Hindi and hreflang back. [E: fact; high; repo:SEO_ARCHITECTURE.md; 2026-11-17]
- **Proposed solution:** Add translated tool and guide pages for a chosen language with hreflang, only after demand evidence for that language.
- **Why it matters:** Could widen organic reach for the same engine without a backend.
- **Evidence:** ResizePixel's language menu shows 15 languages [E: fact; medium; https://resizepixel.com/reduce-image-in-kb; 2026-11-17]. No demand data per language [E: unknown; low; search:resize image to KB search volume by language; 2026-11-17].
- **Competitive context:** At least one competitor offers multiple languages.
- **Expected value:** Unknown.
- **Effort:** L — translation quality, hreflang, maintenance of every page in each language.
- **Risks:** Low-quality translations count as thin content; maintenance multiplies per language.
- **Dependencies:** Demand evidence for a specific language; OPP-001 outcomes.
- **Ratings:** user_value=3, strategic_alignment=3, market_opportunity=3, competitive_differentiation=2, business_impact=3, implementation_feasibility=2
- **Reviewer notes:** Added after review round 1 (reviewer finding 17). Hypothesis only.
