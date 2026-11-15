# SizeTune content, SEO and legal-text audit

- Audited: 2026-11-14, against live staging `https://sizetune-staging.subhamojha9.workers.dev/` (commit 8f0b204 per the request). I reproduced everything on the live site and did not rely on earlier QA documents.
- Scope: `/`, `/resize-image-to-20kb/`, `/resize-signature/`, `/guides/photo-size-for-online-forms/`, `/about/`, `/privacy/`, `/terms/` and the 404 page.
- Method: curl of every route, robots, sitemap, og image and headers; HTML parse (titles, meta, headings, JSON-LD, links); 8-gram text-overlap comparison; real Chrome (Playwright) runs of the tools against staging; diff of deployed HTML against local `dist/`; read of `src/`.
- Nothing in the repo was changed except this file. No mail was sent and nothing was deployed.
- Evidence directory: `/private/tmp/claude-501/-Users-sourav-workspace-personal-automated-niche-website-discovery/9c0cb90c-faaa-4eaf-bcd2-863c04cd34b0/scratchpad/seo-audit/evidence/`. It holds response headers (`*.hdr`), extracted page text (`*.txt`), `browser-results.txt` (tool runs), `browser-full.mjs`, `extract.py`, the og image, `sig-out.jpg`, sitemap and robots.
- Status labels: Verified working, Verified defective, Not tested, Requires human approval.

## Summary

There are no critical or high findings. Titles, descriptions, headings, canonicals, JSON-LD, sitemap, noindex and every internal link check out. The product claims I tested in a real browser held up. I found no typos and no `[[HUMAN]]` or TODO text. Deployed HTML matches `dist/`.

The real issues are these:
- Every absolute URL points at `sizetune.com`, which has no web record yet (SEO-1).
- The home, 20 KB and signature pages overlap heavily in text (SEO-5).
- Some copy is vague about the transparency fill and the quality floor (CNT-3, CNT-4).
- The publisher identity, location and legal wording need owner or lawyer decisions. They are listed as gates (CNT-10 to CNT-15) and I have not cleared any of them.

## A. Confirmed defects (Verified defective)

### SEO-1 (medium, launch gate): all absolute URLs target a host that does not serve the site yet
- **Status:** Verified defective, as seen from staging. This is expected before launch.
- **Repro:**
  - `curl -s -o /dev/null -w '%{http_code}' https://sizetune.com/` returns `000`.
  - `dig +short A sizetune.com` returns nothing. MX records exist (Cloudflare Email Routing).
  - `curl https://sizetune.com/og-default.png` returns `000`.
- **Evidence:** On every page `<link rel=canonical>`, `og:url`, `og:image`, `twitter:image` and the JSON-LD `url` and `mainEntityOfPage` are `https://sizetune.com/...`. `sitemap-0.xml` and `robots.txt` also use `https://sizetune.com`. The same og image does exist at the staging host (200, `image/png`, 1200x630, 55,357 bytes, content OK) and is the file in the evidence folder.
- **Impact:** Staging cannot be used to test social card previews or canonical processing. A canonical pointing at a dead host would be harmful if this HTML were ever served unchanged from another host.
- **Fix:** Before go-live, confirm the apex domain and the `www` redirect decision, then re-fetch `https://sizetune.com/og-default.png` and the sitemap from production. Do not change source for staging.

### SEO-5 (low-medium): heavy shared text between the home, 20 KB and signature pages
- **Status:** Verified defective, as a near-duplicate-content risk.
- **Repro:** `extract.py` produced the page text. A shared 8-word-shingle comparison gave:

| Pair | Shared 8-grams |
|---|---|
| Home vs 20 KB | 340 (24% of home, 22% of 20 KB) |
| Home vs signature | 234 (16%) |
| 20 KB vs signature | 234 (15%) |
| All other pairs | 7% or less |

- **Evidence:**
  - Much of the overlap is the identical tool form text, about 330 words per page (preset buttons, format help, advanced options, notice).
  - The paragraph "SizeTune aims below your maximum counted as 1,000 bytes per KB, and above your minimum counted as 1,024..." appears near-verbatim on the home FAQ, the 20 KB page and the guide.
  - The "minimum / padding" explanation is repeated on the home, 20 KB, signature and guide pages.
  - Unique body text is substantial: 20 KB page about 1,000 words, signature about 900, home about 1,100.
- **Impact:** Moderate. The pages target different intents (generic, 20 KB, signature), so the unique copy probably carries them. Overlap is highest between the home and 20 KB pages.
- **Fix (recommendation):** Keep the tool chrome identical. Shorten the repeated KB-counting and padding paragraphs to one sentence plus a link to the guide on the non-guide pages.

