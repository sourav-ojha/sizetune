# Technical privacy audit (2026-11-13)

Scope: code in `src/`, built `dist/` (verified not older than any source file), `wrangler.jsonc`, `public/_headers`, `.github/workflows/ci.yml`; live run of `dist/` via `wrangler dev` (workerd, 127.0.0.1:8799, real `_headers` applied) driven by Playwright + system Chrome. **Not tested: the real Cloudflare edge or sizetune.com (not deployed).** The prior `QA/PRIVACY_SECURITY_AUDIT.md` was treated as a hypothesis; its staging curl results were not re-run.

## 1. Do images, filenames, metadata leave the browser?
Test: 3.7 MB JPEG named `secret-passport-JOHNDOE.jpg` with EXIF (Make/Model/Artist/Copyright/Description markers + GPS), run on `/`, `/resize-image-to-20kb/`, `/resize-signature/` (preset 20 KB, resize, download). Every request (context-level, includes worker) listed:

| Page | Requests (all GET, no body) |
|--|--|
| each of the 3 | page HTML, `/_astro/_seo.*.css`, `geist-latin-wght-normal.*.woff2`, 5 `/_astro/*.js` (tool, client, hooks, useSession, preact), `/favicon.svg`, `/_astro/compress.worker-*.js`, 2x `blob:` (preview + result, `image`) |

