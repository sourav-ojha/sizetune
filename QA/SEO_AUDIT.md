# SEO audit (2026-11-13)

Independent reviewer: curl on staging and parse of `dist/` for all 7 routes plus 404 and no-slash variants.

## Per route (all pass)
One H1; unique title (23-59 chars) and description (146-160); canonical `https://sizetune.com/...` (no workers.dev anywhere in `dist/`); OG/Twitter tags; OG image 1200x630 PNG; JSON-LD valid and matching visible content (WebApplication on the 3 tool pages, Article on the guide, none elsewhere); **no FAQPage**; all internal links resolve with trailing slashes; no orphans. `sitemap-0.xml` lists the 7 routes, not the 404, no staging host; `robots.txt` Allow + sitemap on sizetune.com; 404 is a real HTTP 404, `noindex`; no-slash URLs 307 to slash URLs. Staging sends `X-Robots-Tag: noindex` on every response (verified with `curl -sI`); production would not (rule is workers.dev only; verify after launch with `curl -sI https://sizetune.com/ | grep -i x-robots` which must print nothing).

Duplicate content: 6-word-shingle overlap between tool pages 0.5-4.6%; no thin pages (1,029-1,614 words).

## Fixed (`c8ec1ea`)
Quality-first wording, "highest quality" -> "a high quality", signature page no longer claims WebP, 19.5 KB described as a ceiling, 1000/1024 exception stated, PNG->JPEG exception stated first, signature copy describes zoom/shape/margin.

## Open
- sizetune.com does not resolve yet (domain step is the owner's). Until then OG/canonical targets 404.
- Privacy/terms legal markers (SEO-neutral but launch-blocking).
- 307 vs 301 (accepted); consider a guides index later.
- Same 1000/1024 sentence appears on three pages (low duplication; vary or link to the guide later).

## Open Graph image - draft recommendation only (nothing generated or published)
Current `public/og-default.png`: legible but text-only, empty right half, brand teal unused, same card for every page. Recommend: logo mark beside the wordmark; right half = before/after graphic ("3.2 MB" struck through -> "19.5 KB"); headline "Resize any image to a size in KB"; "Processed in your browser" at >= 36 px; keep 60 px safe margins; optional per-page variants (20 KB card, signature card). Needs owner approval before replacing (BLOCKERS H9).
