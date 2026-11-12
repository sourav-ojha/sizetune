# SizeTune.com Tech Stack Comparison

Date: 2026-11-12. Scope: static-first SEO site with browser-only image resize/compress tools, solo dev, Cloudflare, built by AI agents.

## How to read this document

- **[V:Sn]** = VERIFIED against official source Sn (see "Sources & access dates"; all accessed 2026-11-12).
- **[A]** = ASSUMPTION or inference (not directly confirmed in an official page I read). Treat as hypotheses to test in a spike.
- Nothing here was **measured** by me. No builds, bundle sizes or Lighthouse runs were done. Every performance statement is a vendor CLAIM or an assumption. Section 4 lists the spike needed to replace claims with measurements.
- Caveat on method: the web pages were read through a summarising fetch tool, not raw HTML. The Cloudflare pages in the local evidence folder were read raw. For any decision-critical sentence, re-read the source.

## 1. Verified versions (npm registry, `npm view <pkg> version time.modified`) [V:S1]

| Package | latest | time.modified | Node engine | Notes |
|---|---|---|---|---|
| astro | 7.4.11 | 2026-11-11 | >=22.23.4 | 7.0.0 released 2026-06-22; 6.0.0 on 2026-03-10; 5.0.0 on 2024-12-03 |
| @astrojs/react | 7.1.8 | 2026-11-11 | n/a | |
| @astrojs/mdx / sitemap | 8.1.5 / 3.7.4 | n/a | >=22.23.4 (mdx) | |
| @astrojs/cloudflare | 14.4.7 | 2026-11-10 | n/a | only needed for SSR/on-demand |
| next | 16.4.6 | 2026-11-11 | >=20.9.0 | peer react ^18.2 or ^19 |
| @opennextjs/cloudflare | 1.20.16 | 2026-11-03 | n/a | peer next `>=15.5.29 <16 \|\| >=16.4.5`; created 2024-09-20 |
| vinext | 1.4.5 | 2026-11-10 | >=22 | 1.0.0 on 2026-09-28; first publish 2026-02-16; peers vite ^8, react ^19.3.1 |
| @vinext/cloudflare | 1.3.4 | n/a | >=22 | deploy tool used in CF guide |
| react-router / @react-router/dev | 8.5.1 | 2026-10-27 | >=22.22.0 | 8.0.0 on 2026-06-17; 7.0.0 on 2024-11-22; peer react >=19.2.7 |
| @tanstack/react-start | 1.169.5 | 2026-11-08 | >=22.12.0 | peer vite >=8; very high release cadence (169 minors) |
| @sveltejs/kit | 3.2.0 | 2026-11-10 | >=22.17 | 3.0.0 on 2026-10-01 (6 weeks old); 2.0.0 on 2023-12-14; peer vite ^8.0.12 |
| @sveltejs/adapter-static | 4.0.1 | 2026-11-05 | n/a | |
| @sveltejs/adapter-cloudflare | 8.0.2 | 2026-11-05 | n/a | |
| vite | 8.3.8 | 2026-11-11 | n/a | |
| vite-react-ssg | 0.9.2 | 2026-07-15 | n/a | pre-1.0; peers vite ^6.4/^7.3/^8, react 17/18/19 |
| vite-ssg (Vue, for reference) | 28.3.0 | 2026-02-05 | n/a | not React; ignore |
| react | 19.3.1 | 2026-11-11 | n/a | |
| tailwindcss | 4.3.5 | 2026-11-11 | n/a | |
| wrangler | 4.160.1 | 2026-11-11 | n/a | |

Cross-cutting observations [V:S1]:
- Every candidate except Next.js now requires Node 22+ (Astro >=22.23.4 is the strictest). Pin the Node version in the Cloudflare build env and `.nvmrc`/`engines`. Whether Cloudflare's build image defaults to that Node is [A]; set `NODE_VERSION` explicitly.
- All Vite-based candidates are on Vite 8. Astro 7 itself moved to Vite 8 [V:S23].
- Release cadence is fast everywhere: Astro had 3 majors in 18 months (5.0 Dec 2024, 6.0 Mar 2026, 7.0 Jun 2026); React Router had 7.0 then 8.0 seven months apart; SvelteKit 3.0 landed 6 weeks ago. Plan for roughly one major upgrade per 4-6 months on any of them. Pin versions, upgrade deliberately.

## 2. Cloudflare platform facts (apply to every option)

