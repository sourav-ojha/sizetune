---
type: product-context
status: approved
revision: 3
last_reviewed: 2026-11-17
approved_by: sourav
approved_at: 2026-11-17
content_hash: "sha256:3f6cdcf1d8bb4470ec49d1687ceea410e244dbe5c46f0fb5f086ead8550a9d07"
---
# SizeTune — Product Context

## 1. Product overview

SizeTune is a free, browser-only web tool that resizes photos and signature images to a target file size in KB, aimed at upload forms that reject files over a stated limit. [E: fact; high; repo:README.md:3; 2026-11-17] Compression runs in a Web Worker in the visitor's browser; the code makes no upload of the image. [E: fact; high; repo:src/lib/engine/client.ts; 2026-11-17] It is a static Astro site with Preact islands, served as Cloudflare Workers static assets. [E: fact; high; repo:package.json; 2026-11-17] It has two tools (image resizer, signature resizer), one guide, and legal/about pages. [E: fact; high; repo:src/pages; 2026-11-17] The product is also a traffic/ads-oriented niche-site candidate: it came from an "automated niche website discovery" workflow and AdSense is under consideration. [E: inference; medium; repo:SIZETUNE_EXECUTION_PLAN.md; 2026-11-17] The owner confirms the goal is ad revenue, that sizetune.com is live in production with Search Console enabled, and that SizeTune is one item in a site portfolio. [E: fact; high; user:chat answer 2026-11-17; 2026-11-17]

## 2. Problem statement

Government, exam, job and bank upload forms often set a maximum (sometimes minimum) file size in KB, e.g. 20 KB or 50 KB, and reject modern phone photos of several MB. [E: inference; medium; repo:src/pages/index.astro; 2026-11-17] Users today use server-upload resizers (TinyPNG, iLoveIMG), general editors (Squoosh, Photopea) or exam-form-specific resizers; the project's own review lists Squoosh, TinyPNG, iLoveIMG, CompressJPEG, ResizePixel and two exam-form resizers. [E: fact; medium; repo:CHANGELOG.md; 2026-11-13] Scale and exact user pain are not measured: the demand validation ("N1", CONDITIONAL GO) is referenced but its source files are not in this repository. [E: unknown; high; repo:SIZETUNE_EXECUTION_PLAN.md:5; 2026-11-17]

## 3. Target audience

| Segment | Who they are | Evidence |
|---|---|---|
| Form applicants (primary) | People uploading a photo or ID image to a form with a KB cap; copy is plain-language and mentions "your form", signature, 20 KB | [E: inference; medium; repo:src/pages/index.astro; 2026-11-17] |
| Signature uploaders | People who need a cropped, white-background signature under a size limit | [E: fact; high; repo:src/pages/resize-signature.astro; 2026-11-17] |
| Privacy-conscious users | Users wary of uploading ID photos to a server; trust section stresses "Nothing is uploaded", works offline | [E: fact; high; repo:src/pages/index.astro:20-33; 2026-11-17] |
| Geography | Owner says target geography does not matter; earlier India inference is not a constraint | [E: fact; high; user:chat answer 2026-11-17; 2026-11-17] |

## 4. Value proposition

Stated: free, no sign-up, no watermark, no limit on count; image stays on your device; test by going offline; real before/after sizes shown; honest warnings when a target is impossible. [E: fact; high; repo:src/pages/index.astro:20-33; 2026-11-17]
Demonstrated: byte-accurate targeting using real `blob.size` and magic-byte verification of every candidate, quality-first/dimensions-first strategies, min–max window, no metadata padding to hit minimums, EXIF orientation handling and GPS/Make/Model stripping, cancellation, a11y audit (axe 0 violations), cross-browser tests on Chrome, Firefox, Playwright WebKit. [E: fact; high; repo:docs/engine/ENGINE.md; 2026-11-13] Not demonstrated: real-device (iPhone/low-RAM Android) behaviour and output quality on real portraits at 20 KB. [E: fact; high; repo:BLOCKERS.md; 2026-11-12]

## 5. Core user journeys

### Journey 1: Resize a photo to a KB limit
1. Land on `/` or `/resize-image-to-20kb/` (limit preselected 50 / 20 KB). [E: fact; high; repo:src/pages/index.astro; 2026-11-17]
2. Pick or drop a JPEG/PNG/WebP file; header-first rejection of unsupported/oversized files. [E: fact; high; repo:BUILD_STATUS.md; 2026-11-12]
3. Choose preset (10/20/30/50/100/200 KB) or custom, optional minimum, advanced options. [E: fact; high; repo:CHANGELOG.md; 2026-11-12]
4. Tool auto-runs, shows before/after compare and sizes. [E: fact; medium; repo:CHANGELOG.md; 2026-11-16]
5. Download result; or see honest warning if target not reachable. [E: fact; high; repo:BUILD_STATUS.md; 2026-11-12]

