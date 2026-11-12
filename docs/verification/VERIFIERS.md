# SizeTune build verifiers

Run `pnpm run build` first; every verifier and test reads `dist/` (tests fail with "run `pnpm run build` first" if it is missing).

| Command | What it does | Exit |
|--|--|--|
| `pnpm run verify:html` | all FAIL rules; LAUNCH + PLACEHOLDER items are listed but not enforced | 1 on any FAIL |
| `pnpm run verify:html:strict` (`STRICT=1`) | FAIL + every non-placeholder LAUNCH rule. Placeholders are listed as "pending human input" | 1 on FAIL or LAUNCH |
| `pnpm run verify:html:final` (`STRICT=2`) | as STRICT=1, and **any remaining `[[HUMAN: ...]]` placeholder fails** | 1 on FAIL, LAUNCH or PLACEHOLDER |
| `pnpm run verify:privacy` | privacy / "files never leave the device" checks (P1-P5 below) | 1 on any finding |
| `pnpm exec vitest run tests/verify-*.test.ts` | negative fixtures: each rule is proven to be able to fail, on temp copies of `dist/` | |

Env form also works (`STRICT=1 node scripts/verify-html.mjs`). Programmatic: `verifyDist(dist, {strict: false|true|1|2})`, `verifyPrivacy(dist)`.
`verifyDist` returns `{fails, hardFails, launch, placeholders, rows, jsFiles}`; `fails` already reflects the level.

## Why parse5
The previous checker used regexes on raw HTML. `parse5` is the WHATWG HTML5 parsing-algorithm implementation (used by jsdom, Angular, lit), i.e. it
tokenises exactly like a browser: unquoted/single-quoted/odd-case attributes, duplicate attributes (first wins), `<template>` content, raw-text
elements (`<script>`/`<style>` bodies are text, never markup), `<noscript>` (parsed as elements, so a tracking pixel inside it is seen),
foreign content (`svg`/`xlink:href`), comments, mis-nested tags. It has no dependencies, is typed, and runs the same on Node 22-24 in CI. We did not use
jsdom/cheerio (heavier, scripting/CSS engines we do not want) or a headless browser (cannot see markup the browser normalises away). It is a
**devDependency** only; nothing ships to users. JS and CSS are scanned lexically (regex over the minified source), which is conservative by design (see Limits).

## Classes
- **FAIL** structural/security defect. Always enforced.
- **LAUNCH** content/readiness item. Reported always; enforced by `STRICT>=1`. Printed `[LAUNCH]`.
- **PLACEHOLDER** (`HUMAN-PLACEHOLDER`) a `[[HUMAN: description]]` marker anywhere in a page (copy, attribute, JSON-LD, comment). These are LAUNCH items for the
  human owner (author identity, contact email, jurisdiction, legal review date). They are listed separately. `STRICT=1` does not fail on them; `STRICT=2` fails on each (`[PLACEHOLDER] /route: description`).
  Exact syntax: `[[HUMAN: some description]]` (capital `HUMAN`, colon, one space, non-empty, no `[`/`]` inside). Any other spelling (`[[human: x]]`, `[[HUMAN]]`, `[[HUMAN:]]`, unterminated) is a **FAIL** so a typo cannot hide a placeholder.
  A placeholder can satisfy a content rule (e.g. a `[[HUMAN: contact email]]` satisfies "privacy policy has a contact method") but the item is still reported until replaced.

Tool route = page with `data-page-type` `home` or `tool`, or containing `data-testid="tool"`. Discovery is generic; no page names are hard-coded.