### Workers (static assets) vs Pages
- Cloudflare's Pages framework-guides index opens with "Are you sure you want to use Pages?" and says "Workers supports most Pages use cases and offers a broader feature set ... It is Cloudflare's primary platform for building applications. Start new projects with Workers." [V:S5, last updated Aug 21, 2026]
- Astro's own Cloudflare deploy page: "Cloudflare recommends using Cloudflare Workers for new projects." [V:S22]
- The Pages-to-Workers migration guide says Workers has "a distinctly broader set of features" (Durable Objects, Cron Triggers, fuller observability), that static asset requests are free on both, and that Pages Functions are billed at Workers rates [V:S6, updated Oct 12, 2026].
- I found no end-of-life or deprecation date for Pages in any page I read. "Pages is deprecated" would be an overstatement; "Pages is de-emphasised, Workers is the recommended default for new projects" is what the docs say. Any future Pages sunset notice is [A: unknown].
- Static assets on Workers: requests to static assets are free and unlimited; no extra storage cost; Worker invocations (SSR, `run_worker_first`) are billed [V:S12]. Static-only site = no Worker code, no `main` field [V:S7].
- Limits (Workers static assets): Free 20,000 files, Paid 100,000 files, 25 MiB per file [V:S14]. Pages: Free 20,000 files, Paid 100,000, 25 MiB per file [V:S13]. Same ceiling. An SEO site with programmatic pages (e.g. size-preset x format pages) can hit 20k files; count HTML + assets.
- Gotchas on Workers: custom 404 page needs `assets.not_found_handling = "404-page"` [V:S22]; Range requests on assets return full 200, not 206 (matters for video only) [V:S12]; free-tier `run_worker_first` routes can 429 when quota is exceeded [V:S12].
- Headers and redirects: Workers static assets support `_headers` and `_redirects` files (doc pages exist in evidence folder: `workers_static-assets_headers.md`, `..._redirects.md`) [V:S-local]. HTML handling (trailing slash behaviour) is configurable (`routing/advanced/html-handling`) [V:S-local].
- What it means for SizeTune: use a Worker project with `wrangler.jsonc` containing `name`, `compatibility_date`, `assets.directory = ./dist`, deploy with `wrangler deploy` or Workers Builds (git-connected CI/CD) [V:S7, S22]. Zero adapter, zero Worker code. This is framework-agnostic for any static output. Cost impact: $0 for static asset traffic on either platform [V:S12, S6]. Do not start on Pages.
- Static-only constraint: Astro's CF guide notes bindings (KV/D1) are unavailable on a purely static site [V:S7]. SizeTune's browser-only design does not need them.

### Next.js on Cloudflare: vinext vs OpenNext vs static export
- CF's Next.js guide (last updated Nov 5, 2026) says: "Cloudflare recommends vinext as the default way to run Next.js applications on Cloudflare Workers." It also says "vinext is in beta. Before adopting it for an existing production application, run the compatibility check ..." [V:S2].
- CF's OpenNext page (updated Oct 12, 2026): "Cloudflare recommends vinext instead of OpenNext for new Next.js applications on Cloudflare Workers." OpenNext is not called deprecated; it is for maintaining existing apps; "Migrate to vinext when compatibility allows"; Wrangler auto-config now uses vinext, so OpenNext needs manual setup [V:S3, via summariser].
- CF's Next.js guide lists remaining paths: OpenNext (existing apps blocked by a vinext gap) and "Static Next.js on Pages" (static export deployed to Pages) [V:S2]. The Pages static guide (updated Aug 25, 2026) uses `next build` -> `out` dir with the "Next.js (Static HTML Export)" preset and itself points to vinext for Workers [V:S4].
- What vinext is: a Vite plugin that reimplements the Next.js API surface (not Next itself); MIT; ~9.4k GitHub stars; targets Next 16.x; "under active development", usable in production "with caution", not widely production-tested; Cache Components / PPR incomplete; build-time image and font optimisation not fully reproduced; core written largely with AI ("rebuilt Next.js with AI in one week") with human + agent review [V:S15].
- Maturity conflict worth noting: npm shows vinext 1.0.0 stable since 2026-09-28 and 96 published versions in 9 months [V:S1], while CF docs and README still say beta / active development [V:S2, S15]. Compatibility dashboard (run of Nov 12, 2026): 96.2% overall pass, 99.7% of supported tests, against Next v16.2.6 tests, while npm Next is 16.4.6 [V:S16]. So vinext trails Next by two minors on its own dashboard.
- Key insight for SizeTune: vinext/OpenNext only matter when you need SSR/ISR/RSC server runtime on Workers. For `output: 'export'`, Next emits plain static files; any static host works and no adapter is needed [V:S17]. vinext also supports `output: "export"` [V:S2, S15] but adds a non-Next toolchain with no benefit for a static site. Whether Wrangler auto-config picks a sensible setup for a static-export Next project is [A].
- Static export limits [V:S17]: no ISR, no Server Actions, no cookies, no rewrites/redirects/headers in next.config (use CF `_headers`/`_redirects` instead), default image loader unsupported (needs custom loader; irrelevant for browser-only tools), dynamic routes need `generateStaticParams()`. Client components still prerender, so browser APIs need `useEffect` guards [V:S17].

