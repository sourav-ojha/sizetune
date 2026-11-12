# BLOCKERS.md — SizeTune (updated 2026-11-12, after the build sprint)

CRITICAL = unsafe/unlaunchable · HIGH = must fix before public launch · MED = soon after / before ads. **No CRITICAL blockers are known.** Owner: AGENT = autonomous work possible; HUMAN = needs you (click, money, legal, devices).
Nothing below has been done by an agent: no push, no deploy, no DNS change, no ads, no purchases.

## A. Decisions and actions only you can do (exact steps)
| # | Action | Exact steps | Blocks |
|--|--|--|--|
| H1 | **Fill the 9 owner markers** | `grep -rn "\[\[HUMAN" src/pages` — about (2: owner name + one sentence, public contact email), privacy (4: legal-review-pending, owner name, contact email, "do you use Google Search Console — keep/delete sentence"), terms (3: legal-review-pending, governing law/jurisdiction line, contact email). Replace each `[[HUMAN: …]]` with real text or delete the sentence. Then `pnpm run build && pnpm run verify:html:final` must exit 0 (STRICT=2). | launch |
| H2 | **Real-device tests (DEFERRED by owner 2026-11-13, to do later)** | Follow `QA/REAL_DEVICE_TEST_PLAN.md` on ≥3 phones (iPhone ≤4 GB RAM, 2 Android ≤3 GB). Fixtures: `node scripts/gen-fixtures.mjs --device-pack`. Serve the build to your LAN: `pnpm run build && pnpm exec wrangler dev --ip 0.0.0.0 --port 8788`. Paste the result table back. A crash on R2/R3 → lower `MAX_SOURCE_PIXELS`/`MAX_OUTPUT_PIXELS` in `src/lib/engine/limits.ts` for that browser. | launch |
| H3 | **Firefox + WebKit browser tests — DONE 2026-11-13** | Owner approved the browser install. `PW_ALL_BROWSERS=1 pnpm exec playwright test`: 562 passed across Chrome, Firefox 159, Playwright WebKit 27.2 (not Safari on a real iPhone). Chromium-only checks are tagged `@chromium-only` with a reason. See `QA/TEST_RESULTS.md` §Cross-browser. | closed |
| H5 | **Staging deploy (non-prod)** | Config + docs ready on `dev` (`CLOUDFLARE_DEPLOYMENT.md` §Staging). Needs `wrangler login`, then deploy; no production deploy until approved. | before prod |
| H4 | **Trademark + legal (owned by the owner, reviewing)** | IP India public search for "SizeTune" (classes 9, 42, 35) and a USPTO check (my exact-wordmark search found no hits on 2026-11-12 — screening only, no clearance); lawyer review of `/privacy/` and `/terms/` (DPDP/GDPR applicability is a counsel question). | launch |
| H5 | **Repo + CI + ruleset** | Create a GitHub repo; `git remote add origin <url> && git push -u origin main` (local `main` has all commits; `experiment/preact` is merged and can be deleted); authorise the Cloudflare GitHub app for that repo only; ruleset on `main`: require PR + check `verify`, block force-push, no bypass **before** connecting Cloudflare. Rulesets on private repos may need a paid plan (unverified). First CI run confirms Node 24 on `ubuntu-24.04` + Chrome. | deploy |
| H6 | **Staging story / first deploy = production** | With `workers_dev:false`, `preview_urls:false` and the custom-domain route, the first deploy (manual `wrangler deploy` or first push to `main` after connecting Workers Builds) **publishes sizetune.com**. Don't connect Builds until launch-ready, or deliberately use a throwaway branch with `workers_dev:true` and no `routes` for a private workers.dev look. See `CLOUDFLARE_DEPLOYMENT.md`. | launch |
| H7 | Confirm the `sizetune.com` zone is in the same Cloudflare account as the Worker; check registrar contact email validity (ICANN verification); set up a role mailbox (e.g. Cloudflare Email Routing) for About/Privacy/Terms. | deploy |
| H8 | `www` handling: apex canonical + proxied dummy `www` record + zone Single Redirect → apex (301, preserve query). | launch |
| H9 | Approve or replace `public/og-default.png` (plain generated card, `scripts/gen-og.mjs`). | launch |
| H10 | Human quality review: open `QA/quality-samples/index.html`; judge 20 KB legibility (faces/text/banding); decide if the pinned-quality behaviour is acceptable (`QA/QUALITY_SAMPLES.md` observations). | launch |
| H11 | Screen-reader pass (VoiceOver iOS/macOS, TalkBack, NVDA) per `QA/ACCESSIBILITY.md`. | launch |
| H12 | AdSense strategy (ads only on content pages, never tool pages — policy D6; consent tool for EEA/UK/CH). **Nothing is enabled.** Analytics: none at launch. | ads |
| H13 | After 1–2 stable weeks live: HSTS (zone setting, small max-age), Search Console DNS verification + sitemap `https://sizetune.com/sitemap-index.xml`, Bing optional. | post-launch |

