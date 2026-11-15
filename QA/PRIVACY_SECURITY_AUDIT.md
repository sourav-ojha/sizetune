# Privacy and security audit (independent, 2026-11-14)

Read-only audit. No source, config, commit or deploy was touched. Everything below was reproduced against live staging, `https://sizetune-staging.subhamojha9.workers.dev/` (dev build, commit 8f0b204). Earlier QA documents and the local `public/_headers` were not used as proof; they were only read to see what to test.

Tools: curl; Playwright 1.65 driving system Google Chrome 157.0.8103.52 (headless, desktop, Chromium only); Python 3 + Pillow to craft fixtures; a hand-written JPEG/PNG/WebP segment parser (`exiftool` is not installed). Scripts and raw outputs: `/private/tmp/claude-501/-Users-sourav-workspace-personal-automated-niche-website-discovery/9c0cb90c-faaa-4eaf-bcd2-863c04cd34b0/scratchpad/sec-audit/` (`run1.mjs`, `run2.mjs`, `run3.mjs`, `csp.mjs`, `loads.mjs`, `names.mjs`, `idle.mjs`, `frame.mjs`, `meta.py`, `gen.py`, `headers1.txt`, `out/`).

Status labels: Verified working, Verified defective, Not tested, Requires human approval.

## Summary

| Area | Result |
|--|--|
| Images leave the browser | No. Zero non-GET requests, zero third-party origins, no WebSocket/beacon/fetch/XHR, no file name or bytes in any URL or body, across 5 full runs on both tools |
| CSP | Delivered as a `<meta>` on every HTML page and enforced (8 attack probes blocked on every route). Header CSP is only `frame-ancestors 'none'` (and `connect-src 'none'` on `/_astro/*.js`) |
| EXIF/GPS in outputs | Stripped for JPEG, PNG and WebP inputs. A 472-byte ICC profile remains (disclosed on the privacy page) |
| Browser storage | Cookies, localStorage, sessionStorage, IndexedDB, Cache API, service workers, OPFS all empty after full use |
| Staging noindex | `X-Robots-Tag: noindex` on every response checked, including 307s, 404s, assets, robots.txt and sitemaps |
| Confirmed defects | 1 medium, 5 low (SEC-1 to SEC-6) |

## Confirmed defects

### SEC-1 (medium) Plain HTTP is served with no redirect to HTTPS and no HSTS. Status: Verified defective (staging); production Not tested
Why it matters: the privacy promise ("the code of this site does not upload your image") depends on the JavaScript arriving intact. A network attacker on a plain-HTTP load can replace the script. Staging is on `workers.dev`, so this is partly platform behaviour, but the same gap can exist on `sizetune.com` unless handled.
Repro:
```
curl -sS -o /dev/null -w "http->%{http_code} redirect=%{redirect_url}\n" http://sizetune-staging.subhamojha9.workers.dev/about/
curl -sI https://sizetune-staging.subhamojha9.workers.dev/ | grep -ic strict-transport
```
Evidence: `http->200 redirect=` and a count of `0` (no `Strict-Transport-Security` on any of 7 routes, 404, assets). TLS itself is fine: TLSv1.3, cert CN `subhamojha9.workers.dev`, HTTP/2, h3 advertised. `sizetune.com` did not resolve at audit time, so production behaviour is Not tested.
Fix direction: on the custom domain enable Cloudflare "Always Use HTTPS" and add HSTS (start with a short max-age, no preload until stable). Owner action in the Cloudflare dashboard.

### SEC-2 (low) CSP `<meta>` is not the first element in `<head>` and the real CSP is not a header. Status: Verified defective
A meta CSP only governs content parsed after it. On `/resize-image-to-20kb/` the CSP meta is at byte offset 2321; before it sit `<link rel=canonical>`, the Open Graph/Twitter metas, `<link rel=icon href=/favicon.svg>` and an inline `<script type="application/ld+json">`. Impact is small (a JSON-LD data block does not execute, the icon is same-origin), but it is a gap in the guarantee and it will bite if anything executable is ever added above the meta.
Also by construction (not a defect, see recommendations R1): a meta CSP cannot carry `frame-ancestors`, `report-uri` or `sandbox`, and does not apply to the worker script's own context.
Repro: `curl -s $B/resize-image-to-20kb/ | python3 -c "import sys;s=sys.stdin.read();print(s.lower().find('content-security-policy'),s.find('<link'),s.find('<script'))"` gives `2321 377 1730` for CSP/first link/first script.

