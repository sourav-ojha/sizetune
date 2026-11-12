# SizeTune — local product candidate (not deployed)

Browser-only image and signature resizer. Astro 7 static output + Preact 11 (compat) islands (migrated from React; see `docs/experiments/PREACT.md`), Tailwind v4, MDX guide, in-browser compression engine (`src/lib/engine`). **Nothing is deployed; no remote repository; no ads or analytics; images never leave the browser.**
Domain `sizetune.com` is registered (Cloudflare) but no site is live and no DNS record was added by this project.

## Read first
`BUILD_STATUS.md` (what is done/partial/missing) · `QA/PRODUCT_READINESS.md` · `QA/TEST_RESULTS.md` · `BLOCKERS.md` (human actions) · `QA/REAL_DEVICE_TEST_PLAN.md` · `ARCHITECTURE_DECISION_RECORD.md` · `docs/engine/ENGINE.md` · `docs/verification/VERIFIERS.md` · `CHANGELOG.md`

## Setup
```bash
nvm use          # .nvmrc = 24 (verified locally on 24.12.0)
npm ci
```
System Google Chrome is used by Playwright (`channel: 'chrome'`); no browser downloads are needed for the default suite.

## Develop
```bash
npm run dev      # http://localhost:4321  (Astro dev server)
npm run build    # static site -> dist/
npx wrangler dev --port 8788 --ip 127.0.0.1   # serve dist/ with Cloudflare's local runtime (what the e2e tests use)
```

## Verify (run before every commit)
```bash
npm run verify            # check + build + unit + verify:html + verify:html:strict + verify:privacy + all Playwright e2e
```
Individual gates:
```bash
npm run check                    # astro check (TypeScript + Astro)
npm test                         # vitest: engine, UI helpers, HTML/privacy verifier mutation tests (needs dist/: run build first)
npm run verify:html              # structural HTML/SEO/CSP rules on dist/ (parse5)
npm run verify:html:strict       # + launch rules; [[HUMAN: …]] markers listed as pending (exit 0)
npm run verify:html:final        # STRICT=2: also FAILS while any [[HUMAN: …]] marker remains — the pre-launch gate
npm run verify:privacy           # third-party origins, trackers, network primitives in tool-page JS
npm run test:e2e                 # Playwright (builds, serves dist/ via wrangler on port 8788)
npm run test:engine:e2e          # engine-only browser tests
```
Optional Firefox/WebKit (needs a browser download you must approve): `npx playwright install firefox webkit && PW_ALL_BROWSERS=1 npx playwright test`.
Fixtures: `node scripts/gen-fixtures.mjs --check`; phone test pack: `node scripts/gen-fixtures.mjs --device-pack` (see `QA/REAL_DEVICE_TEST_PLAN.md`).

## Layout
`src/lib/engine/` engine · `src/components/` image + signature tools · `src/pages/`, `src/content/` launch pages · `scripts/verify-*.mjs` gates · `tests/` unit · `e2e/` browser tests · `docs/reviews/` independent reviews · `QA/` readiness + test plans.

## Rules for this project
No push/deploy/DNS/ads/analytics/purchases without the owner. Tool pages load no third-party origins. No metadata padding to reach minimum sizes. Placeholders in copy use `[[HUMAN: …]]`.
