# SizeTune: Security and Privacy Review

Date: 2026-11-12. Reviewer: security/privacy pass (read-only; no project file changed except this report). Scope: SEO_ARCHITECTURE §10, ADR, CLOUDFLARE_DEPLOYMENT, src/**, public/_headers, dist/*.html.
Tags: **VERIFIED** = read in a primary source or measured by me today. **ASSUMPTION** = standard platform behaviour or secondary source I did not test or confirm. This is **not legal advice and makes no compliance claim**; the "Needs human/lawyer" list is at the end. Nothing here enables or recommends enabling ads/analytics today.
Context update from coordinator (RDAP, 2026-11-12): sizetune.com is registered at Cloudflare (nameservers lars/teagan.ns.cloudflare.com, no A record, site not live). So no nameserver change is needed; the runbook is "attach custom domain to the Worker" (human action). I changed nothing.
Note: source files were being edited by other agents while I reviewed (the guide page already passes a `pageType` prop that the Base.astro I read lacked). Line references may drift.

## 0. Findings table
| ID | Sev | Finding | Evidence | Fix |
|--|--|--|--|--|
| S-01 | HIGH (gates ads) | Any ad script on the same page as the tool makes the "photo stays in your browser" promise untruthful as an absolute. | §1 below. `adsbygoogle.js` runs in the page origin (Google: tag must be a `<script>` in your page). | Ad-free tool pages; ads only on non-tool pages (§1 policy). Do not apply to AdSense with ads on `/`. |
| S-02 | MEDIUM | No CSP and a thin header set. | `public/_headers` has only nosniff, Referrer-Policy, Permissions-Policy. CSP "deferred" in docs. | Ship the "now" CSP (§3a). It was tested: hydration, Worker, preview, download all pass with zero violations. |
| S-03 | MEDIUM | Privacy page is a stub and two statements need qualification. | privacy.astro (one paragraph); noscript text; see §5. | Replace with full policy before any ad/analytics; fix wording now (§5). |
| S-04 | MEDIUM | JSON-LD injected with `set:html={JSON.stringify(...)}`; `JSON.stringify` does not escape `<`. | Base.astro line ~30; guide `title`/`description` flow from MDX frontmatter into it. | Escape: `JSON.stringify(x).replace(/</g,'\\u003c')`. Today all values are static, so not exploitable now; becomes so if content ever comes from untrusted input. |
| S-05 | MEDIUM | `checkSize` decodes the whole image (`createImageBitmap(file)`) before enforcing the 64 MP limit, then the Worker decodes it again; no byte-size cap. A decompression-bomb PNG/WebP can allocate GBs before the check fires. | ImageCompressor.tsx `checkSize`, `MAX_PIXELS = 64_000_000` (64 MP x 4 B = 256 MB per bitmap, plus 256 MB canvas at scale 1). | Cap `file.size` (e.g. 40 MB) first; read width/height from the header bytes (PNG IHDR, JPEG SOF, WebP VP8/VP8L/VP8X) before any decode; lower limit to ~40 MP on mobile; test on low-RAM Android. ASSUMPTION: crash behaviour on low-RAM phones (untested). |
| S-06 | LOW | Type allowlist is only the `accept` hint. | `accept="image/jpeg,image/png,image/webp"`; user can pick "All files". No magic-byte check. SVG exclusion relies on the picker hint. | Check `file.type` and first bytes (FF D8 FF / 89 50 4E 47 / RIFF....WEBP) and reject others, including SVG and HEIC, with a clear message. ASSUMPTION: Chrome's `createImageBitmap` rejects SVG blobs; untested, do not rely on it. Never render user SVG via `<img>`/innerHTML. |
| S-07 | LOW | Result blob URL not revoked when the user clears/changes the file. | `lastUrl` revoked only on next run or unmount; `onChange` resets state but not the URL. | Revoke `lastUrl` in the file onChange handler. Matters more once third-party scripts exist (blob: URLs are readable by any same-origin script). |
| S-08 | LOW | Main-thread fallback has no timeout/cancel; worker error text (`e.message`) is shown raw. | `compressOnMainThread`; `w.onerror`. | Add timeout/yield or refuse >N MP on fallback; show generic message. |
| S-09 | LOW | Supply chain hygiene. | `npm audit --omit=dev`: 0 vulnerabilities (VERIFIED today). Lockfile present. Install scripts: esbuild, workerd, fsevents (`hasInstallScript` in package-lock, VERIFIED). No `.npmrc`. CI actions pinned by tag (`checkout@v4`, `setup-node@v4`), not SHA. Caret ranges everywhere. | Keep `npm ci` only; pin actions by SHA; Dependabot/Renovate with a cool-down; keep `npm audit` in CI (full, incl. dev); review any new package with install scripts. Dev-only tools (wrangler/workerd) never ship to users. |
| S-10 | LOW | Missing headers: `frame-ancestors`, COOP, `X-Frame-Options` fallback, HSTS. | `_headers`. | §3a header block; HSTS ramp §6. |
| S-11 | LOW | workers.dev/preview noindex rules untested locally. | CLOUDFLARE_DEPLOYMENT §4. | Verify on first real deploy with `curl -I`. After the domain works, consider `workers_dev:false`/`preview_urls:false` (human). |
| S-12 | INFO | No cookies, localStorage, sessionStorage or IndexedDB are used by site code. | grep of src (only `URL.createObjectURL`). VERIFIED. | Keep it that way until ads/analytics; re-audit then. |
| S-13 | INFO | e2e already asserts no off-origin and no non-GET requests during compression (SEO §8). Today's CSP test shows the only non-self request is the `blob:` preview. | scratch test (§3). | Add a Playwright test that asserts the CSP header and zero `securitypolicyviolation` events. |

## 1. Can third-party ad scripts read the user's file? (precise answer)
Model: a `<script src=adsbygoogle.js>` in your page executes **in your page's origin and JS realm**. It then injects **cross-origin iframes** that actually render the ads (creatives).

| Question | Answer | Tag |
|--|--|--|
| Script loaded by `<script>` in the page (adsbygoogle.js, any CMP, any beacon) vs the tool | **Full same-origin power.** It can read `input.files[0]` (a `File`), read bytes via `File.arrayBuffer()`/`FileReader`, read the DOM (preview `<img>`, result text, download link), `fetch()` a `blob:` URL (blob URLs are same-origin-scoped, not secret), call `getImageData` on same-origin canvas, monkey-patch `Worker.prototype.postMessage`/`createObjectURL`/`HTMLCanvasElement.toBlob` before the app runs, add listeners to the input, and `fetch`/`sendBeacon`/`new Image().src` data out. A page cannot distinguish "trusted" from "third-party" same-origin script. | ASSUMPTION (standard web-platform semantics; MDN same-origin policy; not tested by me) |
| Ad content inside the **cross-origin iframes** | **Cannot** read the parent DOM, parent `input.files`, parent `blob:` URLs or canvas: "Scripts cannot access most properties in other window objects if the script was loaded from a different origin, including scripts inside a frame accessing the frame's parent" (MDN iframe). They can only `postMessage`, and may navigate the top window if they have sticky activation (MDN). | VERIFIED (MDN iframe page, read today) |
| Does the real File sit in the Worker? | The file is `postMessage`d to a module Worker. Page script cannot read the Worker's memory, but the **page** still holds the `File` (input, `file` state), so isolation of the compute step does not protect it. A script that patches `Worker`/`postMessage` early could also copy it. | ASSUMPTION |
| What does Google say about the ad code? | Google supports only **strict CSP with a nonce**, not allowlists, because "domains change over time"; the supported policy includes `'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https: http:`. Ad code is treated as trusted code running in your page. Google Publisher Tag docs: same-domain creative iframes inherit the page CSP; recommend SafeFrame (`forceSafeFrame`) (that is GPT, not AdSense auto ads). Google gives no isolation guarantee between adsbygoogle.js and page content. | VERIFIED (support.google.com/adsense/answer/16283098; developers.google.com/publisher-tag/guides/content-security-policy) |
| Can CSP stop it? | No. CSP decides **which** script may run; once `https://pagead2.googlesyndication.com` is allowed, its code has page-origin power. `connect-src` does not stop `<img>` beacons, `form` posts, navigations or `sendBeacon`-like paths (hence the img-src/form-action limits). Google's own supported policy is permissive (`https:`), so it cannot be a data-exfiltration barrier. | VERIFIED for Google policy text; ASSUMPTION for the exfil-channel list |
| Can Permissions-Policy stop it? | No. There is no Permissions-Policy feature that blocks the File API or `input.files`. It only restricts powerful features (camera, geolocation...) and can restrict cross-origin iframes via `allow`. | ASSUMPTION |
| Can I sandbox AdSense? | Not usefully. Sandboxing the *ad iframe* is Google's choice, not yours; wrapping `adsbygoogle.js` itself in a sandboxed iframe on a separate origin is an unsupported modification of the ad setup and may breach AdSense policy ("make modifications to the AdSense ad code so long as those modifications do not artificially inflate ad performance" is the only stated allowance). Treat as unsupported. | VERIFIED (policy line quoted) / ASSUMPTION (unsupported) |

Practical conclusion: **a same-page ad script can technically access whatever the page can access**. Whether Google's script does so is a trust/contract matter, not a technical guarantee. Saying "your photo never leaves your device" on a page that also runs third-party ad code is not something the site can guarantee.

### Mitigation options (ranked)
1. **Ad-free tool pages (recommended).** Tool routes (`/`, `/resize-image-to-*kb/`, `/resize-signature/`) load no ad script, no CMP, no third-party analytics. Verifiable with the CSP in §3a (no third-party hosts allowed at all, so the claim is enforced by the browser).
2. **Ads on content pages only** (guides, about, FAQ-style articles) with their own consent flow. These pages have no file input, so there is nothing to read.
3. **Separate origin for the tool** (e.g. tool on `app.sizetune.com`, ads only on `sizetune.com`). Gives origin isolation (different origin = no shared DOM/blob URLs), but splits SEO equity and adds work; no benefit over option 1 unless ads must sit beside the tool.
4. **Ads after the result on the tool page.** Weaker: the `File`, preview `blob:` and result `blob:` may still exist; clearing them needs the app to drop references and revoke URLs, and still cannot stop a script that patched APIs earlier. Also CLS/consent issues. Do not use while the privacy promise is absolute.
5. **Same page, ads beside tool, with copy qualified** ("we do not upload; third-party ad code runs on this page"). Technically honest but undermines the main trust differentiator; a lawyer should approve the wording.

### Concrete ad-placement policy (for when the owner decides; nothing enabled now)
- P1: Never load `adsbygoogle.js`, a CMP, or any third-party script on a route that contains `<input type=file>`. Enforce by CSP on those routes and by a `verify:html` check: no `<script src>` to non-self origin and no `adsbygoogle` string in tool-route HTML.
- P2: Use `_headers` path rules so tool routes keep the strict "now" CSP and content routes (`/guides/*`, `/about/`) get the "ads" CSP (§3b).
- P3: No ads that sit between the file input and the Download button; AdSense separately prohibits ads placed so they look like navigation/blend with content or invite accidental clicks (VERIFIED, program policies page).
- P4: Privacy copy per page type: tool pages may say "this page loads no ads or trackers"; content pages say ads and cookies are used.
- P5: Internal links from tool pages to ad-bearing guides are fine (separate navigation = new page load).
- P6: Re-audit before any change; record the decision in the ADR.
Revenue trade-off: the tool pages are the traffic landing pages; P1 forgoes ad revenue on them. That is a business decision for the owner; the alternative is option 5 with lawyer-approved wording.

## 2. Consent management (EEA/UK/Switzerland, India)
- **Google requirement (VERIFIED):** To serve personalised ads in EEA, UK, Switzerland, publishers must use a **Google-certified CMP integrated with the IAB TCF** (EEA/UK from 16 Jan 2024; Switzerland from 31 Jul 2024); Google lists certified CMPs weekly and does not itself verify TCF/legal compliance; traffic from a non-certified CMP may get only non-personalised/limited ads. Google's own "Privacy & messaging" European regulations message is stated to be certified (support.google.com/adsense/answer/13554116).
- **Google EU User Consent Policy (VERIFIED):** applies to end users in EEA, UK, Switzerland; publisher must obtain legally valid consent for cookies/local storage where legally required and for collecting/sharing/using personal data to personalise ads; identify each party that may collect/use data; keep records of consent; give clear instructions to revoke (google.com/about/company/user-consent-policy). Failure may lead Google to limit/suspend.
- **What a CMP must do in practice (ASSUMPTION, from TCF/ePrivacy norms; lawyer to confirm):** show a notice before ad scripts set non-essential cookies; equal-prominence accept/reject; granular purposes/vendors; store a consent string (TCF "euconsent-v2" cookie) and make it accessible to vendors via the TCF API (`__tcfapi`); persist and allow withdrawal later (a persistent "privacy settings" link); log proofs of consent.
- **Funding Choices / Google's CMP:** Google's own consent tool is certified (VERIFIED above). Third-party certified CMPs are an alternative. Which is better (cost, geo targeting, design) is a human choice.
- **India (ASSUMPTION; secondary sources; verify):** Google's certified-CMP rule above names EEA, UK, Switzerland, not India. India's DPDP Act 2023 and DPDP Rules 2025: Rules notified 13/14 Nov 2025; Board provisions in force at once; consent-manager provisions at 12 months (about 13 Nov 2026, i.e. now); the core notice/consent/rights obligations at 18 months (about 13 May 2027). A January 2026 proposal to shorten 18 to 12 months was reported; I found no confirmation it was adopted. **Status as of today is uncertain; a lawyer must confirm the current dates and whether ad-cookie processing for Indian visitors is in scope** (most expected visitors are in India per SEO doc). Design for notice and an opt-out/consent flow for India as a precaution, but this is not a statement of what the law requires.
- **GDPR/ePrivacy basics (ASSUMPTION; lawyer):** storing/reading cookies or similar on a user's device for advertising generally needs prior opt-in consent (ePrivacy Art. 5(3)); processing for personalised ads needs a legal basis (typically consent). Strictly necessary storage is exempt. The site currently sets none.
- **Cloudflare static hosting interplay:** no server code, so geo-conditional rendering cannot happen at the origin. The CMP itself must detect region client-side (or you show it globally). Static assets cannot inject per-request nonces (relevant to CSP, §3). A Worker could do geo logic but would break the "no Worker" design and is not recommended.
- **CLS/LCP effects (ASSUMPTION; measure before launch):** a third-party CMP adds a script and a banner. Use a fixed-position overlay (no layout shift), load the CMP script `async` only on ad-bearing pages (policy P1 already excludes tool pages, which protects the tool's LCP/INP), reserve ad slot heights (SEO doc §7 already says so), and ensure the banner text is not the LCP element on content pages (render a large hero text/image first or make the banner small).

## 3. CSP strategy
### What Astro 7 supports (VERIFIED: docs.astro.build config reference + my build)
Astro has a **built-in `security.csp`** (since Astro 6.0.0). On static output it emits a `<meta http-equiv="content-security-policy">` per page with `script-src`/`style-src` hashes it computes; options: `algorithm`, `directives`, `styleDirective.{hashes,resources}`, `scriptDirective.{hashes,resources,strictDynamic}`; not supported: `<ClientRouter/>`, Shiki inline styles (build warned: "Shiki syntax highlighting uses inline styles"). Meta cannot carry `frame-ancestors`/`report-to` (MDN, VERIFIED); those need HTTP headers. I built a copy with `security: { csp: { directives: ["object-src 'none'","base-uri 'none'","img-src 'self' blob: data:","connect-src 'self'","worker-src 'self'","form-action 'self'"] } }`: it emitted 7 script hashes + 1 style hash on **every** page and hydration/Worker/preview/download all worked, zero violations (VERIFIED, system Chrome). Recommendation: **use the built-in option** (no custom hashing script to maintain, hashes regenerate on every build and Astro upgrade) and add a **header CSP** only for what meta cannot do (frame-ancestors) plus the `_headers` duplicates. Meta + header policies combine (both must pass). Caveat: the meta policy lists the hashes for every page, not per page; harmless.

### Hand-rolled header alternative (what I tested)
Hashes of the two inline `<script>`s (island bootstrap) and the one inline `<style>` computed from `dist/index.html` and put in `_headers` for `/*`. Works, but hashes change on any Astro/React upgrade, so a post-build script would be required. Prefer the built-in option.

### 3a. CSP "now" (no ads; tested)
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-1BvDVWLr3QCC20uHhUDi27eDFVJpk1uMQJGIWKUks2I=' 'sha256-UIrFqcaitjA3OKa9mHKajg3N+0Y7tW9+y0o3QmMFeZQ='; style-src 'self' 'sha256-vv9IoKo7BSLbWcUHr3tNmfNVmm5L/9Cfn2H6LMk7/ow='; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; frame-src 'none'; manifest-src 'self'
```
(The sha256 values are for today's build of Astro 7.4.11; they will change. With the built-in `security.csp`, drop the hash tokens from the header and keep the meta's. Using both requires both to pass, so the header must also allow the same hashes or omit script-src/style-src and rely on the meta. Simplest: header = everything except `script-src`/`style-src`; meta = those two.)
Plus headers for `/*` in `_headers`:
```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=(), interest-cohort=()
Cross-Origin-Opener-Policy: same-origin
X-Frame-Options: DENY
```
**Test result (VERIFIED, copy of dist in the scratchpad, `wrangler dev --port 8791 --ip 127.0.0.1`, Playwright `channel:'chrome'`, generated 1600x1200 JPEG, target 50 KB):** hydrated=true; result 48,761 B in `mode=worker`; preview naturalWidth 1600; download filename `sizetune-compressed.jpg`; **0 `securitypolicyviolation` events**; no console errors; only non-self request was the `blob:` preview. Header present on `/`, `/privacy/`, guide page and the 404 page.
**Negative controls (each removed one directive, proving it is needed and the policy is enforced):**
| Directive removed/changed | Result |
|--|--|
| `img-src` without `blob:` | preview broken (naturalWidth 0), violation `img-src blob`. **`blob:` in img-src is required.** |
| script hashes removed | island does not hydrate; `script-src-elem inline` violations. **Hashes required.** |
| style hash removed | violation `style-src-elem inline` (the `astro-island{display:contents}` style); app still works. **Style hash (or style-src 'unsafe-inline') required.** |
| `worker-src 'none'` | Worker blocked, "Worker error". **`worker-src 'self'` required (Worker is a same-origin file `/_astro/compress.worker-*.js`).** |
| `connect-src 'none'` | **No violation** and still works: the app never fetches anything (File passed by `postMessage`, `createImageBitmap(File)` is not a fetch). `connect-src 'self'` can be tightened to `'none'` if no analytics is ever added. |
**`blob:` is NOT needed in `worker-src` or `script-src`** (the Worker is not created from a blob URL). `data:` is in img-src only as an allowance (not required by my test); remove it if nothing uses it. JSON-LD `<script type="application/ld+json">` is a data block and needs no hash.
Limits: tested desktop Chrome only (no Safari/Firefox); CSP does not stop navigations/`<img>` beacons from an already-compromised page; the page is only as safe as its own scripts.
Rollout: ship `Content-Security-Policy-Report-Only` first on the real domain (MDN/Google both recommend), check, then enforce. (No report endpoint exists on static hosting; use the browser console or a Reporting-Endpoints service, a human decision.)

### 3b. CSP "later with AdSense" (content routes only; draft; NOT to be applied now)
Google's documented, supported form (VERIFIED): `object-src 'none'; script-src 'nonce-{random}' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https: http:; base-uri 'none'`. Google states it supports only strict CSP (nonce), not host allowlists, and "more restrictive policies may break without notice." **Nonces need a per-response random value, which static hosting cannot generate**, so a nonce policy is impossible without a Worker. Options for content routes: (i) `Content-Security-Policy-Report-Only` or no CSP on ad routes (keep the other headers); (ii) a host-based policy discovered by testing, accepting that Google says it may break; (iii) hashes for your inline scripts plus `'strict-dynamic'` (Astro's `strictDynamic` option exists, needs Chrome 127/Firefox 138/Safari 18+) so the hashed ad loader can load Google's scripts; I did NOT test this with Google scripts (no ads were loaded). Starting point to test in Report-Only, host list from community/Tag Manager docs, **ASSUMPTION, not an official AdSense list**:
```
default-src 'self'; script-src 'self' <astro hashes> 'strict-dynamic' https://pagead2.googlesyndication.com https://*.google.com https://*.googlesyndication.com https://www.googletagservices.com https://fundingchoicesmessages.google.com; frame-src https://googleads.g.doubleclick.net https://*.googlesyndication.com https://*.google.com https://fundingchoicesmessages.google.com; img-src 'self' data: https:; connect-src 'self' https://*.google.com https://*.googlesyndication.com https://*.doubleclick.net https://fundingchoicesmessages.google.com; style-src 'self' 'unsafe-inline' <astro hash>; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
```
Expect to add hosts after reading violations; that is the nature of the ad stack. Keep tool routes on 3a. Do not extend `blob:`/`worker-src` allowances to ad routes unless an ad route has a tool.

## 4. Analytics data minimisation
| Option | Privacy effect | Notes |
|--|--|--|
| **None + Google Search Console / Bing Webmaster (recommended start)** | No script on the site at all; GSC data comes from Google Search, not from your page. | Verify ownership via DNS TXT in Cloudflare DNS (domain is at Cloudflare) or an HTML meta/file: a meta tag adds no script. Human step. |
| Cloudflare Web Analytics | Beacon script `static.cloudflareinsights.com`; reports timing metrics to `/cdn-cgi/rum` (proxied) or `cloudflareinsights.com/cdn-cgi/rum` (manual); VERIFIED docs: "Cloudflare does not track individual end users across our customers' Internet properties", collects "timing metrics", does not log query strings, retains unsampled beacon data 7 days then aggregates; needs CSP allowances; manual embeds cannot use SRI. | Docs I read do **not** state cookie/IP handling or consent status; secondary sources say no cookies/no localStorage (ASSUMPTION, 2020 announcement). Whether a notice/consent is needed is a lawyer question. It is still a third-party-served script that runs in the tool page's origin; if the tool page must stay "no third-party scripts", exclude tool pages or skip it. |
| Self-hosted privacy tools (Plausible/Umami/GoatCounter) | Good privacy, but needs a server/DB, contradicts "no server" architecture and adds ops/security burden. | Not recommended at this scale. |
| Google Analytics / GTM | Cookies, cross-site identifiers, consent requirements. | Avoid for this site. |
Never send, in any analytics, custom event, URL, error report or cookie: file names, file sizes or dimensions tied to a session/identifier, EXIF/GPS, image bytes or hashes, the user's target KB combined with other identifiers, raw error strings that include file names. If events are ever added, only coarse aggregate counters ("compress_clicked") with no file attributes. Never put state in query strings.

## 5. Privacy policy accuracy
Statements the site makes today (from src and built HTML):
| # | Where | Statement | Verdict |
|--|--|--|--|
| 1 | privacy.astro, meta description | "SizeTune processes images inside your browser. Photos are not uploaded to any server." | Accurate for site code (Worker gets the `File` via postMessage; e2e asserts no off-origin and no non-GET requests; today's test saw only a `blob:` request). **Needs qualification**: an absolute about "any server" cannot cover browser extensions, OS/browser sync, or later third-party scripts. Prefer "SizeTune's code does not upload images". |
| 2 | privacy.astro body | "Images you select are processed locally in your browser; SizeTune's code does not upload them to our servers" | Accurate (careful wording). |
| 3 | privacy.astro | "no ads or analytics are enabled in this spike" | Accurate today; wording "this spike" is internal; remove before launch. |
| 4 | privacy.astro | "a full policy ... is required before launch" | Accurate, and an admission that the page is a placeholder; must not ship as is. |
| 5 | index.astro meta/H1 copy | "Reduce a photo ... right in your browser. Nothing is uploaded." | Accurate for the image; **needs qualification**: the page request itself reaches Cloudflare (logs). |
| 6 | index.astro p | "It all runs inside your browser, so SizeTune never uploads your photo." | Accurate for site code today; "never" should be scoped to "our code" and to the tool pages (see §1). |
| 7 | index.astro noscript | "Nothing is sent to a server either way." | **Inaccurate/overbroad**: loading the page sends an ordinary request to Cloudflare. Reword to "your image is not sent". |
| 8 | index.astro title | "Free, Private" | Marketing claim; needs qualification: "private" must match the policy (edge logs exist; ads later). |
| 9 | ImageCompressor.tsx footer | "Our code processes your image in your browser and does not upload it to our servers. Ads, when enabled, are served by third parties (see the privacy page)." | Accurate and well scoped. **Misleading if ads ever appear on this page**: it implies ads sit near the tool. Under policy P1, delete the second sentence on tool pages. |
| 10 | JSON-LD | `offers.price "0"` | Accurate (free). Keep it true if ads/pro tier appear. |
| 11 | Docs (ADR M8, SEO §10) | "A third-party script on a page with a file input can in principle read the File" | Accurate (§1). |
### Data flows (what actually happens)
- **Cloudflare edge/serving (ASSUMPTION, confirm in Cloudflare's own terms/DPA):** every page/asset request reaches Cloudflare; its logs/metrics include IP address, user agent, URL, timestamps, country. As host and DNS provider (and registrar) Cloudflare is a processor/controller for its own purposes. No log access is configured by the site. A privacy policy must name this.
- `workers.dev` and preview URLs: same data flow on other hostnames (noindexed).
- Image bytes: stay in the browser (File, Worker memory, `blob:` URLs); not transmitted by site code (VERIFIED by e2e and today's test).
- Site storage: none (VERIFIED, no cookies/storage in code).
- Search Console/Bing (if used): data collected by the search engines, not the site.
- Later: ad vendors (Google and its partners) set cookies/identifiers, receive IP/UA/page URL, do interest-based ads; the CMP stores a consent record; Cloudflare Web Analytics if enabled; fonts/CDNs if ever added (none now).
### Required contents for a real policy (ASSUMPTION; checklist, not legal advice)
Controller identity and contact; what is and is not collected; local processing explanation; hosting and logs (Cloudflare) and retention; cookies/storage (none today); analytics tool and purposes; ad vendors, cookies, interest-based ads, opt-out routes (Google Ads Settings, aboutads.info: AdSense "Required content" page, VERIFIED), list/links to vendors; consent mechanism and how to withdraw; legal bases (GDPR) and international transfers; user rights (GDPR and DPDP); children's data; retention; security measures; grievance contact (India DPDP expects one, ASSUMPTION); effective date and change log; link in footer of every page. AdSense also expects visitors to be told about third-party cookies (VERIFIED: "Required content" page).
Also needed: About and Terms pages, `ads.txt` (SEO doc) and honest "contact" details.

## 6. Other security
- **XSS surface (S-04):** only `set:html` is the JSON-LD tag; React escapes by default (no `dangerouslySetInnerHTML`, no `innerHTML` in src: VERIFIED by grep). Preview uses `<img src=blob:>`; alt text is static. User file names are never rendered.
- **Headers:** add the §3a block; `nosniff` present. COOP `same-origin` is safe now (no popups/embeds), revisit when ads arrive on content routes.
- **HSTS plan (domain is at Cloudflare; ASSUMPTION on dashboard specifics):** (1) attach custom domain; confirm HTTPS for apex and `www`; (2) enable "Always Use HTTPS"; (3) send `Strict-Transport-Security: max-age=300` via a host-scoped `_headers` rule (`https://sizetune.com/*`) not on workers.dev; (4) after a week with no issues, `max-age=604800`, then `31536000`; (5) add `includeSubDomains` only when every subdomain is HTTPS-only; (6) `preload` only as a deliberate, hard-to-reverse human decision. Cloudflare's dashboard also has an HSTS setting; use one place only.
- **Subresource risk:** no third-party resources, no web fonts, no CDN today (VERIFIED: dist references only /_astro/*). Every future third-party script is a code-execution grant in the page origin (§1); SRI only works for pinned files, not Google/Cloudflare beacons.
- **File handling:** see S-05/S-06/S-08. Also: PNG transparency flattened to white (intended), EXIF not preserved by canvas re-encode (so GPS is dropped from output; ASSUMPTION, untested, ADR M2 says an EXIF fixture is still to be added; please add; orientation handling by `createImageBitmap` is also untested). `createImageBitmap` can fail on malformed images: handled by try/catch with a generic message (fine). Worker has a 60 s timeout (fine).
- **Blob URL lifetime (S-07):** preview URL revoked in effect cleanup (good); result URL revoked on next run/unmount only; fix per S-07.
- **Clickjacking:** `frame-ancestors 'none'` + `X-Frame-Options` fix it; low impact (no auth/state).
- **CI:** workflow runs `npm run verify` on push/PR with no secrets; no `permissions:` block (default token scope); add `permissions: contents: read`.

## 7. Tasks
1. (S-02) Enable `security.csp` in `astro.config.mjs` with directives from §3a; add header block to `public/_headers`; add Playwright test: CSP present, zero violations, hydration and Worker OK. Roll out Report-Only first on the real domain.
2. (S-04) Escape `<` in JSON-LD.
3. (S-05/06/07/08) Header-based dimension check before decode, byte cap, magic-byte allowlist, revoke result URL on file change, fallback timeout; add fixtures (huge PNG, SVG renamed .jpg, truncated JPEG, EXIF-rotated photo).
4. (S-03) Reword items 1, 5, 6, 7, 8; keep privacy page honest until a lawyer-reviewed policy exists.
5. (S-01) Record policy P1-P6 in the ADR; add a `verify:html` check: no third-party `<script src>` on any route containing `<input type="file">`.
6. (S-09) Pin GitHub Actions by SHA, add `permissions`, run full `npm audit` in CI, keep `npm ci`.
7. HSTS ramp after domain attach (human, §6).
8. After first deploy: `curl -I` for CSP, `X-Robots-Tag` on workers.dev, redirects.
9. Before AdSense application (human): policy pages, CMP choice, ads.txt, CLS reservations, Report-Only CSP for ad routes.

## 8. Needs human / lawyer
- Final privacy policy and terms text (GDPR/ePrivacy, India DPDP, UK GDPR, Swiss FADP): bases, controller identity, retention, transfers, grievance officer. Not claimed compliant here.
- **India DPDP current status**: confirm in-force dates, whether the compression to 12 months was adopted, and applicability to ad cookies (sources I read were secondary; unverified).
- Whether Cloudflare Web Analytics (if chosen) needs notice/consent; Cloudflare's controller/processor role and DPA for edge logs.
- Choice and configuration of a Google-certified CMP; legal sufficiency of its banner design/records for each region.
- Whether the AdSense ad stack on content pages and an ad-free tool page meets Google's current AdSense Program Policies and Publisher Policies (policy docs are evolving; I did not read the full Google Publisher Policies text, only the pages cited above).
- Approval of any qualified privacy wording if ads are ever placed on the tool page.
- Business decision: forgo ad revenue on tool routes (policy P1) vs qualified-promise alternative.
- Domain/Cloudflare account actions: attach custom domain, HSTS, "Always Use HTTPS", enabling/disabling workers.dev; AdSense application; Search Console verification.
- Trademark screening of "SizeTune" (ADR item 5; registration of the domain already happened).

## Sources (accessed 2026-11-12)
Astro config reference (security.csp) docs.astro.build/en/reference/configuration-reference/ · Google AdSense CSP support.google.com/adsense/answer/16283098 · Google Publisher Tag CSP developers.google.com/publisher-tag/guides/content-security-policy · AdSense consent/CMP support.google.com/adsense/answer/13554116 · EU User Consent Policy google.com/about/company/user-consent-policy · AdSense Program policies support.google.com/adsense/answer/48182 and Required content support.google.com/adsense/answer/1348695 · Cloudflare Web Analytics data origin/FAQ developers.cloudflare.com/web-analytics/ · MDN CSP practical guide and `<iframe>` reference · DPDP status: secondary sources only (ssrana.in, consent.in, dpdprules.org; unverified).
Scratch test artifacts: /private/tmp/claude-501/-Users-sourav-workspace-personal-automated-niche-website-discovery/9c0cb90c-faaa-4eaf-bcd2-863c04cd34b0/scratchpad/csp (copy of dist + headers + t.mjs/neg.mjs) and .../proj (copy with built-in csp).
