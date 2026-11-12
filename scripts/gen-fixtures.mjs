#!/usr/bin/env node
/**
 * Deterministic test fixtures for the compression engine. No downloads.
 *
 *   node scripts/gen-fixtures.mjs               -> small committed fixtures in tests/fixtures/ (each <= 200 KB)
 *                                                 + larger ones in tests/fixtures/.generated/ (git-ignored)
 *   node scripts/gen-fixtures.mjs --device-pack -> tests/fixtures/.generated/device-pack/ (files to copy to phones, README.txt)
 *   node scripts/gen-fixtures.mjs --check       -> exit 1 if a committed fixture is missing or > 200 KB
 *
 * Uses `sharp` (already installed as a dependency of astro; not a new dependency) for encoding, and macOS `sips`
 * (if present) to turn the system wallpaper into realistic photo content. Wallpaper-derived files are NEVER written to
 * the committed directory.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const sharp = require('sharp');
const FIX = path.join(ROOT, 'tests/fixtures');
const GEN = path.join(FIX, '.generated');
const PACK = path.join(GEN, 'device-pack');
const COMMIT_LIMIT = 200 * 1024;
const WALLPAPER = '/System/Library/Desktop Pictures/Sonoma.heic';

const args = new Set(process.argv.slice(2));

// ---------- deterministic pixel generators ----------
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** Value-noise lattice sampled bilinearly (fast enough for tens of MP). */
function makeNoise(seed, cells) {
  const R = rng(seed);
  const g = new Float32Array((cells + 1) * (cells + 1));
  for (let i = 0; i < g.length; i++) g[i] = R();
  return (u, v) => {
    const x = u * cells, y = v * cells;
    const xi = Math.min(cells - 1, x | 0), yi = Math.min(cells - 1, y | 0);
    const fx = x - xi, fy = y - yi;
    const a = g[yi * (cells + 1) + xi], b = g[yi * (cells + 1) + xi + 1], c = g[(yi + 1) * (cells + 1) + xi], d = g[(yi + 1) * (cells + 1) + xi + 1];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

/** Photo-like RGB: sky gradient, fbm "terrain", a sun disc, and fine grain. `grain` 0..1 controls compressibility. */
function photoLike(w, h, seed = 1, grain = 0.35) {
  const n1 = makeNoise(seed, 6), n2 = makeNoise(seed + 1, 24), n3 = makeNoise(seed + 2, 96);
  const R = rng(seed + 3);
  const buf = Buffer.allocUnsafe(w * h * 3);
  const sunX = 0.7 * w, sunY = 0.25 * h, sunR = 0.08 * Math.min(w, h);
  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const f = 0.55 * n1(u, v) + 0.3 * n2(u, v) + 0.15 * n3(u, v);
      const horizon = 0.45 + 0.15 * (n1(u, 0.5) - 0.5);
      let r, g, b;
      if (v < horizon) { r = 90 + 120 * v; g = 140 + 90 * v; b = 220 - 40 * v; const dx = x - sunX, dy = y - sunY; if (dx * dx + dy * dy < sunR * sunR) { r = 255; g = 236; b = 170; } }
      else { r = 60 + 110 * f; g = 90 + 100 * f; b = 40 + 60 * f; }
      const gr = (R() - 0.5) * 60 * grain;
      const i = (y * w + x) * 3;
      buf[i] = Math.max(0, Math.min(255, r + gr)); buf[i + 1] = Math.max(0, Math.min(255, g + gr)); buf[i + 2] = Math.max(0, Math.min(255, b + gr));
    }
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } });
}

/** Smooth gradient only (for the 48 MP stress image: big pixel count, small file). */
function smooth(w, h) {
  const buf = Buffer.allocUnsafe(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    buf[i] = (x * 255 / w) | 0; buf[i + 1] = (y * 255 / h) | 0; buf[i + 2] = ((x + y) * 127 / (w + h) + 64) | 0;
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } });
}

/** Signature: dark pen strokes on white paper. */
function signature(w, h, seed = 9) {
  const R = rng(seed);
  const buf = Buffer.alloc(w * h * 3, 250);
  const pts = [];
  let x = w * 0.08, y = h * 0.6;
  for (let k = 0; k < 900; k++) { x += (w * 0.84) / 900; y = h * (0.55 + 0.25 * Math.sin(k / 18) * Math.cos(k / 47) + (R() - 0.5) * 0.02); pts.push([x, y]); }
  const pen = Math.max(1, Math.round(Math.min(w, h) / 40));
  for (const [px, py] of pts) for (let dy = -pen; dy <= pen; dy++) for (let dx = -pen; dx <= pen; dx++) {
    if (dx * dx + dy * dy > pen * pen) continue;
    const xx = Math.round(px + dx), yy = Math.round(py + dy);
    if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
    const i = (yy * w + xx) * 3; buf[i] = 20; buf[i + 1] = 24; buf[i + 2] = 60;
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } });
}

