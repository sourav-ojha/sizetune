# Privacy and security audit (2026-11-13)

Independent read-only reviewer plus the lead. Staging `curl -sS -D -` on `/`, `/resize-signature/`, a 404 path, `/sitemap-index.xml`, `/robots.txt`, one `/_astro` asset; local `astro preview` driven by Playwright (system Chrome 157) for both tools with real downloads.

## Evidence
| Check | Result |
|--|--|
| Upload requests / request bodies | None. Only same-origin GETs: HTML, `/_astro/*`, font, favicon, worker script, two `blob:` GETs |
| Third-party origins, analytics, ads | None observed; `verify:privacy` OK |
| Cookies | `Set-Cookie`: 0 on all 5 staging responses; `document.cookie` empty; browser cookie jar empty after both workflows. Cloudflare *can* set operational cookies on some plans; none were seen. Not provable for all future states |
| Browser storage | localStorage/sessionStorage `{}`, no `setItem`, IndexedDB/Cache API/service workers: none |
| Console | 0 messages, no CSP violations, no file names/data logged (`src` has no `console.*`) |
| Object URLs | 2 created = 2 revoked per flow; 0 live afterwards; revoke on replace/reset/unmount in `session.ts` |
| Headers | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, COOP same-origin, Referrer-Policy, Permissions-Policy, `CSP: frame-ancestors 'none'`; CSP meta in HTML (default-src 'self', connect-src 'self', worker-src 'self', object-src 'none', no unsafe-inline). No HSTS. Cloudflare adds `nel` / `report-to` (a.nel.cloudflare.com) |
| Staging noindex | `X-Robots-Tag: noindex` on every staging response incl. 404/assets (from `_headers` workers.dev rule). `robots.txt` says `Allow: /` on purpose: crawlers must be able to read the noindex header. Production hosts do not match the rule |
| File validation | Magic bytes only (SVG/GIF/HEIC rejected), 25 MiB, 100 MP header cap, 16 MP output cap, truncation check, 60 s timeout, 20 encodes |
| XSS sinks | Only `set:html` for build-time JSON-LD with `<` escaped; filenames rendered as text; download filename sanitised |

## Changes made
- `privacy.astro`: names the unused storage APIs, distinguishes app code from the hosting layer (may process request data, send network-error reports, set operational cookies), states that no cookies were set in testing. Also fixed "Kiran T.." typo.
- `public/_headers`: `/_astro/*.js` gets `Content-Security-Policy: connect-src 'none'` (defence in depth for the worker, which a page meta CSP does not govern). Tested: worker still runs (196 e2e green) and the header is asserted by e2e.

## Claims versus evidence
"The code of this site does not upload your images" - supported. A bare "never leaves your device" would be stronger than the evidence, so it is not used. "Sets no cookies / no local storage" - supported for app code; now qualified for hosting. "No analytics" - supported, but the privacy page still contains the unresolved Search Console marker, which reads as contradictory until the owner decides (H1).

## Open
HSTS after the custom domain is live; confirm whether the custom domain also emits NEL; owner confirms that the pseudonym and hello@sizetune.com are intended to be public (they are displayed on About/Privacy/Terms; mailbox delivery is the owner's, not verified here).