## 3. Candidate-by-candidate analysis

Format: each item gives claims with tags. "CF" = Cloudflare.

### 3.1 Astro 7 + @astrojs/react (+ Tailwind, MDX content collections)
- **Version**: astro 7.4.11, @astrojs/react 7.1.8, @astrojs/mdx 8.1.5 [V:S1].
- **Static generation / SSR**: Static is the default: "Astro will pre-render all pages at build time by default" and no adapter is needed for CF static [V:S7]. On-demand rendering available via `@astrojs/cloudflare` adapter (`output: 'server'` by default with adapter; opt pages into `prerender = true`) [V:S7]. Per-route control: `export const prerender = true|false` [V:S7]. Route caching (`cache`, `routeRules`) went stable in 7.0 [V:S23].
- **Content / SEO**: Content collections with `glob()`/`file()` loaders, Zod-validated schemas, typed queries, MDX via `render()`, build-time caching of the data layer [V:S21]. Metadata is plain HTML in a layout `<head>`; no framework magic, and full control over canonical, JSON-LD, OG. Official `@astrojs/sitemap` exists (npm 3.7.4) [V:S1]. Astro-specific SEO helpers beyond that are [A].
- **Interactive components**: React/Preact/Svelte/Vue/Solid islands, mixable on one page; hydrate with `client:load|idle|visible` (and `client:only`) [V:S19]. Docs list a recipe for sharing state between islands (nav entry "Share state between islands") [V:S23-nav]; React context does not cross islands [A, inherent to islands]. `@astrojs/react` quirks: Astro-passed children arrive as plain strings unless `experimentalReactChildren: true` [V:S20]; React Compiler support is experimental (Oxc) [V:S20].
- **Client JS on a content page**: CLAIM: "stripping out all client-side JavaScript automatically"; only `client:*` components ship JS; islands hydrate in parallel/in isolation [V:S19]. NOT MEASURED by me. A pure MDX content page with no island should ship ~0 KB framework JS [A, follows from the claim; verify in spike].
- **CF compatibility**: First-class. CF's Astro guide (updated Nov 5, 2026) includes static and SSR paths and a "create a static blog and deploy" starter [V:S7]. Static = `assets.directory ./dist`. Astro joining Cloudflare as a company is something I recall from before my cutoff; not verified here [A].
- **Deployment complexity**: Lowest. `astro build && wrangler deploy` [V:S22].
- **Build performance**: Claim only: Astro 7 replaced the Go compiler with a Rust one, "faster, but ... stricter about invalid HTML"; queued rendering is now default "improved performance" [V:S23]. No benchmark verified. Experimental flags exist for incremental builds and parallel prerendering [V:S23-nav, A on maturity].
- **DX / breaking-change risk**: Astro 7 upgrade guide lists: Vite 8; Rust compiler (unclosed tags now error, invalid HTML not auto-corrected); new default Markdown processor (Sätteri) and `compressHTML: 'jsx'` whitespace default; `src/fetch.ts` reserved filename; `@astrojs/db` removed [V:S23]. Sätteri's compatibility with remark/rehype plugins is [A: unknown; check if you need plugins]. Agent-friendly: Astro docs ship a copyable "Using a coding agent? Upgrade my Astro project to v7" prompt [V:S23].
- **Ecosystem / maintenance risk**: Large ecosystem of integrations, CMS guides, deploy guides [V:S23-nav]. Risk is cadence of majors (3 in 18 months) [V:S1] and Node >=22.23.4 floor. Moderate.
- **Browser-only file processing**: Good fit. Tool UI = one React island (`client:load` or `client:visible`; `client:only="react"` if the island touches `window` at render). Vite worker imports (`new Worker(new URL('./w.ts', import.meta.url), {type:'module'})`) are Vite's recommended pattern [V:S36]; Astro 7 uses Vite 8 [V:S23] and docs say Vite imports (`?url`, `?raw`) and plugins work [V:S24]. That Astro's production bundling honours this worker pattern end-to-end is [A]; test it first.
- **Weakness**: Islands are separate React roots, so a site that grows into a multi-step app with shared state across routes will fight the model. Each tool page is mostly one island, which is fine.

