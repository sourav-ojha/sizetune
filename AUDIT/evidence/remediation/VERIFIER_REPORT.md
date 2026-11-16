# Independent verifier report: audit remediation

- Branch `fix/audit-remediation` (HEAD e40d1f6, base f13e399). Local `pnpm run build`, served with `wrangler dev --port 8795 --ip 127.0.0.1` (stopped afterwards).
- Browsers: system Chrome (Playwright `channel: 'chrome'`), Playwright WebKit and Firefox where noted.
- Scripts: `AUDIT/tmp-verifier/*.mjs`. Fixtures are synthetic, made with sharp (`AUDIT/tmp-verifier/gen*.mjs`, `st008.mjs`). Raw logs and screenshots: `AUDIT/evidence/remediation/verifier/`.
- Output dimensions, format and hashes were read from the **downloaded bytes** with sharp (`h.mjs` `dl()`), not from the UI text.
- `pnpm exec vitest run`: 24 files, 701 tests, all passed.
- ST-005 was not attempted, by design.

## Results

| Issue | Criterion | Result | Evidence |
|---|---|---|---|
| ST-001 | Slider hidden for PNG input + No limit + Auto | PASS | `e2e/noise.png` (opaque, 800×600): `quality` count 0, Auto checked. Downloaded PNG 800×600, 1,652,495 B, sha 888349243fbcae9f (st001.txt) |
| ST-001 | Slider hidden for PNG input + No limit + explicit PNG | PASS | count 0. The download is identical to the Auto output (same sha) |
| ST-001 | Slider present when output is JPEG | PASS | Visible after choosing JPEG. q5 gave 19,323 B and q100 gave 1,402,414 B (different hashes), so the slider really works |
| ST-001 | Regressions: JPEG, WebP and transparent PNG sources with No limit + Auto | PASS | JPEG source 1, WebP source 1, WebP output 1, transparent PNG 0. On the signature page JPEG shows 1 and PNG shows 0 (sig.txt) |
| ST-001 | Test covers Auto and explicit PNG | PASS | `e2e/ui/audit-remediation.spec.ts` ST-001 test, plus the `outputIsLossless` unit test |
| ST-002 | 48 MP photo, No limit: no "to reach your size limit" | PASS | 8000×6000 JPEG gives 2828×2121 (downloaded). The only note is "opened at reduced size … to stay within browser memory limits" (st002.txt) |
| ST-002 | Memory-capped 42 MP PNG at 200 KB: cause stated correctly | PASS | 7000×6000 opaque PNG, default (auto-JPEG) output: 2646×2268 JPEG, 196,927 B. The only note is the memory note |
| ST-002 | 42 MP PNG with explicit PNG output at 200 KB | PASS (concern) | Output is 1453×1245 PNG. The note says "reduced from 7000×6000 to 1453×1245 to reach your size limit". The size search did scale (from 2646 to 1453), so the note is allowed, but the memory-cap share (7000 to 2646) is not disclosed. The reduced note is suppressed because the output is under 98% of the decode size |
| ST-002 | Max width 400 | PASS | 1200×900 gives 400×300 (downloaded) with No limit and with 100 KB. Note: "reduced … to 400×300 px to fit your maximum width/height". No "size limit" wording |
| ST-002 | Size target that really scales still gets the note | PASS | 1200×900 at 10 KB gives 205×154 with the size-limit note. 48 MP at 50 KB gives 577×433 with the size-limit note |
| ST-002 | Max width plus a scaling size target | CONCERN | 1200×900, max width 400, 10 KB: output 202×151. Two notes appear in this order: "reduced from 1200×900 to 202×151 to reach your size limit" and then "reduced from 1200×900 to 400×300 to fit your maximum width/height". Both are measured from the source, and the order runs backwards, so the reader is confused |
| ST-002 | Unit tests for the three repro cases | PASS | `tests/engine/pipeline.test.ts` covers no-limit huge photo, huge PNG, max width 400, and a size-target control |
| ST-003 | Polyglot `.html` opens as `image/*` and no script runs | PASS | JPEG and PNG polyglots named `.html` with `<script>` appended, opened in a `window.open` popup. Chrome: `image/jpeg` and `image/png`. WebKit: the same. Firefox: the same. `document.title` was not changed and `window.__ran` was null in every case (st003.txt) |
| ST-003 | Link still downloads the original bytes | PASS | The bytes were identical in all 3 engines. Chrome and WebKit keep the name `polyjpg.html`. Firefox renames it to `polyjpg.jpg` and `polypng.png` |
| ST-004 | `curl -sI` on the worker shows the new CSP | PASS | `/_astro/compress.worker-DCimJ7xF.js` sends `content-security-policy: default-src 'none'; script-src 'self'; connect-src 'none'` (plus the global `frame-ancestors 'none'` as a separate header) (st004-curl.txt) |
| ST-004 | `import()` appended to the worker sends 0 outbound requests, and resizing still works | PASS | With the served CSP: the import is rejected, the `requestfailed` reason is `csp`, the route handler for example.com was never reached, and a local probe server on another origin got 0 hits. The resize finished OK: 471×353 JPEG, 49,497 B. Control with the CSP header removed: the import succeeded ("IMPORT-OK") and the route was hit, which proves the probe detects requests. Note: Playwright's `request` event still lists the URL; the failure reason shows it was blocked before the network (st004.txt) |
| ST-004 | Pages load without CSP console errors | PASS | 7 pages in Chrome and WebKit, with a full resize on `/` and `/resize-signature/`: 0 `securitypolicyviolation` events and no CSP console errors. The only messages are the expected 404 resource error and WebKit's COEP info warning (console.txt) |
| ST-006 | Wording discloses that No limit still downsizes | PASS | With No limit selected, `nolimit-note` reads "…except for very large photos (above about 12 megapixels…): those are still reduced…". 24 MP gives 3000×2000 (downloaded), with the reduced note. The result heading still says "✓ Your image is ready"; the criterion allows wording on the option instead |
| ST-007 | Failed-enlarge message describes the downloaded file | PASS | Flat 120×80 JPEG, min 20 KB, enlarging allowed: message "Even after enlarging the image to 480×320 px, the file is only 2.5 KB (2,561 bytes)…". The download is 480×320, 2,561 B. Control without enlarging: message 120×80 / 873 B, download 120×80 / 873 B (st007.txt) |
| ST-008 | Image tool: unknown alpha + JPEG offers the fill choice | PASS | A 42 MP (7000×6000) half-transparent PNG is now testable in Chrome (1.3 MB file). JPEG shows `flatten-choice` and `alpha-unchecked` ("too large to check for transparency…"). Choosing Black and resizing gives a downloaded pixel of [0,0,0] in the formerly transparent half and [218,82,128] in the opaque half. Note: "Transparent areas were filled with black" (st008.txt) |
| ST-008 | No false fill choice for known-opaque sources | PASS | JPEG, opaque noise PNG: 0 and 0. A small transparent PNG still gets the normal alpha note |
| ST-008 | Same defect in the Signature tool | **FAIL / gap** | `/resize-signature/` with the same 42 MP transparent PNG: JPEG is preselected, and there is no `flatten-choice` and no `alpha-unchecked`. `SignatureTool.tsx` does not pass `hasFile` to FormatPicker, and its preselection (`hasAlpha === true ? 'png' : 'jpeg'`) treats unknown alpha as opaque. A large transparent signature scan is still filled with white without warning. The register's location lists only ImageTool, but the criterion ("for unknown alpha, UI offers fill option or states it will be white") is not met on this page |
| ST-008 | Unit test | PASS (weak) | The `alphaUnchecked` unit test only checks the predicate, not that the fill choice renders. The behaviour was verified end to end above |
| ST-009 | Resize disabled while a replacement is inspected (delayed `createImageBitmap`) | PASS | Init script delays `createImageBitmap` by 2 s. On both `/` and `/resize-signature/`, `run` was disabled in every sample from 7 ms to 1285 ms. The status read "Checking your image." and the old file stayed shown. A forced click during intake did nothing; the button then enabled, and Resize gave a result (ui.txt) |
| ST-009 | A rejected replacement does not leave the button stuck | PASS | A `.txt` or a 0-byte file chosen while a file is loaded: the button is enabled again, the old file is kept, and the error is shown |
| ST-010 | WebKit selects ≥ 44 px | PASS | Playwright WebKit and Chrome: `crop-shape` 44, `crop-margin` 44, home `fit` select 44. `selectOption` still works. Screenshot: `verifier/st010-webkit.png`, which shows the CSS arrow |
| ST-011 | Invalid crop input shows an associated message | PASS | Chrome and WebKit: `abc`, `-5` and `1.5` each show `crop-x-error`, `role=alert`, `aria-invalid=true`, `aria-describedby=crop-x-err`. Empty or `10` show nothing. On blur the field reverts and the message clears |
| ST-011 | Out-of-range value (not in the criterion) | NOTE | `99999` is silently clamped to 799 with no message. Existing behaviour, outside the acceptance criterion |
| ST-012 | 0-byte file shows an empty-file message | PASS | Both tools, with and without a file already loaded: "This file is empty (0 bytes). Choose a different file." Picking a valid file afterwards clears it |
| ST-013 | Desktop 1280×800 home CLS ≤ 0.01, 3+ runs | PASS | Same method as the audit (cache disabled, 100 ms latency, 2 Mbps). 1280×800 `/`: 0.0002 in each of 5 runs. 1350×900 (the audit viewport): 0.0001 ×5. `/resize-signature/`: 0.0004 and 0.0003. Pixel 5: 0 (st013.txt) |
| ST-013 | Portability | CONCERN | The fix relies on `src: local("Arial")`. This was measured on macOS, which has Arial. On Linux and Android without Arial the fallback face is skipped and the old shift may return. Not measured here |
| ST-014 | All `uses:` pinned to 40-character SHAs | PASS | `grep` finds no unpinned `uses:`. Each SHA matches its tag per `git ls-remote` (checkout v4.2.2, pnpm/action-setup v4.2.0, setup-node v4.4.0, upload-artifact v4.6.2) |
| ST-014 | Workflow-level cancel-in-progress not true for push | PASS | `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`. The deploy jobs keep their own `cancel-in-progress: false` groups |
| ST-014 | Deploy jobs otherwise untouched | PASS | The diff in deploy jobs changes only `uses:` pins |
| ST-014 | Cross-browser green on CI | NOT VERIFIED | Cannot run CI. The workflow comment still says "NOT yet run on Linux CI" |
| ST-014 | Comment accuracy | NOTE | The comment says a push run "is never cancelled … it queues instead". GitHub keeps only one pending run per concurrency group, so an older *pending* push run is still replaced by a newer one. A run that is already in progress is safe. The production deploy still passes no `--env`, unchanged |
| ST-015 | 404 has no og:url | PASS | `dist/404.html`: 0 `og:url`. A live 404 at `/definitely-not-a-page/` has no `og:url`. Every indexable page still has exactly 1 |