### SEC-3 (low) 404 responses under `/_astro/` are cached as `immutable` for one year. Status: Verified defective
Repro: `curl -sI $B/_astro/does-not-exist.js` and `curl -sI $B/_astro/ImageTool.CO9dXJ5u.js.map`.
Evidence: `HTTP/2 404`, `content-type: text/html`, `cache-control: public, max-age=31536000, immutable`. The `/_astro/*` rule in `_headers` also matches misses. A browser or edge that asks for a hashed file before or during a deploy can keep the 404 for a year. Low because filenames are content-hashed and the HTML is revalidated, but it is a cache-poisoning footgun.

### SEC-4 (low) Trailing-slash and index redirects are 307, not 301/308. Status: Verified defective (SEO/caching rather than security)
Evidence (all `HTTP/2 307`, empty body, `location` as shown):
```
/about          -> /about/
/about//        -> /about/
/about/index.html -> /about/
/index.html     -> /
/404/           -> /404
/404.html       -> /404
```
Wrangler `html_handling: "auto-trailing-slash"` emits 307. Browsers and crawlers treat 307 as temporary, so link equity may not consolidate on the canonical URL on the production domain. Case differs: `/ABOUT/` is 404 (correct). `/about/?x=1` is 200 and served from cache with the same body.

### SEC-5 (low) `/404` returns 200 with the "Page not found" page. Status: Verified defective
Evidence: `curl -sI $B/404` gives `HTTP/2 200`; the body is the not-found template (`<title>Page not found | SizeTune`, `<meta name="robots" content="noindex">`). Real misses (`/nope`, `/nope/`, `/_headers`, `/.env`, `/sitemap.xml`) correctly return 404 with the same 9,807-byte body, `noindex` meta, full security headers. The noindex meta contains the soft-404 on production, so impact is minor.

### SEC-6 (low) Result page renders a right-to-left override from the file name. Status: Verified defective
Repro: upload a file named `a<U+202E>gnp.exe.jpg` to `/resize-signature/`. The "Saved as ..." label (`data-testid=download-name`) keeps U+202E, so the text renders reversed (a visual spoof of the extension). The actual download name is sanitised by the browser (`a_gnp.exe-sizetune.jpg`). HTML/script payloads in names (`<img src=x onerror=...>.jpg`, `"><script>...`), `..\..\evil/../a.jpg`, 300-character names, `.htaccess.jpg` and `CON.jpg` were all rendered as inert text and produced sanitised download names (`img-src=x-onerror=...-sizetune.jpg`, `a-sizetune.jpg`, `htaccess-sizetune.jpg`, `CON-sizetune.jpg`); no script ran and no CSP violation fired. The name only affects the user's own screen, so low.

## Verified working

### SEC-7 (info) Image bytes and names never leave the browser. Status: Verified working
Repro: `node run1.mjs image "fx/Secret-Passport JaneDoe 42.jpg" img-jpg` (also `gps.png`, `gps.webp` on the image tool; `sig_gps.jpg`, `gps.png` on the signature tool). The script injects instrumentation (fetch, XHR, sendBeacon, WebSocket, Worker, URL.createObjectURL/revokeObjectURL, console) and records every Playwright request at context level, including worker requests and POST bodies.
Evidence per run: 15 requests total, all `GET`, one origin (`sizetune-staging.subhamojha9.workers.dev`). After the file is chosen the only requests are two `blob:` image GETs (preview and result), the worker script `/_astro/compress.worker-DPf9GKns.js`, and (on navigating away) HTML/CSS/font. Needle search for the file name, `Secret-Passport`, `JaneDoe`, `SECRETMAKE`, `sig_gps`, `gps.` across all URLs and POST bodies: 0 hits. WebSockets 0, beacons 0, fetch 0, XHR 0 from page code. One module worker, same-origin, `mode: worker`.
Page loads of all seven routes plus a 404: 4 to 9 requests each, same origin only, 0 non-GET. No ad, analytics, tag manager, font CDN or CDN script origins; the only external strings in the shipped JS are XML namespace URIs (`w3.org`). No `http://` mixed content in HTML. Only external-looking link is `mailto:hello@sizetune.com`.