### Journey 2: Resize a signature
1. Open `/resize-signature/`, add photo/scan. [E: fact; high; repo:src/pages/resize-signature.astro; 2026-11-17]
2. Crop (pointer, keyboard, numeric, auto-trim, shape presets, zoom). [E: fact; high; repo:CHANGELOG.md; 2026-11-13]
3. Choose output size/KB range; JPEG default, PNG if alpha; download. [E: fact; high; repo:BUILD_STATUS.md; 2026-11-12]

### Journey 3: Learn the limits (content)
1. Arrive from search to the guide "Photo Size for Online Forms" and follow links to tools. [E: inference; medium; repo:src/content/guides; 2026-11-17]

## 6. Existing capabilities

| Capability | Status | Evidence |
|---|---|---|
| Compression engine (JPEG/PNG/WebP in; JPEG/PNG/WebP out where encodable) | complete | [E: fact; high; repo:src/lib/engine; 2026-11-17] |
| Image tool UI (presets, min–max, dims, aspect lock, fit, strategy, compare) | complete | [E: fact; high; repo:src/components/ImageTool.tsx; 2026-11-17] |
| Signature tool (crop, trim, size) | complete | [E: fact; high; repo:src/components/SignatureTool.tsx; 2026-11-17] |
| Launch pages: home, 20 KB, signature, 1 guide, about, privacy, terms, 404 | complete | [E: fact; high; repo:src/pages; 2026-11-17] |
| Verification gates (HTML/SEO, privacy, CSP, a11y, e2e, mutation tests) | complete | [E: fact; high; repo:scripts/verify-html.mjs; 2026-11-17] |
| CI with staging/production deploy jobs | partial (production job gated) | [E: fact; medium; repo:.github/workflows/ci.yml; 2026-11-17] |
| HEIC/GIF/AVIF/SVG input, bulk, PDF, other languages, more preset pages | not implemented | [E: fact; high; repo:BUILD_STATUS.md; 2026-11-12] |
| Analytics, ads, accounts | none | [E: fact; high; repo:README.md:3; 2026-11-17] |

## 7. Business model

Not yet monetised. Plan is ads (AdSense) on content pages only, never on tool pages, with a consent tool for EEA/UK/CH; no analytics at launch. [E: fact; medium; repo:BLOCKERS.md; 2026-11-12] Privacy page says ads are possible in future and the policy would be updated first. [E: fact; high; repo:src/pages/privacy.astro:77; 2026-11-17] Kill criteria: ≥5K organic visits/mo at day 120, ≥20K Search Console impressions/mo on KB pages at day 60. [E: fact; medium; repo:BLOCKERS.md; 2026-11-12] Revenue expectations, pricing, any paid tier: unknown. [E: unknown; high; n/a; 2026-11-17]

### Owner direction (confirmed 2026-11-17)
- Goal: ad revenue. [E: fact; high; user:chat answer 2026-11-17; 2026-11-17]
- Scope: PDF/document tools, bulk, HEIC, other languages may be considered. [E: fact; high; user:chat answer 2026-11-17; 2026-11-17]
- Constraint: no backend server to manage; features should run client-side (static hosting, no server processing). [E: fact; high; user:chat answer 2026-11-17; 2026-11-17]
- Strategy: use sizetune.com (and subdomains) for many tools, not only image/signature resizing. [E: fact; high; user:chat answer 2026-11-17; 2026-11-17]
- Geography: no preference. [E: fact; high; user:chat answer 2026-11-17; 2026-11-17]
- Tools need not stay ad-free; analytics and accounts are also not ruled out (owner answered "No" to keeping tools ad-free, without analytics and without accounts). Accounts must still fit the no-backend constraint. [E: fact; high; user:chat answer 2026-11-17; 2026-11-17]
- Branding: new tools may share the SizeTune brand or get their own, as suitable. [E: fact; high; user:chat answer 2026-11-17; 2026-11-17]
- Traffic: none yet; the site launched on 2026-11-17, so there is no Search Console, traffic or AdSense data. [E: fact; high; user:chat answer 2026-11-17; 2026-11-17]

## 8. Technical overview

- **Stack:** Astro 7 static output, Preact 11 (compat) islands, Tailwind v4, MDX, TypeScript 6, pnpm 11, Node 24. [E: fact; high; repo:package.json; 2026-11-17]
- **Architecture:** no server code; engine in `src/lib/engine` (~2.2K lines) runs in a Web Worker with main-thread fallback; tool UI in `src/components/tool`. [E: fact; high; repo:src/lib/engine; 2026-11-17]
- **Integrations:** none at runtime (no third-party origins, self-hosted Geist font). Cloudflare for hosting/DNS; Google Search Console via DNS record. [E: fact; high; repo:scripts/verify-privacy.mjs; 2026-11-17]
- **Deployment / operations:** Cloudflare Workers static assets; sizetune.com is live in production with Search Console enabled; staging on workers.dev; GitHub remote `sourav-ojha/sizetune`; CI with Chrome/Firefox/WebKit. [E: fact; high; user:chat answer 2026-11-17; 2026-11-17] Production release date, traffic and indexing state are not known. [E: unknown; high; n/a; 2026-11-17]
- **Tests:** ~687 unit, ~198 Chrome e2e (562 across three browsers) as of 2026-11-14. [E: fact; medium; repo:BUILD_STATUS.md; 2026-11-14]

