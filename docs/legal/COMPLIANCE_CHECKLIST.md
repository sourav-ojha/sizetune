# Compliance checklist: Privacy Policy and Terms of Use

Date: 2026-11-13; revised 2026-11-16. Branch: `legal/privacy-terms-audit`. Not legal advice. Sources: [LEGAL_REVIEW.md](LEGAL_REVIEW.md), [TECHNICAL_PRIVACY_AUDIT.md](TECHNICAL_PRIVACY_AUDIT.md), [COMPETITOR_RESEARCH.md](COMPETITOR_RESEARCH.md).

## Status in one line
The deployed text contains no placeholders and no claim that a lawyer reviewed it. It is **not represented as legally reviewed**; the owner-input items below are still open, and an Indian lawyer's review before go-live is recommended (the owner has said they will arrange it).

## Decisions made without the owner (assumptions)
| # | Decision | Reason | Owner can change by |
|---|---|---|---|
| A1 | Operator named as "Sourav, an independent developer based in India" | Already public on the about page, supplied earlier by the owner | Editing the three pages |
| A2 | Governing law: laws of India; courts in India with jurisdiction under applicable law; **no city** | Conventional for an Indian operator; the city is the owner's choice | Adding a city to `terms.astro` |
| A3 | No liability cap figure; the clause excludes loss from using the site (including indirect loss) "to the extent the law allows", with carve-outs for fraud, deliberate wrongdoing and non-excludable liability. A modest cap would be less exposed to an unconscionability challenge | A figure is a business decision | Adding a cap |
| A4 | Grievance contact is hello@sizetune.com, handled by Sourav; target to resolve within one month (and within any time the law allows) | The reviewer reads SPDI r.5(9) as one month (not read from the primary text); DPDP Rule 14(3) maximum is 90 days | Changing the period |
| A5 | Email retention: "as long as needed or the law requires", no period | Owner has not set one; DPDP Rule 8(3) may require 1 year from 13 May 2027 | Setting a period |
| A6 | Cloudflare retention not stated; "may keep records under its own policies" | No verified period exists (see technical audit) | After checking the dashboard |
| A7 | Search Console described as "may use in future", not as in use | Not set up yet (BLOCKERS H13) | Update after DNS TXT verification |
| A8 | Advertising described as possible future, tool pages meant to stay ad-free | AdSense not integrated | Update before ads go live |
| A9 | Under-18 users: a parent or guardian must agree to the terms and supervise use | A minor's contract is void (Indian Contract Act s.11); making the guardian the contracting party is the conservative drafting | Counsel's view |
| A10 | Tool-page notice: links open in a new tab so a result is not lost; the notice says SizeTune stores nothing and closing the tab clears it | A browser back/forward cache could restore a page; "keeps nothing after you leave" was too absolute | Adding `pagehide` cleanup |
| A11 | Privacy page says tools are "meant to stay free of ads" | Project rule; it limits where AdSense can go (home page is the tool) | Rewording if the ad plan changes |
| A12 | Local-test wording: "on a local copy" for no-upload and no-cookie claims | The audit did not test the live Cloudflare edge | Re-test on production after go-live, then reword |