- Zero POST/PUT, zero request bodies, zero off-origin requests, zero requests carrying the filename or any `SECRET*` marker (filename/markers appear in no URL; the image never produced a network request). In-page wrap of `fetch`, `XMLHttpRequest.open`, `sendBeacon`, `WebSocket`, `Storage.setItem`, `document.cookie` set: 0 calls.
- Code grep (`src/`, `dist/_astro/*.js`): no `fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, `serviceWorker`, `importScripts`, `console.*`, `localStorage`, `sessionStorage`, `indexedDB`, `caches`, `document.cookie`, `navigator.*` network APIs. Only `new Worker(new URL('./compress.worker.ts'))` (same-origin module, no imports of its own; uses `createImageBitmap`, `OffscreenCanvas`, `postMessage`). The one `import(` is Astro's client hydration loader. No `<form>`, no external `src/href` in built HTML. `verify:privacy` also gates this.
- Worker script gets `Content-Security-Policy: connect-src 'none'` header (confirmed via curl on workerd); page has CSP meta `default-src 'self'; connect-src 'self'; ...` (meta CSP does not govern the worker).
- Caveat: the download name is derived from the original file name (`secret-passport-JOHNDOE-sizetune.jpg`). Local only, but the user's file name reaches their disk and any site they upload to.
- Contact: users who email hello@sizetune.com send data via their own mail client (mailto, no form).

## 2. Cookies / storage after full use (all 3 pages)
| Store | Result |
|--|--|
| `document.cookie`, context cookie jar | empty, 0 cookies; `Set-Cookie` absent on local responses |
| localStorage / sessionStorage | `{}` / `{}` |
| IndexedDB databases | none |
| Cache API | none |
| Service workers | 0 registered |
| Console | no messages beyond Worker creation; no errors |
Blob object URLs created are revoked by `session.ts` (prior audit: 2 created = 2 revoked; not re-measured). Normal HTTP cache of static assets still applies (`/_astro/*` immutable 1 year).
Limit: local workerd cannot show cookies that Cloudflare's edge may add (see 4).

## 3. External origins
Built HTML/CSS/JS/XML: only `sizetune.com` (canonical, OG, sitemap, JSON-LD), XML/schema namespace URIs (`schema.org`, `w3.org`, `sitemaps.org`, `google.com/schemas/sitemap-*`) and a `tailwindcss.com` license comment in CSS and the workers.dev header pattern text. None are loaded. Fonts self-hosted (Geist woff2 via fontsource). CSP: `default-src 'self'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-src 'none'; manifest-src 'self'; script-src 'self' + 7 sha256 hashes; style-src 'self' + 1 hash`. No third-party scripts/fonts/widgets/ads/analytics/error reporting. Header CSP is only `frame-ancestors 'none'`. No HSTS.

## 4. Cloudflare
Config (`wrangler.jsonc`): no `main`, no bindings, `assets.directory=./dist` => static-assets-only Worker (no custom Worker code). `workers_dev:false`, `preview_urls:false`, route `sizetune.com` custom domain; staging env `sizetune-staging` on workers.dev. **No `observability`, `logpush`, `tail_consumers` keys are set.**
| Item | Status |
|--|--|
| Observability/Workers Logs | Not configured in repo. Cloudflare docs say new Workers get observability enabled by default (https://developers.cloudflare.com/workers/observability/logs/workers-logs/); whether that applies to an assets-only Worker, and the dashboard state, is **unknown**. Configurable: add `"observability": {"enabled": false}` explicitly. Cited retention applies only when Workers Logs is on: 3 days Free / 7 days Paid (same page). |
| Logpush / tail | Not configured in repo; dashboard state unknown. |
| Cloudflare processing visitor data | Cloudflare's privacy policy (https://www.cloudflare.com/privacypolicy/) says it processes end users' interactions with customer sites, incl. IP addresses, gathered in log files; it acts as processor for Customer Logs and has "no direct relationship with End Users". It states no retention period for end-user/Customer Logs: **do not claim one**. DPA: https://www.cloudflare.com/cloudflare-customer-dpa/ (processor role, no log retention figure; 12-month figure there is for infrastructure access logs only). |
| Cookies | Cloudflare sets cookies only for features that need them (`__cf_bm` bot fight/management, `cf_clearance` challenges, `_cfuvid` rate limiting, etc.): https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/. None configured in repo; zone settings unknown. |
| NEL | Prior audit saw `nel`/`report-to` (a.nel.cloudflare.com) headers on staging; browser may send failure reports to Cloudflare (https://developers.cloudflare.com/network-error-logging/). Zone-level setting; custom domain unverified. |
| Web Analytics | Auto-injects a JS beacon only if enabled for a proxied zone (https://developers.cloudflare.com/web-analytics/faq/). Not enabled in repo; zone state unknown. Would contradict "no analytics" and break CSP (blocked by `script-src`). |
Unknown without dashboard/edge access: zone security/bot settings, WAF/Analytics toggles, Workers Logs state, real response headers on sizetune.com.

## 5. GitHub Actions / Search Console
- `ci.yml`: third parties = GitHub, npm registry (`pnpm install --frozen-lockfile`, run before and separate from secrets), Playwright browser downloads (cross-browser), Cloudflare (wrangler deploy). Secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in GitHub environments, exposed only to the `wrangler deploy` step; production deploy disabled unless `PRODUCTION_DEPLOY_ENABLED=true`. No analytics/tracking in the pipeline. No secrets in build output (`dist/` contains no tokens). `permissions: contents: read`.
- Search Console: no verification meta tag or file in `dist/`; `BLOCKERS.md` H13 plans DNS TXT verification (Domain property) after launch. DNS TXT adds nothing to pages; if later switched to a meta tag/file it would still not load a script. Using GSC means Google receives Google-side search data, not visitor data from this site. **Not yet set up** (BUILD_STATUS lists it as not implemented).

## 6. Contact / analytics / ads / error reporting
`hello@sizetune.com` is plain-text `mailto:` on /about/, /privacy/, /terms/ (1 each); public pseudonym "Kiran T.". No form, analytics, ads, Sentry-style reporting, or console logging. Mailbox existence/delivery not verified.

## 7. Claims vs evidence
| # | Claim (location) | Status | Evidence |
|--|--|--|--|
| 1 | "no accounts, no ads and no analytics scripts at the time of writing" (privacy.astro:12-13) | VERIFIED (site code) | no such scripts/requests; CF Web Analytics/edge settings UNVERIFIED |
| 2 | "The code of this site does not upload your images" (privacy:13; terms:26-27; index.astro:99; guide mdx:76; sig FAQ:132) | VERIFIED | section 1 request capture, code grep |
| 3 | "SizeTune's code does not send the image, or any part of it, to a server, and we keep no copy" (privacy:26-27) | VERIFIED for app code; "we keep no copy" holds because nothing is received | no request carried it |
| 4 | "When you close the tab, the working data is released by your browser" (privacy:27) | VERIFIED-ish | object URLs revoked, no persistent storage; GC is browser behaviour |
| 5 | "Re-saving a picture generally drops its camera metadata such as location" (privacy:31-33; guide:78) | VERIFIED (hedged) | all 6 JPEG/PNG/WebP inputs with EXIF/GPS -> JPEG/PNG/WebP outputs: no EXIF/GPS/Make/Artist bytes. Output JPEG/WebP carry a colour ICC profile (Chrome sRGB), not personal; file name is kept in the download name |
| 6 | Cloudflare receives IP, page address, user agent, time, approximate country (privacy:38-40) | UNVERIFIED (plausible) | not observable locally; CF policy confirms IP and log files only generally |
| 7 | "Cloudflare may keep such records under its own policies" (privacy:39-40) | VERIFIED as hedged | CF policy states no retention period |
| 8 | "requests do not include your images" (privacy:41) | VERIFIED | section 1 |
| 9 | "sets no cookies and does not use localStorage, sessionStorage, IndexedDB or the Cache API" (privacy:46-47) | VERIFIED (local); edge-set cookies UNVERIFIED, disclosed in next sentences | section 2 |
| 10 | "When we tested the site, no cookies were set" (privacy:50) | VERIFIED locally and per prior staging curl (not re-run) | 0 cookies |
| 11 | "Cloudflare ... may send network-error reports" (privacy:48-49) | VERIFIED as "may" | prior audit saw NEL headers on staging |
| 12 | "SizeTune currently runs no analytics and shows no advertising" (privacy:55) | VERIFIED (code) | |
| 13 | "The owner uses Google Search Console ..." (privacy:55-56) | **WRONG today / unresolved** | GSC not set up (BUILD_STATUS, BLOCKERS H13); `[[HUMAN]]` marker sits in the same paragraph |
| 14 | "does not need any script on these pages" (privacy:56-57) | VERIFIED | DNS verification, no script |
| 15 | "Because we hold no images, accounts or profiles..." (privacy:63) | VERIFIED for app; mail received at hello@ is personal data held |  contact path not mentioned in rights text |
| 16 | "Questions ... hello@sizetune.com" / owner "Kiran T." (about:30-31, privacy:18-19) | UNVERIFIED mailbox/identity | not testable |
| 17 | Hero "Stays in your browser" (Hero.astro:12); footer "processed in your browser" (Base.astro:78); tool notes "not uploaded, and this page keeps nothing after you leave it" (ImageTool.tsx:170, SignatureTool.tsx:323; Dropzone.tsx:72 "nothing is uploaded") | VERIFIED for code; absolute "nothing is uploaded"/"stays" is stronger than the host/extension caveats | |
| 18 | "this page loads no advertising or analytics scripts" (index.astro:99-100) | VERIFIED locally | edge injection would be blocked by CSP |
| 19 | Home/FAQ "Browser extensions or device backup ... outside the site's control" (index:120-121) | VERIFIED (true caveat) | |
| 20 | About "runs in your browser" / terms:26 "processed in your browser" | VERIFIED | |
| 21 | "Last updated 12 November 2026" (privacy:8) | STALE | text edited 13 Nov per BUILD_STATUS |
| 22 | Tool result text: "Your original contains location data; the SizeTune result does not" (ResultPanel.tsx:100) | VERIFIED for tested cases | GPS-only detection from header |

## Discrepancies that would make a statement false or risky
1. **Search Console sentence (privacy:55-56) states current use that is not true yet** and still carries the HUMAN marker; remove or reword until verified.
2. Cloudflare-side logging/cookies/NEL/Web Analytics cannot be proven absent; statements must stay "may" and never claim "we log nothing" or give a retention period. Consider setting `observability.enabled=false` explicitly.
3. "Nothing is uploaded"/"stays in your browser" are true only for site code; keep the host-request caveat adjacent.
4. Privacy page does not mention that emailing the contact address gives the owner your email/message, nor that the download keeps your original file name.
5. "Last updated" date predates later edits; legal-review marker unresolved.
6. No HSTS (security, not a claim).
Test artifacts: `/private/tmp/claude-501/scratch/{audit.mjs,audit2.mjs,results.json}`.