### 3.2 Next.js 16 (static export; vinext/OpenNext only if SSR is needed)
- **Version**: next 16.4.6 [V:S1].
- **Static / SSR**: `output: 'export'` writes an HTML file per route to `out/`; Server Components run at build time; client components prerendered; route handlers can emit static files with `dynamic = 'force-static'` [V:S17]. SSR/ISR/Actions need a server runtime, i.e. vinext or OpenNext on Workers (see section 2). Per-route control exists in the App Router (static vs dynamic), but under export, everything must be static [V:S17].
- **SEO**: Best-in-class built-in Metadata API: `metadata` object, `generateMetadata`, file conventions for `sitemap.xml`, `robots.txt`, `opengraph-image`; prerendered pages resolve metadata at build time (no streaming) [V:S18]. MDX in Next requires `@next/mdx` [A: not fetched].
- **Interactive**: Full React, trivially. Client Components need `useEffect` guards for `window` during prerender [V:S17].
- **Client JS**: Claim: static export "can avoid loading unnecessary JavaScript code on the client-side" by splitting into per-route HTML [V:S17]. Reality: pages ship the Next client runtime plus React and an RSC payload for client navigation [V:S17: "static payload for client navigation"]. Not zero-JS by design; amount NOT MEASURED, expected well above Astro's no-island page [A].
- **CF compatibility**: Static export deploys to Workers static assets or Pages (`out` dir) [V:S4, S2]. CF's headline recommendation (vinext) is irrelevant for static. If SSR is later needed, you are choosing between a beta-labelled reimplementation (vinext) and OpenNext in maintenance posture [V:S2, S3, S15].
- **Deployment complexity**: Static: low. SSR on CF: high/uncertain.
- **Build performance / DX**: [A: Turbopack default builds; not verified]. DX is excellent and best documented; docs offer `llms.txt` for agents [V:S17 footer].
- **Maintenance risk**: Next itself is stable and heavily maintained [V:S1], but its centre of gravity (RSC, Cache Components, Vercel features) is not static sites, and CF's own path (vinext) trails Next by two minors on its dashboard [V:S16]. For a static-only site you carry framework weight you do not use.
- **Browser-only processing**: Fine (it is just React), but the framework's server-first mental model adds `'use client'` boundaries and prerender guards for every tool component.

### 3.3 React Router 8 framework mode (prerender / SPA mode)
- **Version**: 8.5.1; requires React >=19.2.7 and Node >=22.22 [V:S1].
- **Static / SSR**: `prerender: true | string[] | async fn | {paths, concurrency}` in `react-router.config.ts`. With `ssr: false` + `prerender`, deploys to a static file server with every matched route's loaders run at build; output `[url].html` plus `[url].data` per path into `build/client`; partial prerender emits `__spa-fallback.html` [V:S25]. With `ssr: true` you keep a runtime server for the rest [V:S25]. Per-route control: only through the global prerender list plus loaders; with `ssr: false` `action` and `headers` exports are prohibited [V:S25]. Pure SPA mode prerenders only the root route [V:S26].
- **SEO / metadata**: Route `meta`/`links` exports [A: not fetched this session]. No content-collection equivalent: MDX and content indexing are DIY (Vite plugin) [A].
- **Interactive**: Full React. Every page hydrates the whole route tree; no islands.
- **Client JS**: React + router runtime on every page. NOT MEASURED; no official low-JS claim [A].
- **CF compatibility**: CF guide (Nov 5, 2026) is built around SSR with the Cloudflare Vite plugin. It states "SPA mode is not currently supported when using the Cloudflare Vite plugin. Prerendering is supported in React Router v8." On v7, prerender needed >=7.13.1 plus an unstable flag [V:S8]. For a static site you could skip the CF plugin and upload `build/client` [A; consistent with S25].
- **Deployment complexity**: Medium (CF plugin vs plain static is a decision; SPA fallback/`_redirects` handling for partial prerender) [V:S25].
- **Maintenance risk**: Major cadence high (7.0 Nov 2024, 8.0 Jun 2026) and it requires brand-new React 19.2.7 [V:S1]. The Remix-to-RR merge means older tutorials/LLM training data are confusing [A]. Moderate.
- **Browser-only processing**: Good. SSR-safety required in root even for SPA mode, because root renders at build time [V:S26].

