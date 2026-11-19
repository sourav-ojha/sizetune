# Measurement plan

<!-- Owned by the plan phase. Describes what to measure; the skill never installs tags or changes analytics itself. -->

## Summary
Today nothing is measured: no analytics, no tool events, and Search Console has no data (site about 2 days old). [E: fact; high; S-036; 2026-11-19] The plan makes the first monthly refresh possible; all volumes stay unknown until then.

## Search Console
Owner verifies the property (DNS record reported), submits `sitemap-index.xml`, and exports Performance → Queries, Pages and Countries monthly into `.growth/performance/` for `gs import gsc` (GRO-004). Judge indexing after about 4 weeks, not before. [E: fact; medium; S-038; 2026-11-19]

## GA4 events
Whatever analytics is chosen in GRO-001, events carry tool name and outcome only, never file data: `tool_start`, `tool_success` (target KB, result size bucket), `tool_error` (reason), `download`, `guide_click`. Preferred: cookieless or consent-gated; decision belongs to the owner. [E: hypothesis; low; n/a; 2026-11-19]

## Referral sources
UTM convention per channel: `utm_source` (hn, alternativeto, reddit, quora, pinterest), `utm_medium=referral`, `utm_campaign` per post. Check referral reports after any distribution item (GRO-014, GRO-015).

## Landing-page performance
Per page from Search Console: impressions, clicks, CTR, position; from analytics: success rate per landing page. Track new pages (GRO-005, GRO-008) for indexing first.

## Tool usage funnel
landing view → `tool_start` → `tool_success` → `download`. Failures ("target impossible") reported separately, since they show unmet demand.

## Conversion and retention
For an ad model the conversion is a completed resize and a second tool or guide view in the same session; returning-user share only if consent allows. Revenue per page needs ads, which do not exist yet. [E: assumption; low; n/a; 2026-11-19]