### CNT-3 (low): the transparency-fill copy is vaguer than the tool
- **Status:** Verified defective (copy only). The tool itself discloses properly.
- **Repro:** On `/resize-signature/` (and the guide), the text says "a signature with a see-through background is saved with a solid colour behind it" (guide: "usually white"). In the browser:
  - A transparent 600x200 PNG was uploaded.
  - PNG was preselected. The note "PNG is preselected so they are not filled without asking" is true.
  - Choosing JPEG showed "Fill transparent areas with White / Black / Custom colour", with White selected.
  - The result panel said "Transparent areas were filled with white".
  - The downloaded JPEG corner pixel was `[255,255,255,255]`.
- **Impact:** The disclosure is good in the tool and in the result. The prose pages do not say the colour is chosen by the user (white by default).
- **Fix:** Add "white by default; you can choose black or a custom colour" to the signature page JPEG paragraph and the guide.

### CNT-4 (low): quality-first copy does not mention the quality floor
- **Status:** Verified defective (copy omission). Partly source-verified.
- **Repro:** The home page says quality-first lowers compression "until the file fits" and shrinks the picture "only if quality alone cannot reach the limit".
  - Real run, 1200x900 noisy PNG to 20 KB, quality-first: result was JPEG quality 60, 438x328, 19,448 bytes. Dimensions-first gave quality 85, 316x237, 19,155 bytes.
  - `src/lib/engine/search.ts` shows the search tries q95 to q40 at full pixels and then falls back to scaling at q60. With fixed dimensions it may go below q40, down to q1.
- **Impact:** The copy is broadly accurate, but users are not told that quality-first with free dimensions may still shrink pixels at about q60. They are also not told that fixed dimensions can drive quality very low.
- **Fix:** Add one sentence about the floor. Fixed-dimension runs below q40 were Not tested in the browser.

## B. Verified working (claims and technical checks)

### SEO-2: staging noindex
- **Status:** Verified working.
- **Evidence:** `x-robots-tag: noindex` is on all eight HTML responses and on `robots.txt`, `sitemap-*.xml`, `og-default.png` and `favicon.svg`. There is no `meta robots` on indexable pages, by design.
- **Note:** The 404 page has `<meta name="robots" content="noindex">` and returns HTTP 404. `public/_headers` applies the noindex only to `https://:version.:subdomain.workers.dev/*`, so production on the custom domain will not carry it.
- **Check at launch:** Confirm the production response has no `X-Robots-Tag`.

### SEO-6: titles and descriptions
- **Status:** Verified working.
- **Evidence:** All unique. Title lengths are 42, 43, 59, 25, 25, 39, 50 and 23 characters. Description lengths are 158, 146, 158, 111 (404), 153, 160, 155 and 150 characters, all within 70-160. The 20 KB description is exactly 160, at the limit.
- **Notes:**
  - The home title "Resize Image to KB Online, Free" reads slightly awkwardly (see SEO-8).
  - `og:title`, `og:description` and the Twitter tags mirror the title and description. Twitter card is `summary_large_image`. `og:type` is `article` on the guide and `website` elsewhere.

### SEO-7: heading hierarchy
- **Status:** Verified working.
- **Evidence:** Exactly one H1 per page. H2 then H3 only appear under H2 (FAQ sections). The tool result heading is an H3. The 404 has only an H1.

### SEO-9: JSON-LD
- **Status:** Verified working.
- **Evidence:**
  - Home, 20 KB and signature pages carry a `WebApplication`. The guide carries an `Article`. All parse as valid JSON, with `<` escaped.
  - Every claim is true on the page: free (`isAccessibleForFree`, Offer price 0), Requires JavaScript (verified, the tool needs JS), URLs match canonical, and the Article dates match the visible "Published and last updated 12 November 2026".
  - There are no ratings, reviews or fake counts.
  - Policy, about and 404 pages have no JSON-LD. FAQ content is visible but has no FAQPage markup. That is acceptable.
- **Note:** `WebApplication` without ratings will not earn an app rich result. Do not add invented ratings.

### SEO-10: sitemap and robots
- **Status:** Verified working.
- **Evidence:**
  - `sitemap-index.xml` points to `sitemap-0.xml`. That file lists the 7 routes with trailing slashes and no 404. There is no `lastmod`.
  - `robots.txt` is `User-agent: *`, `Allow: /`, plus a Sitemap line (the same file is served on staging).
  - `/sitemap.xml` returns 404; the index name is `sitemap-index.xml`, as declared.

### SEO-11: internal links
- **Status:** Verified working.
- **Evidence:**
  - Every `href` extracted from the 8 pages (header and footer nav, in-copy links, skip link) returns 200. All are slash-terminated, with no redirects.
  - The only external-looking link is `mailto:hello@sizetune.com`. There are no external http links.
  - `/guides/` returns 404, but nothing links to it.
  - Note: my first crawl printed `/terms/#main`; that was my concatenation of two link files, not a real link.