## Regressions looked for
- Quality slider for JPEG and WebP sources and on the signature page: still present.
- Notes still appear where they should: the size-limit note on a real size-target shrink, and the memory note on huge sources.
- SignatureTool: Resize is disabled during intake, 44 px selects work, crop errors work, and a full resize is OK.
- Worker under the new CSP: resizing works in Chrome, WebKit and Firefox.
- No CSP console errors.

## FAIL and concerns summary
1. **ST-008 (FAIL, partial fix):** the Signature tool still flattens a >36 MP transparent PNG to JPEG (preselected) with no fill choice or warning.
2. ST-002 (concern): max width combined with a size target produces two contradictory-looking notes, both measured from the source, in backwards order. For the explicit-PNG 42 MP case, the memory-cap part of the reduction goes undisclosed.
3. ST-013 (concern): the fallback depends on a local Arial. It was verified only on macOS.
4. ST-014: cross-browser green on CI is not verifiable here. The concurrency comment slightly overstates what queueing guarantees.
5. ST-011 (note): out-of-range crop values are clamped silently. Outside the criterion.

## Re-verification (follow-up commits aacc270, 17ab0ba, 5d4af38)

Rebuilt with `pnpm run build`, served with `wrangler dev` on 127.0.0.1:8795 (stopped afterwards), system Chrome. `vitest run`: 703 tests passed. Output dimensions and pixels were read from the downloaded bytes with sharp. Logs: `verifier/rv008.txt`, `verifier/rv002.txt`. Script: `AUDIT/tmp-verifier/rv.mjs`.

