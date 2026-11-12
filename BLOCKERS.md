# BLOCKERS.md — SizeTune (2026-11-12)

Severity: CRITICAL = cannot launch / unsafe; HIGH = must fix before public launch; MED = fix before/soon after. No CRITICAL blockers are known. "Owner": AGENT = can be done autonomously; HUMAN = needs a person (click, money, legal, devices).

## A. Human actions required (exact)
| # | Action | Why | Owner | Blocks |
|--|--|--|--|--|
| H1 | Create a GitHub repo, push `sizetune/` (`git add -A && git commit && git push`; the repo has **zero commits** today). | CI, branch protection, Workers Builds all need it. Publishing action. | HUMAN | CI, deploy |
| H2 | GitHub ruleset on `main`: require PR + required status check `verify`, block force-push, **no bypass**; do this BEFORE connecting Cloudflare. | Workers Builds deploys every push to the production branch regardless of GitHub Actions. | HUMAN | safe deploy |
| H3 | Confirm the `sizetune.com` zone is in the same Cloudflare account that will own the Worker (dashboard → Websites). | Custom Domains need an active zone in the account. | HUMAN | custom domain |
| H4 | Cloudflare dashboard → Workers & Pages → Create → connect the GitHub repo; Worker name `sizetune` (must equal `wrangler.jsonc` name); build cmd `npm ci && npm run check && npm run build && npm test && npm run verify:html`; deploy cmd `npx wrangler deploy`; **do not enable production deploy until H2 is done**. First deploy publishes a site → needs explicit go-ahead. | Deployment | HUMAN | launch |
| H5 | Decide `www`: recommended = apex canonical + zone Single Redirect `www`→apex (301, preserve query). | Avoid duplicate host | HUMAN | launch |
| H6 | IP India trademark search for "SizeTune" (classes 9, 42, 35) and a lawyer's view; USPTO exact-wordmark search found no hits on 2026-11-12 (screening only, no clearance). | Brand risk | HUMAN | launch |
| H7 | Real-device compression test on ≥3 phones (one iPhone 2–4 GB class, two Android ≤3 GB, incl. in-app browsers like WhatsApp/Instagram) following `QA/PRODUCT_READINESS.md` §3. | Simulators don't prove memory limits | HUMAN | launch |
| H8 | Approve/override engineering decisions in ADR §3 marked "human may override" (Preact-compat, ad-free tool routes, Node 24 pin). | Reversible but owner's call | HUMAN | — |
| H9 | Provide author/about identity (name or pseudonym policy, contact email) and approve privacy/terms drafts with a lawyer. | E-E-A-T, AdSense, DPDP/GDPR | HUMAN | launch, ads |
| H10 | AdSense: decide strategy (ads on content pages only vs beside tool), choose a Google-certified CMP, apply only after content exists. **Nothing is enabled.** | Revenue vs privacy promise | HUMAN | ads |
| H12 | **Decide the staging story.** Because `workers_dev:false`/`preview_urls:false` + custom-domain `routes`, the *first* deploy (human `wrangler deploy` or pushing `main` once Workers Builds is connected) publishes sizetune.com. If you want a private pre-launch look: do not connect Builds yet; or on a throwaway branch set `workers_dev:true`, remove `routes`, deploy once to a workers.dev URL (ensure noindex header works), then revert. | Avoid accidental launch | HUMAN | launch |
| H13 | Check the registrar contact email (Cloudflare Registrar → domain contact) is valid/monitored (ICANN verification); set up a role mailbox (e.g. Cloudflare Email Routing) for About/Privacy/contact. | Domain suspension risk; trust pages | HUMAN | launch |
| H14 | Authorise the Cloudflare GitHub app for the one repo; choose GitHub private vs public (rulesets on private repos may need a paid plan — unverified). | H2/H4 | HUMAN | deploy |
| H15 | Supply/approve a 1200×630 og:image asset. | Sharing/STRICT | HUMAN (or approve an agent-made one) | launch |
| H16 | Add Search Console DNS TXT record (Domain property) after launch. | Indexing | HUMAN | — |
| H11 | After a stable 1–2 weeks live: HSTS (zone setting, small max-age first), Search Console + Bing verification and sitemap submission. | Post-launch | HUMAN | — |

