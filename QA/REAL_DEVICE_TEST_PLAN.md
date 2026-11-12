# QA/REAL_DEVICE_TEST_PLAN.md — SizeTune (manual, physical phones)

**Status: NOT RUN.** Nothing in this file has been verified on a real phone. Simulators/emulators only share an engine with real devices; they do not reproduce phone memory pressure, tab kills or in-app browser quirks.
Fill the result table as you go. Record PASS/FAIL/N-A and the measured numbers. A FAIL on any "must" row blocks launch (lower the pixel cap or fix, then retest).

## 0. Prepare (≈10 min)
1. Run locally on your computer: `npm ci && npm run build && npx wrangler dev --ip 0.0.0.0 --port 8788` (do not deploy). Phones on the same Wi-Fi open `http://<your-computer-LAN-IP>:8788/`. (Plain HTTP over LAN is fine for this test; file picking and canvas work. If the phone blocks it, use the iOS Simulator result as a stand-in and mark "not real device".)
2. Copy the test images to each phone (AirDrop / USB / cloud drive). Generate them with `node scripts/gen-fixtures.mjs --device-pack` (see `tests/fixtures/README.md`): the pack contains a 12 MP photo, a 36 MP photo, a 48 MP smooth image, a transparent PNG, a tiny 140×60 signature PNG, an EXIF-rotated JPEG with fake GPS, a corrupt JPEG, and an SVG renamed .png. **Also take 2 real photos with each phone camera (default settings) and 1 screenshot.**
3. Devices (minimum): 1 iPhone with ≤4 GB RAM (SE 2/3, 11, 12 class), 2 Android phones ≤3 GB RAM (one Chrome, one Samsung Internet or another browser). Optional: open the page inside WhatsApp/Instagram in-app browsers.
4. For each device note: model, OS version, browser + version, free RAM state ("fresh boot" vs "many apps open").

## 1. Cases (run each on every device)
| # | Case | Input | Settings | Expected (measurable) | Must |
|--|--|--|--|--|--|
| R1 | Basic max size | camera photo (phone's own) | max 50 KB, JPEG | result ≤ 50 KB (shown number matches Files-app size within rounding), processed < 10 s, preview looks sane, download works | ✔ |
| R2 | Large 12 MP | 12 MP pack photo | max 100 KB | success, < 15 s, no page reload/tab kill | ✔ |
| R3 | Large 36 MP | 36 MP pack photo | max 50 KB | EITHER success ≤ 50 KB OR a clear "too large for this device" message — never a blank page/crash. Record time. | ✔ |
| R4 | 48 MP stress | 48 MP pack image | max 50 KB | same as R3; record whether the tab reloads | record |
| R5 | EXIF rotation | rotated-EXIF JPEG (portrait phone shot) | any | output upright (not sideways); dimensions swapped correctly | ✔ |
| R6 | Location stripped | JPEG with fake GPS | any | open result in a metadata viewer (e.g. iOS Photos ⓘ / Android file details / any EXIF app): no location/camera make | ✔ |
| R7 | Transparent PNG | transparent PNG | format auto, then JPEG | auto keeps transparency (PNG/WebP); JPEG choice shows the "filled with white/black" disclosure and a colour choice | ✔ |
| R8 | Range | camera photo | min 20 KB, max 50 KB | result in range or clear explanation; the displayed size matches the real file size | ✔ |
| R9 | Impossible minimum | 140×60 signature | min 10 KB, fixed dims | message says it cannot honestly reach the minimum and shows the achieved size; no padded file | ✔ |
| R10 | WebP output | camera photo | format WebP | Chrome/Android: WebP result. iOS Safari: tool must say WebP unavailable and offer JPEG (not silently deliver PNG) | ✔ |
| R11 | Cancel | 36 MP | start then Cancel | UI returns to idle within 2 s; no stale result appears later; page stays responsive | ✔ |
| R12 | Repeat | camera photo | run 10 times in a row | no slowdown trend > 2×, no crash | ✔ |
| R13 | Bad files | corrupt JPEG; SVG renamed .png; 40 MB file | any | friendly error, no crash | ✔ |
| R14 | Drag & drop / picker | n/a | n/a | picker works; (desktop only) drag & drop works | ✔ |
| R15 | Signature tool | photo of a signature on paper | crop + max 20 KB | crop box usable by touch, result readable, size ≤ 20 KB | ✔ |
| R16 | Offline/no-network | any | enable airplane mode after page load | processing still works (proves local processing) | ✔ |
| R17 | Privacy network check | any | (optional) desktop Chrome devtools Network on the same LAN session | zero requests carrying the image; only same-origin GETs | record |
| R18 | In-app browsers | camera photo | open page in WhatsApp/Instagram in-app browser | works or degrades gracefully; note quirks | record |
| R19 | Accessibility | n/a | VoiceOver (iOS) / TalkBack (Android) | controls announced with labels; result announced | record |
| R20 | Layout | n/a | portrait + landscape | no horizontal scroll, buttons ≥ 44 px, text readable | ✔ |

## 2. Result table (copy per device)
| Device / OS / browser | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | R11 | R12 | R13 | R15 | R16 | R20 | Notes (times, crashes) |
|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|
| | | | | | | | | | | | | | | | | | |

## 3. Decision rules after testing
- Any crash/tab-kill on R2/R3 → lower `maxWorkingPixels`/`maxPixels` in `src/lib/engine/limits.ts` for that browser class and retest.
- Any case where the displayed size ≠ real file size → CRITICAL, stop.
- Any silent transparency flatten or silent format switch → HIGH.
- Report results back (paste the table); an agent will turn failures into tickets.