### 3.4 TanStack Start 1.x
- **Version**: 1.169.5 on npm; docs: "TanStack Start is stable" [V:S1, S28]. RSC support is experimental [V:S28]. Vite >=8 peer [V:S1].
- **Static / SSR**: SSR + streaming by default. `prerender` option in the `tanstackStart` plugin: auto-discovers static routes, `crawlLinks` (default true) follows links, `concurrency`, `filter`, `failOnError`, per-page overrides [V:S27]. Parameterised routes are only prerendered when linked and crawled, or listed explicitly [V:S27]. SPA mode ships a `/_shell.html`, and the docs themselves say it is "less SEO-friendly" [V:S29]. Per-route control: selective SSR (`ssr: false` per route) [V:S30]; per-route static vs SSR is expressed through prerender filter/pages [V:S27].
- **SEO**: `head()` route option for title/meta/links/OG/canonical/JSON-LD; built-in sitemap via prerender+`crawlLinks`; `robots.txt` in `public/` [V:S30]. No content-collection layer (MDX is DIY) [A].
- **Client JS**: Full React + TanStack Router on each page. No official low-JS claim [V:S28 states no bundle claims]. NOT MEASURED.
- **CF compatibility**: Dedicated CF guide (Nov 5, 2026) with a "Static prerendering" section that outputs static assets for Workers [V:S10]. Cloudflare Vite plugin integration with `viteEnvironment: { name: "ssr" }`; remove other adapters such as `nitro()` [V:S10].
- **Maintenance risk**: 1.x label but nearly 170 minor releases; the project is young in production terms [V:S1], and the static-site path (crawl-based) is less conventional than Astro/SvelteKit. Moderate-high.
- **Browser-only processing**: Good; type-safe routing is a real DX gain for a tools app. Overkill for a content-heavy SEO site.

### 3.5 SvelteKit 3 (adapter-static / prerender)
- **Version**: @sveltejs/kit 3.2.0 (3.0.0 only 2026-10-01), adapter-static 4.0.1; Node >=22.17; Vite ^8.0.12 [V:S1].
- **Static / SSR**: `adapter-static` with `export const prerender = true` in the root layout; `strict` build fails if a page is not prerendered; `fallback` SPA is discouraged (large performance and SEO costs); `trailingSlash: 'always'` yields `/a/index.html` for hosts that need it; `precompress` option [V:S31]. Per-route control is a strength: `prerender` (`true`/`false`/`'auto'`), `ssr`, `csr`, `trailingSlash`, `entries()` per page/layout, children override parents [V:S32].
- **Client JS**: Strongest official lever of any candidate: `csr = false` per page "does not ship any JavaScript to the client" (so legal/blog pages can be JS-free), at the cost of no progressive enhancement or client navigation there [V:S32]. Svelte compiles to small runtime code [A]; the intro page makes no byte claims [V:S33]. NOT MEASURED.
- **SEO**: `<svelte:head>` per page [A, not fetched]. No built-in content collections; MDX via community mdsvex [A, not official].
- **Interactive**: Svelte components, not React. If SizeTune standardises on React for tools (agent training data, libraries, shadcn-style components), this is a real cost. Svelte 5 can handle tool UIs fine [A].
- **CF compatibility**: CF's SvelteKit guide (Nov 5, 2026) is built around `@sveltejs/adapter-cloudflare` (Workers + assets) and tells you Wrangler auto-config runs `sv add`; it does not discuss adapter-static [V:S9]. adapter-static output served via `assets.directory` is [A, standard static assets behaviour].
- **Maintenance risk**: Low-moderate: v3 is fresh (6 weeks), so expect early patches; Svelte/Kit team is stable. I could not read the v3 migration guide (URL 404), so v3 breaking changes are unverified [A].
- **Browser-only processing**: Good (Vite workers apply; Kit uses Vite 8 [V:S1]).
- **AI-agent friendliness**: Good docs; fewer React-style examples in common agent training data [A].

