# Experiment: React 19 islands -> Preact 11 (compat), 2026-11-12

Branch `experiment/preact`. Local only; nothing pushed or deployed. Baseline = commit `a2c56ba` (main).

## Recommendation: KEEP (conditional on the owner accepting the points under "Risks")

Decision rule: (1) saving meaningful: yes, first-load UI JS per tool page falls 63 % (-60 KB gzip). (2) ALL checks pass without weakening any rule: yes (counts below); the privacy/HTML allow-list got narrower, not wider. (3) No material compatibility or maintainability regression found: source change is 11 one-line edits (`e.target` -> `e.currentTarget`) plus config; no behaviour difference was found by 6 new framework-neutral e2e tests (they also pass on React). Residual risks are ecosystem/docs related and listed below.

## What changed
- `package.json`: removed `@astrojs/react`, `react`, `react-dom`, `@types/react`, `@types/react-dom`; added `@astrojs/preact@^6.1.5`, `preact@^11.2.0` (npm `latest`). Nothing else needs React.
- `astro.config.mjs`: `preact({ compat: true })` (client directive unchanged).
- `tsconfig.json`: `jsxImportSource: "preact"`, `paths` mapping `react`, `react/jsx-runtime`, `react-dom(/*)` to `preact/compat` / `preact/jsx-runtime` so source imports (`from 'react'`) and types keep working unchanged.
- `src/components/**`: `e.target.value|checked` -> `e.currentTarget.value|checked` (11 sites). Preact types `target` as `EventTarget`; `currentTarget` is the typed element and is equivalent here (handlers sit on the input itself). Two comment wording tweaks.
- `playwright.config.ts`: port via `PW_PORT` env (default 8788 unchanged).
- Verifiers: `scripts/verify-lib.mjs` allow-list replaced (see audit), `tests/verify-*.ts` updated and extended (+5 tests), `docs/verification/VERIFIERS.md` updated.
- New `e2e/ui/preact-semantics.spec.ts` (6 tests).

## Issues hit and fixes
1. 22 TS errors (`e.target` typing) -> `currentTarget`. No other type errors (compat provides the `React.*` types used: `React.Ref`, `ReactNode`, `RefObject`, `ChangeEvent`, ...).
2. Privacy/HTML verifiers failed on the new chunks (expected): `external-url` x6 in `preact.*.js`, `dyn-import` x1 in `client.*.js`. Resolved with narrow allow-list entries below, not by loosening patterns.
3. Test helper `reactChunk` located the react-dom chunk by `__reactFiber$`; replaced by `preactChunk` / `clientChunk`; `appChunk` now excludes Preact runtime chunks.
4. No runtime/event-semantics defects were found (see "Behaviour checks").

## Allow-list re-audit (evidence)
Built chunks scanned with the unchanged primitive families. Old React entries (resource-hint, script-inject, navigator.connection, 40 URLs incl. `react.dev/errors`) have no counterpart in Preact chunks (grep for `preconnect|dns-prefetch|createElement("script")|navigator.*|fetch|sendBeacon` in `preact.*.js`: no hits) and were REMOVED. Remaining entries:
| id | file (signature) | count | evidence |
|---|---|---|---|
| `external-url` | `preact.*.js` (contains `foreignObject` + MathML URL + `dangerouslySetInnerHTML`) | <= 6, only `http://www.w3.org/{2000/svg,1998/Math/MathML,1999/xhtml}` | all 6 hits are those namespace identifiers (svg x2, MathML x2, xhtml x2) in createElementNS / foreignObject handling; never fetched; CSP `connect-src 'self'` |
| `dyn-import` | `client.*.js` (contains `data-preact-island-id`) | <= 1 and `proof`: must be literal `` import(`./signals.module.<hash>.js`) `` | @astrojs/preact hydrator lazy-loads its bundled `@preact/signals` only when an island has `data-preact-signals`; no dist page contains that attribute (asserted by a new test); the target chunk itself scans clean |

`verify-lib.mjs` gained an optional `proof` field (global regex that must match at least as many times as the entry covers) so a non-literal or additional `import()` is still flagged. Mutation tests added: 7th namespace URL, fetch / sendBeacon / external URL / tracker in Preact chunk, second or non-literal `import()` in client, old React tokens not excused, allow-listed tokens not excused in app code, unit tests of `jsIssues`.

## Test results (Node 24.12.0, system Chrome)
- `npx astro check`: 0 errors, 0 warnings, 3 hints (same hints as baseline).
- `npx vitest run`: 17 files, 547 passed (baseline 542; +5 verifier tests).
- `npm run build`: OK, 8 pages.
- `node scripts/verify-html.mjs`: `verify:html OK`; `STRICT=1 node scripts/verify-html.mjs`: `verify:html OK (STRICT=1)`; `node scripts/verify-privacy.mjs`: `verify:privacy OK` (allow-list: external-url<=6, dyn-import<=1).
- `PW_PORT=8801 npx playwright test` (chrome; includes e2e/ui, a11y, mobile, tool, engine specs under the repo config): 99 passed (93 existing + 6 new).
- `npm run test:engine:e2e`: 29 passed, 1 skipped (`m6-ui-repro` skips under the engine-only config by design).
No test was weakened or deleted.

