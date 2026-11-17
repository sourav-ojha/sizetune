---
type: feature-spec
id: FEATURE-000
opportunity: OPP-000
status: draft
product_revision: 0
---
# {{feature_title}}

> Written for an implementation agent that must not need to invent product requirements.
> Requirements marked **[Approved]** come from the user-approved opportunity. Anything else is a **[Suggestion]**
> or goes under "Unresolved decisions". Delete this block and every `{{placeholder}}` before setting `status: ready`.

## 1. Feature overview

{{Two or three sentences: what the feature is and the outcome it creates.}}

## 2. Problem statement

{{The user problem, with evidence tag(s).}}

## 3. Business justification

{{Objective served, expected value, competitive context. Link to OPP-xxx.}}

## 4. Target users and personas

- **{{persona}}** — {{context, goal, frustration}}

## 5. User stories

- As a {{persona}}, I want {{capability}} so that {{outcome}}.

## 6. Functional requirements

| ID | Requirement | Type |
|---|---|---|
| FR-1 | {{The system shall …}} | [Approved] |

## 7. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | {{performance / accessibility / reliability / i18n}} | {{testable threshold}} |

## 8. User journeys and expected UX

{{Step-by-step happy path and key alternates; states (empty, loading, error, success). Reference existing UI patterns in the product.}}

## 9. Technical considerations

**Constraints from the existing system:** {{[E: fact; …; repo:path]}}

**Suggested approach [Suggestion — implementer may choose otherwise]:** {{…}}

## 10. Acceptance criteria

| ID | Covers | Criterion |
|---|---|---|
| AC-1 | FR-1 | **Given** {{precondition}} **When** {{action}} **Then** {{observable result}} |

## 11. Edge cases

- {{edge case and expected behavior}}

## 12. Error and failure scenarios

- {{failure}} → {{expected behavior and user-visible message}}

## 13. Security and privacy considerations

- {{data handled, authz, retention, abuse cases — or "No new data or trust boundary", with reasoning}}

## 14. Out of scope

- {{explicitly excluded work}}

## 15. Dependencies

- {{internal systems, third-party services, other features}}

## 16. Success metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| {{metric}} | {{value or "unknown"}} | {{target}} | {{how measured}} |

## 17. Research references

- Originating opportunity: OPP-000
- {{[E: fact; medium; https://…; YYYY-MM-DD]}} {{what it supports}}

## 18. Unresolved decisions

- {{Decision the user must make, or "None". Prefix `[BLOCKING]` if implementation cannot start without it.}}

## 19. Implementation handoff

- **Product baseline:** PRODUCT.md revision {{n}}
- **Read first:** {{files/modules the implementer should inspect}}
- **Definition of done:** all acceptance criteria pass; no out-of-scope work; no new unresolved decisions invented.
- **Questions go to:** the user, via the implementation agent. Do not guess requirements.
- **Suggested verification:** {{tests/manual checks mapped to AC-ids}}