### 3.6 React + Vite 8 with prerendering
- **Version**: vite 8.3.8, react 19.3.1; vite-react-ssg 0.9.2 (modified 2026-07-15) [V:S1].
- **Vite's own position**: SSR/prerender is "a low-level API for library and framework authors"; Vite recommends higher-level tools for full apps; pre-rendering is described as a pattern you implement with your own script, no built-in command [V:S35].
- **vite-react-ssg**: static-site generation with `getStaticPaths`, `<Head/>` (React Helmet), lazy routes, build-time loaders, `<ClientOnly/>`. But: the README tells React Router v7 users to use RR's built-in SSG, and commits only to maintain v6 support; React 19 is an unchecked roadmap item; TanStack Router support experimental; 240 stars, 10 open issues; single-author project [V:S34]. npm peers do list React 19 and Vite 8 [V:S1], so that README roadmap may be stale [A]. Verdict: single-maintainer pre-1.0 library on a legacy router; not a safe base for a long-lived revenue site.
- **Custom Vite SSR + prerender script**: Possible (client build + `vite build --ssr`, render known routes to HTML) [V:S35], but you own routing, head management, sitemap, content pipeline, hydration correctness: the opposite of "minimal maintenance by agents".
- **CF**: Static output deploys trivially; CF's React+Vite guide is SPA-oriented (`not_found_handling = single-page-application`), which is wrong for SEO pages [V:S11].
- **Client JS**: Full React hydration on every page. NOT MEASURED.

## 4. Spike to replace claims with measurements (recommended before locking in)
Build the same 3 pages (MDX article, tool page with a Worker-based resize, privacy page) in Astro, SvelteKit and one React option (TanStack Start or RR). Measure with `npm run build` timing, `dist/` size, transferred JS on the article page (DevTools / Lighthouse), and confirm a module Web Worker bundles and runs from a built page. This is the only way to settle the JS-overhead and build-speed rows. [A: no measurements exist yet.]

## 5. Comparison table (condensed)

| | Astro 7 | Next 16 (export) | RR 8 | TanStack Start | SvelteKit 3 | Vite + SSG |
|---|---|---|---|---|---|---|
| Static output | default | `output:'export'` | `prerender` + `ssr:false` | `prerender` (crawl) | adapter-static | lib/custom |
| SSR option | adapter | needs vinext/OpenNext | built-in | built-in | adapters | custom |
| Per-route control | `prerender` flag | limited under export | global list | filter/selective SSR | best (`prerender/ssr/csr`) | n/a |
| Head/SEO | plain HTML | Metadata API (best) | route exports [A] | `head()` | svelte:head [A] | Helmet |
| Content/MDX | collections (built-in) | `@next/mdx` [A] | DIY | DIY | mdsvex [A] | DIY |
| Content-page JS | claimed ~0 | React+runtime | React+router | React+router | claim 0 with `csr=false` | React |
| React interactivity | islands | native | native | native | no (Svelte) | native |
| CF doc status | first-class, static+SSR | vinext (beta) rec.; static on Pages/Workers | guide; SPA mode unsupported w/ CF plugin | guide w/ prerender section | guide (adapter-cloudflare) | React SPA guide |
| Deploy complexity | lowest | low static / high SSR | medium | medium | low-medium | medium-high |
| Main risk | major cadence, Rust compiler strictness | weight, CF path in flux | cadence, React 19.2.7 floor | young static story | v3 fresh, not React | unmaintained-risk lib |

## 6. Scored matrix

Scale 1-5 (5 best) per criterion. Weights sum to 100. Weighted score = sum(score x weight) / 5, giving 0-100. Scores are my judgment from the evidence above, not measurements.

| Criterion | Weight | Astro | Next export | RR 8 | TanStack | SvelteKit | Vite+SSG |
|---|---|---|---|---|---|---|---|
| SEO-first static HTML (content pipeline, metadata, per-route control) | 30 | 5 | 4 | 4 | 4 | 5 | 3 |
| Minimal JS on content pages | 25 | 5 | 2 | 3 | 3 | 4 | 2 |
| Cloudflare simplicity (static, doc status) | 20 | 5 | 4 | 3 | 4 | 4 | 4 |
| Maintenance / long-term risk | 15 | 4 | 3 | 3 | 3 | 4 | 2 |
| Interactivity (React tools, workers, state) | 10 | 4 | 5 | 5 | 5 | 3 | 5 |
| **Weighted total (0-100)** | 100 | **95** | **69** | **70** | **74** | **84** | **60** |

