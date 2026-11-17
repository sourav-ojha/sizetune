---
type: feature-spec
id: FEATURE-002
opportunity: OPP-004
status: ready
product_revision: 3
created: 2026-11-17
---
# Ad and consent foundation for content pages

## 1. Feature overview

Add AdSense-ready ad slots on content pages only (guides and landing-page text), a Google-certified consent tool for visitors in the EEA, UK and Switzerland, matching privacy and terms updates, and the CSP and verifier changes the ad origins need. Tool pages stay ad-free in this phase. The outcome is a policy-compliant route to the owner's ad-revenue goal.

## 2. Problem statement

The owner's goal is ad revenue, but the site has no ads, no consent tool, and a privacy policy that says the tools are meant to stay free of ads. [E: fact; high; repo:src/pages/privacy.astro; 2026-11-17]

## 3. Business justification

Objective: ad revenue. Competitors such as ResizePixel and imresizer show ads. [E: fact; medium; https://resizepixel.com/reduce-image-in-kb; 2026-11-17] With zero traffic today the payoff is nil until pages rank, so this should follow FEATURE-001 and real content. RPM for utility sites is unknown. [E: unknown; low; search:AdSense RPM by niche utility tools sites average RPM published data; 2026-11-17] Originating opportunity: OPP-004 (score 57, Consider, Medium confidence).

## 4. Target users and personas

- **Site owner** — wants revenue without losing the account to a policy breach.
- **Visitor in the EEA, UK or Switzerland** — must be asked for consent before personalised ads.
- **Tool user** — expects "Nothing is uploaded" to stay true on tool pages.

## 5. User stories

- As the site owner, I want ads only on content pages so that the file-handling tool pages stay free of third-party scripts.
- As an EEA visitor, I want a clear consent choice so that ads respect my privacy law rights.
- As the site owner, I want updated privacy and terms text so that disclosures match what the site does.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | Ad slots shall appear only on content pages (guides and landing text), not on any page that contains the file input. | [Approved] |
| FR-2 | A Google-certified consent management platform shall be shown to visitors in the EEA, UK and Switzerland before personalised ads load. | [Approved] |
| FR-3 | Privacy and terms pages shall be updated to describe ads, consent and third-party processing accurately. | [Approved] |
| FR-4 | The CSP and the verifier gates shall be changed to allow the ad and consent origins on ad-bearing pages only. | [Approved] |
| FR-5 | Ads shall not sit near buttons or download links that could cause accidental clicks. | [Approved] |
| FR-6 | Ads shall not appear on screens without substantial content. | [Approved] |
| FR-7 | Tool-page ads are excluded from this feature; a separate later decision is needed. | [Approved] |
| FR-8 | The consent tool shall be Google's own consent tool provided with AdSense (owner decision 2026-11-17); the implementer shall verify its current terms and cost before building and report any fee or restriction to the owner. | [Approved] |
| FR-9 | Ship the consent tool as a lazy, ad-pages-only script. | [Suggestion] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | Tool pages keep their first-load budget and zero third-party origins. | `verify:html` and `verify:privacy` pass for every page that has the file input. |
| NFR-2 | Ad scripts load only after consent where consent is required. | In an EEA-simulated session, no ad request fires before consent (network log). |
| NFR-3 | Accessibility holds with the consent dialog. | Axe specs pass; dialog is keyboard operable. |

## 8. User journeys and expected UX

Content page, non-EEA visitor: page renders, ad slot loads below a content block, away from any button. EEA/UK/CH visitor: consent dialog appears first; declining shows the page without personalised ads. Tool page: unchanged, no ad or consent script. Follow existing layout patterns in `src/layouts/Base.astro`.

## 9. Technical considerations

**Constraints from the existing system:** `verify:privacy` intentionally forbids third-party origins and ad identifiers in `dist`; it must be redesigned to scope the allowance to content pages. [E: fact; high; repo:scripts/verify-privacy.mjs; 2026-11-17] The SEO notes warn that a third-party script on a page with a file input could in principle read the selected file. [E: fact; high; repo:SEO_ARCHITECTURE.md; 2026-11-17] Hosting is Cloudflare static assets, so CSP is set through headers or config, not a server. [E: fact; high; repo:wrangler.jsonc; 2026-11-17]

**Suggested approach [Suggestion — implementer may choose otherwise]:** Mark each page type as `content` or `tool` in the layout; inject ad and consent code only for `content`. Make the verifier assert both sides: ad origins present on content pages, absent on tool pages.

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1, FR-7 | **Given** the built site **When** pages containing the file input are inspected **Then** none contains an ad slot, ad script or consent script. |
| AC-2 | FR-2 | **Given** a visitor simulated as in the EEA **When** a content page loads **Then** the consent dialog appears and no ad request is made until consent is given. |
| AC-3 | FR-3 | **Given** the built site **When** privacy and terms are read **Then** they describe ads, consent and third-party processing. |
| AC-4 | FR-4 | **Given** the build **When** `verify:privacy` runs **Then** it passes with ad origins allowed on content pages and still failing if one appears on a tool page. |
| AC-5 | FR-5 | **Given** any content page with an ad **When** laid out at phone and desktop widths **Then** no ad is adjacent to a button or download link. |
| AC-6 | FR-6 | **Given** the set of pages with ad slots **When** reviewed **Then** each has substantial original content. |
| AC-7 | NFR-1 | **Given** the build **When** `verify:html` runs **Then** tool-page size budgets are unchanged. |

## 11. Edge cases

- Visitor declines consent → page works with no personalised ads.
- Ad blocker active → layout does not shift or break.
- Page reachable as both content and tool (home page has the tool) → treated as a tool page, no ads.

## 12. Error and failure scenarios

- Consent tool fails to load → no ad scripts load; page remains usable.
- Ad script fails → empty slot collapses without layout break.
- Verifier detects an ad origin on a tool page → build fails.

## 13. Security and privacy considerations

New trust boundary: third-party ad and consent scripts on content pages. Tool pages carry no such script, so selected files stay unreachable by them. Data: ad and consent cookies or identifiers set by third parties; privacy and terms must say so. Abuse case: an ad script on a page that later gains a file input; the verifier in AC-4 guards that. Legal text needs the owner's review.

## 14. Out of scope

- Ads on any tool page.
- Analytics scope (separate decision).
- Ad networks other than the chosen one; alternatives were not researched. [E: unknown; low; search:none run on ad network alternatives; 2026-11-17]
- Content creation (FEATURE-001).

## 15. Dependencies

- Enough real content pages (FEATURE-001 or existing guides).
- Owner legal review of privacy and terms changes.
- Ad network is AdSense; consent tool is Google's own (see FR-8).
- AdSense account approval (owner action).

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Tool pages with third-party scripts | 0 | 0 | `verify:privacy` |
| AdSense account approved | not applied | approved | AdSense dashboard |
| Page RPM | unknown | none set | AdSense reports after traffic exists |

## 17. Research references

- Originating opportunity: OPP-004
- [E: fact; high; https://support.google.com/publisherpolicies/answer/11112688; 2026-11-17] No ads on screens without substantial content.
- [E: fact; high; https://support.google.com/adsense/answer/1346295; 2026-11-17] Ads must not sit near accidental-click buttons.
- [E: fact; high; https://support.google.com/adsense/answer/13554020; 2026-11-17] Certified CMP required in EEA, UK, Switzerland.

## 18. Unresolved decisions

- Resolved 2026-11-17: consent tool is Google's own, bundled with AdSense (owner chose it at the blocker walk-through; terms and cost still to be verified by the implementer, see FR-8).
- Resolved 2026-11-17: privacy and terms wording is drafted by the implementer and reviewed by the owner before publish. The owner's review is a release gate for AC-3, not a start blocker.
- Whether and when to add analytics (not blocking; out of scope here).
- Timing: start only after real content and some indexed pages exist (owner call).

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision 3
- **Read first:** `src/pages/privacy.astro`, `scripts/verify-privacy.mjs`, `src/layouts/Base.astro`, `wrangler.jsonc`, `SEO_ARCHITECTURE.md`.
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** AC-1, AC-4, AC-7 via `verify:privacy` and `verify:html`; AC-2 via a Playwright network-log test; AC-5 via manual layout review at 375 px and desktop; AC-3 and AC-6 by owner review.
