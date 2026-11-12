# Cloudflare deployment review - SizeTune (2026-11-12)

Tags: **V** = verified (official doc fetched 2026-11-12, or observed locally/by lookup), **A** = assumption (not verified, check before relying).
Scope: read-only review. No login, no deploy, no DNS change. Docs fetched from developers.cloudflare.com (`/index.md`) plus GitHub runner-image and Playwright docs.

## 0. Headline facts
1. **sizetune.com is registered at Cloudflare Registrar and already uses Cloudflare nameservers** (V, public WHOIS and `dig` at 1.1.1.1, 2026-11-12): Registrar "Cloudflare, Inc.", created 2026-11-12T04:48:59Z, NS `lars.ns.cloudflare.com` / `teagan.ns.cloudflare.com`, DNSSEC unsigned, status clientTransferProhibited, no A/AAAA on apex or `www`. The user said registrar unknown, so **the user must confirm that the zone sits in the same Cloudflare account that will own the Worker** (A: the buyer's account). If so, no nameserver change, no CNAME/partial setup and no registrar transfer is needed. Cloudflare docs: domains bought via Cloudflare Registrar automatically use Cloudflare authoritative DNS (V).
2. **Decision: Workers static assets (not Pages).** Details in section 5.
3. Local test results (V) in section 3. Rule `https://:subdomain.workers.dev/*` in `_headers` is dead for real worker hosts (section 2, CF-04).

## 1. Findings
| ID | Sev | Finding | Evidence | Fix |
|--|--|--|--|--|
| CF-01 | HIGH | CLOUDFLARE_DEPLOYMENT.md s5 and ADR s9 say "domain not yet bought" and "zone must be on Cloudflare DNS"; domain is bought and already on Cloudflare NS. Doc is stale, runbook differs (no NS change). | WHOIS/dig above (V). Workers Custom Domains need an *active Cloudflare zone* (V, custom-domains doc). | Rewrite s5 per runbook below. Agent can edit. |
| CF-02 | HIGH | Production deploy is **not** gated by GitHub Actions. Workers Builds deploys on every push to the production branch, independent of the `ci` workflow. Branch protection only blocks the merge, not a direct push or an admin bypass. Playwright (e2e) never runs before deploy. | Builds doc: "Every push event made to this branch will trigger a build ... build command, followed by the deploy command" (V). GitHub check runs from Cloudflare are separate from Actions (V). | (a) Keep unit/check/html gates in the Cloudflare build command (already planned). (b) Ruleset on `main`: require PR, require status check `verify`, block force-push, **no bypass actors**. (c) Merge only via PR. e2e therefore gates the merge, not the deploy. Human. |
| CF-03 | MED | CLOUDFLARE_DEPLOYMENT.md s4 claims "Workers does not [add noindex to previews]". Current docs say otherwise for workers.dev Preview URLs. | Previews doc: "its `workers.dev` URL ... includes an `X-Robots-Tag: noindex` response header. For custom domain Preview URLs, use Cloudflare Access" (V). Pages previews also get noindex by default (V). | Correct the text. Keep the `_headers` rule as belt and braces for the production `*.workers.dev` host and Version URLs. Do not put previews on a custom domain. |
| CF-04 | MED | `_headers` rule 1 `https://:subdomain.workers.dev/*` never matches a worker host. A placeholder matches exactly one DNS label, so it matches only `<account>.workers.dev`. Real hosts are `sizetune.<acct>.workers.dev`, `<version>-sizetune.<acct>.workers.dev` and `<preview>-sizetune.<acct>.workers.dev`; those are covered only by rule 2. | Observed with a scratch copy (rule 1 only): Host `sizetune.sourav.workers.dev` -> no `x-robots-tag`; Host `sourav.workers.dev` -> `x-robots-tag: noindex`. With the real `_headers`, all three workers.dev host shapes got noindex and `sizetune.com` got none (V). Syntax is correct per docs; 5 of 100 rules used. | Delete rule 1 (cosmetic), keep rule 2. After first deploy, `curl -sI https://sizetune.<acct>.workers.dev/` (if enabled) must show noindex (A: live behaviour). |
| CF-05 | MED | Order of operations as documented would expose `sizetune.<acct>.workers.dev` as a duplicate host. `workers_dev` defaults to true when the config has no `routes`. Disabling `workers_dev` does **not** disable Version URLs or Preview URLs. | workers-dev doc, wrangler config doc (V): `workers_dev` default true without routes, false with routes; `preview_urls` controls Version URLs and workers.dev Preview URLs; if omitted Wrangler leaves existing setting. Dashboard-only disable is re-enabled by next `wrangler deploy` if config does not say false (V). | Because the zone is already active, put the Custom Domain in `wrangler.jsonc` from the very first deploy (see s4 config) and set `workers_dev:false`. Decide `preview_urls` (see s4). |
| CF-06 | MED | Node: `.nvmrc` = 24.12.0. Build image default is **24.22.1**; preinstalled are 22.23.4 and 24.22.1. 24.12.0 is not preinstalled. Cloudflare reads `.nvmrc` / `.node-version` / `NODE_VERSION` itself. | build-image doc (V). Whether 24.12.0 is fetched on demand: A. Astro 7 needs >=22.23.4 (24.x ok). | Set `.nvmrc` to `24.22.1` (preinstalled, deterministic; setup-node can fetch it) or `24`. No `NODE_VERSION` var needed then. Re-run `npm run verify` on it. |
| CF-07 | MED | CI hardening: `runs-on: ubuntu-latest` migrates to Ubuntu 26.04 in Nov 2026; `on: [push, pull_request]` double-runs PR branches; no `permissions`, `concurrency`, `timeout-minutes`; no report upload on e2e failure. | Runner-images README announcement (V). `channel:'chrome'` works on ubuntu-latest: **Google Chrome 156.0.8078.79 is preinstalled on both the 24.04 and 26.04 images** (V, image READMEs 20261101); Playwright says `channel: chrome` uses the machine's branded Chrome and does not install it (V); Playwright 1.65 docs list Ubuntu 22.04/24.04/26.04 and Node 22/24/26 (V). Linux run of `wrangler dev`/workerd not exercised (only macOS) (A). | Pin `ubuntu-24.04`; `on: { push: {branches:[main]}, pull_request: {} }`; `permissions: {contents: read}`; `concurrency` cancel-in-progress; `timeout-minutes: 15`; upload `playwright-report/` and `test-results/` with `if: failure()`. Verify the first real run. |
| CF-08 | LOW | html_handling redirects are **307** (temporary). Slash variants are not 301. | Observed (V). Canonical tags and sitemap use slash URLs: `dist/index.html` canonical `https://sizetune.com/`; `sitemap-0.xml` lists `/`, `/guides/photo-size-for-online-forms/`, `/privacy/` (V). | Acceptable: canonical + internal links + sitemap carry the signal (A: Google treats 307 as temporary but follows it). Optional hardening: `_redirects` with `/privacy /privacy/ 301` etc. Observed locally: `_redirects` 301 **wins** over html_handling 307 (V). Only for the 3 known URLs; no `/*` splat (loop risk). |
| CF-09 | LOW | `www` is not handled anywhere; `_redirects` cannot do host-level redirects. | Redirects doc table: "Domain-level redirects" unsupported (V). | Proxied dummy DNS record + zone Single Redirect www -> apex 301 with query preserved (s4 H6). Doc's own example `concat("https://","example.com",http.request.uri.path)` drops the query string; enable "Preserve query string". |
| CF-10 | LOW | Repo has **zero commits**, no remote, `.github/`, `.gitignore`, `.nvmrc` untracked. Workers Builds and branch protection need a GitHub repo with a pushed `main`. | `git log`: "does not have any commits yet" (V). | Human creates the GitHub repo and pushes (publishing action). |
| CF-11 | LOW | Preview command default is `npx wrangler preview` (needs Wrangler >=4.135; installed 4.160.1 ok). Not exercised for a static-only Worker. | Previews + configuration docs (V); behaviour on this project A. | If preview builds fail, set Preview command to `npx wrangler versions upload` (documented alternative, V), or disable preview builds. |
| CF-12 | LOW | `compatibility_date` 2026-11-12 equals today; docs: set to current date at project start and bump occasionally; old dates supported forever. | compat-dates doc (V). | Fine as is. No `compatibility_flags`, no bindings. Keep `wrangler` pinned by lockfile; bump deliberately. |
| CF-13 | INFO | Cache strategy verified (s3). HSTS and CSP deferred: fine. HSTS is a zone setting (Edge Certificates), not `_headers`. | HSTS doc (V): do not later un-proxy/pause/point NS away or you lock visitors out for max-age. | Enable HSTS only after 1-2 stable weeks; start max-age small, no `includeSubDomains`/preload initially. Human. |

### `_headers` vs Transform Rules (V)
Response Header Transform Rules apply only to hostnames in **your zone** (they cannot touch `*.workers.dev`), live in the dashboard (no git history), and do not describe the repo's behaviour. `_headers` is versioned, applies on every host the Worker serves incl. workers.dev, limit 100 rules / 2,000 chars per line. Keep security, cache and noindex headers in `_headers`; use dashboard rules only for things that cannot live there (HSTS zone setting, www redirect). Note `_headers` is not applied to responses generated by a Redirect Rule or Worker code (V, caution box).

## 2. Platform limits relevant here (V)
Workers static assets: 20,000 files free / 100,000 paid (Wrangler >=4.34), 25 MiB per file, `_headers` 100 rules, `_redirects` 2,000 static + 100 dynamic. Current `dist/`: 14 files, 308 KB, largest file well under 1 MiB. Requests to static assets are free and unlimited (billing doc). Range requests return 200 full body (irrelevant, no media). Workers Builds free plan: 3,000 build min/month, 1 concurrent build, 20 min timeout, 64 env vars. Pages (for comparison): 20,000 files, 25 MiB, 500 builds/month free, 100 projects/account.

## 3. Local observations (V) - `npm run build` then `npx wrangler dev --port 8790 --ip 127.0.0.1` (wrangler 4.160.1)
| Request | Result |
|--|--|
| `/` | 200, `cache-control: public, max-age=0, must-revalidate`, ETag, nosniff, referrer-policy strict-origin-when-cross-origin, permissions-policy `camera=(), microphone=(), geolocation=()` |
| `/privacy` | **307** `Location: /privacy/` (no cache-control on the 307) |
| `/privacy.html` | 307 -> `/privacy/` |
| `/index.html` | 307 -> `/` |
| `/guides/photo-size-for-online-forms` | 307 -> `.../` |
| `/privacy/`, `/guides/.../` | 200 |
| `/nope/` and `/nope` | **404** with custom `404.html` (title "Page not found \| SizeTune", `<meta name="robots" content="noindex">`, canonical `/404/`); `/nope` (no slash) is a direct 404, not a 307 |
| `/PRIVACY/` | 404 (case-sensitive) |
| `/_headers` | 404 (file not served) |
| `/robots.txt` | 200 text/plain; sitemap line `https://sizetune.com/sitemap-index.xml` |
| `/sitemap-index.xml` | 200 application/xml |
| `/_astro/Base.CtDPQdIt.css` | 200 `cache-control: public, max-age=31536000, immutable` |
| `/favicon.svg` | 200 `cache-control: public, max-age=86400` |
| Host header `sizetune.sourav.workers.dev`, `abc123-sizetune.sourav.workers.dev`, `sourav.workers.dev` | `x-robots-tag: noindex` on all three |
| Host `sizetune.com` | no `x-robots-tag` |
| Scratch test, `_headers` containing only rule 1 | `sizetune.sourav.workers.dev` no noindex; `sourav.workers.dev` noindex (CF-04) |
| Scratch test, `_redirects` `/privacy /privacy/ 301` | `/privacy` -> **301**, `/privacy/` 200 |
Not testable locally: edge certificate, real workers.dev/Preview headers, custom-domain routing, Builds environment, rollback.
Method note: scratch tests used copies under the scratchpad (nothing in the project was modified). I once ran a broad `pkill -f "wrangler dev"` / `pkill -f workerd`; other agents' wrangler processes (ports 8788, 8791) were still running afterward but may have been disturbed.

## 4. Runbook
### 4a. Target config (agent can apply; `wrangler.jsonc`)
```jsonc
{ "$schema": "./node_modules/wrangler/config-schema.json", "name": "sizetune", "compatibility_date": "2026-11-12",
  "workers_dev": false,
  "preview_urls": false,   // see decision below
  "routes": [ { "pattern": "sizetune.com", "custom_domain": true } ],
  "assets": { "directory": "./dist", "html_handling": "auto-trailing-slash", "not_found_handling": "404-page" } }
```
`preview_urls` decision: `false` removes Version URLs and workers.dev Preview URLs (zero duplicate hosts) but also makes PR previews unavailable (A: Previews then have no URL; custom-domain previews need extra config and Access). Recommended for launch: **`false`**, and turn "Enable Preview Builds" OFF; re-enable `true` later if previews are wanted, then rely on the native noindex plus `_headers` rule 2 and verify with curl. The Builds API token (auto-created) includes "Workers Routes: Edit" for all zones, so config-managed routes deploy (V, configuration doc). Custom Domain cannot be created on a hostname with an existing CNAME (V); apex currently has no records (V). If a parking A/AAAA/CNAME appears in the zone, delete it first (A for A/AAAA).
Canonical host: **apex `https://sizetune.com`** (already in `astro.config.mjs` `site`, canonical tags, sitemap, robots).

### 4b. Agent can do (no login, no publish)
1. Apply 4a to `wrangler.jsonc`; delete `_headers` rule 1; optionally add `public/_redirects` (3 lines, 301, CF-08).
2. `.nvmrc` -> `24.22.1` (or `24`); update ci.yml per CF-07; fix CLOUDFLARE_DEPLOYMENT.md s4/s5 and ADR (registrar facts, noindex claim, build-image Node default now verified).
3. Run `npm ci && npm run verify` locally; add a post-change local `wrangler dev` smoke of section 3.
4. Prepare a post-deploy smoke script (read-only curl, section 4d). Re-run `whois`/`dig` to confirm NS/records before the human steps.
5. If the human asks: `git add -A && git commit` locally (no push, no remote).

### 4c. HUMAN must do (in order)
H0 **Confirm account/zone.** dash.cloudflare.com -> choose the account -> Domains -> Overview: `sizetune.com` must be listed as Active and Registrar = Cloudflare. If it is in another account, use that account for everything below (a Worker can only attach a Custom Domain to a zone in its own account, V: "zone you do not own" is refused).
H1 **DNS sanity.** Domain -> DNS -> Records: expect none for `@`/`www`. Delete any parking A/AAAA/CNAME. Do not touch nameservers (already Cloudflare). Optional: DNS -> Settings -> DNSSEC -> Enable DNSSEC (A: registrar is Cloudflare so DS is added automatically).
H2 **Git.** Create an empty GitHub repo `sizetune` (private is fine). In the project: `git add -A && git commit -m "Initial SizeTune site" && git remote add origin git@github.com:<you>/sizetune.git && git push -u origin main`. First push triggers the `ci` workflow; confirm it is green (Actions tab) and note the check name `verify`.
H3 **Branch protection.** GitHub repo -> Settings -> Rules -> Rulesets -> New branch ruleset: target `main`; enable Require a pull request, Require status checks to pass -> add `verify`, Block force pushes, Restrict deletions; leave Bypass list empty. (A: rulesets on private repos need a paid GitHub plan; on a public repo they are free.) Do this **before** step H4 so a bad merge cannot auto-deploy.
H4 **Workers Builds.** Dashboard -> Workers & Pages -> Create application -> GitHub (authorize the Cloudflare GitHub app for this one repo only) -> select `sizetune`. Worker name must be exactly `sizetune` (V, name mismatch fails the build). Branch `main`. Root directory blank. Build command: `npm ci && npm run check && npm test && npm run build && npm run verify:html`. Deploy command: `npx wrangler deploy` (default). Build variables: none (Node comes from `.nvmrc`; if the log shows another Node, add `NODE_VERSION=24.22.1`). Save and Deploy. The build command must be set in the form, not left empty, otherwise `dist/` will not exist (A: failure mode).
H5 **Watch the first build** (Worker -> Deployments -> View build history). Expect Node 24.x, all gates pass, deploy attaches `sizetune.com`. Universal SSL for an active full-setup zone is issued automatically within 15 min-24 h of activation (V); the zone is already active, so the cert for the apex usually exists; Custom Domain adds its own certificate (V). Until it is valid, browsers show a cert error: wait, do not change records.
H6 **www redirect.** DNS -> Add record: Type A, Name `www`, IPv4 `192.0.2.1`, Proxy status **Proxied**. Then Rules -> Redirect Rules -> Create rule -> Custom filter expression `(http.host eq "www.sizetune.com")`; Type Dynamic; Expression `concat("https://sizetune.com", http.request.uri.path)`; Status 301; tick Preserve query string; Deploy. (Pattern from the Cloudflare "redirect a subdomain to the apex" doc, V; dashboard labels A.)
H7 **HTTPS.** Domain -> SSL/TLS -> Edge Certificates: Always Use HTTPS = On. Leave HSTS off for now (CF-13).
H8 **Verify** (4d). Then Search Console: add property `sizetune.com` (Domain, DNS TXT added in Cloudflare DNS) and submit `https://sizetune.com/sitemap-index.xml`.
H9 Optional later: set `preview_urls:true` + enable Preview Builds, push a branch, check `x-robots-tag: noindex` on its URL; enable HSTS after a stable week.

### 4d. Post-deploy verification (read-only; agent can run once the human says it is live)
```
curl -sI https://sizetune.com/                 # 200, security headers, cache-control must-revalidate
curl -sI https://sizetune.com/privacy          # 307 (or 301 if _redirects added) -> /privacy/
curl -sI https://sizetune.com/nope/            # 404
curl -sI "https://www.sizetune.com/privacy/?x=1"   # 301 -> https://sizetune.com/privacy/?x=1
curl -sI http://sizetune.com/                  # 301/308 to https
curl -s  https://sizetune.com/robots.txt ; curl -sI https://sizetune.com/_astro/<hash>.css  # immutable
curl -sI https://sizetune.<acct>.workers.dev/  # expect failure/404 (workers_dev false); if reachable it must carry x-robots-tag: noindex
dig +short NS sizetune.com @1.1.1.1; dig +short sizetune.com @1.1.1.1
```

## 5. Workers static assets vs Pages (decision: **Workers**)
| Topic | Workers static assets | Pages | Source |
|--|--|--|--|
| Cloudflare direction | "Start new projects with Workers" | Marked as "Are you sure you want to use Pages?"; still works | pages/framework-guides (V) |
| Static serving cost | Free, unlimited | Free, unlimited | billing docs (V) |
| Files / size / `_headers` / `_redirects` | 20k (100k paid) / 25 MiB / 100 / 2,100 | 20k (100k paid) / 25 MiB / 100 / similar | limits docs (V) |
| Git integration | Workers Builds (GitHub/GitLab/Artifacts), build+deploy commands, root dir, 3,000 build min/mo | Pages Git integration, 500 builds/mo | V |
| Previews | Worker Previews (`wrangler preview`), workers.dev URL gets noindex natively; custom-domain previews need Access | `pages.dev` previews with automatic noindex | V |
| Rollback | Dashboard Deployments -> Rollback, or `wrangler rollback`; last 100 versions | Dashboard rollback to any successful production deployment | V |
| Config in repo | `wrangler.jsonc` (routes, html_handling, 404) | mostly dashboard + `pages_build_output_dir` | V |
| Node default | 24.22.1 (22.23.4 also preinstalled); `NODE_VERSION`, `.nvmrc`, `.node-version` | not re-checked | V |
| Custom domain | Needs active zone in same account; auto DNS+cert; apex ok | needs zone or CNAME | V |
Reasons: Cloudflare's stated direction, same limits and cost, config as code (`wrangler.jsonc`), simpler rollback via versions, same `dist/` so a later switch is a config change. Costs of Workers: preview/Version URLs are public `workers.dev` hosts that must be neutralised (CF-04/05), and Previews are newer (A: less field-proven). Pages remains valid if the user prefers its simpler dashboard flow; not a blocker.

## 6. Custom domain for a domain registered ELSEWHERE (reference; not needed here)
- Full (primary) setup: Free plan supported. Onboard apex in dashboard (Domains -> Onboard a domain), review records, **turn off DNSSEC at the registrar first** (a stale DS breaks resolution), replace registrar nameservers with the two assigned ones, wait for Active (V, full-setup doc). Universal SSL: 15 min-24 h after activation; covers apex and first-level subdomains (V). Zero-downtime rule: keep records DNS-only until the edge cert is active (V, minimize-downtime). No live site exists for sizetune.com, so downtime is moot.
- CNAME/partial setup: **Business/Enterprise only**; not supported for Cloudflare Registrar domains; apex needs CNAME flattening at the other DNS provider (V). Not applicable for a free-tier launch.
- Apex vs www: apex canonical + proxied `www` record + Single Redirect (H6). Custom Domains need exact hostnames, no wildcards (V).

## 7. Rollback plan
1. **Bad deploy (fastest, minutes):** Dashboard -> Workers & Pages -> `sizetune` -> Deployments -> `...` on the last good version -> Rollback (V). CLI alternative for a human: `npx wrangler rollback <version-id> -m "reason"` (needs login; V that command exists; not exercised). Limited to last 100 versions; no bindings, so no data hazard (V).
2. **Stop further bad deploys:** change Deploy command to `npx wrangler versions upload` (builds still run, nothing promoted; V) or pause by disconnecting Builds (Settings -> Builds -> Disconnect, V).
3. **Fix forward:** `git revert <sha>` via PR; merge triggers a clean redeploy.
4. **Domain/DNS issue:** remove or re-add the Custom Domain (Worker -> Settings -> Domains & Routes) - note config `routes` re-asserts it on the next deploy, so also edit `wrangler.jsonc`. Disable the www Redirect Rule if it misbehaves.
5. **Do not enable HSTS before the site is stable;** it is the one change that cannot be rolled back quickly (CF-13).
6. Rolling back leaves `_headers`/`_redirects` of that version in effect (they ship with each version, A).
