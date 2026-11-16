# Latest staging audit (2026-11-14)

Target: https://sizetune-staging.subhamojha9.workers.dev/ serving `dev` at `8f0b204` (CI run 43537940973: verify, cross-browser and deploy-staging all passed). Five independent audits ran against the live site in a real browser. They did not rely on earlier QA reports. The detailed reports are:

| Report | Scope |
|---|---|
| [IMAGE_WORKFLOW_AUDIT.md](IMAGE_WORKFLOW_AUDIT.md) | 119-case matrix, Chrome, WebKit, Firefox, every download decoded |
| [SIGNATURE_WORKFLOW_AUDIT.md](SIGNATURE_WORKFLOW_AUDIT.md) | 24 crop cases pixel-compared, keyboard, touch emulation |
| [UX_ACCESSIBILITY_AUDIT.md](UX_ACCESSIBILITY_AUDIT.md) | 7 routes x 6 widths, axe on three engines, keyboard, performance |
| [PRIVACY_SECURITY_AUDIT.md](PRIVACY_SECURITY_AUDIT.md) | requests, CSP enforcement, storage, headers, EXIF, bad files |
| [SEO_CONTENT_AUDIT.md](SEO_CONTENT_AUDIT.md) | titles, canonicals, JSON-LD, links, claims versus behaviour, legal text |

Evidence (screenshots, data): `QA/screenshots/latest/`.

## 1. Readiness
**Not launch-ready, and no critical defect was found.** The core promise holds on the live site: images never leave the browser, every downloaded file matched what the UI displayed (size, type, extension, dimensions), and no constraint was reported as met when it was not. What stops launch is human work: legal review, a lawyer's read of the identity, grievance and governing-law wording, real-device tests, the HTTPS/HSTS setting, and pointing the domain. See section 7.

## 2. Findings
Status labels: **Verified defective**, **Fixed** (local commit, not pushed or deployed), **Open** (defective, not fixed in this pass), **Human** (needs owner decision), **Device** (needs real hardware).