## 9. Known limitations

- Real phones untested (iOS memory/canvas limits, low-RAM Android, in-app browsers). [E: fact; high; repo:BLOCKERS.md; 2026-11-12]
- 20 KB output quality on real portraits unreviewed by a human; quality pinned ≈q60 with pixel shrink; WebP slower. [E: fact; high; repo:BLOCKERS.md; 2026-11-12]
- Safari encoder sizes 1–7× Chrome; sources >100 MP refused, 16 MP output cap, >36 MP no preview. [E: fact; high; repo:BLOCKERS.md; 2026-11-12]
- Signature tool: no live crop preview, no pinch zoom; touch handle size on short crops unverified. [E: fact; high; repo:BLOCKERS.md; 2026-11-14]
- Only one guide and two tool pages; no per-preset pages beyond 20 KB. [E: fact; high; repo:src/pages; 2026-11-17]
- HTTPS redirect/HSTS not configured at last audit. [E: fact; medium; repo:BLOCKERS.md; 2026-11-14]
- Documentation drift: README/BUILD_STATUS still say "not deployed, no remote", while later commits and BLOCKERS record staging deploy and a GitHub remote. [E: fact; high; repo:README.md:3; 2026-11-17]

## 10. Assumptions and unanswered questions

### Assumptions
- Existing public statements (privacy page: tools "meant to stay free of ads"; "Nothing is uploaded" trust copy) conflict with the owner allowing ads/analytics on tools; opportunities that change them need privacy/terms updates and weigh the privacy-first value proposition. [E: inference; medium; repo:src/pages/privacy.astro; 2026-11-17]
- Growth is expected from organic search on "resize image to N KB" style queries. [E: assumption; medium; repo:SEO_ARCHITECTURE.md; 2026-11-17]

### Unanswered questions for the user
1. (Answered: launched 2026-11-17, no traffic data yet; research must rely on external evidence.)
2. (Still open, not blocking) Are the N1 kill criteria (≥5K organic visits/mo at day 120; ≥20K impressions/mo at day 60) still the bar?
3. (Answered: geography does not matter.)
4. (Answered: PDF/document tools, bulk, HEIC, other languages may be considered.)
5. (Answered: no backend server; most features client-side. Tools need not stay ad-free; analytics and accounts not ruled out.)
6. (Answered: SizeTune is one portfolio item, but the owner wants to maximise sizetune.com and may add many tools on it or on subdomains.) (Branding answered: shared or separate, as suitable.)

### Conflicting evidence
- "Not deployed, no remote" (README.md, BUILD_STATUS.md) vs production live (user). Resolved by owner: production is live; README and BUILD_STATUS are stale. [E: fact; high; user:chat answer 2026-11-17; 2026-11-17]
- BLOCKERS lists 4 open legal `[[HUMAN]]` markers vs recent commits "re-verify and revise privacy policy and terms (16 Nov 2026)". Believed: legal text updated since BLOCKERS was written; marker state not re-verified here. [E: inference; medium; repo:CHANGELOG.md; 2026-11-16]

## 11. Evidence and confidence

| Area | Confidence | Basis |
|---|---|---|
| Purpose and audience | Medium | Strong product copy; demand/audience data not in repo [E: fact; high; repo:src/pages; 2026-11-17] |
| Capabilities | High | Code, tests and verification docs agree [E: fact; high; repo:BUILD_STATUS.md; 2026-11-17] |
| Business model | Low | Plan notes only; no live revenue or traffic data [E: unknown; high; n/a; 2026-11-17] |
| Technical overview | High | package.json, wrangler.jsonc, source inspected [E: fact; high; repo:package.json; 2026-11-17] |

Repository inspected at: 607a648 on 2026-11-17. Agents used: none — single-agent investigation (repository read-only, no web research at init).

## Revision History

| Revision | Date | By | Action | Note |
|---|---|---|---|---|
| 0 | 2026-11-17 | product-intelligence | reviewed | Initial draft |
| 1 | 2026-11-17 | product-intelligence | reviewed | Applied owner answers (prod live, ad revenue goal, client-side only, broader scope); awaiting confirmation |
| 2 | 2026-11-17 | product-intelligence | reviewed | Applied ads/analytics/accounts, branding and no-traffic answers; awaiting confirmation |
| 3 | 2026-11-17 | sourav | approved | User: "Yes, approve it" (confirming revision 2) |
