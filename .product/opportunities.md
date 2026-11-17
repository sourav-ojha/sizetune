---
type: opportunity-registry
last_research: 2026-11-17
review_mode: independent
decision_count: 13
decision_head: d06a2ad927f9
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

Widened pass (2026-11-17, `full auto widen override`): four more parallel research agents on new angles (new competitors by HTML inspection, new community and issue-tracker sources, ad-network, SEO-policy and tool-category facts, open-source licences and autocomplete demand proxies). Reddit, Quora, Stack Overflow, Play Store review text and Bing/Google Trends could not be read, so demand is still unmeasured.

**New competitors (all direct, India exam-focused clones are the closest).** None of the processing claims were network-tested; "client-side" below means the page says so. Ad-network names come from one agent's HTML inspection; the independent reviewer's page fetches strip scripts and could not confirm them (photoresizer.in showed only an ad-space placeholder), so treat every ad claim here as low confidence. examdetail.in (per-KB page, says no upload, about 1,400 words) is a further example of the per-KB pattern. [E: fact; medium; https://www.examdetail.in/tools/image-resizer/20kb; 2026-11-17]

| Name | What it is | Notable facts | Evidence |
|---|---|---|---|
| photoresizer.in | Exam photo and signature resizer | Says no upload; loads AdSense; about 3,270 words with FAQ and exam checklist; KB, dimension and percentage modes; batch; compliance check; Hindi; background removal | [E: fact; medium; https://photoresizer.in/; 2026-11-17] |
| docset.in | Per-exam resize pages inside a PDF and Aadhaar tool suite | One URL per exam; bilingual; says photos never uploaded; AdSense and DoubleClick | [E: fact; medium; https://docset.in/resize/ssc-cgl; 2026-11-17] |
| onlineresult.in | Exam photo resizer with SSC preset and signature background cleaner | Says processing stays in the browser; AdSense; preset URL parameter | [E: fact; medium; https://www.onlineresult.in/tools/exam-photo-resizer?preset=ssc; 2026-11-17] |
| mb2kb.com and examdetail.in | One landing page per KB value | Say no upload; AdSense; about 1,200 to 1,400 words with FAQ | [E: fact; medium; https://mb2kb.com/compress-image-to-20kb; 2026-11-17] |
| resizer.exammint.in | Signature resizer to 140x60 px | WebAssembly in-browser claim | [E: fact; medium; https://resizer.exammint.in/signature-resizer; 2026-11-17] |
| picresize.com | Older generic resizer | Server-side (form posts to its server); ad script from adapex.io | [E: fact; medium; https://picresize.com/; 2026-11-17] |
| compressjpeg.com | Generic quality-slider compressor | In-browser per its page; no KB target; batch of 20 | [E: fact; medium; https://compressjpeg.com/; 2026-11-17] |

Not profiled: reduceimages.com and pixelssize.com did not load; mergeimages.net returned 403. [E: unknown; high; https://reduceimages.com/; 2026-11-17]

**What this changes.** The "no upload" claim and per-KB or per-exam pages are common among small sites, not unique to SizeTune. [E: fact; high; https://photoresizer.in/; 2026-11-17] Exam presets, a compliance check, Hindi and batch exist on the strongest clone, which SizeTune lacks. Per-KB pages on competitors are longer (about 1,200 to 3,300 words) than the 300-word tripwire in OPP-001. [E: inference; medium; https://mb2kb.com/compress-image-to-20kb; 2026-11-17]

**Autocomplete demand proxies (weak, no volumes).** Google suggest orders image KB targets 20, 100, 50, 200, 30, 15, 40 KB and PDF targets 200, 100, 500, 50 KB; signature, SSC, UPSC, NEET, RRB, IBPS, PAN and GDS queries recur. [E: inference; low; search:suggestqueries.google.com resize image to ; 2026-11-17] Passport and visa queries are mostly dimensions (cm, pixels), not KB. [E: inference; low; search:suggestqueries.google.com visa photo size; 2026-11-17]

**Pain points (new sources, small samples).** One applicant's 24 KB JPG signature was rejected as invalid although the size was right, cause unknown. [E: fact; low; https://www.careers360.com/question-why-is-my-jee-form-saying-that-signature-jpg-is-not-valid-despite-correct-size-24kb-its-the-same-with-my-category-certificate-pdf-too-uploaded-size-286kb-but-my-photo-was-uploaded-successfully-kindly-answer-this-asap; 2026-11-17] browser-image-compression has an open issue about PNG output ignoring its size target (library issue, not an end-user complaint). [E: fact; medium; https://github.com/Donaldcwl/browser-image-compression/issues/176; 2026-11-17] A second open issue reports white borders when size and dimension caps combine. [E: fact; medium; https://www.github.com/Donaldcwl/browser-image-compression/issues/178; 2026-11-17] No first-hand complaint about a minimum-KB rejection or a PDF size limit was found. [E: unknown; low; search:photo size should be between kb file too small upload application form; 2026-11-17]

**Monetisation and SEO facts that answer earlier unknowns.**
- Ezoic asks for about 250,000 monthly users for sites added after 2026-02-19 (earlier publishers are grandfathered). [E: fact; high; https://support.ezoic.com/kb/article/getting-started-ezoics-requirements; 2026-11-17]
- Raptive's minimum is reported as 25,000 monthly pageviews, with a traffic-geography rule (at least 50% from US, CA, UK, AU or NZ at 25 to 99K pageviews); the reviewer could not load Raptive's pages, so this is low confidence. If it holds, geography matters for premium ad networks, though not for AdSense eligibility (inference). [E: fact; low; https://help.raptive.com/hc/en-us/articles/360032840891-Who-is-eligible-for-Raptive; 2026-11-17]
- AdSense's eligibility page, as fetched (truncated), shows no traffic minimum. [E: inference; medium; https://support.google.com/adsense/answer/9724; 2026-11-17]
- Google says it treats subdomains and subdirectories about the same but prefers keeping related content together (a 2018 hangout statement); its documentation lists trade-offs, not a ranking claim. [E: fact; medium; https://www.searchenginejournal.com/google-treats-subdomains-subdirectories-john-mueller-says/254687/; 2026-11-17]
- Google's spam policy names scaled content abuse and doorway pages; substantially similar pages are a doorway example. [E: fact; high; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]
- RMBG-1.4 (background removal) is non-commercial licensed. [E: fact; high; https://huggingface.co/briaai/RMBG-1.4; 2026-11-17]
- Semrush estimates (low confidence, India-skewed): iLoveIMG about 40M monthly visits; iLovePDF about 303M. [E: inference; low; https://www.semrush.com/website/iloveimg.com/overview/; 2026-11-17]

**Licences checked (each from its own source; all need legal review before use).**
- heic-to is LGPL-3.0-or-later. [E: fact; high; https://github.com/hoppergee/heic-to/blob/main/LICENSE; 2026-11-17]
- libheif is LGPL; its sample apps and wrappers are MIT. [E: fact; high; https://github.com/strukturag/libheif/blob/master/COPYING; 2026-11-17]
- No permissive HEIC decoder turned up in npm and GitHub licence checks; this is an absence in one pass, not proof none exists. [E: inference; low; search:npm and GitHub licence checks of heic decoder packages; 2026-11-17]
- pdf-lib is MIT; its last release date (2021) is unconfirmed by the reviewer, who saw no release dates on GitHub. [E: inference; medium; https://github.com/Hopding/pdf-lib; 2026-11-17]
- pdf.js is Apache-2.0 and active (read and render only, it does not write PDFs). [E: fact; medium; https://github.com/mozilla/pdf.js; 2026-11-17]
- qpdf WASM wrappers are ISC or Apache-2.0 and restructure streams but do not recompress images. [E: fact; medium; https://github.com/neslinesli93/qpdf-wasm; 2026-11-17]
- Ghostscript WASM builds are AGPL-3.0. [E: fact; high; https://github.com/alam00000/bentopdf-gs-wasm; 2026-11-17]
- No single permissive library recompresses images inside a PDF; a build from pdf-lib, qpdf-wasm and the existing canvas worker is plausible but unproven. [E: inference; medium; https://github.com/Hopding/pdf-lib; 2026-11-17]

**Widened pass tally.** About 13 candidates examined; 3 registered (OPP-011, OPP-012, OPP-013, all Low confidence after review); 1 merged (PDF to JPG into OPP-013); 5 dropped (background removal: no evidence of an audience need, extreme competition, and RMBG-1.4 is non-commercial (other models not checked); video compress: no evidence tying it to the audience; OCR and QR/text utilities: no evidence or product link; standalone HEIC page: already Deferred as OPP-002, licence finding is not new demand evidence); 4 existing items updated with evidence (OPP-005, OPP-010, plus flags on OPP-001 and OPP-004, which are approved and left unchanged).

### Feature research: seven owner-proposed tools (2026-11-17, `feature` command)

The owner asked about Bulk Image Compressor, Bulk Image Converter, Image Rotator, Passport Photo Maker, Image Format Checker, social thumbnail resizers and Favicon/App Icon generators. A request is not approval. Four parallel research agents covered them; Reddit, Trustpilot, Play Store and Product Hunt user voice could not be loaded, and no search volumes exist (Google/DuckDuckGo autocomplete gives ordering only). Mapping to the registry: Bulk Compressor merges into OPP-006, Bulk Converter into OPP-012, Passport Photo into OPP-008; Rotator, Format Checker, social resizers and Favicon/App Icon are new (OPP-014 to OPP-017).

- **Bulk compression.** Squoosh's multi-file request (#301) has 115 reactions and was closed in 2020, pointing users to the Squoosh CLI as the batch route. [E: fact; medium; https://github.com/GoogleChromeLabs/squoosh/issues/301; 2026-11-17] A later request (#1406) is open since 2024 with about 58 reactions and users built forks. [E: fact; medium; https://github.com/GoogleChromeLabs/squoosh/issues/1406; 2026-11-17] TinyPNG limits free use to 20 images of 5 MB each and keeps uploads up to 48 hours. [E: fact; medium; https://tinypng.com; 2026-11-17] BIRME claims in-browser bulk processing with ZIP. [E: fact; low; https://www.birme.net; 2026-11-17] Autocomplete suggests "bulk image compressor to 50kb/100kb/20kb". [E: inference; low; search:suggestqueries.google.com bulk image compressor; 2026-11-17] fflate (MIT) and JSZip (dual MIT/GPL) are usable client-side ZIP libraries. [E: fact; high; https://api.github.com/repos/101arrowz/fflate; 2026-11-17] Phone memory use for many large photos is an untested risk. [E: hypothesis; low; n/a; 2026-11-17]
- **Bulk conversion.** heic.online is server-side and accepts up to 100 files. [E: fact; medium; https://heic.online; 2026-11-17] CloudConvert's free plan is 10 credits a day. [E: fact; high; https://cloudconvert.com/pricing; 2026-11-17] Privacy as a differentiator comes from vendor pages only. [E: inference; low; https://heic.online; 2026-11-17] heic2any has an open crash report on a large HEIC. [E: fact; medium; https://github.com/alexcorvi/heic2any/issues/64; 2026-11-17] libheif is LGPL (HEIC stays Deferred as OPP-002). [E: inference; low; https://api.github.com/repos/strukturag/libheif; 2026-11-17]
- **Passport photo.** Competitors range from free server-side croppers (idphoto4you) to paid services with acceptance guarantees (Visafoto, which already offers a KB-size option). [E: fact; low; https://www.visafoto.com; 2026-11-17] One user reported a photo passing one government tool but failing another's upload. [E: fact; low; https://www.uniquephoto.com/community/qa/why-can-a-passport-style-photo-pass-the-state-department-photo-tool-but-still-be-rejected-by-uscis-upload; 2026-11-17] The real pain is acceptance, which a free tool cannot guarantee (inference). MediaPipe is Apache-2.0. [E: fact; medium; https://api.github.com/repos/google-ai-edge/mediapipe; 2026-11-17] @imgly/background-removal is AGPL-3.0 per the GitHub API (not fetched by the reviewer). [E: fact; medium; https://api.github.com/repos/imgly/background-removal-js; 2026-11-17] RMBG-1.4 is non-commercial licensed. [E: fact; high; https://huggingface.co/briaai/RMBG-1.4; 2026-11-17]
- **Rotator.** The head term is dominated by iLoveIMG, Img2go, Canva and Adobe Express (all free). [E: fact; medium; https://www.img2go.com/rotate-image; 2026-11-17] Browsers apply EXIF orientation by default. [E: fact; high; https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap; 2026-11-17] SizeTune's engine decodes with orientation applied. [E: fact; high; repo:src/lib/engine/env.ts; 2026-11-17] Canvas rotation is trivial but re-encodes JPEG; lossless rotation needs a WASM jpegtran build of unverified upkeep. [E: fact; low; https://socket.dev/npm/package/jpegtran-js; 2026-11-17] No applicant-specific complaint was found. [E: unknown; low; search:sideways photo upload form applicant; 2026-11-17]
- **Format checker.** Competitors are EXIF viewers (Metadata2go processes files on servers) and a few real-file-type checkers. [E: fact; medium; https://www.metadata2go.com; 2026-11-17] photoresizer.in links a "Photo Compliance Checker" beside its exam presets, though its page does not say it returns an explicit pass or fail. [E: fact; medium; https://photoresizer.in/; 2026-11-17] Renamed or mismatched files (WebP named .jpg) are rejected by upload systems in several support threads seen as search snippets only. [E: fact; low; search:photo upload rejected invalid file format jpg actually png webp heic; 2026-11-17] "is my image a real jpeg" shows thin autocomplete demand. [E: fact; low; https://suggestqueries.google.com/complete/search?client=firefox&q=is%20my%20image%20a%20real%20jpeg; 2026-11-17] exifr is MIT. [E: fact; high; https://github.com/MikeKovarik/exifr; 2026-11-17]
- **Social resizers.** Specs move: YouTube's help page lists a 50 MB thumbnail cap on desktop and 2 MB on mobile, while many blogs still say 2 MB. [E: fact; medium; https://support.google.com/youtube/answer/72431; 2026-11-17] Reel cover and LinkedIn banner sizes conflict across third-party guides, with no official page read. [E: unknown; low; search:Instagram reel cover size help center; 2026-11-17] Canva, Kapwing and Adobe Express offer free resizers, so price is no differentiator. [E: fact; low; https://www.kapwing.com/resize-image; 2026-11-17] The audience (creators) differs from SizeTune's form applicants. [E: inference; low; ref:competitor tags above; 2026-11-17] Google's spam policy lists doorway pages as abuse, so near-identical size pages are a risk. [E: fact; high; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]
- **Favicon and app icons.** realfavicongenerator.net is the leader (Semrush estimate of 556,300 visits in September 2026, a competitor estimate, low confidence). [E: inference; low; https://de.semrush.com/website/realfavicongenerator.net/overview/; 2026-11-17] Apple's guidelines specify a 1024 px layout size for iOS, iPadOS and macOS and say the system scales to smaller sizes (tvOS and watchOS differ); that per-size sets are now legacy output is my inference. [E: inference; medium; https://developer.apple.com/design/human-interface-guidelines/app-icons.md; 2026-11-17] The page's change log shows two dated entries in 2026, including one on 2026-10-28. [E: fact; medium; https://developer.apple.com/design/human-interface-guidelines/app-icons.md; 2026-11-17] Free CLIs (Capacitor assets, pwa-asset-generator) serve developers. [E: fact; medium; https://github.com/ionic-team/capacitor-assets; 2026-11-17] Vendor sources claim developers block ads heavily; no developer RPM figure was found. [E: fact; low; https://carbonads.net/blog/developer-advertising-guide-2026; 2026-11-17]


## Registry

| ID | Title | Status | Score | Confidence | Tier | Effort | Updated | Feature |
|---|---|---|---|---|---|---|---|---|
| OPP-001 | Per-size landing pages for image and signature KB limits | Ready for Implementation | 69 | Medium | Consider | S | 2026-11-17 | FEATURE-001 |
| OPP-002 | Accept HEIC photos and convert them in the browser | Deferred | 61 | Low | Needs evidence | M | 2026-11-17 | FEATURE-004 |
| OPP-003 | Client-side PDF compression to a target KB | Ready for Implementation | 63 | Low | Needs evidence | L | 2026-11-17 | FEATURE-003 |
| OPP-004 | Ad and consent foundation for content pages | Ready for Implementation | 57 | Medium | Consider | M | 2026-11-17 | FEATURE-002 |
| OPP-005 | Multi-tool site platform (dependency note, not an option) | Under Evaluation | 65 | Medium | Consider | M | 2026-11-17 | - |
| OPP-006 | Bulk resize with one ZIP download | Ready for Implementation | 57 | Medium | Consider | M | 2026-11-17 | FEATURE-005 |
| OPP-007 | Evaluate whether WASM encoders improve quality at tiny KB targets | Under Evaluation | 54 | Low | Backlog | L | 2026-11-17 | - |
| OPP-008 | Passport and visa photo maker with size specs | Approved | 52 | Low | Backlog | L | 2026-11-17 | FEATURE-011 |
| OPP-009 | Serve minimum-size forms when the source is too small | Discovered | 56 | Low | Needs evidence | S | 2026-11-17 | - |
| OPP-010 | Localised pages for other languages | Discovered | 55 | Low | Needs evidence | L | 2026-11-17 | - |
| OPP-011 | Exam-form preset pack with a pixel, KB and file-type compliance check | Deferred | 63 | Low | Needs evidence | M | 2026-11-17 | - |
| OPP-012 | Client-side image format converters (WebP and PNG to JPG) | Ready for Implementation | 57 | Low | Needs evidence | S | 2026-11-17 | FEATURE-006 |
| OPP-013 | Client-side image-to-PDF and JPG-to-PDF | Discovered | 53 | Low | Backlog | M | 2026-11-17 | - |
| OPP-014 | Image rotator and flipper | Ready for Implementation | 50 | Low | Backlog | S | 2026-11-17 | FEATURE-007 |
| OPP-015 | "Will this file pass?" image checker (format, KB, pixels, type) | Ready for Implementation | 60 | Low | Needs evidence | M | 2026-11-17 | FEATURE-008 |
| OPP-016 | Social media (Instagram, LinkedIn, YouTube) image resizers | Ready for Implementation | 46 | Low | Backlog | S | 2026-11-17 | FEATURE-009 |
| OPP-017 | Favicon and app icon generator | Ready for Implementation | 49 | Low | Backlog | M | 2026-11-17 | FEATURE-010 |

## Review Summary

Independent review by separate sub-agents (general-purpose agent following the independent-reviewer role), three rounds on 2026-11-17. The reviewers ran their own searches and fetches and did not receive the author's reasoning.

- Round 1 (PASS WITH CHANGES, 0 Critical, 6 High): found client-side PDF-to-KB competitors that undercut OPP-003's differentiation, an unverifiable volume source (the cited Ahrefs page redirects to a look-alike domain, confirmed and withdrawn), inflated ratings for OPP-001, 002, 005 and 007, and a HEIC premise contradicted by the file picker's accept list. All resolved: ratings lowered, sources withdrawn or re-tagged, competitors added, HEIC premise re-tagged.
- Round 2 (PASS WITH CHANGES, 0 Critical, 3 High): untagged demand claims on OPP-003, a marginal OPP-001 Recommend, and a mis-sourced thin-content risk. Resolved: OPP-003 re-tagged as hypothesis, OPP-001 and OPP-003 ratings lowered, risk re-sourced to Google's policy.
- Round 3 (PASS WITH CHANGES, 0 Critical, 0 High, 7 Medium, 7 Low): source-attribution and rating consistency items. Applied: OPP-004 scoped to content pages first and business_impact lowered, OPP-007 business_impact lowered (now Backlog), OPP-005 relabelled as a dependency note, TinyPNG and enabler claims downgraded, per-claim citations fixed. The three-round maximum was reached, so these last edits were not re-reviewed by a fourth round.
- Widened pass (`full auto widen override`, same day), review round 4 (PASS WITH CHANGES, 0 Critical, 4 High, 9 Medium, 5 Low), by a separate general-purpose agent following the independent-reviewer role, with spot-check fetches. Applied: OPP-012 premise re-tagged as assumption and AVIF removed (the engine rejects AVIF); OPP-012 and OPP-013 returned to Discovered because they fail the evidence test; OPP-013 re-rated (53, Backlog); competitor claims, Raptive, AdSense and licence tags downgraded or split into one source per tag; approved items OPP-001, OPP-003 and OPP-004 were not edited and their conflicts are queued in `.product/attention.md`. This was one review round; the other open points are in the attention queue.
- Feature research (seven owner-proposed tools), review round 5 (PASS WITH CHANGES, 0 Critical, 4 High, 8 Medium, 5 Low), by a separate general-purpose agent with spot-check fetches. Applied: Squoosh reaction counts split between issues #301 and #1406, Semrush figure corrected, OPP-015 differentiation lowered (score 60), licence and YouTube claims split into one source per tag; OPP-014, OPP-015, OPP-016 and OPP-017 returned to Discovered because they fail the evidence test; OPP-008 lowered to 52 (Backlog); OPP-006 kept at 57 and proposed. One review round only.
- Still open: no search volumes, rankings, RPM or real-user data exist for any opportunity; competitor no-upload claims were not network-tested; Reddit, Quora, VisaJourney and Stack Exchange were unreadable; codec and decoder licences need legal review. Net effect: no opportunity reaches Recommend. The review pushed every score down, and the honest overall state is that demand is unmeasured.

## Decision Log

| Date | ID | Decision | By | Note | Content | Seal |
|---|---|---|---|---|---|---|
| 2026-11-17 | OPP-001 | approve | sourav | User chose Approve for OPP-001 in the Gate 2 question dialog, 2026-11-17 (reply to 'Give decisions') | dda34860f259 | b3ac762854f2 |
| 2026-11-17 | OPP-004 | approve | sourav | User chose Approve for OPP-004 in the Gate 2 question dialog, 2026-11-17 (reply to 'Give decisions') | eff54dd779de | bd80e10096b2 |
| 2026-11-17 | OPP-003 | approve | sourav | User chose Approve for OPP-003 in the Gate 2 question dialog, 2026-11-17 (reply to 'Give decisions') | 84e3d56d8210 | f43ac835cebf |
| 2026-11-17 | OPP-002 | approve | sourav | User chose Approve for OPP-002 in the Gate 2 question dialog, 2026-11-17 (reply to 'Give decisions') | 4ff7da1c23c6 | f4b1a448d25c |
| 2026-11-17 | OPP-002 | defer | sourav | User chose Defer HEIC at the FEATURE-004 blocker walk-through, 2026-11-17 | 4ff7da1c23c6 | d298aa39d8de |
| 2026-11-17 | OPP-011 | defer | sourav | User: 'Defer OPP-011' (reply to Gate 2 decision sheet, 2026-11-17) | 789fa8d6db11 | 4bfafd32a054 |
| 2026-11-17 | OPP-006 | approve | sourav | User: 'Approve OPP-006' (reply to Gate 2 decision sheet, 2026-11-17) | 153c1f5be11a | e20b8aabd117 |
| 2026-11-17 | OPP-008 | approve | sourav | User: 'lets add them, so we ll have more tools in our arsenal' (owner override of Backlog/Needs-evidence tier, 2026-11-17) | 1344bd07e6b9 | 3ad8894a2d11 |
| 2026-11-17 | OPP-012 | approve | sourav | User: 'lets add them, so we ll have more tools in our arsenal' (owner override of Backlog/Needs-evidence tier, 2026-11-17) | 2a671f9909bc | 5626037167e7 |
| 2026-11-17 | OPP-014 | approve | sourav | User: 'lets add them, so we ll have more tools in our arsenal' (owner override of Backlog/Needs-evidence tier, 2026-11-17) | 470dae0fbb6e | 2d6f447ec2f8 |
| 2026-11-17 | OPP-015 | approve | sourav | User: 'lets add them, so we ll have more tools in our arsenal' (owner override of Backlog/Needs-evidence tier, 2026-11-17) | c8cf40333119 | ea2fc4e19686 |
| 2026-11-17 | OPP-016 | approve | sourav | User: 'lets add them, so we ll have more tools in our arsenal' (owner override of Backlog/Needs-evidence tier, 2026-11-17) | 67726529a2a4 | 281a9902d7ad |
| 2026-11-17 | OPP-017 | approve | sourav | User: 'lets add them, so we ll have more tools in our arsenal' (owner override of Backlog/Needs-evidence tier, 2026-11-17) | a73bf4e09ee4 | d06a2ad927f9 |

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
- **Evidence:** The owner states the intent. [E: fact; high; user:chat answer 2026-11-17; 2026-11-17] Indie suites with 60-170 tools exist, so the pattern is proven but crowded [E: fact; low; https://www.indiehackers.com/post/i-got-tired-of-uploading-my-files-to-random-free-online-tools-so-i-built-129-of-them-that-never-leave-your-browser-27e58dffcb; 2026-11-17]. No sourced evidence compares subpath and subdomain for search; that is an open question [E: unknown; low; search:none run on subdomain versus subdirectory ranking; 2026-11-17]. Widened pass: Google's documentation treats both as trade-offs, and a 2018 Google statement says it sees them the same but prefers keeping content together; no data on new subdomains was found, so subdirectories are the safer default [E: fact; medium; https://www.searchenginejournal.com/google-treats-subdomains-subdirectories-john-mueller-says/254687/; 2026-11-17].
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
- **Feature research (2026-11-17), "Bulk Image Compressor" request:** Squoosh's multi-file request (#301) has 115 reactions and was closed in 2020 with a pointer to its CLI. [E: fact; medium; https://github.com/GoogleChromeLabs/squoosh/issues/301; 2026-11-17] A later request (#1406) is open with about 58 reactions and forks built. [E: fact; medium; https://github.com/GoogleChromeLabs/squoosh/issues/1406; 2026-11-17] Free in-browser or uncapped bulk tools already exist (BIRME, and imresizer's 12-file batch), so the unproven gap is per-file KB targeting in a batch; TinyPNG's limit and BIRME's claim are vendor-sourced. Autocomplete suggests bulk compression to 20, 50 and 100 KB. [E: inference; low; search:suggestqueries.google.com bulk image compressor; 2026-11-17] TinyPNG caps free batches at 20 images of 5 MB. [E: fact; medium; https://tinypng.com; 2026-11-17] This supports demand for batch KB targeting more than before; no volumes exist. Scope proposal: batch compress or resize to a per-file KB target with ZIP output.

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
- **Ratings:** user_value=3, strategic_alignment=3, market_opportunity=3, competitive_differentiation=1, business_impact=3, implementation_feasibility=2
- **Reviewer notes:** Review round 1: fails the admission test (no evidence of user problem or value). Kept as Discovered so it is not rediscovered; not presented and not counted among scored options.
- **Feature research (2026-11-17):** Visafoto already offers a KB-size option with an acceptance guarantee, and a free tool cannot match that. [E: fact; low; https://www.visafoto.com; 2026-11-17] A common browser background-removal library is AGPL-3.0 and a common model is non-commercial, so permissive options need checking. [E: fact; medium; https://api.github.com/repos/imgly/background-removal-js; 2026-11-17] Wrong specs create liability (inference). [E: inference; medium; https://www.uniquephoto.com/community/qa/why-can-a-passport-style-photo-pass-the-state-department-photo-tool-but-still-be-rejected-by-uscis-upload; 2026-11-17] Visafoto's refund promise and the liability risk are why a free tool cannot offer the same guarantee (inference). Differentiation lowered 2 to 1 (score 52, Backlog); the owner asked about this idea, but the evidence does not support recommending it now.

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
- **Evidence:** ResizePixel's language menu shows 15 languages [E: fact; medium; https://resizepixel.com/reduce-image-in-kb; 2026-11-17]. Widened pass: docset.in and photoresizer.in offer Hindi, so a bilingual competitor set exists [E: fact; high; https://photoresizer.in/; 2026-11-17]. No demand data per language [E: unknown; low; search:resize image to KB search volume by language; 2026-11-17].
- **Competitive context:** At least one competitor offers multiple languages.
- **Expected value:** Unknown.
- **Effort:** L — translation quality, hreflang, maintenance of every page in each language.
- **Risks:** Low-quality translations count as thin content; maintenance multiplies per language.
- **Dependencies:** Demand evidence for a specific language; OPP-001 outcomes.
- **Ratings:** user_value=3, strategic_alignment=3, market_opportunity=3, competitive_differentiation=2, business_impact=3, implementation_feasibility=2
- **Reviewer notes:** Added after review round 1 (reviewer finding 17). Hypothesis only.

### OPP-011 — Exam-form preset pack with a pixel, KB and file-type compliance check

- **Category:** product extension
- **Source direction:** competitive gap
- **Problem:** Applicants must satisfy several rules at once (KB range, pixel size, file type), and published exam rules differ between sites. One applicant's signature at the right size was still rejected as invalid, cause unknown. [E: fact; low; https://www.careers360.com/question-why-is-my-jee-form-saying-that-signature-jpg-is-not-valid-despite-correct-size-24kb-its-the-same-with-my-category-certificate-pdf-too-uploaded-size-286kb-but-my-photo-was-uploaded-successfully-kindly-answer-this-asap; 2026-11-17] Sources disagree on SSC dimensions. [E: inference; low; https://truejobs.co.in/blog/government-exam-photo-signature-upload-2026; 2026-11-17]
- **Proposed solution:** A small, hand-maintained preset list (for example SSC, UPSC, NEET photo and signature) that fills KB range and pixel size in the existing tool, plus a result check that shows pass or fail per rule, with a "last verified" date and a link to the official notice. Starts as part of OPP-001's later wave rather than before it.
- **Why it matters:** Exam-named queries recur in autocomplete [E: inference; low; search:suggestqueries.google.com ssc photo size; 2026-11-17], and the strongest clone already offers presets and a compliance check [E: fact; medium; https://photoresizer.in/; 2026-11-17].
- **Evidence:** SizeTune has crop, pixel fields, minimum KB and format choice but no presets or compliance check. [E: fact; high; repo:src/components/SignatureTool.tsx; 2026-11-17] docset.in carries per-exam presets. [E: fact; medium; https://docset.in/resize/ssc-cgl; 2026-11-17] onlineresult.in carries an SSC preset. [E: fact; medium; https://www.onlineresult.in/tools/exam-photo-resizer?preset=ssc; 2026-11-17] photoresizer.in lists exam chips. [E: fact; medium; https://photoresizer.in/; 2026-11-17]
- **Competitive context:** Parity with photoresizer.in, docset.in and onlineresult.in; a verified and dated preset list is the only possible edge, and it costs upkeep.
- **Expected value:** Unknown; no volumes. Depends on OPP-001 wave 1 results.
- **Effort:** M — preset data, check UI, content, and a maintenance process.
- **Risks:** Wrong presets cause rejected applications and liability; exam rules change each cycle; thin template pages (Google's scaled-content and doorway policies). [E: fact; high; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]
- **Dependencies:** OPP-001 wave 1; an owner process for verifying presets against official notices.
- **Ratings:** user_value=3, strategic_alignment=4, market_opportunity=3, competitive_differentiation=2, business_impact=3, implementation_feasibility=4
- **Reviewer notes:** Widened-pass review (independent agent): evidence split into one source per tag; no rating changes. Confidence Low; depends on OPP-001 wave 1.

### OPP-012 — Client-side image format converters (WebP and PNG to JPG)

- **Category:** product extension
- **Source direction:** adjacent market
- **Problem:** Portals are assumed to accept JPG only, so applicants would need a conversion; this is an assumption with no user evidence. [E: assumption; low; user:none found, owner direction to broaden tools; 2026-11-17] SizeTune already accepts and outputs JPEG, PNG and WebP but has no dedicated converter pages. [E: fact; high; repo:src/components/tool/Dropzone.tsx; 2026-11-17]
- **Proposed solution:** Static pages such as "WebP to JPG" that reuse the existing engine (canvas) for the formats it already accepts. AVIF is out of scope: the engine detects and rejects AVIF today, and accepting it would depend on browser support. [E: fact; high; repo:src/lib/engine/sniff.ts; 2026-11-17]
- **Why it matters:** Cheap extra entry pages and a first step toward a multi-tool site (the owner's direction).
- **Evidence:** iLoveIMG ranks first for "webp to jpg" at an estimated 201K searches in India (Semrush, low confidence). [E: inference; low; https://www.semrush.com/website/iloveimg.com/overview/; 2026-11-17] SizeTune's output picker offers JPEG, PNG, WebP and Auto. [E: fact; high; repo:src/components/tool/FormatPicker.tsx; 2026-11-17]
- **Competitive context:** Extreme: iLoveIMG and many converters; no differentiation beyond no-upload, which is common.
- **Expected value:** Unknown; competition makes ranking uncertain.
- **Effort:** S — pages and copy on the existing engine.
- **Risks:** Doorway or thin pages; AdSense low-value policy; weak intent match with the KB-resizing brand.
- **Dependencies:** OPP-001 outcome (proof that such pages get indexed); OPP-005 if many tools follow.
- **Ratings:** user_value=2, strategic_alignment=4, market_opportunity=3, competitive_differentiation=1, business_impact=3, implementation_feasibility=5
- **Reviewer notes:** Widened-pass review (independent agent): premise re-tagged as assumption, AVIF removed from scope (engine rejects it), evidence re-cited. Confidence Low; the Semrush figure is a competitor keyword estimate, not evidence of a user problem. Kept at Under Evaluation but not presented as an option.
- **Feature research (2026-11-17), "Bulk Image Converter" request:** BIRME converts in the browser with ZIP (vendor claim). [E: fact; low; https://www.birme.net; 2026-11-17] That batch conversion is commoditised is my inference. [E: inference; low; https://www.birme.net; 2026-11-17] HEIC input stays out of scope while OPP-002 is deferred (decoder licences are an unverified legal check). Bulk mode would depend on OPP-006.

### OPP-013 — Client-side image-to-PDF and JPG-to-PDF

- **Category:** product extension
- **Source direction:** adjacent market
- **Problem:** Forms are assumed to want a document as PDF, forcing applicants to convert a photo or scan; no user evidence was found. [E: assumption; low; user:none found, owner direction to broaden tools; 2026-11-17] Demand is unmeasured.
- **Proposed solution:** An in-browser image-to-PDF tool (select images, order, output size note) built on pdf-lib (MIT) with the existing resize step before embedding, no upload.
- **Why it matters:** "jpg to pdf" is a large keyword at iLovePDF: about 7.5M estimated searches in an India-filtered Semrush table (a search-volume estimate, not visits; low confidence). [E: inference; low; https://www.semrush.com/website/ilovepdf.com/overview/; 2026-11-17] It is simple and permissive-licensed, unlike PDF compression, and pairs with the KB tool.
- **Evidence:** pdf-lib is MIT; its last release is reported as 2021 (unconfirmed). [E: inference; medium; https://github.com/Hopding/pdf-lib; 2026-11-17] "jpg to pdf under 1mb" appears in autocomplete. [E: inference; low; search:suggestqueries.google.com compress pdf to 100kb; 2026-11-17]
- **Competitive context:** Extreme (iLovePDF, Smallpdf and many client-side tools); not a differentiator.
- **Expected value:** Unknown. It does not validate demand for compress-to-KB PDFs (OPP-003); sequencing with OPP-003 Phase 0 is an owner decision.
- **Effort:** M — new engine path, page ordering UI, memory limits, tests, verifier changes.
- **Risks:** Crowded; unmaintained library; verifier and privacy gates assume images only (see OPP-005).
- **Dependencies:** OPP-005 once a second tool is committed; OPP-003's Phase 0 result.
- **Ratings:** user_value=2, strategic_alignment=4, market_opportunity=3, competitive_differentiation=1, business_impact=3, implementation_feasibility=3
- **Reviewer notes:** Widened-pass review (independent agent): differentiation lowered 2 to 1 (own text says not a differentiator), feasibility lowered 4 to 3 (new engine path, unmaintained library, verifier gates assume images), user_value lowered 3 to 2 (no user evidence). Score recomputed.

### OPP-014 — Image rotator and flipper

- **Category:** product extension
- **Source direction:** adjacent market
- **Problem:** Some photos appear sideways or mirrored before upload. The complaint exists in developer-side articles; no applicant-specific complaint was found. [E: hypothesis; low; n/a; 2026-11-17] SizeTune's engine already applies EXIF orientation when decoding. [E: fact; high; repo:src/lib/engine/env.ts; 2026-11-17]
- **Proposed solution:** A rotate (90, 180, 270) and flip page on canvas, with a link into the KB resizer.
- **Why it matters:** Cheap extra entry page and part of a multi-tool site; autocomplete shows "rotate image online" queries. [E: inference; low; https://suggestqueries.google.com/complete/search?client=firefox&q=rotate%20image; 2026-11-17]
- **Evidence:** Free incumbents (iLoveIMG, Img2go, Adobe Express) hold the head term. [E: fact; medium; https://www.img2go.com/rotate-image; 2026-11-17] OS viewers and phone galleries rotate natively (not sourced). [E: assumption; low; n/a; 2026-11-17] Browsers apply EXIF orientation by default. [E: fact; high; https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap; 2026-11-17]
- **Competitive context:** Extreme and free; no differentiation beyond no-upload.
- **Expected value:** Unknown; likely low-value filler, as the research agent concluded.
- **Effort:** S — canvas rotation and a page.
- **Risks:** Thin or doorway page; JPEG re-encoding quality loss; weak brand fit.
- **Dependencies:** OPP-005 if tools multiply.
- **Ratings:** user_value=2, strategic_alignment=3, market_opportunity=3, competitive_differentiation=1, business_impact=2, implementation_feasibility=5
- **Reviewer notes:** Feature-research review (independent agent): fails the admission test (hypothesis problem, no applicant complaint, engine already applies EXIF orientation); returned to Discovered. Backlog tier.

### OPP-015 — "Will this file pass?" image checker (format, KB, pixels, type)

- **Category:** product extension
- **Source direction:** competitive gap
- **Problem:** Upload systems reject files whose real type differs from the extension or whose size or pixels fall outside rules; reports exist but are vendor articles and unopened support-thread snippets. [E: fact; low; search:photo upload rejected invalid file format jpg actually png webp heic; 2026-11-17] One applicant's correctly sized signature was still rejected as invalid. [E: fact; low; https://www.careers360.com/question-why-is-my-jee-form-saying-that-signature-jpg-is-not-valid-despite-correct-size-24kb-its-the-same-with-my-category-certificate-pdf-too-uploaded-size-286kb-but-my-photo-was-uploaded-successfully-kindly-answer-this-asap; 2026-11-17]
- **Proposed solution:** A page where a user picks a file and, optionally, enters a form's rules (KB range, pixel range, type); the tool shows real format (magic bytes), dimensions, size and pass or fail per rule, with a one-click link to the resizer. Overlaps the compliance-check part of the deferred OPP-011; this version is generic and rule-entry based, so it needs no maintained exam preset list.
- **Why it matters:** The only angle that ties to SizeTune's audience; keeps users on the site.
- **Evidence:** Existing generic checkers are EXIF viewers or type detectors [E: fact; medium; https://www.metadata2go.com; 2026-11-17]; photoresizer.in already offers a compliance checker next to exam presets, so the rule-check angle is not clear of competition. [E: fact; medium; https://photoresizer.in/; 2026-11-17] SizeTune already reads headers for dimensions and orientation. [E: fact; high; repo:src/lib/engine/header.ts; 2026-11-17] Autocomplete shows "check image format" and "check image dimensions" queries, but "is my image a real jpeg" is thin (ordering only). [E: inference; low; https://suggestqueries.google.com/complete/search?client=firefox&q=check%20image%20format; 2026-11-17]
- **Competitive context:** Many small and mid-size checkers exist; exif.tools says it processes files in the browser (vendor claim, page not verified). [E: fact; low; https://exif.tools; 2026-11-17] OS tools show type, dimensions and size natively for desktop users.
- **Expected value:** Unknown; entry pages for checker queries and better result pages for the resizer.
- **Effort:** M — rule input UI, reuse of header and sniff code, content, tests.
- **Risks:** Weak demand evidence; DPI is often missing from files; a checker cannot know a portal's hidden rules (pass here, fail there). Overlap with OPP-011.
- **Dependencies:** Decision on OPP-011; DPI field availability unverified.
- **Ratings:** user_value=3, strategic_alignment=4, market_opportunity=2, competitive_differentiation=2, business_impact=3, implementation_feasibility=4
- **Reviewer notes:** Feature-research review (independent agent): differentiation lowered 3 to 2 (photoresizer.in already has a compliance checker); score 60. Fails the admission test as a standalone option: the problem evidence is the same anecdote as the deferred OPP-011 plus unopened search snippets. Returned to Discovered and tied to the OPP-011 decision; revisit with OPP-011. DPI would be new code (header.ts reads dimensions and orientation only), so effort M assumes that.

### OPP-016 — Social media (Instagram, LinkedIn, YouTube) image resizers

- **Category:** product extension
- **Source direction:** adjacent market
- **Problem:** Creators need images in platform sizes; only a few independent complaints were found (one 2019 thread). [E: fact; low; https://community.adobe.com/questions-712/frustrated-instagram-upload-dimensions-1076234; 2026-11-17]
- **Proposed solution:** A few preset modes (crop, pad, blur-background fit) on the existing engine, at most 3 to 5 pages, not one per size.
- **Why it matters:** Wider audience and ad topics; a byte-target overlap exists for YouTube thumbnails (2 MB on mobile, 50 MB on desktop). [E: fact; medium; https://support.google.com/youtube/answer/72431; 2026-11-17]
- **Evidence:** Canva, Kapwing and Adobe Express offer free resizers. [E: fact; low; https://www.kapwing.com/resize-image; 2026-11-17] Autocomplete order suggests size-lookup intent over resizer intent (weak proxy). [E: inference; low; https://suggestqueries.google.com/complete/search?client=firefox&q=linkedin%20banner%20size; 2026-11-17] Third-party specs conflict and YouTube's cap changed within a year, so presets need upkeep. [E: inference; medium; https://blog.youtube/news-and-events/youtube-updates-october-2025/; 2026-11-17]
- **Competitive context:** Free tools from large brands and many thin clones.
- **Expected value:** Unknown; likely low and off-brand.
- **Effort:** S — presets and fit modes.
- **Risks:** Doorway or scaled-content policy for many near-identical pages [E: fact; high; https://developers.google.com/search/docs/essentials/spam-policies; 2026-11-17]; spec upkeep; brand dilution.
- **Dependencies:** OPP-005.
- **Ratings:** user_value=2, strategic_alignment=2, market_opportunity=3, competitive_differentiation=1, business_impact=2, implementation_feasibility=5
- **Reviewer notes:** Feature-research review (independent agent): fails the admission test (one 2019 thread, off-brand audience); returned to Discovered. Backlog tier.

### OPP-017 — Favicon and app icon generator

- **Category:** product extension
- **Source direction:** adjacent market
- **Problem:** Developers and designers need icon sets from one image; free tools and CLIs already do it. [E: fact; medium; https://github.com/ionic-team/capacitor-assets; 2026-11-17]
- **Proposed solution:** One tool with favicon and app-icon modes (ICO, PNG set, web manifest, ZIP), client-side, not two separate near-duplicate pages. [E: hypothesis; low; n/a; 2026-11-17]
- **Why it matters:** Adds a tool with steady search interest ("favicon generator" appears in autocomplete). [E: inference; low; https://suggestqueries.google.com/complete/search?client=firefox&q=favicon+generator; 2026-11-17]
- **Evidence:** realfavicongenerator.net leads (Semrush estimate of 556,300 visits in September 2026, low confidence). [E: inference; low; https://de.semrush.com/website/realfavicongenerator.net/overview/; 2026-11-17] Apple's guidelines specify a 1024 px layout size for its main platforms and say the system scales down; that per-size sets are legacy is an inference, and Android and PWA icon rules were not covered by that page. [E: inference; medium; https://developer.apple.com/design/human-interface-guidelines/app-icons.md; 2026-11-17] The audience is developers, who an ad vendor claims block ads heavily (a vendor claim; no RPM was found). [E: fact; low; https://carbonads.net/blog/developer-advertising-guide-2026; 2026-11-17]
- **Competitive context:** Long-established incumbents and free CLIs.
- **Expected value:** Unknown and probably low ad yield.
- **Effort:** M — ICO encoding, ZIP (fflate, MIT), adaptive-icon and Apple variants are harder than plain resizing. [E: inference; low; https://github.com/101arrowz/fflate; 2026-11-17]
- **Risks:** Crowded; developer audience mismatch with SizeTune; spec churn.
- **Dependencies:** OPP-005.
- **Ratings:** user_value=3, strategic_alignment=2, market_opportunity=3, competitive_differentiation=1, business_impact=2, implementation_feasibility=4
- **Reviewer notes:** Feature-research review (independent agent): fails the admission test (no user problem evidence for a standalone favicon tool; developer audience); returned to Discovered. Backlog tier.