Arithmetic example (Astro): 5x30 + 5x25 + 5x20 + 4x15 + 4x10 = 475; 475/5 = 95.

Sensitivity: if interactivity weight rose to 30 and content-JS fell to 10 (a tools-first app), Astro still leads but TanStack/React options narrow the gap to within about 5-8 points [A: arithmetic on the table, not tested]. The ranking only flips if SizeTune becomes a heavy multi-route SPA.

## 7. Ranking

1. **Astro 7 + React islands + Tailwind + MDX collections (95).** Only candidate where static, zero-JS content pages, built-in content pipeline and CF static-assets deployment are all default behaviours, backed by CF's own guide. Conditional on spike confirming zero-JS content pages and Web Worker bundling.
2. **SvelteKit 3 + adapter-static (84).** Technically the best per-route rendering controls (`csr=false`) and small-runtime story. Loses mainly on non-React tool UI, DIY content/MDX, and v3 being six weeks old. The honest runner-up and the fallback if Astro's island model hurts.
3. **TanStack Start (74).** Best React DX and CF guide with prerender section. But heavy runtime on every content page and a crawl-based static story that is less conventional.
4. **React Router 8 prerender (70).** Solid prerender, but CF docs say SPA mode is unsupported with their Vite plugin, hydration of the full React tree on every page, and a fresh React 19.2.7 floor.
5. **Next.js 16 static export (69).** Best metadata API and ecosystem, but carries server-first machinery and a JS payload the site does not need; CF's strategic path is the beta vinext, which only matters for SSR.
6. **React + Vite + vite-react-ssg (60).** Single-maintainer pre-1.0 library on a legacy router; custom SSR prerendering means owning the whole SEO pipeline.

## 8. Rejected alternatives and reasons

- **Next.js + vinext on Workers**: solves a problem SizeTune does not have (SSR). Beta per CF docs, built largely with AI-assisted development, trails Next on its own compat dashboard (Next v16.2.6 vs 16.4.6 on npm) [V:S2, S15, S16, S1]. Revisit only if server rendering becomes necessary and the team wants to stay on Next APIs.
- **Next.js + OpenNext (@opennextjs/cloudflare)**: active (1.20.16, modified 2026-11-03) and not deprecated, but CF recommends vinext for new work and Wrangler auto-config no longer targets it [V:S1, S3]. Adds a Worker bundle and cost for nothing on a static site.
- **Pages as the host**: still works and is documented, but CF steers new projects to Workers [V:S5, S22]. No upside for SizeTune; identical file limits [V:S13, S14].
- **React Router SPA mode**: SEO-hostile and explicitly unsupported with CF's Vite plugin [V:S8, S26].
- **TanStack Start SPA mode**: docs call it less SEO-friendly [V:S29].
- **Plain SPA React + Vite**: client-rendered shell only; wrong for SEO-first content.
- **vite-react-ssg**: see 3.6.
- **Astro SSR adapter**: unnecessary; adding `@astrojs/cloudflare` makes `output: 'server'` the default [V:S7]. Stay static unless a feature needs a Worker.

## 9. Recommendation and guardrails for the chosen stack (Astro)

1. Static output only; Workers project with `assets.directory ./dist`, `not_found_handling: "404-page"`, `_headers` for caching/CSP [V:S22, S-local].
2. Pin Node >=22.23.4 in `.nvmrc` and CF build env (`NODE_VERSION`) [V:S1].
3. Tool UIs = one React island per page; use `client:visible` or `client:only="react"` and a Vite-style module Worker. Prove this in the spike first [A].
4. Keep the Astro 7 changes in mind in CI: Rust compiler errors on unclosed tags; Sätteri Markdown default; test MDX plugins early [V:S23].
5. Add a CI check on `dist/` file count (limit 20,000 on free) and per-file 25 MiB (relevant if bundling WASM codecs) [V:S14].
6. Re-evaluate SvelteKit only if the spike shows Astro's React-island ergonomics or JS output are worse than expected.

## Sources & access dates