## B. Open technical risks
| ID | Sev | Risk | Status / next |
|--|--|--|--|
| B1 | HIGH | **Real phones untested** (iOS canvas/memory/tab kill, low-RAM Android, in-app browsers). Simulator only. | H2 |
| B2 | HIGH | **Firefox/WebKit now run in automation (Playwright builds); real Safari/iPhone still untested.** | H2 (deferred) |
| B3 | HIGH | Owner markers + legal/trademark pending. | H1, H4 |
| B4 | HIGH | Demand/competition: N1 volume buckets, Easy KD, but saturated SERPs and a new site; N1 kill criteria apply (≥5K organic visits/mo at day 120; ≥20K Search Console impressions/mo on KB pages at day 60). | business |
| B5 | HIGH | Deploy safety depends on repo + ruleset; first deploy is production. | H5, H6 |
| B6 | MED | Quality at 20 KB on real portraits unknown (no face photos; SSIM indicative); quality pinned ≈q60 with pixel shrink for most size targets; WebP slower (~2.6 s vs 0.3 s at 50 KB); 1 KB target returns `ok` at 114×64 q9. | H10; tuning backlog in `QA/QUALITY_SAMPLES.md` |
| B7 | MED | Safari encoder sizes 1–7× Chrome; engine verifies real bytes so results are honest but may shrink pixels more on iOS. | monitor in H2 |
| B8 | MED | CSP is a build-time `<meta>` (enforced from first deploy, no Report-Only) + `frame-ancestors` header; live edge not tested; ad-route CSP (if ever) is an untested draft. | first deploy |
| B9 | MED | Verifiers are regex/AST-lite for JS (computed property access `self['fe'+'tch']` could evade the scanner; runtime backstops: CSP `connect-src 'self'`, e2e network test). Same-origin requests are allowed by `connect-src 'self'` — safe only while there is no server route. | documented in `docs/verification/VERIFIERS.md` |
| B10 | MED | Preact 11 / `@astrojs/preact` are recent (published Nov 2026), pinned exactly; fallback `preact@10.29.8` documented; compat can lag React. | monitor; H3 |
| B11 | MED | Very large sources (>36 MP) get no preview by design; sources >100 MP refused; 16 MP output cap. Message copy is honest but may frustrate users with 108/200 MP phones. | revisit after H2 |
| B12 | LOW | Hydration glitch from the simulator (smoke report D5: first tap ignored before hydration) cannot be fixed in UI; `client:load` vs `client:idle` not re-evaluated. | monitor |
| B13 | LOW | Dependency hygiene: TypeScript held at 6.0.3 by `@astrojs/check`; install scripts (esbuild, workerd, fsevents, sharp); Actions pinned by tag not SHA; `axe-core`, `sharp` test/dev-only pinned. | monthly |
| B14 | LOW | 307 (not 301) trailing-slash redirects by Cloudflare default; internal links are canonical; canonical tags are the backstop. | accepted |

## C. Closed in this sprint (was open before)
No real content → done (launch pages). Compression engine not production-grade → built and reviewed. Verifier regex tripwire → parse5. Spike copy/placeholder text → replaced. `og:image`, About/Terms, nav → done. Stale-result/leak/magic-byte bugs → fixed with tests. Sharp/engines pins → fixed. Preact evaluation → done (kept).
