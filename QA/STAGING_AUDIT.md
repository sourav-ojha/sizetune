# Staging product audit (2026-11-13)

Scope: https://sizetune-staging.subhamojha9.workers.dev/ (built from `4e46c1b`, the redesign; staging itself still serves the *older* design until CI deploys, see `BLOCKERS.md` H5) compared with the local build. Nothing was deployed or pushed in this sprint. Method: three independent read-only reviewers (privacy/security, SEO, UX/a11y) plus the lead's engine/code review; an independent code reviewer inspected the final diff. Detail: `UX_AND_ACCESSIBILITY.md`, `COMPRESSION_WORKFLOW.md`, `PRIVACY_SECURITY_AUDIT.md`, `SEO_AUDIT.md`.

## Environment and exact commands
- Chrome 157.0.8103.52 (system, Playwright `channel: chrome`), Playwright 1.65.0; Firefox 159 / Playwright WebKit 27.2 from the previous sprint (`PW_ALL_BROWSERS=1`). Real Safari / real phones: **not tested** (deferred by owner).
- `pnpm run verify` (check, build, 676 unit, verify:html, strict, privacy, 196 Chrome e2e): **exit 0** after the changes below.
- Evidence capture: Playwright scripts against `astro preview`; `curl -sS -D -` against staging; 72 screenshots in `QA/screenshots/` (JPEG, 700 px wide): 8 routes × widths 320/375/390/768/1024/1440 plus tool states at 375.

## Routes reviewed
`/`, `/resize-image-to-20kb/`, `/resize-signature/`, `/guides/photo-size-for-online-forms/`, `/about/`, `/privacy/`, `/terms/`, and a nonexistent URL (real 404). No horizontal overflow at any of the 6 widths, zero console errors, zero failed requests, CLS <= 0.03, LCP < 100 ms locally, JS transfer 108-117 KB uncompressed per tool page, CSS 36 KB. axe-core: 0 violations on all routes and 7 tool states.

## Findings by severity (all verified)
| Sev | Finding | Status |
|--|--|--|
| High | Owner markers (legal review, governing law, Search Console sentence) are still visible on `/privacy/` and `/terms/` | **Open, human** (BLOCKERS H1/H4). Not guessed. |
| High | Production domain sizetune.com does not resolve yet, so canonicals/OG image/sitemap point at nothing | **Open, human** (domain/DNS is out of scope) |
| High | Signature crop editor lacked zoom, aspect presets and a margin control; the page text implied "positioning" | **Fixed** `3220309` |
| Med | Wording inaccurate: quality-first "dimensions stay as they are"; "highest quality that fits"; WebP offered on signature page (it is not); 19.5 KB shown as typical (it is a ceiling); 1000/1024 guarantee has an exception | **Fixed** `c8ec1ea` |
| Med | Privacy cookie/storage sentence silent on hosting-layer cookies, NEL reporting and which storage APIs are unused | **Fixed** `c8ec1ea` (wording); evidence in `PRIVACY_SECURITY_AUDIT.md` |
| Med | Header/footer links 20-32 px tall (touch/target-size) | **Fixed** `3220309` (44 px) |
| Med | Signature: output-size fieldset before the max-size picker (tab/visual order contradicts the guidance "leave blank") | **Fixed** (moved below the size picker) |
| Med | Result compare had no zoom | **Fixed** (Fit / 2x / 4x scrollable frame) |
| Med | Signature has no live crop preview (only after Resize) and no two-finger pinch | **Open** (zoom slider added; pinch and live preview are a follow-up) |
| Low | Worker script response carried no CSP header | **Fixed** (`connect-src 'none'` via `_headers`) |
| Low | HSTS not sent (workers.dev is preloaded; custom domain not) | **Open, human** after domain is live (BLOCKERS H13) |
| Low | 307 (not 301) trailing-slash redirects | Accepted (B14); canonicals cover it |
| Low | Focus stays on body after file pick (status region announces file info) | Open, low |
| Info | OG image is plain; per-page variants absent | Draft recommendation in `SEO_AUDIT.md`; **not** replaced (needs approval, H9) |

## Preserved constraints (checked)
Astro static, Preact islands, Workers static assets, browser-local processing, ad-free tool pages, no analytics, no third-party origins (verify:privacy OK), no FAQPage JSON-LD, no backend/accounts/uploads, no PDF scope creep, no padding.

## Remaining technical risks
Real iPhone/Android memory and canvas limits untested; 24 and 48 MP not individually exercised (12, 36 and an 81 MP header-accept case are); Safari encoder sizes differ from Chrome; compare zoom is bounded by the 1024 px preview, not the full-resolution image; staging shows the old design until the next green CI deploy.
