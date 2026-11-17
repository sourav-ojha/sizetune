# Competitor analysis framework

## Categories

| Category | Definition | Examples of evidence to collect |
|---|---|---|
| Direct | Same audience, same job, comparable solution | features, pricing, positioning, reviews |
| Indirect | Same job, different solution type (incl. manual / spreadsheet / services) | why users choose it, what they sacrifice |
| Open-source alternatives | Self-hostable or embeddable projects solving the job | license, maintenance, usability, relevance |
| Emerging | New or fast-moving entrants, early products, pivoting incumbents | launch date, direction, early adopters, funding if publicly stated |
| Adjacent | Neighbouring products/markets that could expand into or be partnered with | overlap, user overlap, expansion signals |

## Dimensions (profile each, mark unknowns)

Positioning · target audience · features · UX/UI · pricing & monetization · differentiators · weaknesses · technology · adoption and community signals · opportunities for us.
Working format: `templates/competitor-profile.md`.

## Open-source specifics

Evaluate whether the project is actually **usable** (install path, docs, working releases), **maintained** (last release/commit, issue response, archived notices),
**commercially compatible** (SPDX license; flag AGPL, GPL, SSPL, BUSL, FSL and "source-available"; "needs legal review" if unclear), and **relevant** (competitor, enabler or noise).
Stars, forks and followers are context only and **never proof of commercial traction**.

## Reading user sentiment

- Prefer recurring, recent, independent complaints. Report frequency ("4 of 20 reviews since 2026-06 mention export limits").
- Distinguish a user's statement (fact about what was said) from the conclusion you draw (inference).
- Vendor-curated testimonials are marketing, not sentiment.

## Comparing against the product

Use PRODUCT.md capabilities as the baseline. For each notable competitor capability: do we have it (complete/partial/none), do users value it (evidence), is it table stakes or a differentiator?
Feature presence alone is not an opportunity.

## Landscape table conventions

Keep each row to one line per cell; cite the primary source URL with accessed date in the Evidence column. Put long notes in the opportunity detail where they matter, not in the table.
Rows older than the freshness window are refreshed during `refresh`.