/** RGBA: transparent top-left quadrant, 50%-alpha white disc, 24%-alpha blue strip, opaque gradient elsewhere. */
function transparent(w = 800, h = 600) {
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    let r = 200 - (y * 120) / h, g = 80 + (x * 120) / w, b = 90, a = 255;
    if (x < w / 2 && y < h / 2) { r = 0; g = 0; b = 0; a = 0; }
    const dx = x - w * 0.7, dy = y - h * 0.65;
    if (dx * dx + dy * dy < (h * 0.2) ** 2) { r = 255; g = 255; b = 255; a = 128; }
    if (y > h * 0.9) { r = 0; g = 0; b = 255; a = 60; }
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 4 } });
}

// ---------- EXIF (Orientation + Make/Model + GPS) ----------
function exifApp1({ orientation, make, model, gps }) {
  // Big-endian TIFF. Layout: header(8) | IFD0 | IFD0 data | GPS IFD | GPS data
  const be16 = (n) => [(n >> 8) & 255, n & 255];
  const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const asc = (s) => [...Buffer.from(s + '\0', 'latin1')];
  const ifd0Count = 4, gpsCount = 4;
  const ifd0Off = 8;
  const ifd0Size = 2 + ifd0Count * 12 + 4;
  const makeB = asc(make), modelB = asc(model);
  const dataOff = ifd0Off + ifd0Size;
  const makeOff = dataOff, modelOff = makeOff + makeB.length;
  let gpsOff = modelOff + modelB.length; if (gpsOff % 2) gpsOff++;
  const gpsSize = 2 + gpsCount * 12 + 4;
  const latOff = gpsOff + gpsSize, lonOff = latOff + 24;
  const rat = (deg) => { const d = Math.floor(deg), mf = (deg - d) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60 * 100); return [...be32(d), ...be32(1), ...be32(m), ...be32(1), ...be32(s), ...be32(100)]; };
  const t = [0x4d, 0x4d, ...be16(42), ...be32(ifd0Off)];
  t.push(...be16(ifd0Count));
  t.push(...be16(0x010f), ...be16(2), ...be32(makeB.length), ...be32(makeOff));
  t.push(...be16(0x0110), ...be16(2), ...be32(modelB.length), ...be32(modelOff));
  t.push(...be16(0x0112), ...be16(3), ...be32(1), ...be16(orientation), 0, 0);
  t.push(...be16(0x8825), ...be16(4), ...be32(1), ...be32(gpsOff));
  t.push(...be32(0));
  t.push(...makeB, ...modelB);
  while (t.length < gpsOff) t.push(0);
  t.push(...be16(gpsCount));
  t.push(...be16(1), ...be16(2), ...be32(2), gps.lat >= 0 ? 0x4e : 0x53, 0, 0, 0);
  t.push(...be16(2), ...be16(5), ...be32(3), ...be32(latOff));
  t.push(...be16(3), ...be16(2), ...be32(2), gps.lon >= 0 ? 0x45 : 0x57, 0, 0, 0);
  t.push(...be16(4), ...be16(5), ...be32(3), ...be32(lonOff));
  t.push(...be32(0));
  t.push(...rat(Math.abs(gps.lat)), ...rat(Math.abs(gps.lon)));
  const payload = [...Buffer.from('Exif\0\0', 'latin1'), ...t];
  return Buffer.from([0xff, 0xe1, ...be16(payload.length + 2), ...payload]);
}
const insertAfterSoi = (jpeg, seg) => Buffer.concat([jpeg.subarray(0, 2), seg, jpeg.subarray(2)]);

/** Stored 400x300; left quarter RED. After orientation 6 (rotate 90° CW) the red band is at the TOP of a 300x400 image. */
async function exif6Gps() {
  const w = 400, h = 300, buf = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    if (x < w / 4) { buf[i] = 230; buf[i + 1] = 20; buf[i + 2] = 20; } else { buf[i] = 30; buf[i + 1] = 90; buf[i + 2] = 200; }
  }
  const base = await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
  return insertAfterSoi(base, exifApp1({ orientation: 6, make: 'TestCam', model: 'Model9', gps: { lat: 28.6139, lon: 77.209 } }));
}

