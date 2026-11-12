# SizeTune (foundation — not published)
Astro 7 static + Preact (compat) island + Tailwind + MDX. Read `ARCHITECTURE_DECISION_RECORD.md` first.
```
nvm use            # 24.12.0
npm ci
npm run dev        # http://localhost:4321
npm run verify     # check + unit + build + verify:html + e2e (needs Google Chrome + wrangler)
STRICT=1 npm run verify:html   # launch content gate (fails until real copy exists)
```
Nothing here is deployed. Domain `sizetune.com` is registered (at Cloudflare, 2026-11-12) but no site is live and no DNS record was added by this project.