| Issue | Criterion | Result | Evidence |
|---|---|---|---|
| ST-008 | Signature tool, 42 MP half-transparent PNG, JPEG: fill choice and "too large to check" note shown | PASS | JPEG is preselected, and `flatten-choice` and `alpha-unchecked` are both present before and after selecting JPEG. Note: "This image is too large to check for transparency. If it has any, those areas are filled with the colour you choose." |
| ST-008 | Downloaded pixel in the transparent half follows the chosen colour | PASS | Output 2646×2268 JPEG. At x = 10% (transparent half): Black gives [0,0,0], Custom #ff0000 gives [254,0,0], White gives [255,255,255]. At x = 90% (opaque half) the pixel is [197,93,128] every time. The result note names the colour each time |
| ST-008 | No spurious fill choice on small signatures | PASS | Small transparent signature PNG: PNG preselected and the normal alpha note shown (genuine transparency); no unchecked note. Flattened opaque PNG and JPEG signatures: JPEG preselected, 0 fill choice and 0 unchecked note, before and after choosing JPEG. Image tool recheck: t42 1/1, JPEG 0/0, small transparent PNG gives the normal alpha note only |
| ST-008 | Copy consistency | NOTE | The signature intro says "If your scan has transparent areas, PNG is preselected". When transparency is unknown (>36 MP), JPEG is preselected instead, with the fill choice visible. This is acceptable under the criterion, but the intro sentence does not cover this case |
| ST-002 | 1200×900, max width 400, 10 KB | PASS | Download 202×151. Notes in order: "reduced from 1200×900 px to 400×300 px to fit your maximum width/height", then "reduced from 400×300 px to 202×151 px to reach your size limit". Correct order and no contradiction |
| ST-002 | 42 MP PNG, explicit PNG, 200 KB: memory cap disclosed | PASS | Download 1453×1245 PNG. Notes: "reduced from 2646×2268 px to 1453×1245 px to reach your size limit", plus "opened at reduced size (2646×2268 px of the original 7000×6000 px) to stay within browser memory limits" |
| ST-002 | Original repro: 48 MP, No limit | PASS | 2828×2121. Memory note only |
| ST-002 | Original repro: 42 MP PNG, default format, 200 KB | PASS | 2646×2268 JPEG, 196,927 B. Memory note only |
| ST-002 | Original repro: max width 400 (No limit and 100 KB) | PASS | 400×300. Max-dims note only |
| ST-002 | Genuine size target | PASS | 1200×900 at 10 KB gives 205×154 with "reduced from 1200×900 px to 205×154 px to reach your size limit". 48 MP at 50 KB gives 577×433 with "reduced from 2113×1585 px to 577×433 px…" plus the memory note (2113×1585 of 8000×6000) |
| ST-002 | No regression elsewhere | PASS | 24 MP No limit: memory note only (3000×2000). 800×600 at 100 KB: no notes |
| ST-002 | Huge photo + max width or typed width | CONCERN | 48 MP with max width 400 (No limit) gives 400×300 with only "opened at reduced size (400×300 px …) to stay within browser memory limits, so the result can have less detail". The real cause is the user's max width, and the max-dims note is suppressed by `!plan.reduced`. The same happens with typed width 400 and with max width 2000 (2000×1500). By code reading this is not new: the old `> 98%` guard also passed in these cases, so the base build showed the same note. It was not rebuilt to confirm. It is still a wrong-cause note of the ST-002 kind. Also, for 48 MP at 50 KB the memory note reports a 2113×1585 decode, smaller than the 2828×2121 the memory cap gives with No limit, so part of that reduction is planned for the size target, not memory |
| ST-014 | Comment-only change | PASS | The diff is one comment line: "…A push run that is already running (possibly mid-deploy) is never cancelled by a newer push; GitHub keeps at most one waiting run per group, so a newer push replaces an older still-waiting one." This is accurate. `concurrency` keys, jobs and pins are unchanged |

### Re-verification summary
- PASS: ST-008 Signature tool (fill choice, note, pixels match the chosen colour, no spurious fill choice); ST-002 all requested cases; ST-014 comment.
- CONCERN (not in the requested cases): ST-002 huge photo combined with a max or typed width still blames "browser memory limits" and suppresses the max-dims note.
- NOTE: the Signature intro copy does not mention the unknown-transparency case.
