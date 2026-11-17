# TDD, acceptance criteria and test quality

## Acceptance criteria
- Written as Given / When / Then, observable and testable. Come from the spec (or the approved mini-spec); never invented by the engineer.
- Each criterion gets an id in the ledger. Each task lists the criteria it satisfies. A task without one is not a task.
- A task is done when its criteria pass, not when code exists. Never weaken a criterion to make a test pass; raise it as a spec question.

## TDD loop (default; skipped only when the user says so, logged as a ruling)
1. Red: write a failing behaviour-level test for the criterion. Run it. It must fail for the right reason.
2. Green: minimal code to pass. Run it.
3. Refactor with tests green. Run the task's verify command.
Nothing testable (docs, config, wiring)? Record `noTest: <reason>` on the criterion instead of a token test.

## Test quality over quantity
- One test per criterion plus risk cases that guard real failures (boundaries, bad input, failure paths). No coverage targets.
- Test behaviour through the public interface. Avoid mocking your own internals.
- Test name states the criterion it protects. Every test maps to a criterion or a named risk.
- Delete tests that add no value: duplicates, tautologies, constant assertions, implementation-coupled or over-mocked tests, flaky tests
  without a fix. QA reports each deletion and why.
- Bug fixes get one regression test, in the project's existing test style, that fails before the fix.

## Evidence gate (before any "done" or "pass")
1. Identify the command that proves the claim. 2. Run it fresh. 3. Read the full output and exit code. 4. Only then state the result with the
command. `impl pass` refuses without a command and exit 0, and refuses if a criterion has neither tests nor a `noTest` reason.
Also run an end-to-end check when one exists (CLI, build, app), not only unit tests.