// ---------- writers ----------
const written = [];
function write(dir, name, buf, note) {
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  fs.writeFileSync(p, buf);
  written.push({ p, bytes: buf.length, note });
  return p;
}

function hasSips() { try { execFileSync('sips', ['--help'], { stdio: 'ignore' }); return fs.existsSync(WALLPAPER); } catch { return false; } }
/** Wallpaper -> JPEG at w×h (center crop to aspect, then resample). Returns Buffer or null. */
function wallpaperJpeg(w, h, quality = 92) {
  if (!hasSips()) return null;
  const tmp = fs.mkdtempSync(path.join(GEN, 'sips-'));
  try {
    const src = path.join(tmp, 'src.jpg');
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(quality), WALLPAPER, '--out', src], { stdio: 'ignore' });
    const S = 6016;
    const cw = w / h >= 1 ? S : Math.round(S * w / h), ch = w / h >= 1 ? Math.round(S * h / w) : S;
    execFileSync('sips', ['-c', String(ch), String(cw), src, '--out', src], { stdio: 'ignore' });
    execFileSync('sips', ['-z', String(h), String(w), '-s', 'formatOptions', String(quality), src, '--out', src], { stdio: 'ignore' });
    return fs.readFileSync(src);
  } catch { return null; } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

async function committed() {
  const j = (s, q = 85, o = {}) => s.jpeg({ quality: q, ...o }).toBuffer();
  write(FIX, 'exif6-gps.jpg', await exif6Gps(), 'stored 400x300, EXIF Orientation 6, Make TestCam, Model Model9, GPS 28.6139N 77.209E; red band at top when oriented');
  write(FIX, 'transparent.png', await transparent().png().toBuffer(), '800x600 RGBA: transparent TL quadrant, 50% white disc, 24% blue strip');
  write(FIX, 'signature-140x60.png', await signature(140, 60).png().toBuffer(), '140x60 signature (tiny: cannot reach 10 KB honestly)');
  write(FIX, 'signature-1200x400.png', await signature(1200, 400).png().toBuffer(), '1200x400 signature');
  write(FIX, 'photo-200x230.jpg', await j(photoLike(200, 230, 3), 92), '200x230 photo-like JPEG');
  write(FIX, 'photo-1200x800.jpg', await j(photoLike(1200, 800, 5, 0.2), 80), '1200x800 photo-like JPEG');
  write(FIX, 'photo-800x600.webp', await photoLike(800, 600, 7, 0.2).webp({ quality: 80 }).toBuffer(), 'lossy WebP (VP8)');
  write(FIX, 'alpha-400x300.webp', await transparent(400, 300).webp({ lossless: true }).toBuffer(), 'lossless WebP with alpha');
  write(FIX, 'progressive-640x480.jpg', await j(photoLike(640, 480, 11), 80, { progressive: true }), 'progressive JPEG (SOF2)');
  write(FIX, 'cmyk-300x200.jpg', await photoLike(300, 200, 13).toColourspace('cmyk').jpeg({ quality: 85 }).toBuffer(), 'CMYK JPEG');
  write(FIX, 'tiny-1x1.png', await sharp({ create: { width: 1, height: 1, channels: 3, background: '#336699' } }).png().toBuffer(), '1x1 PNG');
  write(FIX, 'tiny-8x8.jpg', await sharp({ create: { width: 8, height: 8, channels: 3, background: '#cc8844' } }).jpeg({ quality: 90 }).toBuffer(), '8x8 JPEG');
  const noise = Buffer.alloc(256 * 256 * 3); const R = rng(42); for (let i = 0; i < noise.length; i++) noise[i] = (R() * 256) | 0;
  write(FIX, 'noise-256.png', await sharp(noise, { raw: { width: 256, height: 256, channels: 3 } }).png().toBuffer(), 'incompressible noise');
  const good = fs.readFileSync(path.join(FIX, 'photo-200x230.jpg'));
  write(FIX, 'corrupt-truncated.jpg', good.subarray(0, Math.floor(good.length * 0.5)), 'valid header, file cut at 50%');
  const sofEnd = findSofEnd(good);
  const R2 = rng(99); const garbage = Buffer.alloc(4000); for (let i = 0; i < garbage.length; i++) garbage[i] = (R2() * 256) | 0;
  write(FIX, 'corrupt-garbage.jpg', Buffer.concat([good.subarray(0, sofEnd), garbage]), 'valid SOI..SOF, then random bytes');
  const tp = fs.readFileSync(path.join(FIX, 'signature-1200x400.png'));
  write(FIX, 'corrupt-truncated.png', tp.subarray(0, Math.floor(tp.length * 0.6)), 'PNG cut at 60% (no IEND)');
  const tw = fs.readFileSync(path.join(FIX, 'photo-800x600.webp'));
  write(FIX, 'corrupt-truncated.webp', tw.subarray(0, Math.floor(tw.length * 0.6)), 'WebP cut at 60% (RIFF size > file)');
  write(FIX, 'trailing-garbage.jpg', Buffer.concat([good, Buffer.from('POLYGLOT-TAIL<html>not an image</html>')]), 'valid JPEG + text after EOI (accepted; re-encode drops it)');
  const R3 = rng(7); const fakeVideo = Buffer.alloc(70 * 1024); for (let i = 0; i < fakeVideo.length; i++) fakeVideo[i] = (R3() * 256) | 0;
  fakeVideo.write('\0\0\0\x18ftypmp42', 0, 'latin1'); for (let i = 0; i + 1 < fakeVideo.length; i++) if (fakeVideo[i] === 0xff && fakeVideo[i + 1] === 0xd9) fakeVideo[i + 1] = 0xd8;
  write(FIX, 'motion-photo-like.jpg', Buffer.concat([good, fakeVideo]), 'valid JPEG + 70 KB MP4-like trailer without FFD9 (EOI not in the last 64 KB; accepted)');
  write(FIX, 'jpeg-extraneous-bytes.jpg', Buffer.concat([good.subarray(0, 20), Buffer.alloc(4), good.subarray(20)]), '4 zero bytes between APP0 and the next segment (libjpeg/Chrome decode it)');
  const g12 = fs.readFileSync(path.join(FIX, 'photo-1200x800.jpg'));
  write(FIX, 'jpeg-no-eoi.jpg', g12.subarray(0, g12.length - 2), 'complete scan data, only the final EOI missing (incomplete)');
  const prog = fs.readFileSync(path.join(FIX, 'progressive-640x480.jpg'));
  write(FIX, 'progressive-truncated-70.jpg', prog.subarray(0, Math.floor(prog.length * 0.7)), 'progressive JPEG cut at 70%');
  write(FIX, 'svg-renamed.png', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'), 'SVG text with a .png name');
  write(FIX, 'gif-renamed.jpg', Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'), '1x1 GIF with a .jpg name');
  write(FIX, 'heic-header.heic', Buffer.from([0, 0, 0, 0x18, ...Buffer.from('ftypheic'), 0, 0, 0, 0, ...Buffer.from('mif1heic')]), 'HEIC ftyp box only');
}

function findSofEnd(b) {
  let i = 2;
  while (i < b.length) {
    const m = b[i + 1]; const len = (b[i + 2] << 8) | b[i + 3];
    if (m >= 0xc0 && m <= 0xc2) return i + 2 + len;
    i += 2 + len;
  }
  throw new Error('no SOF');
}

async function generated() {
  const w12 = wallpaperJpeg(4000, 3000);
  const big16 = await photoLike(4000, 4000, 31).jpeg({ quality: 90 }).toBuffer();
  write(GEN, 'real-truncated-90.jpg', big16.subarray(0, Math.floor(big16.length * 0.9)), '16 MP JPEG cut at 90% (incomplete)');
  write(GEN, 'photo-12mp.jpg', w12 ?? (await photoLike(4000, 3000, 21).jpeg({ quality: 90 }).toBuffer()), `4000x3000 ${w12 ? 'wallpaper (sips)' : 'procedural'}`);
}

async function devicePack() {

  fs.rmSync(PACK, { recursive: true, force: true });
  const rows = [];
  const add = (name, buf, expected) => { write(PACK, name, buf); rows.push([name, buf.length, expected]); };
  const w12 = wallpaperJpeg(4000, 3000), w36 = wallpaperJpeg(6000, 6000);
  add('01-photo-12mp.jpg', w12 ?? (await photoLike(4000, 3000, 21).jpeg({ quality: 90 }).toBuffer()), 'R2: 12 MP photo. max 100 KB -> success <= 100 KB, < 15 s, no tab reload.');
  add('02-photo-36mp.jpg', w36 ?? (await photoLike(6000, 6000, 22).jpeg({ quality: 90 }).toBuffer()), 'R3/R11: 36 MP photo. max 50 KB -> success <= 50 KB OR a clear "too large for this device" message; never a blank page.');
  add('03-smooth-48mp.jpg', await smooth(8000, 6000).jpeg({ quality: 90 }).toBuffer(), 'R4: 48 MP smooth stress image. max 50 KB -> as R3; record whether the tab reloads.');
  add('04-transparent.png', await transparent().png().toBuffer(), 'R7: format auto -> stays PNG/WebP with transparency; format JPEG -> "Transparent areas were filled with white" disclosure + colour choice.');
  add('05-signature-140x60.png', await signature(140, 60).png().toBuffer(), 'R9: fixed 140x60, min 10 KB -> "cannot honestly reach the minimum" message with the achieved size (about 4-6 KB); no padded file.');
  add('06-exif-rotated-gps.jpg', await exif6Gps(), 'R5/R6: stored sideways with EXIF orientation 6 -> output upright 300x400 (red band at the TOP); output has no location/camera make (TestCam/Model9/GPS).');
  const good = await photoLike(1200, 900, 23).jpeg({ quality: 85 }).toBuffer();
  add('07-corrupt-truncated.jpg', good.subarray(0, Math.floor(good.length * 0.4)), 'R13: truncated JPEG -> friendly error OR a partially grey image (browser-dependent); never a crash.');
  add('08-svg-renamed.png', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>'), 'R13: SVG renamed .png -> "not a JPEG, PNG or WebP" error.');
  const big = w12 ?? (await photoLike(4000, 3000, 24).jpeg({ quality: 90 }).toBuffer());
  const filler = Buffer.alloc(40 * 1024 * 1024 - big.length, 0x20); // test input only: exceeds the 25 MB byte cap
  add('09-too-large-40mb.jpg', Buffer.concat([big.subarray(0, big.length - 2), filler, Buffer.from([0xff, 0xd9])]), 'R13: 40 MB file -> "larger than 25 MB" error before any decoding.');
  add('10-photo-1200x800.jpg', await photoLike(1200, 800, 25, 0.2).jpeg({ quality: 85 }).toBuffer(), 'R1/R8/R10/R12 stand-in if no camera photo: max 50 KB; range 20-50 KB; WebP (iOS: must say WebP unavailable).');
  const readme = [
    'SizeTune device test pack (generated by `node scripts/gen-fixtures.mjs --device-pack`; NOT committed).',
    `Photo content: ${w12 ? 'macOS Sonoma wallpaper converted with sips (do not redistribute)' : 'procedural (no wallpaper found)'}.`,
    'Copy these files to the phone (AirDrop/USB/cloud). See QA/REAL_DEVICE_TEST_PLAN.md for the case numbers.',
    '',
    ...rows.map(([n, b, e]) => `${n}  (${(b / 1024 / 1024).toFixed(2)} MB)\n    expected: ${e}`),
    '',
    'Also take 2 real photos with the phone camera and 1 screenshot (R1, R5, R8).',
  ].join('\n');
  write(PACK, 'README.txt', Buffer.from(readme + '\n'));

}

function check() {
  const names = ['exif6-gps.jpg', 'transparent.png', 'signature-140x60.png', 'signature-1200x400.png', 'photo-200x230.jpg', 'photo-1200x800.jpg', 'photo-800x600.webp', 'alpha-400x300.webp', 'progressive-640x480.jpg', 'cmyk-300x200.jpg', 'tiny-1x1.png', 'tiny-8x8.jpg', 'noise-256.png', 'corrupt-truncated.jpg', 'corrupt-garbage.jpg', 'corrupt-truncated.png', 'corrupt-truncated.webp', 'trailing-garbage.jpg', 'motion-photo-like.jpg', 'jpeg-extraneous-bytes.jpg', 'jpeg-no-eoi.jpg', 'progressive-truncated-70.jpg', 'svg-renamed.png', 'gif-renamed.jpg', 'heic-header.heic'];
  let bad = 0;
  for (const n of names) {
    const p = path.join(FIX, n);
    if (!fs.existsSync(p)) { console.error('missing', n); bad++; continue; }
    const s = fs.statSync(p).size;
    if (s > COMMIT_LIMIT) { console.error('too big to commit', n, s); bad++; }
  }
  if (bad) process.exit(1);
  console.log(`ok: ${names.length} committed fixtures present, all <= 200 KB`);
}

if (args.has('--check')) check();
else if (args.has('--device-pack')) { fs.mkdirSync(GEN, { recursive: true }); await devicePack(); }
else { fs.mkdirSync(GEN, { recursive: true }); await committed(); await generated(); }
for (const w of written) console.log(`${path.relative(ROOT, w.p)}\t${w.bytes} B${w.note ? '\t' + w.note : ''}`);
for (const w of written) if (w.p.startsWith(FIX + path.sep) && !w.p.includes('.generated') && w.bytes > COMMIT_LIMIT) { console.error(`ERROR: ${w.p} exceeds 200 KB and must not be committed`); process.exitCode = 1; }