## B. Risks and engineering blockers
| ID | Sev | Item | Status / next |
|--|--|--|--|
| B1 | HIGH | **No real content.** Home 94 words, guide 108, privacy 45 (total words in `<main>`; STRICT counts *unique* words: 90/104/43). `STRICT=1 npm run verify:html` fails on purpose (unique-word, FAQ, og:image, orphan rules). Thresholds (tool 300 / home 400 / guide 400 / policy 150 unique words) are tripwires, untested on real copy. | AGENT writes copy (work packages A5/A8); H9, H15. |
| B2 | HIGH | **Compression engine not production-grade**: scale-ladder floor + q=0.05 last resort give 8.9 KB for a 20 KB target (SSIM .835), iOS Safari `fits=false` at 36/48 MP, no min bound, no alpha handling, **full decode before the pixel check (S-05, ~1 GB peak at 36 MP; decompression-bomb order)**, main-thread fallback has no timeout (S-08). Stale-result e2e is partial (needs a deterministic Worker stub); main-thread fallback untested; old 60 s timer not cleared. Fixed in this gate: magic-byte type check (S-06), blob URL revoke on file change (S-07), stale-result race, `bmp.close` in `finally`, generic error text. | Roadmap Stages 0–5 in `QA/PRODUCT_READINESS.md`; AGENT Day 1–2. |
| B3 | HIGH | Real-device behaviour unverified (iPhone canvas limits/tab kill; low-RAM Android; in-app browsers). | H7. |
| B4 | HIGH | Demand/competition: N1 evidence = volume *buckets*, Easy KD, but SERPs saturated; new DR-0 site. Kill criteria from N1 still apply (≥5K organic visits/mo at day 120; ≥20K Search Console impressions/mo on KB pages at day 60). | Business risk; monitor. |
| B5 | HIGH | Deploy gate depends on H1/H2; without a ruleset a bad push deploys. | H1/H2. |
| B6 | MED | Ads vs privacy promise: any ad script on a tool page can read the selected file (same-origin). Policy P1 adopted: ad-free tool routes (enforced by `verify:html`). Revenue trade-off is the owner's. | H10. |
| B7 | MED | `verify-html` is a regex tripwire (known gaps in ADR §8b F3); replace with a real HTML parser (parse5) before relying on it. CSP is by `<meta>` (Astro built-in) + `frame-ancestors` header; ad-route CSP is an untested draft; Report-Only rollout on the real domain not done. | AGENT/H11. |
| B8 | MED | Privacy page stub; no cookies/storage used today; policy must precede any analytics/ads. | H9. |
| B9 | MED | Safari encoder differences (1.4–1.9× bigger at same quality; WebP encode unsupported; AVIF mislabelled). | Engine must verify real `blob.size` and magic bytes (Stage 1/3). |
| B10 | MED | `og:image`, About/Terms pages, `/guides/` hub or nav relabel missing. | AGENT Day 3. |
| B11 | MED | **The first deploy is production** (no preview URL by config). Live edge headers, CSP (meta, enforced from first deploy), 307/404, cert issuance are first verified on sizetune.com itself right after launch. Report-Only CSP is not possible for the meta policy. | H12; keep Builds disconnected until launch-ready. |
| B12 | LOW | Dependency hygiene: TypeScript held at 6.0.3 by `@astrojs/check`; install scripts (esbuild, workerd, fsevents); Actions pinned by tag not SHA. | AGENT, monthly update. |
| B13 | LOW | Node pin `24` (Cloudflare default 24.22.1) — local verify ran on 24.12.0 only; first CI run on the pinned image will confirm. | After H1. |
