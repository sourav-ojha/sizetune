# CLOUDFLARE_DEPLOYMENT.md — SizeTune (v2, 2026-11-12)

v1 (same day) said "domain not yet bought / zone must be on Cloudflare DNS" and called the workers.dev noindex rule "unverified". Those statements are superseded below; v1 history is summarised in ADR §9. Full evidence, per-claim V/A tags and the long runbook: `docs/reviews/cloudflare-review.md`. Doc access date 2026-11-12 (copies in `docs/evidence-cloudflare-docs-2026-11-12/`). **Nothing is deployed; DNS untouched; nothing purchased.**

## 1. Facts
- **Domain:** `sizetune.com` registered 2026-11-12T04:48:59Z at **Cloudflare Registrar** (RDAP), Cloudflare nameservers (`lars/teagan.ns.cloudflare.com`), no A/AAAA, no site. So no nameserver change; attach the Custom Domain to the Worker. (If the zone were in a different Cloudflare account than the Worker's, attachment fails — human check H3.)
- **Platform decision: Workers static assets** (Cloudflare: "Start new projects with Workers"). Static requests free and unlimited; limits 20k files / 25 MiB per file; `_headers` 100 rules; `_redirects` supported. Pages remains valid; `dist/` is identical, so switching is configuration only.
- Config in repo (`wrangler.jsonc`): assets-only, `html_handling: auto-trailing-slash`, `not_found_handling: 404-page`, `workers_dev:false`, `preview_urls:false`, `routes:[{pattern:"sizetune.com",custom_domain:true}]`. These take effect only when a human-run deploy happens.

## 2. Build, Node, CI
| Item | Value |
|--|--|
| Install / build | `npm ci` · `npm run build` (`astro build`) → `dist/` |
| Workers Builds build command | `npm ci && npm run check && npm run build && npm test && npm run verify:html` (e2e runs in GitHub Actions) |
| Deploy command | `npx wrangler deploy` (default) |
| Node | `.nvmrc` = `24`; Cloudflare build image default is 24.22.1 (22.23.4 also preinstalled); local full `verify` passed on 24.12.0; Astro 7 needs ≥22.23.4. Confirm on first CI/build run. |
| CI | `.github/workflows/ci.yml`: PR + push to main, `ubuntu-24.04` (Google Chrome preinstalled → Playwright `channel:'chrome'`), `permissions: contents: read`, concurrency, 15 min timeout, uploads `test-results/` on failure. Inactive until the repo is pushed. |
| **Branch protection (required)** | GitHub ruleset on `main`: require PR, required check `verify`, block force-push/deletion, **no bypass**. Required **before** connecting Workers Builds because Workers Builds deploys every push to the production branch regardless of Actions. (Rulesets on private repos may need a paid GitHub plan — unverified.) |
| Local prod-like run | `npx wrangler dev --port 8788 --ip 127.0.0.1` (workerd; used by Playwright on port 8788) |

## 3. Behaviour verified locally (workerd, 2026-11-12)
`/privacy` → **307** `/privacy/`; `/index.html` → 307 `/`; unknown path → **404** with the custom `noindex` page; `/_astro/*` `cache-control: public, max-age=31536000, immutable`; HTML/robots/sitemap `max-age=0, must-revalidate`; `_headers` file not served; `_redirects` 301 overrides the 307 in a scratch copy. 307 is documented Cloudflare behaviour for html-handling; internal links are canonical (build-gated) and the canonical tag + sitemap carry the signal.
Headers in `public/_headers`: `nosniff`, `X-Frame-Options: DENY`, `COOP same-origin`, `frame-ancestors 'none'`, `Referrer-Policy`, restrictive `Permissions-Policy`; the page CSP is a build-time `<meta>` (Astro `security.csp`). One noindex rule for workers.dev (`https://:version.:subdomain.workers.dev/*`; a one-label rule was dead and removed). **It only matters if workers.dev/preview URLs are ever enabled** — with `workers_dev:false`+`preview_urls:false` (current config) no such host exists. Cloudflare docs say workers.dev Preview URLs get noindex natively; not testable locally.

## 4. Runbook (human step IDs match `BLOCKERS.md`; exact clicks in `docs/reviews/cloudflare-review.md` §4 whose own H1–H9 numbering is local to that file)
**WARNING — the first deploy is production.** With `workers_dev:false`, `preview_urls:false` and the custom-domain `routes`, the first `wrangler deploy` (or the first push to `main` after Workers Builds is connected) publishes sizetune.com. There is no pre-launch preview URL. Pre-launch verification = `npm run verify` (local workerd + CI). See BLOCKERS H12 for an explicit staging option.
1. DNS sanity: no leftover records for `@`/`www` (expected none). Do not touch nameservers.
2. **BLOCKERS H1/H14** Create GitHub repo, commit, push; check CI check name `verify` is green.
3. **H2** Ruleset on `main` (above); **H3** confirm zone/account.
4. **H4** (only when launch-ready; see H12) Dashboard → Workers & Pages → Create → connect repo; Worker name exactly `sizetune`; branch `main`; build/deploy commands above. First deploy publishes the site → explicit go-ahead.
5. Watch the first build (Node 24.x, gates pass, domain attached; cert normally within minutes–hours).
6. **H5** `www`: proxied dummy record + Single Redirect rule to apex (301, preserve query). "Always Use HTTPS" on; **HSTS off** until 1–2 stable weeks (H11; not easily reversible).
7. Post-deploy checks (agent can run read-only `curl -sI` list in the review §4d once told it is live).
8. **H16** Search Console (Domain property via DNS TXT) + sitemap `https://sizetune.com/sitemap-index.xml`; Bing optional.

## 5. Rollback
Fastest: Dashboard → Deployments → previous version → Rollback (or `npx wrangler rollback <version-id>`, not exercised). Stop bad deploys: switch deploy command to `npx wrangler versions upload` or disconnect Builds. Fix forward with `git revert` via PR. Config `routes` re-asserts the custom domain on the next deploy, so DNS/domain changes also need a config edit. HSTS is the one change that cannot be rolled back quickly.

## 6. Cache strategy
Hashed `/_astro/*` immutable one year; HTML revalidated every request (ETag); favicon 1 day; no CDN purge needed on deploy because HTML is revalidated.

## 7. Known limitations / unverified
No live edge test, certificate issuance, Workers preview builds or rollback executed; no Linux `wrangler dev`; Range requests return 200 (irrelevant); Pages-vs-Workers preview maturity A.
