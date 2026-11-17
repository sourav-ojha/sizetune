# Competitor analysis

All fetches 2026-11-17. Tooling caveats: WebFetch summarises and truncates big sitemaps; WebSearch is US-region so Indian SERPs may differ; **no search volume, difficulty or rank data was available and none is claimed**. Labels: **[V]** verified by fetching the cited page; **[I]** inference. earlier landscape in `.product/opportunities.md` §Market Landscape.

## 1. How competitors structure keyword coverage (sitemaps, [V])
| Site | Strategy | Real examples |
|---|---|---|
| imresizer.com | One page per KB value, per dimension, per named document. ~574 URLs visible [I: truncated summary, approximate]. ~65 KB slugs (`resize-image-to-10kb` … `5000kb`), ~84 pixel slugs, cm/mm/inch sizes, named (`pan-card-size`, `aadhar-card-size`, `passport-size`), 7 exam slugs (`india-ssc-photo-size`, `india-upsc-signature-size`, `india-neet-*`). |
| photoresizer.in | Exam-first. 377 URLs [I, approximate]: ~100 exam pages, 50 country passport pages, 115 blog posts (11 "photoresizer-vs-X"), 11 Indian-language hubs, Hindi pages (`hi/signature-20kb`). |
| imageonline.io | KB ladder `compress-image-to-5kb` … `2mb`, `heic-to-jpg`, `ico-converter`, `image-dpi-checker-converter`, `batch-resize`, `resize-signature` with min-max KB. |
| iLoveIMG, TinyPNG, CompressJPEG, ResizePixel | Tool-type × language multiplication. No KB-number or exam slugs in the portions read. |
| Squoosh | Single-page app, no sitemap. |
[I] Two models: global brands win on brand + languages; long-tail winners (imresizer, photoresizer.in, imageonline.io) generate one page per size/exam. Exact-KB intent is *not* served by iLoveIMG/TinyPNG/CompressJPEG.

## 2. Page teardown (selected, [V])
| Page | Title / H1 | Notes |
|---|---|---|
| imresizer `/resize-image-to-100kb` | "Resize Image to 100kb Online Free \| ImResizer" | ~1,000 words, 12-Q FAQ, KB siblings cross-linked, **3 ad slots**, client-side claim. |
| imresizer `/india-ssc-photo-size` | "SSC Photo Resizer — 3.5x4.5 cm Print Photo" | 12-Q FAQ, explains SSC rule change, cross-links other exams. |
| photoresizer.in `/resize-image-to/50kb` | "Resize Image to 50KB Free" | long guide, "2026 Portal Upload Checklist", only 4 FAQs. |
| photoresizer.in `/ssc-photo-resizer` | "SSC Photo & Signature Resizer" | spec matrix, "last verified Nov 2026", **contradicts itself** on live-photo vs 20-50 KB upload and on data storage. |
| imageonline.io `/compress-image-to-50kb` | "Compress Image to 50KB Online Free - JPG, PNG & WebP" | quality vs target-size modes, no ads observed. |
| imageonline.io `/resize-signature` | "Resize Signature Online Free - Set Exact Pixels and KB Size" | closest feature match to SizeTune (min-max KB, trim). |
| resizepixel `/resize-image-to-10-kb/` | — | thin: 2 H2s, no FAQ, no processing statement. |
| tinypng | — | server-side; files kept 48 h. |
| compressjpeg / squoosh | — | local processing. |

## 3. SERP snapshot (WebSearch, US, listing order ≠ rank, [V])
- KB-target queries ("compress image to 50kb", "resize image to 100kb", "resize image to 20kb"): cloudinary tools, zamzar, imresizer, wondershare, many generic SaaS and how-to blogs. iLoveIMG / TinyPNG / CompressJPEG did not appear.
- Signature / exam queries ("signature resize 20kb", "photo resizer for ssc", "upsc photo and signature resize 200kb"): fragmented, many `*.pages.dev` / `*.vercel.app` micro-sites, imageonline.io, passportphotosnap.com, small Indian sites.
- Head converters (`jpg to png`, `heic to jpg`): big brands (zamzar, Adobe Express, cloudinary, cloudconvert). Not winnable early.
- "compress image without losing quality": almost all blog/guide pages (tinify blog, adobe, uploadcare…): intent is informational, a tool page is the wrong shape.
- SERP features (AI Overviews, People Also Ask): **not visible via this tooling — unknown**.

## 4. Gaps SizeTune can use
| # | Gap (evidence) | SizeTune angle |
|---|---|---|
| 1 | Exam/signature results are fragmented, low-authority micro-sites; competitors' specs conflict (UPSC dimensions differ across sources; photoresizer.in self-inconsistent) | Few pages, each with **dated, source-linked official specs** and "last verified" stamp. Accuracy is the moat. |
| 2 | Privacy claims inconsistent or absent (TinyPNG uploads 48 h; photoresizer.in mixed) | Verifiable "no upload" claim: works offline; tell users how to confirm in the browser network tab. Already true in SizeTune's CSP (`connect-src 'self'`). |
| 3 | Exact-KB targeting absent at the big three | KB pages with true byte-targeting (already: 1,000-byte safety margin). |
| 4 | Thin competitor pages (ResizePixel) / generic FAQs | FAQs built from real failure modes ("portal still says too large", "signature rejected as PNG"). |
| 5 | Regional-language exam pages almost uncontested (only photoresizer.in) | Later phase (P3): Hindi, after English pages prove traction. |
| 6 | Heavy ad load (imresizer 3 slots/page) | Lighter ad layout as UX difference [I, unproven revenue effect]. |

## 5. Feature gaps (vs repo capability)
SizeTune already has crop, pixel fields, min KB, format choice, signature clean-up, bulk ZIP, checker, rotate, WebP/PNG→JPG, social, favicon. Missing vs competitors: **HEIC input**, **cm/inch/mm + DPI sizes**, **PDF**, **exam presets**, **Hindi**. These are tracked as OPP-002/003/011/018 in `.product/`; do not rebuild them from this doc.

## 6. Not verified
Official SSC/UPSC specs (see `LANDING_PAGE_STRATEGY.md` for what *was* verified), real India SERPs, ad counts beyond text labels, iLoveIMG title tag, full sitemaps for imresizer/imageonline/resizepixel/iloveimg (truncated).
