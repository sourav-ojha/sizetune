# Keyword research

Researched 2026-11-17. **No search volume, keyword difficulty or ranking data was obtained, and none appears here.** Only free proxies were used: Google autocomplete (~162 requests, `gl=in` and `gl=us`, ~1 req/s) and SERP/sitemap structure of competitors (`COMPETITOR_ANALYSIS.md`). Presence in autocomplete means people type it; it does not rank demand. Earlier Ahrefs free-tool volume *buckets* (India, 2026-11-12) are in `SEO_ARCHITECTURE.md` §2 and are floors, not counts. Google Trends was not fetched. First action after launch: replace these proxies with Search Console impressions.

## Clusters and what autocomplete showed [PROXY]
| Cluster | Observation | Tool exists? |
|---|---|---|
| Compress/resize to KB (20/50/100/200) | suffixes "online", "jpg", "pdf", "free", "without losing quality"; range chains "20kb to 50kb", "100kb to 200kb" | Yes |
| **Increase** size to a KB (min) | "increase image size to 200kb", Hinglish "photo kb kaise badhaye", "5 kb to 10 kb photo size" | Partial: minimum-KB field exists, no page |
| Signature / thumb / pixel specs | "signature resize 20kb ssc", "signature 140x60 pixels under 50kb", "thumb impression size for ibps/sbi" | Signature yes; thumb preset no |
| Exam photo | every major exam has "photo size"/"photo resize for X" query, many with a year | Tool yes, verified pages no |
| Passport/ID | "passport photo size in cm/mm/pixels", "35mm x 45mm white background", "pan card photo size", "aadhaar photo size" | No (cm/DPI + passport tool: OPP-008/018) |
| Format conversion | jpg↔png, png→webp, heic→jpg, webp→jpg, avif; "bulk" common | WebP/PNG→JPG yes; HEIC no |
| PDF-adjacent | "jpg to pdf 100/200 kb", "compress pdf to 100kb/200kb" | No (guides only) |
| Units/DPI | "resize image in cm and kb and dpi", "change dpi to 300", "photo size in cm to pixel" | No |
| Social | "resize image for instagram/whatsapp dp without cropping" | Instagram/LinkedIn/YouTube yes |
| Privacy | "compress image no upload" returned nothing | n/a |
India and US suggestion lists were nearly identical for size/exam queries; India-only differences were KB-qualified conversions and Hinglish phrasing.

## Prioritisation (qualitative; no numeric scores invented)
Criteria: intent clarity · can the existing tool fully satisfy it · competition shape (SERP evidence) · AdSense fit (informational + utility pages OK).
| Rank | Target query family | Intent | Satisfiable now | Competition shape (SERP, US region) | Decision |
|---|---|---|---|---|---|
| 1 | resize/compress image to 50 KB | transactional-utility | Yes | imresizer, cloudinary, zamzar, blogs | **Built** `/resize-image-to-50kb/` |
| 2 | signature 20 KB | utility | Yes | fragmented micro-sites, imageonline.io | **Done** via retitle `/resize-signature/` |
| 3 | 20 KB, 100 KB, signature 10 KB | utility | Yes | same | Already live |
| 4 | exam photo/signature size (IBPS, SBI, NEET, JEE, CUET, GATE) | utility + reference | Yes for KB-only specs | fragmented, specs conflict across sites | Next: needs verified spec table (see strategy) |
| 5 | increase image size to X KB / minimum KB / range "20kb to 50kb" | utility | Partly: tool supports min/max | not measured | Candidate: one page, not a family |
| 6 | cm/DPI/pixel size | utility | No | not measured | Needs tool work (OPP-018) |
| 7 | converters (jpg↔png, heic→jpg) | utility | webp/png→jpg only | dominated by big brands | Low priority; head terms not winnable early |
| 8 | "compress image without losing quality" | informational | n/a | blog pages | Guide, not tool page |
| 9 | passport photo maker | utility | No | many brands | Blocked (OPP-008 legal) |

## Verified official specs (for exam pages) — read from primary sources 2026-11-17
| Exam | Photo | Signature | Other | Source (year) |
|---|---|---|---|---|
| IBPS CRP PO | 200×230 px preferred, 20-50 KB | 140×60 px, 10-20 KB | left thumb 240×240 px @200 DPI 20-50 KB; handwritten declaration 800×400 px @200 DPI 50-100 KB | ibpsreg.ibps.in/crppoxvjun25/uploads/loadpdf.php (2025) |
| SBI Junior Associate | 200×230 px, 20-50 KB | 140×60 px, 10-20 KB | thumb 240×240 px 20-50 KB; declaration 800×400 px 50-100 KB | sbi.bank.in …/JA_2026_Detailed_Advt_Eng.pdf (2026) |
| SSC CGL | **live webcam capture, no upload** | JPG 10-20 KB, ≈6.0×2.0 cm | Aadhaar-authenticated exempt from rejection | ssc.gov.in …/Notice_of_adv_cgl_2025.pdf (header date 21-05-2026) |
| NEET UG 2026 | JPG 10-200 KB, no pixel spec | JPG 10-100 KB | thumb 10-200 KB (bulletin gives 50-300 KB elsewhere: conflict) | NTA bulletin PDF (2026) |
| JEE Main 2026 | JPG 10-200 KB | 10-100 KB | | NTA bulletin PDF (2026) |
| CUET UG 2026 | JPG 10-200 KB | 10-50 KB | | NTA bulletin PDF (2026) |
| GATE 2026 | 200×260 to 530×690 px, 5-600 KB | 250×80 to 580×180 px, 3-300 KB | | gate2026.iitg.ac.in/photograph-and-signature.html |
| UPSC OTR | 20-300 KB, 550-1000 px | 20-300 KB, 350-500 px | **undated FAQ; a newer notice reportedly differs: unresolved** | upsconline.gov.in …/FAQs.pdf |
| Passport (print) | 4.5×3.5 cm white background | | no digital pixel/KB spec in the booklet | passportindia.gov.in booklet V3.0 |
Full URLs for NTA rows are in the agent report; re-fetch each before publishing a page and show the date.
**Unverified, do not publish:** RRB (varies per notice; only search summaries), PAN (≈10-year-old snippets), SBI PO (assumed same template), passport digital upload numbers (third-party only), Aadhaar/UIDAI, old SSC "20-50 KB, 100×120" figures (not in current notice).

## Intents SizeTune may be missing [PROXY]
1 raise a file *to* a minimum KB · 2 range targets "20kb to 50kb" · 3 combined specs (px + KB, or cm + DPI + KB) · 4 thumb-impression and handwritten-declaration images (IBPS/SBI) · 5 KB-qualified conversions ("pdf to jpg 100 kb") · 6 GDS/EPFO/PAN/WhatsApp-DP forms · 7 Hinglish/Devanagari phrasing.