## Behaviour checks (all covered by passing tests)
Typing fires per keystroke (compat maps onChange->onInput for text/range); controlled radios/select (value derived from state, option list changes)/checkboxes; clamped controlled field re-snaps to the applied value even when the same text is typed twice; SSR ids (`P1-..`) equal hydrated ids, no dangling `label for`/`aria-describedby` (same check passes on React: `_r1R_..`); pre-hydration native file pick (existing e2e); object URL create/revoke balance through replace, setting-change, reset and `astro:unmount` (hook cleanup -> `session.dispose`); cancel/stale-run (focus returns to Run, no late result); drag-and-drop, crop pointer drag + keyboard, before/after slider keyboard, mobile viewport (existing specs); worker/engine untouched (engine e2e green; `compress.worker` chunk byte-identical, hash `kbmCTb36`).

## Bundle (production, gzip level 9; transitive static imports per page)
| chunk | React raw / gz | Preact raw / gz |
|---|---|---|
| UI runtime (react-dom client / preact core+compat) | 212,836 / 65,678 | 10,890 / 4,637 |
| island glue (react.*.js / client.*.js) | 7,909 / 3,010 | 3,115 / 1,536 |
| preact/hooks | - | 2,899 / 1,281 |
| ImageTool | 7,738 / 2,744 | 7,301 / 2,687 |
| SignatureTool | 17,026 / 6,193 | 16,391 / 6,111 |
| useSession (engine glue, shared) | 70,610 / 23,424 | 72,640 / 24,825 |
| compress.worker (worker only, unchanged) | 32,023 / 11,908 | 32,023 / 11,908 |
| signals.module (shipped, never loaded) | - | 7,829 / 2,981 |

First-load JS (static graph, excl. worker): `/` and `/resize-image-to-20kb/`: 94,856 -> 34,966 B gzip (-59,890, -63 %; brotli 82,822 -> 31,258); `/resize-signature/`: 98,305 -> 38,390 (-59,915; brotli 85,896 -> 34,332). The task brief's ~113 KB baseline additionally counts the worker and inline Astro bootstrap (about 2 KB gz). Total dist: 557,342 -> 361,829 bytes (-35 %), 21 -> 23 files. Build time (`npm run build`, 3 runs each, warm): React 1.4-1.8 s, Preact 2.0-2.5 s (the Preact vite preset adds a Babel pass); both negligible. `node_modules`: 255 -> 279 top-level packages (build-time only, preset-vite/babel), similar disk size.

## Hydration / interaction (indicative only)
Local static server, system Chrome, 4x CPU throttle, cache disabled, 15 runs each, median: hydration complete (island `ssr` attribute removed) `/`: 292 -> 260 ms, `/resize-signature/`: 299 -> 270 ms. Click-to-next-frame ~12 -> ~9 ms; typing-to-next-frame ~10 -> 12-15 ms (slightly slower: native-event + debounced render); long-task time over 50 ms: 0 vs 7-9 ms median in Preact (likely initial work now concentrated in a different task split). Differences are within noise for INP purposes; the real win is transfer/parse size on slow networks, which localhost cannot show. Not a Lighthouse/CrUX measurement.

## Browser compatibility facts
Verified from Preact's published pages: README says it "supports all modern browsers" with no version list, and the differences guide states compat targets React 15-17 with some 18/19 additions. No explicit browser-version matrix was found on those pages for Preact 10 or 11 (so I make no claim); React 19 likewise requires modern browsers. Preact has no synthetic event system (native listeners). The site already requires OffscreenCanvas/createImageBitmap-era browsers (engine), so the UI layer is not the limiting factor.

## Risks
- Ecosystem/compat: Preact compat tracks React with lag and partially (no React 19-only APIs relied on today; `useId`, `useSyncExternalStore` work). Future dependencies that assume real React internals (some UI libraries, Server Components/Actions, `use`, concurrent rendering) may not work. SizeTune uses only hooks + plain DOM elements.
- Semantics: native events (no delegation/synthetic), async debounced rendering (no React discrete-event sync flush), `onChange` only equals React's via compat. Tests cover today's code; new inputs must keep using `onChange` under compat or `onInput`.
- Maintainability: types come via `paths` aliasing; `e.target` is untyped (use `currentTarget`). Hiring/docs familiarity lower than React. Preact 11 is a recent major (`@astrojs/preact` peer allows ^10.6.5 or ^11); pin or move to 10.x if stability is preferred.
- Tooling: `@astrojs/preact` ships a dormant `@preact/signals` chunk (3 KB gz in dist, lazy, never requested) and one audited dynamic `import()`; the verifier now depends on that literal form. A hydrator change in a future `@astrojs/preact` will fail the verifier ("re-audit") by design.
- Perf claims are indicative only.

## Revert
`git revert` the branch or simply do not merge; main is untouched.