### CNT-1: browser-verified claims
- **Status:** Verified working. Evidence is `evidence/browser-results.txt` (Chrome via Playwright against staging).
- **Preselected limit:** `/resize-image-to-20kb/` preselects 20 KB.
- **Default mode:** Quality-first is the default.
- **Output format:**
  - A photo-like PNG was preselected as JPEG with the note "Your PNG will be saved as a JPEG...".
  - Switching to PNG gave a PNG result.
  - A transparent PNG kept PNG in Auto, with the alpha note.
- **Decimal versus binary:**
  - The 20 KB result was 19,448 bytes, under the 20,000-byte limit.
  - It was displayed as "19.0 KB (19,448 bytes)", with the line "KB figures on this page use 1 KB = 1,024 bytes; the exact byte counts are always shown."
  - This matches the "up to about 19.5 KB" claim.
- **Download name:** `photo-sizetune.jpg`, matching the privacy claim.
- **Minimum size:** A 60x30 flat image with a 20 KB minimum gave "Minimum size not reached ... SizeTune does not pad files". No padding, and honest.
- **Cancel:** The Cancel button appears during a run.
- **Input limits:** A GIF is rejected with "not a JPEG, PNG or WebP". A file over 25 MB is rejected with "limit is 25 MB". Both match the copy.
- **EXIF:** A JPEG with an EXIF/GPS block went in; the output has no Exif. An ICC profile was present in the output, which the privacy page discloses ("A colour profile may remain"). Real GPS coordinates were not tested, only a GPS IFD stub.
- **DPI:** The output JFIF header has density unit 0 and density 1:1. The tool sets no DPI and the copy makes no DPI promise (the guide and signature page say pixels, not print size, are what upload checks see). No contradiction.
- **Privacy/network behaviour:**
  - During a full run the only requests were the page, favicon and `blob:` URLs. There were no POSTs and no third-party hosts.
  - `localStorage`, `sessionStorage`, cookies, IndexedDB and Cache API were all empty. No `Set-Cookie` on the response.

### CNT-2: staging versus local `dist/` (drift)
- **Status:** Verified working.
- **Evidence:** Byte comparison of deployed HTML to `dist/`:
  - Guide, about, privacy, terms and 404 are identical.
  - Home, 20 KB and signature differ only by the random `astro-island uid` attribute (one character).
  - The three `/_astro/*` assets have identical hashes locally and live. `public/_headers` equals `dist/_headers`.
  - `dist/` was built after the last `src/` edit (02:36 vs 01:36 on 14 Nov), so no source drift is visible.
- **Not tested:** I did not rebuild from `src/`. I compared deployed to the existing `dist/`.

### CNT-7: placeholders, typos and spelling
- **Status:** Verified working.
- **Evidence:**
  - `grep` for HUMAN, TODO, FIXME, lorem, `[[` and TBD across deployed HTML and `src/` found none.
  - A dictionary pass found no misspellings. Only proper nouns and technical terms were flagged. A full read also found none.
  - British spelling is used consistently (colour, organisation, licence, behaviour, centimetres, optimised).

### CNT-8: consistency of notices, publisher identity and dates
- **Status:** Verified working.
- **Evidence:**
  - Tool notices on all three tool pages say the code does not upload the image, no copy is kept, and the browser releases it on tab close. This matches privacy ("code of this site does not upload", "browser releases the working data when you close the tab") and terms.
  - Contact is `hello@sizetune.com` on about, privacy and terms. The name "Sourav, an independent developer" is used identically in about, privacy and terms.
  - Privacy and terms are dated 13 November 2026. The guide is 12 November 2026. About correctly states that privacy, terms and guide show their dates.
  - The 20 KB, signature and home pages agree on the 1,000 versus 1,024 explanation. The guide agrees with them.
  - "KB" appears 118 times and "kilobyte" 7 times. "kB" appears once, in a FAQ heading. There is no "KiB".

## C. Recommendations (not confirmed defects)

### SEO-3 (low): 404 page carries Open Graph URL
- On `/nope-404/` the page has `og:url` = `https://sizetune.com/404/`, no canonical (correct for an error page) and meta noindex (correct).
- **Fix:** Optionally drop the og:url from the error layout.

### SEO-4 (low): temporary redirects for non-slash URLs
- `curl -I https://sizetune-staging.../about` returns 307 to `/about/`.
- The same applies to every route; `/ABOUT/` returns 404.
- 307 is a temporary redirect. It is the Cloudflare assets default, so it is not fixable from source.
- **Check at launch:** Confirm production behaviour. It does not affect canonical correctness. The site links only to the slash forms.