| ID | Sev | Finding | Status |
|---|---|---|---|
| SIG-1 | High | Choosing crop shape 3:1, 4:1 or 1:1 silently shrank the box below the signature; the download clipped strokes | **Fixed** `6c6f6f3` (shape refused with a message) |
| SEC-1 | Medium | HTTP returns 200, no redirect to HTTPS, no HSTS | **Open, Human** (Cloudflare zone setting; the owner's call) |
| SIG-2 | Medium | Auto-trim said "Cropped to the ink" when it trimmed nothing | **Fixed** `5c49174` |
| SIG-3 | Medium | Touch: 44 px handles cover the middle of a short crop box, so a drag resizes | **Open, Device** (seen in emulation only; the obvious fix risks handles outside the picture edge) |
| A11Y-1 | Medium | Crop-box focus ring was yellow on white, about 1.3:1 | **Fixed** `3abe369` |
| UX-1 | Medium | Mobile: Resize about 500 px below the fold after picking a file, no cue | **Fixed** `a765ed5` (visible "Next:" cue) |
| UX-2 | Medium | Mobile: Download about 700 px below the result heading | **Fixed** `a765ed5` (Download above the compare widget) |
| UX-3 | Medium | "Ready" shown for a picture shrunk to a tiny size, no pixel-reduction note | **Fixed** `39371e5` (note when under half size per side, free dimensions only) |
| IMG-1 | Medium | Typed 800x600 with aspect lock returned 800x533 under a green "ready" heading | **Fixed** `7ad5f4b` (amber heading, "not to the exact dimensions you typed") |
| IMG-3 | Medium | WebKit has no WebP encoder: a transparent WebP with Auto becomes a tiny PNG (183x128) with no warning before the run | **Open** (disclosed only after the run) |
| SEO-1 | Medium | Canonical, og:url, og:image, JSON-LD, sitemap and robots point at sizetune.com, which does not resolve yet | **Open, Human** (expected on staging; needs the domain) |
| IMG-2 | Low | "Quality had to go down" shown when the user chose the quality | **Fixed** `7ad5f4b` |
| SEO-5 | Low-Med | Home, 20 KB and signature pages share 22-24% of their text | Open (recommendation) |
| SEC-2 | Low | CSP is a `<meta>` placed after canonical, OG, icon and JSON-LD elements; header CSP is only `frame-ancestors` | Open |
| SEC-3 | Low | 404s under `/_astro/` are cached as immutable for one year | Open |
| SEC-4 | Low | Trailing-slash and index redirects are 307, not 301 | Open (known, accepted earlier) |
| SEC-5 | Low | `/404` returns 200 with the not-found page | Open |
| SEC-6 | Low | Result page keeps a U+202E override from the original file name (download name is sanitised) | Open |
| SIG-4..8 | Low | Typing Left=9999 collapses the crop; faint ink reports "No signature was found"; black fill hides dark ink; stretch/cover framing differs from the crop; both dimensions with lock give 195x100 | Open |
| IMG-4 | Low | "KB"/"MB" are 1,024-based; upload cap reads "25 MB" but is 25 MiB; max applied x1000, min x1024 (the page states its basis and shows exact bytes) | Open (wording) |
| IMG-5..8 | Low | Single-dimension stretch has no note; huge output rejected late with vague text; zero-byte file called "not an image"; min-only 100 KB gave a 2.66 MB file from 2.19 MB | Open |
| UX-4, UX-5, A11Y-2, PERF-1 | Low | Amber heading when larger than original although the target is met; "allow enlarging" advice points to a collapsed control; header logo link 32 px tall; one 140 ms frame gap on file select | Open |
| CNT-3, CNT-4 | Low | JPEG fill copy says "a solid colour" (default white, user-selectable); quality-first copy omits the quality floor | Open |
| CNT-10..15 | n/a | Governing law, "Sourav", "based in India", grievance contact, minors and browsewrap, future-ads and Cloudflare statements | **Human** (not changed by any agent) |

Recommendations (UX-9..14, SEO-3/4/8, CNT-5/6, PERF-2, keyboard shortcut ideas) are in the individual reports.

## 3. Verified working (reproduced on staging)
- No image upload: every request on both tools was a same-origin GET. No WebSockets, beacons, fetch or XHR, no filename or file bytes in any request (SEC-7). No third-party origins, ads or analytics.
- CSP enforced on every route: inline script, handlers, eval, external and data: scripts, third-party requests and framing were all blocked (SEC-8).
- Cookies, localStorage, sessionStorage, IndexedDB, Cache API and OPFS empty after full use; object URLs created and released balanced (26/26); worker terminates after idle (SEC-11, SEC-12).
- EXIF, GPS, XMP and IPTC stripped for JPEG, PNG and WebP; a generic ICC profile can remain and the privacy page says so (SEC-10).
- Bad input rejected cleanly: SVG, GIF, zero-byte, truncated, renamed, over-size, over-100-megapixel (SEC-13); 72 and 100 MP PNGs processed.
- Image tool: presets 10/20/30/50/100/200 KB, custom sizes, min/max, formats, transparency, fills, cancel, Escape, ten repeat runs. Downloaded bytes, MIME, extension and dimensions matched the UI in all three engines.
- Signature tool: the download matched the on-screen crop (mean absolute error 0 to 0.07 across 24 cases); displayed bytes equal the file; detached strokes survive auto-trim; transparency and the JPEG fill disclosure are correct; keyboard operation and focus visible.
- axe: 0 violations on every route and tool state in Chrome, Firefox and WebKit. No horizontal overflow at 320, 375, 390, 768, 1024 and 1440 px; 200% and 400% zoom reflow; reduced motion respected.
- Performance: initial JS about 45-49 KB transferred on tool pages; no main-thread long tasks while processing 12 to 48 MP images (about 0.4-0.5 s); worker gone afterwards.
- Staging sends `x-robots-tag: noindex` on every response including robots.txt and the sitemaps; no `.env`, `.git`, `wrangler.jsonc`, `_headers` or source maps exposed.
- Content: unique titles and descriptions in range, one H1 per page, valid JSON-LD that matches the page, all internal links 200, no `[[HUMAN` markers, no typos found, deployed HTML matches `dist/`.

## 4. Not tested
VoiceOver, NVDA and TalkBack; physical phones or tablets (**Device**); pinch zoom; real Windows High Contrast (forced-colors emulated only); Lighthouse; Chrome-only for the security audit; the 60-second timeout and out-of-memory paths; drag and drop on staging; email delivery to hello@sizetune.com; production headers (domain does not resolve). The image audit could not confirm staging was serving `8f0b204` byte-for-byte; the CI deploy job reported success.

## 5. Fixes in this pass (local commits on `dev`, not pushed, not deployed)
`6c6f6f3` SIG-1 · `3abe369` A11Y-1 · `5c49174` SIG-2 · `39371e5` UX-3 · `a765ed5` UX-1 and UX-2 · `7ad5f4b` IMG-1 and IMG-2. Each engine or crop change has a unit test that failed before the fix. The IMG-1 heading has an e2e assertion. Gate: `CI=1 pnpm run verify` exit 0, 687 unit and 198 Chrome e2e. An independent diff review is recorded in section 8.

## 6. Remaining technical limits
Safari output sizes can differ from Chrome (engine verifies real bytes, so results stay honest). WebKit cannot encode WebP. Pinch zoom is not implemented in the signature tool. Compare zoom is limited by the 1,024 px preview. The CSP is a `<meta>` policy, so it cannot block anything before it in `<head>`.

## 7. Human decisions and device tests still required
1. Legal review by an Indian lawyer of Privacy and Terms; owner confirmation of the public name "Sourav", whether a postal address is needed, the court city, and the grievance wording. Nothing was invented or approved by an agent.
2. Cloudflare: redirect HTTP to HTTPS and enable HSTS (SEC-1); Workers Logs, Web Analytics, NEL settings (see `docs/legal/COMPLIANCE_CHECKLIST.md`).
3. Point sizetune.com at the Worker, then re-test headers, canonicals and the "tested on a local copy" claims on the live edge.
4. Real-device tests (`QA/REAL_DEVICE_TEST_PLAN.md`), including SIG-3 touch handles, and a screen-reader pass.
5. Confirm the hello@sizetune.com mailbox receives mail; approve the OG image.

## 8. Independent review
A Sonnet reviewer read the real diffs and ran 687 unit and 140 Chrome UI e2e tests: **approve**, with one medium and four low notes.
- M1 (fixed): the pixel-reduction note compared the output with the whole source, so a plain crop (4000x3000 cropped to 800x300) falsely said "reduced". It now compares with the crop. Test added.
- L1 (hardened by a test): a crop that already has the target shape must not be refused because of rounding.
- L3 (fixed): duplicated mismatch condition in the result panel now shares one variable.
- L2, L4 (left): the shape-refusal message stays until the next crop edit; the "Next:" cue stays visible after a result. Both are cosmetic.
- Not independently checked by the reviewer: 44 px targets and the content-spacing / verify-html constraints beyond what the suites cover.
