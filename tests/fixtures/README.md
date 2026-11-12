# Test fixtures

All fixtures are generated deterministically by `scripts/gen-fixtures.mjs` (no downloads; encodes with `sharp`, already installed as an Astro dependency).

```
node scripts/gen-fixtures.mjs                 # committed fixtures (this folder, each <= 200 KB) + .generated/photo-12mp.jpg
node scripts/gen-fixtures.mjs --check         # fail if a committed fixture is missing or > 200 KB
node scripts/gen-fixtures.mjs --device-pack   # .generated/device-pack/ for real phones (see QA/REAL_DEVICE_TEST_PLAN.md)
```
`.generated/` is git-ignored. Files derived from the macOS wallpaper (`/System/Library/Desktop Pictures/Sonoma.heic`, converted with `sips`) are written **only** to `.generated/`; without `sips` a procedural photo is used instead.

| file | content | used by |
|--|--|--|
| `exif6-gps.jpg` | stored 400×300, EXIF Orientation 6, Make `TestCam`, Model `Model9`, GPS 28.6139 N 77.209 E; red band at the top once oriented | orientation regression, GPS-strip proof |
| `transparent.png` | 800×600 RGBA: transparent top-left quadrant, 50 %-alpha white disc, 24 %-alpha blue strip | alpha keep / flatten |
| `alpha-400x300.webp` | lossless WebP with alpha (VP8X) | WebP alpha |
| `photo-800x600.webp` | lossy WebP (VP8) | WebP input |
| `photo-200x230.jpg`, `photo-1200x800.jpg` | procedural photo-like JPEGs | targets, raise, ICC |
| `progressive-640x480.jpg`, `cmyk-300x200.jpg` | SOF2 / 4-component JPEG | header parser |
| `signature-140x60.png`, `signature-1200x400.png` | pen strokes on paper | below_min, PNG |
| `noise-256.png` | incompressible noise | impossible max |
| `tiny-1x1.png`, `tiny-8x8.jpg` | tiny inputs | edge cases |
| `corrupt-truncated.jpg` | photo-200x230 cut at 50 % | completeness check (`corrupt` in every browser) |
| `corrupt-garbage.jpg` | valid SOI..SOF then random bytes | `corrupt` |
| `corrupt-truncated.png`, `corrupt-truncated.webp` | cut at 60 % (no IEND / RIFF size > file) | completeness check |
| `trailing-garbage.jpg` | valid JPEG + text after EOI | accepted, tail dropped |
| `motion-photo-like.jpg` | valid JPEG + 70 KB MP4-like trailer (EOI not in the last 64 KB) | accepted via the forward scan |
| `svg-renamed.png`, `gif-renamed.jpg`, `heic-header.heic` | wrong types with misleading names | magic-byte rejection |
| `.generated/photo-12mp.jpg` | 4000×3000 wallpaper photo (or procedural) | 12 MP e2e, repeat/memory |

Large inputs (36 MP / 48 MP) for e2e are generated inside the browser at test time (`makeLarge` in `e2e/engine/harness-page.js`) and never written to disk.

Device pack (`--device-pack`): 12 MP and 36 MP photos, 48 MP smooth image, transparent PNG, 140×60 signature, EXIF-6+GPS JPEG, truncated JPEG, SVG renamed .png, a 40 MB JPEG (to trigger the 25 MB limit), a 1200×800 photo, and `README.txt` listing the expected outcome per file (cases R1–R13).