All accessed 2026-11-12. "local" = copy in `/Users/sourav/workspace/personal/automated-niche-website-discovery/sizetune/docs/evidence-cloudflare-docs-2026-11-12/` read raw; others fetched via summarising tool (verify critical quotes).

- S1 npm registry: `npm view <pkg> version time.modified engines peerDependencies` and `npm view <pkg> time --json` for all packages listed in section 1.
- S2 CF Next.js guide (vinext), updated Nov 5, 2026: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/index.md (local: `workers_framework-guides_web-apps_nextjs.md`).
- S3 CF OpenNext guide, updated Oct 12, 2026: https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/index.md
- S4 CF Pages static Next.js, updated Aug 25, 2026: https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/index.md
- S5 CF Pages framework guides index, updated Aug 21, 2026: https://developers.cloudflare.com/pages/framework-guides/index.md (local: `pages_framework-guides.md`).
- S6 CF Migrate from Pages to Workers, updated Oct 12, 2026: https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/index.md (local).
- S7 CF Astro guide, updated Nov 5, 2026: https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/index.md (local).
- S8 CF React Router guide, updated Nov 5, 2026: https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/index.md (local).
- S9 CF SvelteKit guide, updated Nov 5, 2026: https://developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit/index.md (local).
- S10 CF TanStack Start guide, updated Nov 5, 2026: https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/index.md (local).
- S11 CF React + Vite guide, updated Sep 5, 2026: https://developers.cloudflare.com/workers/framework-guides/web-apps/react/index.md (local).
- S12 CF static assets billing & limitations, updated Nov 3, 2026: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/index.md (local).
- S13 CF Pages platform limits: https://developers.cloudflare.com/pages/platform/limits/index.md (local: `pages_platform_limits.md`).
- S14 CF Workers limits (static assets), updated Oct 29, 2026: https://developers.cloudflare.com/workers/platform/limits/index.md
- S15 vinext repository README: https://github.com/cloudflare/vinext
- S16 vinext compatibility dashboard: https://vinext.dev/compatibility
- S17 Next.js static exports (lastUpdated 2026-08-09): https://nextjs.org/docs/app/guides/static-exports
- S18 Next.js metadata and OG images (lastUpdated 2026-08-25): https://nextjs.org/docs/app/getting-started/metadata-and-og-images
- S19 Astro islands: https://docs.astro.build/en/concepts/islands/
- S20 Astro React integration: https://docs.astro.build/en/guides/integrations-guide/react/
- S21 Astro content collections: https://docs.astro.build/en/guides/content-collections/
- S22 Astro deploy to Cloudflare: https://docs.astro.build/en/guides/deploy/cloudflare/
- S23 Astro v7 upgrade guide: https://docs.astro.build/en/guides/upgrade-to/v7/ (local raw HTML: `astro_v7.html`; "S23-nav" = the docs sidebar in that file).
- S24 Astro imports reference: https://docs.astro.build/en/guides/imports/
- S25 React Router pre-rendering (docs version 8.5.1): https://reactrouter.com/how-to/pre-rendering
- S26 React Router SPA mode: https://reactrouter.com/how-to/spa
- S27 TanStack Start static prerendering: https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering
- S28 TanStack Start overview: https://tanstack.com/start/latest/docs/framework/react/overview
- S29 TanStack Start SPA mode: https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode
- S30 TanStack Start SEO: https://tanstack.com/start/latest/docs/framework/react/guide/seo
- S31 SvelteKit adapter-static: https://svelte.dev/docs/kit/adapter-static
- S32 SvelteKit page options: https://svelte.dev/docs/kit/page-options
- S33 SvelteKit introduction: https://svelte.dev/docs/kit/introduction (the v3 migration guide URL returned 404, so v3 breaking changes were not verified).
- S34 vite-react-ssg README: https://github.com/Daydreamer-riri/vite-react-ssg
- S35 Vite SSR guide: https://vite.dev/guide/ssr
- S36 Vite features (Web Workers): https://vite.dev/guide/features
- S-local: CF static assets headers/redirects/html-handling docs in the local evidence folder (`workers_static-assets_headers.md`, `workers_static-assets_redirects.md`, `workers_static-assets_routing_advanced_html-handling.md`), read 2026-11-12.

Not consulted / gaps: Astro Sätteri details, Next.js `@next/mdx`, Svelte `<svelte:head>`/mdsvex, React Router `meta` docs, Turbopack build claims, any Pages sunset notice, any independent benchmarks. All related statements are marked [A].
