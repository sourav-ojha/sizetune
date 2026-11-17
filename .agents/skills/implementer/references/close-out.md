# Close-out: record what was delivered

The ledger in `.implementation/` is scratch and never committed. The durable record is the **spec** and the commits. Do this on every run
that implements a spec, including partial runs and T0/T1 work. Skipping it leaves specs saying `ready` for work that is half built.

## 1. Gather facts
- T2/T3: `impl report --name <slug>` prints `state` (none|partial|complete), delivered and pending criterion ids.
- T0/T1 (no ledger): list the criteria you verified and the ones you did not.
- Add **non-code pending items**: anything that needs a person or time (owner review of copy, legal text, account setup, post-deploy checks,
  metrics that gate the next wave) and known loose ends (a flaky test you did not investigate). Do not drop them because they are not code.

## 2. Edit the spec you were given (tracked file)
Append one row per run to a `## Delivery log` section at the end (create it if missing; never rewrite earlier rows):

```
## Delivery log
| Date | Branch / PR | Delivered | Pending (code) | Pending (non-code) | Notes |
|---|---|---|---|---|---|
| 2026-11-17 | feat/x (commits a1b2c3..d4e5f6) | AC-1, AC-2 | AC-3 | owner copy review; GSC impressions | wave 1 only |
```

Frontmatter (`.product/features/FEATURE-NNN.md` and similar):
- add or update `delivery: none|partial|complete` (from `impl report`; never guess).
- `partial`: leave `status: ready`. The `delivery` key and the log row are what say it is part built.
- `complete`: set `status: implemented`, then run `pi transition <OPP-id> Implemented` (the `opportunity:` frontmatter key gives the id;
  `pi` is `node <product-intelligence-skill-dir>/core/scripts/pi.mjs`, in the folder the product-intelligence skill was installed to). If `pi` is not
  installed, say so in the report instead of editing `.product/opportunities.md` by hand.
- Never set `validated` or `Validated`: that needs real-world confirmation by the user.
- Do not hand-edit `.product/opportunities.md` statuses; only `pi transition` does that. If `pi validate` exists, run it after the edit.

## 3. Commit and report
Commit the spec change on the feature branch (`docs: record delivery of FEATURE-NNN`). If you open a PR, add its link to the log row in a
follow-up commit. With no tracked spec (a raw idea), put the same table in the final commit body and the PR description.
In your final message list pending items last under "Not done", each with who or what it waits on.