### SEO-8 (low): title wording and lastmod
- Home title "Resize Image to KB Online, Free | SizeTune" is slightly ungrammatical.
- Alternative: "Resize an Image to a Size in KB | SizeTune".
- Optionally add `lastmod` to the sitemap.
- Guide `Article` JSON-LD has no `image`. The author is the Organization "SizeTune", not a person. Switching author to `Sourav` is an owner decision (see CNT-12).

### CNT-5 (low): awkward meta descriptions
- Home: "...The code here does not upload your image."
- Privacy: "...resized in your browser, with currently no accounts, ads or analytics scripts."
- Both read stiffly. Rewrite for plain language and keep the same meaning.

### CNT-6 (low): terminology
- The tool displays binary-based figures labelled "KB" while targeting decimal limits.
- Both are explained on the pages and in the result panel (the `kb-basis` line), so this is understood and consistent.
- Consider "KiB" only if you want strict SI/IEC use. The current copy is internally consistent.
- "image / photo / picture" are used interchangeably across pages. This is a style point only.

## D. Not tested

- **CNT-9:** Crop UI claims on the signature page (auto-trim, margin, 2:1 / 3:1 / 4:1 shapes) are supported by `SignatureTool.tsx` (Free, 2:1, 3:1, 4:1 and 1:1 exist) but I did not drive the crop UI in a browser.
- **CNT-9:** WebP unavailable-browser fallback; HEIC and iPhone camera setting steps; Safari, Firefox and mobile browsers; and no-JavaScript text rendering were not exercised.
- **CNT-9:** Email deliverability to `hello@sizetune.com`. MX records point to Cloudflare Email Routing, but I sent no mail.
- **CNT-9:** The Cloudflare statements on the privacy page (what logs and analytics are actually enabled and for how long) were not checked against the owner's account.

## E. Legal and identity text: human-approval gates

I did not rewrite or approve any of these. I did not invent names, addresses, jurisdictions or legal clearance. Statuses are Requires human approval.

### CNT-10 (medium): governing law and jurisdiction
- Terms say "These terms are governed by the laws of India... courts in India that have jurisdiction under the applicable law."
- Privacy and terms also say the developer is "based in India". About does not state a location.
- **Action:** The owner must confirm that India, and these words, are intended. This is not legal clearance.

### CNT-11 (medium): grievance and contact details
- `hello@sizetune.com` is the single contact for everything, including privacy requests, complaints and grievances. No postal address is given.
- Privacy says "That address is also our grievance contact, and it is handled by Sourav"
- **Action:** The owner and a lawyer must decide whether more (a postal address, a designated officer, a response-time promise) is required. Privacy promises resolution "within one month". Check this can be met.

### CNT-12 (medium): identity of the publisher and ownership wording
- The publisher is an individual, "Sourav" (the name the owner told me to use). JSON-LD uses `Organization` named "SizeTune" for publisher and Article author.
- Terms say content belongs to "SizeTune's owner" and there is no copyright notice or legal entity.
- **Action:** Decide the legal name or trading name, whether `Organization` or `Person` markup is appropriate, and whether to add a copyright line.

### CNT-13 (medium): statements citing Indian law
- Privacy refers to the "Data Protection Board of India once that route is open to you".
- It commits to deleting or correcting data on request and to telling "the people affected and the authorities" after a security incident.
- Terms say forgery and identity misuse "can be criminal offences under Indian law".
- **Action:** A lawyer should confirm these statements are accurate and acceptable for the intended audience. I cannot confirm them.

### CNT-14 (low-medium): minors and consent
- Terms and privacy say a parent or guardian must agree for under-18s.
- Acceptance is by use ("By using the site you agree"; tool notice "By using the tool you agree to the terms of use"). That is browsewrap, not a click-through.
- **Action:** Owner or lawyer to decide whether this wording and the acceptance mechanism are adequate.

### CNT-15 (low): future advertising and Cloudflare statements
- Privacy says AdSense "may" be added in future and promises an update and consent tool beforehand. Terms mention advertising in future.
- The tool pages promise no ads, the home page says it loads no advertising scripts, and a consent mechanism is promised.
- **Action:** Confirm the owner's actual intentions before launch, and re-review this text when ads are added.
- Privacy also states what Cloudflare receives and may keep. Verify against the real Cloudflare configuration (see Section D).
- The "effective and last updated: 13 November 2026" date should be confirmed by the owner at publish time.

## F. What was checked and found clean

- All eight routes return the expected status (200, and 404 for the 404 page).
- Single H1 and a valid H2/H3 outline on every route.
- No broken internal links; no external links to check.
- Title and description lengths are within range and unique.
- JSON-LD is valid, true to the visible page, and has no ratings.
- Sitemap and robots are well-formed. Noindex is present on staging by header on every response.
- Privacy and tool-page statements match observed browser behaviour (no uploads, no storage or cookies, EXIF removed, no padding, honest minimum-size message).