## verify-html: FAIL rules (per page unless noted)
Document: `data-page-type` on body; valid `lang`; viewport meta; `<meta charset>`; exactly one `<main>`; no duplicate `id`s.
Head: exactly one `<title>` <= 60 chars and unique; exactly one meta description 70-160 chars and unique; at most one canonical (any `rel` token order/case); indexable pages: canonical == `https://sizetune.com` + route
(trailing slash, absolute); `og:url` == canonical; `og:title`; no `<meta http-equiv=refresh>`; robots meta read with any attribute order/case/`robots|googlebot`, `none` == noindex; `nofollow` or `index`+`noindex` on an indexable page; 404 must be noindex.
Headings/a11y: exactly one `<h1>`; no level skips; no empty headings; every `<img>` has `alt`; every link has an accessible name; in-page `#anchor` links resolve (same-page and cross-page).
Forbidden markup: `<base>`; `<iframe>/<frame>/<object>/<embed>/<applet>/<portal>` (unless in `EMBED_ALLOWLIST`, empty); `<form action>`, `<form method=post>` (any case), `formaction`; `<input type=file>` outside a tool page; inline `on*` event handlers (any case/quoting, svg included); inline `style=""`; `ping=`.
URLs (every URL-bearing attribute of every element: `src href action formaction data poster srcset imagesrcset ping background manifest cite longdesc xlink:href`, meta-refresh url; whitespace/newline obfuscation stripped like a browser):
`javascript:` anywhere; `data:` only as `data:image/*` on `img/source/input[src,srcset]` or `link[rel~=icon]`; `blob:` only on `img`; other schemes fail; internal links must exist, be canonical (trailing slash or file extension) and not `http://`/`www.`; internal subresources must exist;
**tool routes: any external origin (incl. `<a>`, `<link>`, srcset, noscript, template) fails**; **non-tool pages: any external *resource* fails unless listed in `EXTERNAL_RESOURCE_ALLOWLIST` (origin + tag + page type; empty today)**; external `<a>`: `target=_blank` needs `noopener`/`noreferrer`; every external `<a>` needs `rel~=noreferrer`.
JSON-LD (any `type` attr casing/whitespace; arrays and `@graph` handled): valid JSON; `@context` = `https://schema.org`; `FAQPage`/`QAPage` banned; any `Review`/`AggregateRating`/`Rating` type or `aggregateRating|review|reviewRating|ratingValue|ratingCount|reviewCount|bestRating|worstRating` key banned (regardless of nesting);
`WebApplication`: `name`, `url`, `applicationCategory`, `url` on `https://sizetune.com/`; `Article`: `headline` (<=110), `dateModified`, `mainEntityOfPage` (== page URL), ISO-8601 dates.
Page types: tool/home need SSR'd tool markup and a `<noscript>` fallback; tool markup on a non-tool page fails; non-tool pages: no JS reference (`script src`, `modulepreload`, island `component-url`/`renderer-url`) and no executable inline script.
CSP `<meta>` (every page): exactly one; no `unsafe-inline/eval/hashes`, no `*`; no duplicate directives; has `default-src script-src object-src base-uri`; `object-src 'none'`, `base-uri 'none'`; every source token is `'self'`, `'none'`, or a `sha256/384/512` hash (`blob:/data:` only in `img-src`); no third-party `report-uri/report-to`;
the meta must precede the first executable script/stylesheet/modulepreload/`<style>`/body; **every inline script and `<style>` must be covered by a hash in `script-src`/`style-src`** (else the browser blocks it).
**Tool routes additionally** (strict profile): `connect-src`, `form-action`, `frame-src`, `worker-src` required; `default-src/connect-src/worker-src` exactly `'self'` (or `'none'`), `frame-src 'none'`, `form-action 'self'|'none'`; script/style/font/manifest/media/child sources never `blob: data: http(s): *`; `img-src` only `'self' blob: data:`.
Tool-route privacy: tracker/ad identifiers in markup context (attributes, script/style bodies, comments); external `@import`/`url()` in inline `<style>`; inline scripts with an external URL or any network primitive (below).
CSS files (`dist/**/*.css`): external `@import`/`url()`/`javascript:`/non-image `data:` URL. Comments are stripped first.
**JS network capability** (see P5): every `.js` a tool page loads (script src, modulepreload, island urls, then transitively every same-site `.js` string literal inside those files incl. `new Worker(new URL('/_astro/x.js', ...))`) AND every other `.js` in dist.
robots.txt: exists; `Sitemap:` line is `https://sizetune.com/sitemap-index.xml`; groups parsed properly (multi-UA groups, comments, longest-match); `*` group must not block `/`, `/_astro*`, any indexable page, or any `/_astro` js/css asset.
Sitemaps: `sitemap-index.xml` exists, root `<sitemapindex>`, lists only existing same-site `.xml` files (not itself), >= 1; each sitemap root `<urlset>`; no duplicate `<loc>`; every indexable page listed; every `<loc>` has a file, is canonical (trailing slash), is not noindex, is not `/404/`.
Content: min words in `<main>` (floorDev: home/tool 80, guide 40, policy 30); near-duplicate pages of the same type (Jaccard of 5-word shingles > 0.35); `[[HUMAN` marker malformed.