### SEC-8 (info) CSP is enforced (meta). Status: Verified working
Repro: `node csp.mjs` (page.evaluate on all 7 routes plus a 404, listening for `securitypolicyviolation`). Same CSP string on every page: `default-src 'self'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-src 'none'; manifest-src 'self'; script-src 'self' <7 sha256 hashes>; style-src 'self' <1 sha256 hash>`. No `unsafe-inline`, no `unsafe-eval`.
Result on every route: injected inline `<script>` did not run; inline event handler (`onerror=`) did not run; `eval`, `new Function`, `setTimeout("string")` threw; `https://example.com/evil.js` and a `data:` script blocked (request `failed: csp`, never sent); third-party `fetch`, `<img>`, `WebSocket` and `<iframe>` blocked (`connect-src`, `img-src`, `frame-src`); injected `<style>` and `style=` attribute not applied; `blob:` Worker blocked (`worker-src`); injected `<base href=https://evil.example/>` ignored (`base-uri`). All violations carried `disposition=enforce`; 14 distinct directives fired. Zero violations on clean page load and zero console messages on all routes.
Framing: an attacker page (`https://attacker.test/`, route-mocked) framing `/resize-signature/` was blocked: `Framing '...workers.dev/' violates ... "frame-ancestors 'none'"`.

### SEC-9 (info) Header CSP is only `frame-ancestors`. Status: Verified working as designed; see R1
HTML responses: `content-security-policy: frame-ancestors 'none'`. `/_astro/*.js` (including the worker): two CSP headers, `frame-ancestors 'none'` and `connect-src 'none'`. CSS/fonts/images: `frame-ancestors 'none'` only. Direct enforcement of the worker's `connect-src 'none'` was Not tested (the worker only reacts to `postMessage`; proving it would need modified code).

### SEC-10 (info) Metadata stripping. Status: Verified working
Fixture: 1600x1200 JPEG with Exif (Make `SECRETMAKE_ACME`, Model, Artist, Copyright, ImageDescription, DateTime, GPS lat/lon/altitude, UserComment, OwnerName), XMP APP1, COM comment and Photoshop APP13 (IPTC). Same Exif embedded into PNG (`eXIf`, `tEXt`, `iTXt` XMP) and WebP.
Segment parse of the original JPEG: `E1(Exif) E1(XMP) FE(COM) ED(Photoshop)`. Output JPEG (19,393 bytes): `E0 JFIF, E2 ICC_PROFILE(472), DB, DB, C0, C4x4, DA`; needle search for `SECRET`, `JANE`, `ACME`, `Exif`, `GPS`, `XMP`, `xmpmeta`, `Photoshop`, `8BIM`, `COMMENT`, `ARTIST`, `COPYRIGHT`, `HOME_ADDRESS`: none. PNG input gives JPEG output with the same layout; WebP output chunks are `VP8X, ICCP, VP8 ` with no `EXIF`/`XMP `. Signature tool outputs identical. The only retained item is a generic 472-byte display/sRGB ICC profile, which `/privacy/` already discloses ("A colour profile may remain"). A JPEG+trailing-HTML polyglot decoded normally and produced a clean re-encoded output.
"Keep your original instead" (offered only when the result is larger): a 1,339-byte JPEG with GPS gave a 5,793-byte result; the page warned "Your original contains location data; the SizeTune result does not ... keep it only if you are happy to share that location." The kept original downloads unchanged, with its Exif intact (as the privacy page states). This is an explicit opt-in, not a leak.

### SEC-11 (info) No persistent client storage and no console leakage. Status: Verified working
After full use of both tools (choose, resize, download, start over), a context cookie jar, `document.cookie`, `localStorage`, `sessionStorage`, `indexedDB.databases()`, `caches.keys()`, service-worker registrations and OPFS entries: all empty/zero. 0 `Set-Cookie` headers on all responses checked. Console: 0 messages (log/info/warn/error/pageerror) during all runs, including error paths; the shipped JS contains no `console.*`, `sendBeacon`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `indexedDB`, `localStorage`, `sessionStorage`, `caches.` or `document.cookie`, and no `fetch(` call (grep over the 8 live bundles returned nothing).

