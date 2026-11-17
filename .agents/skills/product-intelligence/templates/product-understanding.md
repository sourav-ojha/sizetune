---
type: product-context
status: draft
revision: 0
last_reviewed: {{YYYY-MM-DD}}
---
# {{Product name}} — Product Context

> Evidence tags: `[E: fact|inference|hypothesis|assumption|unknown; high|medium|low; source; YYYY-MM-DD]`.
> Sources: `repo:<path>[:line]`, `https://…` (with accessed date), `user:<note>`. See references/evidence-standards.md.
> Delete this block and every `{{placeholder}}` before requesting approval.

## 1. Product overview

{{One paragraph: what the product is and does, in the product's own terms. Tag each factual claim.}}

## 2. Problem statement

{{The problem(s) the product solves, for whom, and what they do today without it.}}

## 3. Target audience

| Segment | Who they are | Evidence |
|---|---|---|
| {{segment}} | {{description}} | {{[E: …]}} |

## 4. Value proposition

{{Why a user would choose this over alternatives, as supported by the product itself. Separate stated claims from demonstrated capability.}}

## 5. Core user journeys

### Journey 1: {{name}}
1. {{step}} {{[E: …]}}

## 6. Existing capabilities

| Capability | Status (complete / partial / stub) | Evidence |
|---|---|---|
| {{capability}} | {{status}} | {{[E: fact; high; repo:path:line]}} |

## 7. Business model

{{How the product makes money or sustains itself, or "Not identifiable from the repository" with an `unknown` tag. Do not guess pricing.}}

## 8. Technical overview

- **Stack:** {{languages, frameworks, runtime}}
- **Architecture:** {{services, data stores, boundaries}}
- **Integrations:** {{third-party services, APIs}}
- **Deployment / operations:** {{what is visible}}

## 9. Known limitations

- {{limitation, incomplete feature, TODO cluster, missing test or doc}} {{[E: …]}}

## 10. Assumptions and unanswered questions

### Assumptions
- {{assumption}} {{[E: assumption; low; n/a]}}

### Unanswered questions for the user
- {{question only the user can answer}}

### Conflicting evidence
- {{claim A (source) vs claim B (source) — which is believed and why, or "None found"}}

## 11. Evidence and confidence

| Area | Confidence | Basis |
|---|---|---|
| Purpose and audience | {{High/Medium/Low}} | {{[E: …]}} |
| Capabilities | {{…}} | {{[E: …]}} |
| Business model | {{…}} | {{[E: …]}} |
| Technical overview | {{…}} | {{[E: …]}} |

Repository inspected at: {{commit hash or "not a git repo"}} on {{YYYY-MM-DD}}. Agents used: {{roles, or "none — single-agent investigation"}}.

## Revision History

| Revision | Date | By | Action | Note |
|---|---|---|---|---|