## verify-html: LAUNCH rules (enforced by STRICT>=1)
Unique words in `<main>` (home 400, tool 300, guide 400, policy 150; "unique" = 5-word shingles not appearing on any other page); visible FAQ heading on tool/home; orphan page (no contextual link from another indexable page's `<main>`);
`og:image` (non-error pages); tool/home without `WebApplication` JSON-LD; guide without `Article` JSON-LD; `WebApplication` without `operatingSystem`; `Article` without `datePublished` or `author.name`; JSON-LD `@type` not in the reviewed list;
leftover `lorem ipsum`/`TODO`/`FIXME`/`TBD` in `<main>`; `/privacy/` has neither a `mailto:` link nor a `[[HUMAN: ... contact|email ...]]` placeholder.
(Added in this revision beyond the original verifier: operatingSystem, Article datePublished/author, unreviewed @type, leftover-text, privacy-contact, tool/guide JSON-LD presence. Drop any you disagree with in `verify-html.mjs`.)

## verify-privacy (all FAIL)
- **P1** per tool route: any external origin in any URL attribute (incl. noscript/template/srcset/poster/unquoted/odd-case), `data:`/`javascript:` non-image URLs, embedding elements, `preconnect/dns-prefetch/prefetch/prerender` hints (even same-origin: they contact a host before consent), external CSS `@import`/`url()`/`@font-face` in inline `<style>` and every CSS file.
- **P2** strict CSP profile on EVERY tool route (same rules as above), exactly one CSP meta, hashes cover inline script/style, meta precedes content.
- **P3** ad/analytics/CMP identifiers anywhere in dist (adsbygoogle, googlesyndication, doubleclick, googletagmanager, google-analytics, gtag/gtm, plausible, fathom, hotjar, clarity.ms, segment, mixpanel, amplitude, heap, fullstory, logrocket, sentry, datadog, newrelic, Cloudflare Web Analytics beacon, matomo, posthog, umami, statcounter, yandex metrika, facebook/twitter/linkedin/tiktok/pinterest pixels, taboola/outbrain/criteo/..., onetrust/cookiebot/quantcast/... CMPs, `dataLayer`; list in `TRACKER_PATTERNS`).
  Scope: HTML = markup context only (tag/attribute names+values, script/style bodies, comments); all other text/binary-safe files = whole content; file names too. Visible prose such as "we do not use Hotjar" is deliberately NOT flagged (privacy copy must be able to say it). Patterns are specific enough not to match React's `onDoubleClick`.
- **P4** `_headers` (Cloudflare format parsed; `! Name` detach detected): `/*` must set `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a CSP with `frame-ancestors 'none'` (and no `unsafe-`/`*`/host sources), Referrer-Policy in {no-referrer, same-origin, strict-origin, strict-origin-when-cross-origin}, `Permissions-Policy` disabling camera/microphone/geolocation, `Cross-Origin-Opener-Policy: same-origin`; anywhere: no `Access-Control-Allow-Origin: *`, no `Set-Cookie`, no off-site `Link:`, no third-party CSP `report-uri/report-to`; `*.workers.dev` must be `X-Robots-Tag: noindex`; `/_astro/*` immutable cache.
- **P5** network capability in tool-page JS. Flagged unless allow-listed: `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket(Stream)`, `EventSource`, `WebTransport`, `RTCPeerConnection/DataChannel`, `importScripts`, `serviceWorker`, `SharedWorker`, `BroadcastChannel`, `new Image(` (pixel beacon), dynamic `import()`, `eval`/`Function`, `document.write`, dynamic `<script>`/iframe/embed injection, `preconnect/dns-prefetch`, `location.assign|replace|href=`/`window.open`, sensitive `navigator.*` (connection, mediaDevices, geolocation, clipboard, ...), `document.cookie`/`localStorage`/`sessionStorage`/`indexedDB`, `parent|top|opener.postMessage`, any hard-coded `http(s)|ws(s)|ftp` or protocol-relative URL; `new Worker(...)` must take a literal same-site chunk.
  **Allow-list (`JS_PRIMITIVE_ALLOWLIST` in `scripts/verify-lib.mjs`; applies only to the entry's audited `file` path AND `signature`, only up to an audited count; `dyn-import` additionally needs a per-occurrence literal-form `proof` whose target chunk exists in dist)** - evidence from the current build (Preact 11 + `preact/compat` in `_astro/preact.*.js`, `@astrojs/preact` island hydrator in `_astro/client.*.js`; app chunks `ImageTool`, `SignatureTool`, `useSession`, `hooks`, `signals.module`, `compress.worker` contain **zero** flagged tokens; full audit in `docs/experiments/PREACT.md`):
  `external-url` <= 6 and only the XML namespace identifiers `http://www.w3.org/{2000/svg,1998/Math/MathML,1999/xhtml}` (Preact core `createElementNS`; svg x2, MathML x2, xhtml x2; never fetched), in the Preact core chunk only;
  `dyn-import` <= 1 in the island hydrator only, and only in the literal form ``import(`./signals.module.<hash>.js`)`` (lazy load of the bundled `@preact/signals` chunk, executed only for an island with `data-preact-signals`, which tests assert never appears in dist). Any growth, any other dynamic import, or a non-literal specifier fails with "re-audit".
  The former React 19 entries (`resource-hint`, `script-inject`, `navigator-api`, the 40-URL `external-url` incl. `react.dev/errors`) were removed because those tokens do not exist in the Preact chunks; tests assert they are no longer excused.
  The inline Astro island bootstrap is allowed to use `import()` (same-site chunks; CSP `script-src 'self'` enforces) and nothing else.

## Limits (honest)
- JS/CSS scanning is lexical, not an AST/dataflow: `self['fe'+'tch']`, `atob`-built identifiers, or computed property access would evade the regexes (partly mitigated: `eval`/`Function`/dynamic `import` are flagged, CSP forbids unsafe-eval, and `connect-src 'self'` blocks cross-origin requests at runtime). Same-origin requests are allowed by `connect-src 'self'`; today there is no server route to receive them (static assets only) - keep it that way and keep the Playwright "no network request after file select" e2e as the runtime proof.
- Static analysis only: nothing executes, so runtime-injected content is out of reach here (e2e territory). `frame-ancestors` cannot be set in a meta CSP; `_headers` is checked as a file, not as served by Cloudflare.
- The allow-list is tied to the current Preact build; a bundler change that merges app code into the Preact core chunk would still be caught for non-allow-listed primitives, but an allow-listed token (a w3.org namespace URL) used by app code inside that same chunk would only be caught if the audited count grows.
- Tracker scan excludes visible prose by design (see P3).