## Owner-input dependencies (still open)
1. Confirm the legal name to publish (or keep the trade-name form) and whether a postal address should be shown.
2. Choose the court city and whether to have arbitration (optional).
3. Cloudflare dashboard facts: Workers Logs / observability on or off, Logpush, Web Analytics, Bot Fight Mode cookie `__cf_bm`, NEL, plan tier, DPA accepted. Consider setting `observability.enabled=false` in `wrangler.jsonc` (not done here: infra change).
4. Email provider for hello@sizetune.com, retention, forwarding.
5. Decide whether SizeTune will earn money (AdSense). This drives SPDI/"body corporate" and CERT-In treatment.
6. Appoint a CERT-In point of contact and incident owner if run commercially (6-hour reporting).
7. Whether a postal address must be published (reviewer's reading of SPDI r.5(3)(d); not verified against primary text) and whether the grievance contact must be a full legal name rather than "Sourav" (technical reviewer M2, legal reviewer #3).
8. Lawyer review (Indian counsel) of both pages, the under-18 wording and the liability clause.

## Law status as of 2026-11-13 (see LEGAL_REVIEW.md for sources)
- DPDP Act: Board and definitions in force; **ss.3–17 and Rules 3, 5–16 from 13 May 2027** (not yet in force).
- IT Act s.43A and SPDI Rules 2011 apply until 13 May 2027 (s.44(2) then repeals s.43A). A privacy policy and grievance contact are published now as the conservative course.
- Consumer Protection Act 2019 likely does not apply to a free service (s.2(42)); the terms still avoid excluding non-waivable rights.
- IT Intermediary Rules 2021: SizeTune stores and transmits nothing for users, so probably not an intermediary.
- No Indian cookie-consent statute found. GDPR/UK GDPR not assumed to apply today.

## Advertising readiness (not enabled)
Before AdSense goes live:
- [ ] Update the privacy policy: Google and vendor cookies, what they collect, how to opt out, vendor list, AdSense-required statements.
- [ ] Certified consent management platform for EEA, UK and Switzerland visitors (Google requirement for personalised ads).
- [ ] Decide non-personalised ads for India, since DPDP s.9(3) (from 13 May 2027) bans targeted ads to children and many users are exam applicants.
- [ ] Keep tool pages ad-free (project rule); loosen the CSP only for ad pages.
- [ ] Update `verify-privacy` expectations and the "no advertising" wording across the site.
- [ ] Resolve the commercial-operation questions above.

## Acceptance criteria
- [x] Repository and architecture audit completed (technical audit)
- [x] Browser processing verified (network capture, no upload)
- [x] Cloudflare config examined; unknowns recorded, not claimed
- [x] Third parties identified (none in site code)
- [x] Indian legal research done; commencement dates cited to the Gazette
- [x] Competitor comparison done
- [x] Privacy policy and terms revised in the real pages
- [x] No placeholders or editorial notes in deployed text
- [x] No invented legal or technical claims (see assumptions above)
- [x] Independent Opus legal review passed (round 2; text only, owner items open)
- [x] Independent Sonnet technical review passed (round 2)
- [x] Build, lint and tests pass (local verify; CI cross-browser pending)
- [ ] Staging validated after deploy (staging build was stale on 2026-11-16; redeploy after merge)
- [ ] Lawyer review (owner)

## Review log
**Round 1 (2026-11-13).** Sonnet technical: no Critical/High; M1 tool-notice links left the page (fixed: new tab), M2 pseudonym (owner item), L1/L2 filename and EXIF wording (fixed), L3 edge analytics unverifiable (disclosed, owner to check dashboard), L5 link styling (fixed). Opus legal: FAIL with 7 required fixes, all applied: ads-for-children promise removed, entire-agreement clause no longer pulls in the privacy policy, Cloudflare statistics/logs disclosed, one-month grievance target stated, under-18 wording rewritten, "tested locally" wording, "keeps nothing" reworded, liability second sentence deleted. Low items 10-14 addressed; 15-16 noted.
**Round 2 (2026-11-13).** Opus legal: all 8 round-1 fixes PASS; no Critical/High; M1 (Cloudflare retention is partly in the owner's control) and L1-L4 wording applied. Sonnet technical: 0 Critical/High; axe 0 violations on /, /resize-signature/, /privacy/, /terms/; no overflow at 320-1440; no console errors, cookies or storage; all internal links 200; applied: spacing above notice links, "nothing is uploaded" in Dropzone/error copy aligned to "the site's code does not upload it", "currently" in the meta description. Remaining Low: privacy page filename sentence omits extension/truncation detail (acceptable).
**Gate:** `CI=1 pnpm run verify` exit 0 (677 unit, 198 Chrome e2e). Firefox/WebKit run in CI after push.
**Not yet done:** staging validation (needs push and deploy), lawyer review, owner items above.

## Revision 2026-11-16
Changes: pages re-dated 16 Nov 2026; privacy page adds a "Which laws apply" section (DPDP core duties start 13 May 2027) and discloses Cloudflare-injected network error reporting headers (observed on staging); terms add a no-waiver sentence. Corrections to legal labels recorded in LEGAL_REVIEW.md (CERT-In and SPDI are conditional on commercial operation; no postal address requirement found). Owner item 7 is narrowed: a name or role plus email suffices; address optional.
Open owner items unchanged: legal name/trade name, court city, Cloudflare dashboard facts, email provider and retention, AdSense decision (drives body-corporate, CERT-In and consent-tool needs), CERT-In contact, counsel review. Re-check egazette.gov.in for any change to the 13 May 2027 date before launch.

### Opus legal review 2026-11-16: dispositions
Fixed: M1 DPDP wording (individuals covered), M4 children clause, M5 NEL wording (not staging-only), L1 "never" wording, L2 retention carve-out, L4 Board route timing, L7 LEGAL_REVIEW staleness.
Deferred to owner (not invented): M2 fallback liability cap figure (reviewer suggests a modest cap; business decision); M3 full legal name for grievance contact (SPDI r.5(9) matters only if a "body corporate", i.e. once monetised); L3 email provider; L5 court city; L6 Cloudflare retention (owner dashboard); L8 minors' contract wording (counsel).
**H1 (blocking before AdSense):** these sentences become false when ads run and must change in the same release: privacy "no advertising and no analytics scripts", "sets no cookies and writes nothing to storage", "We do not use this information to identify, profile...", "share it only with the service providers" (Google is a separate party), index.astro "loads no advertising or analytics scripts" (true only if tool pages stay ad-free). Add: AdSense required vendor/cookie/opt-out wording, certified TCF consent tool for EEA/UK/CH, non-personalised ads for under-18 audience from 13 May 2027.