### SEC-12 (info) Object URLs and worker lifecycle. Status: Verified working
Instrumented page: choose A (2 URLs created), replace with B (A's 2 revoked, 2 live), result (3 live), "Process another" (all 5 created revoked, 0 live). "Start over" in other runs: 3 created, 3 revoked, 0 live. The result URL is intentionally live while the result is shown. Worker: one same-origin module worker per page; after a job it stays idle and is terminated by the page after the engine's 15 s idle timer (`idleMs`); Playwright observed the worker `close` event at 16.6 s after load with a job at 1.7 s. Large sources (72 MP and 100 MP) terminate the worker straight after the job. Not tested: cancel mid-run (jobs finished before the Cancel control could be clicked).

### SEC-13 (info) File validation and resource limits. Status: Verified working
Chrome did not crash and no page error occurred in any case; every rejection happened before decode and sent no request. Both tools behave identically.
| Input | Result |
|--|--|
| 0-byte `.jpg` | Rejected: "not a JPEG, PNG or WebP image" |
| Text renamed `.jpg` | Rejected (magic bytes) |
| Real SVG with `<script>`; SVG renamed `.png` | Rejected |
| Animated GIF; GIF renamed `.jpg` | Rejected |
| PDF; PDF renamed `.jpg` | Rejected |
| JPEG renamed `.png`; PNG renamed `.jpg` | Accepted by content, processed correctly |
| JPEG with random bytes after 600 B | Rejected at intake |
| JPEG cut in half | Rejected: "looks incomplete or damaged" |
| 28.7 MB JPEG | Rejected: "too large ... limit is 25 MB" (no read) |
| PNG header 10,001x10,000 (100.01 MP), 20,000x20,000, 65,535x65,535 | Rejected from the header: "too many pixels ... limit is 100 megapixels" |
| PNG header exactly 10,000x10,000 with no real pixel data | Accepted at intake, then "looks incomplete or damaged" after the run (worker terminated) |
| Real 12,000x6,000 PNG (72 MP) and 10,000x10,000 PNG (100 MP) | Processed in the worker (about 1.5 s and 2.1 s), no preview thumbnail ("very large image"), valid output |
| 1x1 PNG | Processed (759 bytes) |
Limits come from `src/lib/engine/limits.ts` and were seen to apply: 25 MiB, 100 MP header cap.

### SEC-14 (info) Security headers on every route and asset. Status: Verified working (staging)
Identical on `/`, `/resize-image-to-20kb/`, `/resize-signature/`, `/guides/photo-size-for-online-forms/`, `/about/`, `/privacy/`, `/terms/`, the 404, 307s, `robots.txt`, both sitemaps, `favicon.svg`, `og-default.png`, `/_astro/*`:
```
HTTP/2 200
content-type: text/html
cache-control: public, max-age=0, must-revalidate
content-security-policy: frame-ancestors 'none'
cross-origin-opener-policy: same-origin
permissions-policy: camera=(), microphone=(), geolocation=()
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
x-frame-options: DENY
x-robots-tag: noindex
nel: {"report_to":"cf-nel","success_fraction":0.0,"max_age":604800}
report-to: {"group":"cf-nel","max_age":604800,"endpoints":[{"url":"https://a.nel.cloudflare.com/report/v4?s=..."}]}
server: cloudflare
```
Cache: HTML `max-age=0, must-revalidate`; `/_astro/*` `public, max-age=31536000, immutable`; `favicon.svg` `max-age=86400`; `og-default.png` `max-age=0, must-revalidate`. No `Access-Control-Allow-Origin` (even with a hostile `Origin`). `POST` and `OPTIONS` return 405. Missing by choice or platform: HSTS (SEC-1), COEP/CORP (not needed, no cross-origin isolation features in use). Permissions-Policy lists only three features.
Note: Cloudflare injects `nel`/`report-to`; browsers may send network-failure reports to `a.nel.cloudflare.com` (success fraction 0, so failures only). That is a third-party contact made by the browser, not by site code, and cannot be blocked by CSP. The privacy page mentions "network-error reports".

### SEC-15 (info) Staging noindex, robots, sitemap, canonicals. Status: Verified working; see R3
- `X-Robots-Tag: noindex` present on all responses checked (22 URLs including 307s, 404s, JS/CSS/font/PNG/SVG assets, robots.txt, sitemap-index.xml, sitemap-0.xml).
- HTML pages carry no `<meta name="robots">` (staging relies on the header); only the 404 page has `<meta name="robots" content="noindex">`.
- `robots.txt` (72 B): `User-agent: *` / `Allow: /` / `Sitemap: https://sizetune.com/sitemap-index.xml`. Allowing crawl is what lets bots see the noindex header.
- `sitemap-index.xml` lists `https://sizetune.com/sitemap-0.xml`; `sitemap-0.xml` lists 7 URLs, all `https://sizetune.com/...` with trailing slashes: `/`, `/about/`, `/guides/photo-size-for-online-forms/`, `/privacy/`, `/resize-image-to-20kb/`, `/resize-signature/`, `/terms/`. No 404 and no `/404` in the sitemap.
- Every page has `<link rel=canonical>` and `og:url` pointing at production `https://sizetune.com/<path>/` (staging does not self-canonicalise; fine because it is noindex).

### SEC-16 (info) Exposed files, source maps. Status: Verified working
404 (HTML body, noindex): `/.env`, `/.git/config`, `/.git/HEAD`, `/wrangler.jsonc`, `/package.json`, `/_headers`, `/sitemap.xml`, `/ads.txt`, `/security.txt`, `/.well-known/security.txt`, `/_astro/`, `/_astro/*.js.map`. No `sourceMappingURL` in any shipped JS. Path traversal (`/%2e%2e/...`, `--path-as-is /../../etc/passwd`) returns 400. `_headers` is applied but not served.

## Recommendations (not defects)

- R1 CSP delivery: if hosting allows, send the full policy as a response header as well (build-time hashes make this awkward with Astro's meta approach; at minimum put the meta first in `<head>`, SEC-2). Consider adding `report-to`/`report-uri` only if a first-party collector is ever wanted (privacy trade-off). Add `Cross-Origin-Resource-Policy: same-origin` for assets.
- R2 Production: HSTS (SEC-1), HTTP-to-HTTPS redirect, and verify 301/308 for slash redirects if the zone allows a Redirect Rule (SEC-4).
- R3 Staging indexing: noindex hangs on the host pattern `https://:version.:subdomain.workers.dev/*`. Any other non-production host (a custom staging domain, preview URL) would be indexable and would serve `robots.txt Allow: /` plus a sitemap of production URLs. Prefer a build-time environment flag that emits both header and `<meta robots noindex>`.
- R4 Add `/404` handling so it returns 404, or accept the soft 404 (SEC-5).
- R5 Strip Unicode bidi controls (U+202A-202E, U+2066-2069) from displayed file names (SEC-6).
- R6 Consider adding `security.txt` once a contact is approved.
- R7 Privacy wording: the policy says "When we tested the site's code on a local copy"; this audit now also verified staging behaviour. The owner can decide whether to reword.

## Requires human approval (carried over, not decided by this audit)

- Owner confirms that the displayed name "Sourav", the claim "based in India", the contact `hello@sizetune.com` and the Indian-law statements on `/about/`, `/privacy/` and `/terms/` are intended to be public and accurate. This audit does not assert or invent any legal identity; mailbox delivery was not verified.
- Search Console wording on `/privacy/` ("We may use Google Search Console in future ...") versus "no analytics": owner decision.
- HSTS and Always-Use-HTTPS on the custom domain (SEC-1): Cloudflare dashboard change, owner action.
- Whether the custom domain also emits NEL/`report-to` headers: confirm after the domain is live.
- Terms say the site "may show advertising in future"; the privacy page says there is none today. Any future ads change the CSP and privacy claims and need re-audit.

## Not tested

Production `sizetune.com` (does not resolve); Firefox and Safari/WebKit and any real mobile device (Chromium 157 only; CSP and file handling can differ); direct enforcement of the worker's `connect-src 'none'` (SEC-9); cancel mid-run; HEIC and EXIF-orientation behaviour; low-memory devices and tab-crash recovery; Cloudflare account-level features that could add cookies or logging; whether staging deploy matches commit 8f0b204 (taken from the brief; `dist/` timestamps and live asset names `ImageTool.CO9dXJ5u.js` match the local build).
