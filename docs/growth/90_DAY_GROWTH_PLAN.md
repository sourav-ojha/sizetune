# 90-day growth plan

Assumptions: site is live (sizetune.com), no traffic, no Search Console data, AdSense not applied. Owner = founder. Sources for tool facts: session research 2026-11-17 (distribution/analytics agent; Reddit and Quora rules could not be fetched, so every Reddit/Quora rule is **[UNVERIFIED]**, read the sidebar before posting). Principle: bootstrapped, free tools only, no spam, no purchased links.

## Phase 0 — Days 0-7: make it measurable (owner actions, ~2 h)
| # | Action | Detail | Verified how |
|---|---|---|---|
| 0.1 | Search Console, **Domain property** | DNS TXT is the only method for a Domain property; keep the record permanently. Submit `https://sizetune.com/sitemap-index.xml`. | support.google.com/webmasters/answer/9008080 [V] |
| 0.2 | Bing Webmaster Tools | Use "Import from Search Console" (no separate verification). | Bing blog [V via search result] |
| 0.3 | IndexNow | Host key `.txt` in `public/`; ping on deploy (CI step). Bing/Yandex/Naver/Seznam only, **not Google**. Low priority: do after 0.1. | indexnow.org/faq [V] |
| 0.4 | `www` → apex 301, Always HTTPS, HSTS off | CLOUDFLARE_DEPLOYMENT H5/H11 | repo doc |
| 0.5 | Request indexing in GSC for ~10 core URLs | Manual, URL Inspection | — |

### Analytics decision (needs owner choice; nothing implemented)
| Option | CSP change | Consent | Fit |
|---|---|---|---|
| **A. Search Console + Bing only (recommended start)** | none | none | Gives queries, clicks, impressions, indexing, CWV field data. Covers all SEO decisions in the first 90 days. |
| B. Cloudflare Web Analytics | manual snippet needs `script-src` + `connect-src` for the Cloudflare beacon host (copy host from the dashboard snippet); auto-injection on Workers static assets **not documented**, test after deploy | cookieless is **[UNVERIFIED]** in the docs read | Cheap pageview/referrer counts. |
| C. GA4 | `script-src-elem googletagmanager.com`, `connect-src`/`img-src` `*.google-analytics.com` etc. (developers.google.com/tag-platform/security/guides/csp [V]) | EEA/UK consent banner needed with Google ad products (consent mode: secondary sources, **[UNVERIFIED]**) | Not recommended: contradicts "your image never leaves your device" positioning and adds banner/origins. |
Recommendation: A for days 0-45. Add B only if you need non-search traffic counts; then edit the privacy page and CSP in the same PR. If any analytics ships, events must be **tool-usage only, no file names, sizes of user files or image content**: `tool_start`, `download_click`, `preset_used` (page path + KB preset, nothing else).

## Phase 1 — Days 8-30: foundation content + first distribution
- Ship what this branch built (hub pages, breadcrumbs, `/resize-image-to-50kb/`); merge to `dev`, then `main` (human deploy gate).
- Gate rule (already in repo): max 5 per-size pages in wave 1. After 4 weeks of GSC data, expand only pages whose query appears in "Queries" with impressions, see `LANDING_PAGE_STRATEGY.md`.
- Write 2 guides from `CONTENT_ROADMAP.md` (priority 1 and 2).
- Directories (3-4 only, quality over quantity): SaaSHub (submit page says free) [V], Uneed [V loads, pricing unread], Fazier [V loads], Startup Stash [V loads]. Skip AI-tool directories (poor fit). AlternativeTo and Peerlist returned 403: check by hand.
- Launch posts, each written for the venue, not copy-pasted:
  - dev.to / Hashnode technical post: "How we compress an image to an exact KB limit entirely in the browser" (canonical URL = sizetune.com guide). dev.to code of conduct has no explicit promo rule [V].
  - Show HN: only when the tool list has 8+ tools [I: our own threshold]; must be tryable without signup, author must answer comments, no vote solicitation [V news.ycombinator.com/showhn.html]. Lead with the engineering angle (binary search on JPEG quality, worker, no upload).

## Phase 2 — Days 31-60: iterate on data
- Weekly 30-min GSC review: queries with impressions but position >10 → improve that page's copy/FAQ; queries with no page → backlog.
- Add wave-2 pages only for queries GSC shows (see strategy gates). Verify every exam spec against the **official notice** before publishing, with a visible "last verified" date.
- Exam-community help (see below), answer real "photo rejected" questions with the specific fix; link only where it is the actual answer.
- Product Hunt: launch when the hub has 8+ tools and one distinctive claim (no upload, exact KB). Free to launch; read the launch guide first. (Site itself returned 403; **[UNVERIFIED]** details.)

## Phase 3 — Days 61-90: authority + monetisation prep
- Re-evaluate AdSense: no published traffic minimum [V support.google.com/adsense/answer/9724], but "low-value content" and navigation-only screens are ineligible [V .../10502938]. Tool pages with prose + FAQ are the mitigation. Apply when ≥15 pages of original content exist and the About page names a human. Then `ads.txt` (publisher ID; never a placeholder) [V .../12171612].
- CSP for ads is a separate piece of work: Google publishes no allowlist, only nonce+strict-dynamic [V]; keep tool routes ad-free and scope ad origins to guide routes (ADR D6, `SEO_ARCHITECTURE.md` §12).
- Outreach (honest, 5/week max): education blogs and exam-prep sites that publish "how to upload photo" content: offer a verified spec table + embed link. No paid links, no link swaps, no fake reviews.
- Pinterest: one cheat-sheet pin per social-size guide linking to the guide. YouTube: 30-60 s screen recordings titled with the exact task ("Compress photo to 50 KB, no upload"). Both free.

## Community rules of engagement
| Channel | Status of rules | Approach |
|---|---|---|
| Reddit (r/SideProject, r/webdev, r/IndiaTech, exam subs) | **[UNVERIFIED]** (fetch blocked). Third-party sources: r/webdev limits self-promo to a weekly thread. | Read each sidebar; 9:1 contribution ratio; disclose authorship; one post per sub. Exam subs: answer questions, no drive-by links. |
| Quora | **[UNVERIFIED]** | Full answers to real questions; link only when relevant. |
| Telegram/YouTube exam channels | none found; won't invent names | Search manually; message admins individually; offer the spec table. |

## KPIs (leading, then lagging)
| Week | Metric | Source |
|---|---|---|
| 1 | Indexed pages = pages in sitemap | GSC Pages report |
| 4 | Impressions, queries per page | GSC |
| 8 | Clicks, CTR on 5 target pages; average position per target query | GSC |
| 12 | Pages with ≥1 click/week; referring domains (count only) | GSC Links |
| 12 | AdSense application readiness checklist | manual |
**No traffic target is claimed.** Search volume for these queries is unknown (only autocomplete proxies; see `KEYWORD_RESEARCH.md`). Set numeric goals after week 4 from real impressions.
