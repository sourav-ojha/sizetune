// QA quality samples runner. Usage (from the sizetune repo root):
//   export PATH=$HOME/.nvm/versions/node/v24.12.0/bin:$PATH
//   node QA/quality-samples/run.mjs
// Bundles the REAL engine (src/lib/engine) with esbuild, runs it in system Chrome (Playwright channel "chrome") on a fake
// origin with every other request aborted, and writes outputs + index.html + results.json next to this file.
// Inputs: macOS wallpapers (HEIC -> JPEG via `sips`), tests/fixtures, and two SYNTHETIC images generated here.
// No network, no downloads, nothing outside this folder (plus an OS temp dir) is written.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, '../..');
const require = createRequire(path.join(ROOT, 'package.json'));
const esbuild = require('esbuild');
const sharp = require('sharp');
const { chromium } = require('@playwright/test');
const FIX = path.join(ROOT, 'tests/fixtures');
const OUT = HERE;
const MAX_OUT_BYTES = 250 * 1024;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sizetune-qs-'));
const INP = path.join(TMP, 'in');
fs.mkdirSync(INP);
const ORIGIN = 'http://engine.test';

// ---------------------------------------------------------------- inputs
const DP = '/System/Library/Desktop Pictures';
const sips = (...a) => execFileSync('sips', a, { stdio: 'pipe' });
const inputs = {}; // name -> { file, label }

function prepWallpapers() {
  const full = path.join(INP, 'horizon-full.jpg');
  sips('-s', 'format', 'jpeg', '-s', 'formatOptions', '90', path.join(DP, '.wallpapers/Sonoma Horizon/Sonoma Horizon.heic'), '--out', full);
  inputs['photo-landscape'] = { file: full, label: 'Real photo: macOS "Sonoma Horizon" wallpaper (vineyard + conifers + fog), 3840x2160' };
  const crop = path.join(INP, 'horizon-detail.jpg');
  // sips --cropOffset <y> <x> -c <h> <w>: dense conifer foliage, lower-left of the frame
  sips('-s', 'format', 'jpeg', '-s', 'formatOptions', '90', '--cropOffset', '960', '0', '-c', '1200', '1600', full, '--out', crop);
  inputs['photo-detailed'] = { file: crop, label: 'Real photo crop of the same wallpaper: dense conifer foliage, 1600x1200 (high-frequency detail)' };
  const smooth = path.join(INP, 'sonoma-smooth.jpg');
  sips('-s', 'format', 'jpeg', '-s', 'formatOptions', '90', '-Z', '3000', path.join(DP, 'Sonoma.heic'), '--out', smooth);
  inputs['smooth-gradient'] = { file: smooth, label: 'macOS "Sonoma" wallpaper (smooth vector gradients, banding stress), 3000x3000' };
}

let seed = 987654321;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += rnd(); return (s - 2) * 1.7; };

async function addNoise(buf, w, h, ch, sigma) {
  const raw = await sharp(buf).raw().toBuffer();
  for (let i = 0; i < raw.length; i += ch) { const n = gauss() * sigma; for (let c = 0; c < 3; c++) raw[i + c] = Math.max(0, Math.min(255, raw[i + c] + n)); }
  return sharp(raw, { raw: { width: w, height: h, channels: ch } });
}

async function genDocScan() {
  const w = 1240, h = 1754;
  let lines = '';
  // printed-text-like body: rows of short word bars (we avoid depending on fonts)
  for (let r = 0; r < 38; r++) {
    const y = 330 + r * 30; let x = 110;
    while (x < 1100) { const wl = 25 + rnd() * 90; if (x + wl > 1130) break; lines += `<rect x="${x.toFixed(0)}" y="${y}" width="${wl.toFixed(0)}" height="${(9 + rnd() * 3).toFixed(0)}" rx="2" fill="#262626"/>`; x += wl + 11 + rnd() * 6; }
  }
  // handwriting-like strokes: wobbly connected loops in blue ink
  let hand = '';
  for (let r = 0; r < 5; r++) {
    let x = 120, y = 1440 + r * 52, d = `M${x} ${y}`;
    while (x < 1050) { const dx = 18 + rnd() * 14; d += ` c${(dx * 0.3).toFixed(1)} ${(-22 - rnd() * 14).toFixed(1)} ${(dx * 0.7).toFixed(1)} ${(-24 - rnd() * 10).toFixed(1)} ${dx.toFixed(1)} ${(rnd() * 8 - 4).toFixed(1)} s${(dx * 0.4).toFixed(1)} ${(24 + rnd() * 10).toFixed(1)} ${(dx * 0.1).toFixed(1)} ${(rnd() * 6 - 3).toFixed(1)}`; x += dx * 1.5; if (rnd() < 0.12) { x += 28; d += ` m28 ${(rnd() * 6 - 3).toFixed(1)}`; } }
    hand += `<path d="${d}" fill="none" stroke="#1d3f9a" stroke-width="${(2.6 + rnd()).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>`;
  }
  const sig = `<path d="M820 1640 c40 -80 70 -90 80 -30 s-30 70 20 20 s60 -50 70 -10 s60 -30 90 -20" fill="none" stroke="#14327a" stroke-width="3.4" stroke-linecap="round"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6f3ea"/><stop offset="1" stop-color="#e6e1d3"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/><rect x="110" y="120" width="520" height="38" rx="3" fill="#1a1a1a"/><rect x="110" y="190" width="300" height="14" fill="#333"/><rect x="110" y="230" width="420" height="14" fill="#333"/>
<line x1="110" y1="290" x2="1130" y2="290" stroke="#444" stroke-width="2"/>${lines}${hand}${sig}
<rect x="0" y="0" width="38" height="${h}" fill="#000" opacity="0.07"/></svg>`;
  const base = await sharp(Buffer.from(svg)).rotate(0.6, { background: '#d8d3c6' }).resize(w, h, { fit: 'cover' }).removeAlpha().blur(0.6).toBuffer();
  const n = await addNoise(base, w, h, 3, 6);
  const file = path.join(INP, 'synthetic-doc-scan.jpg');
  await n.jpeg({ quality: 90 }).toFile(file);
  inputs['synthetic-doc-scan'] = { file, label: 'SYNTHETIC document scan, 1240x1754: bar-shaped printed text, blue handwriting-like strokes, paper grain, slight skew' };
}

async function genPassport() {
  const w = 630, h = 810;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs>
<radialGradient id="bg" cx="50%" cy="38%" r="80%"><stop offset="0" stop-color="#e8eef5"/><stop offset="1" stop-color="#b9c6d6"/></radialGradient>
<radialGradient id="skin" cx="42%" cy="38%" r="70%"><stop offset="0" stop-color="#e9b99a"/><stop offset="0.7" stop-color="#d09a78"/><stop offset="1" stop-color="#b57d5d"/></radialGradient>
<linearGradient id="jk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c3448"/><stop offset="1" stop-color="#171b27"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#bg)"/>
<path d="M20 810 C40 640 150 600 250 590 L380 590 C490 600 600 640 610 810 Z" fill="url(#jk)"/>
<path d="M255 590 L315 700 L375 590 Z" fill="#f2f2f2"/>
<rect x="268" y="500" width="94" height="110" rx="30" fill="#c08a69"/>
<ellipse cx="315" cy="340" rx="140" ry="178" fill="url(#skin)"/>
<ellipse cx="173" cy="360" rx="20" ry="40" fill="#c58a69"/><ellipse cx="457" cy="360" rx="20" ry="40" fill="#c58a69"/>
<path d="M170 320 C160 150 280 130 330 135 C430 140 470 200 462 330 C445 250 420 215 320 205 C240 205 195 245 170 320 Z" fill="#2a1d17"/>
<ellipse cx="260" cy="335" rx="26" ry="13" fill="#fff"/><ellipse cx="370" cy="335" rx="26" ry="13" fill="#fff"/>
<circle cx="262" cy="336" r="9" fill="#3b2a1f"/><circle cx="372" cy="336" r="9" fill="#3b2a1f"/>
<path d="M228 308 Q262 292 292 306" stroke="#2a1d17" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M338 306 Q368 292 402 308" stroke="#2a1d17" stroke-width="7" fill="none" stroke-linecap="round"/>
<path d="M315 345 C305 395 296 410 312 420 C330 424 340 414 328 398" stroke="#9e6a4d" stroke-width="5" fill="none" stroke-linecap="round"/>
<path d="M265 460 Q315 485 365 460" stroke="#8a4a3a" stroke-width="8" fill="none" stroke-linecap="round"/>
<ellipse cx="315" cy="540" rx="60" ry="12" fill="#000" opacity="0.12"/></svg>`;
  const base = await sharp(Buffer.from(svg)).blur(1.4).removeAlpha().toBuffer();
  const n = await addNoise(base, w, h, 3, 5);
  const file = path.join(INP, 'synthetic-passport.jpg');
  await n.jpeg({ quality: 92 }).toFile(file);
  inputs['synthetic-passport'] = { file, label: 'SYNTHETIC passport-style portrait stand-in (cartoon face on gradient + noise), 630x810. NOT a real face.' };
}

const fx = (name, label) => (inputs[name.replace(/\.\w+$/, '')] = { file: path.join(FIX, name), label });
function prepFixtures() {
  if (!fs.existsSync(path.join(FIX, 'signature-1200x400.png'))) execFileSync(process.execPath, [path.join(ROOT, 'scripts/gen-fixtures.mjs')], { stdio: 'inherit' });
  fx('signature-1200x400.png', 'Fixture: pen strokes on paper, 1200x400 PNG');
  fx('signature-140x60.png', 'Fixture: pen strokes on paper, 140x60 PNG');
  fx('transparent.png', 'Fixture: 800x600 RGBA (transparent quadrant, 50% white disc, 24% blue strip)');
  fx('noise-256.png', 'Fixture: 256x256 incompressible noise PNG');
}

// ---------------------------------------------------------------- cases
const J = { format: 'jpeg', strategy: 'quality-first', lockAspect: true, fit: 'contain', background: 'white' };
const cases = [];
const add = (id, input, opts, what) => cases.push({ id, input, opts: { ...J, ...opts }, what });
for (const [p, key] of [['land', 'photo-landscape'], ['detail', 'photo-detailed']]) {
  for (const kb of [20, 50, 100, 200]) add(`max${kb}kb-${p}`, key, { maxKb: kb }, `max ${kb} KB, JPEG, quality-first`);
  add(`max20kb-${p}-dimsfirst`, key, { maxKb: 20, strategy: 'dimensions-first' }, 'max 20 KB, JPEG, dimensions-first');
  add(`range20-50kb-${p}`, key, { minKb: 20, maxKb: 50 }, 'range 20-50 KB, JPEG');
}
add('fmt-jpeg-50kb-land', 'photo-landscape', { maxKb: 50 }, 'max 50 KB, JPEG (WebP comparison)');
add('fmt-webp-50kb-land', 'photo-landscape', { maxKb: 50, format: 'webp' }, 'max 50 KB, WebP (WebP comparison)');
add('fmt-jpeg-50kb-detail', 'photo-detailed', { maxKb: 50 }, 'max 50 KB, JPEG (WebP comparison)');
add('fmt-webp-50kb-detail', 'photo-detailed', { maxKb: 50, format: 'webp' }, 'max 50 KB, WebP (WebP comparison)');
add('max50kb-smooth-banding', 'smooth-gradient', { maxKb: 50 }, 'max 50 KB, JPEG, smooth gradient (banding check)');
add('max20kb-smooth-banding', 'smooth-gradient', { maxKb: 20 }, 'max 20 KB, JPEG, smooth gradient (banding check)');
add('png-alpha-keep-png-30kb', 'transparent', { maxKb: 30, format: 'png', background: 'keep' }, 'PNG with transparency, keep alpha (PNG out), max 30 KB');
add('png-alpha-keep-webp-30kb', 'transparent', { maxKb: 30, format: 'webp', background: 'keep' }, 'PNG with transparency, keep alpha (WebP out), max 30 KB');
add('png-alpha-jpeg-white-30kb', 'transparent', { maxKb: 30, format: 'jpeg', background: 'white' }, 'PNG with transparency, JPEG, fill white, max 30 KB');
add('signature-1200x400-max20kb', 'signature-1200x400', { maxKb: 20 }, 'signature scan, max 20 KB, JPEG');
add('signature-1200x400-max20kb-png', 'signature-1200x400', { maxKb: 20, format: 'png' }, 'signature scan, max 20 KB, PNG');
add('signature-1200x400-10to20kb', 'signature-1200x400', { minKb: 10, maxKb: 20 }, 'signature scan, range 10-20 KB, JPEG');
add('signature-140x60-min10kb', 'signature-140x60', { minKb: 10, maxKb: 20 }, 'tiny signature 140x60, min 10 KB (max 20 KB), JPEG');
add('signature-140x60-min10kb-enlarge', 'signature-140x60', { minKb: 10, maxKb: 20, allowEnlarge: true }, 'tiny signature 140x60, min 10 KB (max 20 KB), JPEG, allowEnlarge');
add('doc-scan-max100kb', 'synthetic-doc-scan', { maxKb: 100 }, 'synthetic document scan, max 100 KB, JPEG');
add('doc-scan-max50kb', 'synthetic-doc-scan', { maxKb: 50 }, 'synthetic document scan, max 50 KB, JPEG');
add('doc-scan-max20kb', 'synthetic-doc-scan', { maxKb: 20 }, 'synthetic document scan, max 20 KB, JPEG');
add('passport-max50kb', 'synthetic-passport', { maxKb: 50 }, 'synthetic passport-style portrait, max 50 KB, JPEG');
add('passport-max20kb', 'synthetic-passport', { maxKb: 20 }, 'synthetic passport-style portrait, max 20 KB, JPEG');
add('impossible-1kb-photo', 'photo-landscape', { maxKb: 1 }, 'impossible: max 1 KB, JPEG');
add('impossible-1kb-noise', 'noise-256', { maxKb: 1, format: 'png' }, 'impossible: max 1 KB on incompressible noise, PNG');

// ---------------------------------------------------------------- page code (runs in Chrome)
const PAGE = `
import * as E from './engine.js';
const clamp = (v) => Math.max(0, Math.min(255, v));
async function lumaAt640(bitmap, W, H) {
  const c = new OffscreenCanvas(W, H); const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.imageSmoothingQuality = 'high'; x.drawImage(bitmap, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data; const Y = new Float64Array(W * H);
  for (let i = 0, j = 0; j < Y.length; i += 4, j++) Y[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return Y;
}
/** Mean SSIM over non-overlapping 8x8 windows of the luma plane, both images scaled so the long side is 640 px. Indicative only. */
async function ssim640(srcBlob, outBlob) {
  const a = await createImageBitmap(srcBlob); const b = await createImageBitmap(outBlob);
  const s = 640 / Math.max(a.width, a.height); const W = Math.max(8, Math.round(a.width * s)), H = Math.max(8, Math.round(a.height * s));
  const A = await lumaAt640(a, W, H), B = await lumaAt640(b, W, H); a.close(); b.close();
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2; let sum = 0, n = 0;
  for (let y = 0; y + 8 <= H; y += 8) for (let x = 0; x + 8 <= W; x += 8) {
    let ma = 0, mb = 0; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { ma += A[(y + j) * W + x + i]; mb += B[(y + j) * W + x + i]; } ma /= 64; mb /= 64;
    let va = 0, vb = 0, cv = 0; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const p = A[(y + j) * W + x + i] - ma, q = B[(y + j) * W + x + i] - mb; va += p * p; vb += q * q; cv += p * q; }
    va /= 63; vb /= 63; cv /= 63; sum += ((2 * ma * mb + C1) * (2 * cv + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2)); n++;
  }
  return { ssim: sum / n, view: [W, H] };
}
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
window.runCase = async (name, opts) => {
  const r = await fetch('/in/' + name); const blob = await r.blob(); const file = new File([blob], name, { type: r.headers.get('content-type') });
  const t = performance.now();
  try {
    const res = await E.processImage(file, opts); const wall = Math.round(performance.now() - t);
    const m = await ssim640(file, res.blob);
    const u8 = new Uint8Array(await res.blob.arrayBuffer());
    return { ok: true, wall, status: res.status, bytes: res.bytes, mime: res.mime, width: res.width, height: res.height, quality: res.quality, attempts: res.attempts, elapsedMs: res.elapsedMs, mode: res.mode, notes: res.notes, message: res.message, window: res.window, source: res.source, originalFits: res.originalFits, ssim: m.ssim, view: m.view, data: u8.length <= ${MAX_OUT_BYTES} ? b64(u8) : null };
  } catch (e) { return { ok: false, code: e && e.code, message: String(e && e.message), wall: Math.round(performance.now() - t) }; }
};
window.ready = true;
`;

// ---------------------------------------------------------------- main
async function main() {
  prepWallpapers(); await genDocScan(); await genPassport(); prepFixtures();
  const bdir = path.join(TMP, 'bundle'); fs.mkdirSync(bdir);
  const common = { bundle: true, format: 'esm', target: 'es2022', logLevel: 'warning', minify: false };
  await esbuild.build({ ...common, entryPoints: [path.join(ROOT, 'src/lib/engine/index.ts')], outfile: path.join(bdir, 'engine.js') });
  await esbuild.build({ ...common, entryPoints: [path.join(ROOT, 'src/lib/engine/compress.worker.ts')], outfile: path.join(bdir, 'worker.js') });

  const MIME = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  const browser = await chromium.launch({ channel: 'chrome' });
  const chromeVersion = browser.version();
  const ctx = await browser.newContext();
  const outsideRequests = [];
  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== ORIGIN) { outsideRequests.push(u.href); return route.abort(); }
    const p = u.pathname; const js = (body) => route.fulfill({ status: 200, contentType: 'text/javascript', body });
    if (p === '/') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset=utf-8><script type="module" src="/page.js"></script>' });
    if (p === '/page.js') return js(PAGE);
    if (p === '/engine.js') return js(fs.readFileSync(path.join(bdir, 'engine.js'), 'utf8'));
    if (p === '/compress.worker.ts') return js(fs.readFileSync(path.join(bdir, 'worker.js'), 'utf8'));
    if (p.startsWith('/in/')) { const e = inputs[decodeURIComponent(p.slice(4))]; if (e) return route.fulfill({ status: 200, contentType: MIME[path.extname(e.file)], body: fs.readFileSync(e.file) }); }
    return route.fulfill({ status: 404, body: 'nf' });
  });
  const page = await ctx.newPage();
  await page.goto(ORIGIN + '/'); await page.waitForFunction(() => window.ready === true);

  // clean previous outputs
  for (const f of fs.readdirSync(OUT)) if (/^(\d\d-|src-)/.test(f) || f === 'index.html' || f === 'results.json') fs.rmSync(path.join(OUT, f));

  const results = []; let n = 0;
  for (const c of cases) {
    n++; const r = await page.evaluate(([i, o]) => window.runCase(i, o), [c.input, c.opts]);
    const rec = { n, ...c, input_label: inputs[c.input].label, ...r }; delete rec.data;
    if (r.ok) {
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[r.mime];
      if (r.data) { rec.file = `${String(n).padStart(2, '0')}-${c.id}.${ext}`; fs.writeFileSync(path.join(OUT, rec.file), Buffer.from(r.data, 'base64')); }
      else rec.file = null;
    }
    results.push(rec);
    console.log(String(n).padStart(2), c.id.padEnd(36), r.ok ? `${r.status.padEnd(9)} ${String(r.bytes).padStart(7)}B ${r.width}x${r.height} q=${r.quality} ${r.elapsedMs}ms ssim=${r.ssim.toFixed(3)}` : `ERR ${r.code} ${r.message}`);
  }
  await browser.close();

  // source previews (640 px long side, JPEG q80) so the owner can compare side by side
  const used = [...new Set(cases.map((c) => c.input))];
  for (const k of used) {
    const f = `src-${k}.jpg`;
    await sharp(inputs[k].file).rotate().resize(640, 640, { fit: 'inside', withoutEnlargement: false, kernel: 'lanczos3' }).flatten({ background: '#fff' }).jpeg({ quality: 80 }).toFile(path.join(OUT, f));
    inputs[k].preview = f;
  }
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ date: new Date().toISOString(), chrome: chromeVersion, outsideRequestsBlocked: outsideRequests, inputs: Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, v.label])), cases: results }, null, 1));
  writeIndex(results, chromeVersion);
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log('outside requests blocked:', outsideRequests.length);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function writeIndex(results, chrome) {
  const card = (r) => {
    const m = r.ok ? `<b>${esc(r.status)}</b> ${r.bytes} B (${(r.bytes / 1000).toFixed(1)} kB / ${(r.bytes / 1024).toFixed(1)} KiB) &middot; ${r.width}&times;${r.height} &middot; q=${r.quality ?? '-'} &middot; ${r.mime.replace('image/', '')} &middot; ${r.elapsedMs} ms (${r.mode}) &middot; SSIM ${r.ssim.toFixed(3)}` : `<b>ERROR ${esc(r.code)}</b> ${esc(r.message)}`;
    const o = r.file ? `<img src="${r.file}" alt="${esc(r.id)} output" style="max-width:640px">` : '(no image)';
    const win = r.ok ? `window ${r.window.minBytes ?? '-'}..${r.window.maxBytes ?? '-'} B` : '';
    return `<figure><figcaption><strong>${String(r.n).padStart(2, '0')} ${esc(r.id)}</strong><br>${esc(r.what)}<br>input: ${esc(r.input_label)}<br>${m}<br>${esc(win)}${r.ok && r.message ? '<br>msg: ' + esc(r.message) : ''}${r.ok && r.notes.length ? '<br>notes: ' + esc(r.notes.join(' | ')) : ''}</figcaption>
<div class="row"><div><small>source (640 px preview)</small><br><img src="src-${r.input}.jpg" alt="source" style="max-width:640px"></div><div><small>output (actual pixels, shown at most 640 px wide)</small><br>${o}</div></div></figure>`;
  };
  const html = `<!doctype html><meta charset="utf-8"><title>SizeTune quality samples</title>
<style>body{font:14px/1.4 system-ui,sans-serif;margin:16px;background:#fff;color:#111}figure{margin:0 0 28px;padding-bottom:16px;border-bottom:1px solid #ccc}figcaption{margin-bottom:8px}.row{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}img{border:1px solid #999;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/16px 16px}small{color:#555}</style>
<h1>SizeTune quality samples (${esc(new Date().toISOString().slice(0, 10))}, Chrome ${esc(chrome)})</h1>
<p>Real engine, real Chrome. SSIM = luma, 8x8 windows, both images scaled to 640 px long side: indicative only. Synthetic inputs are labelled SYNTHETIC; there are no real face photos. Transparent checkerboard behind images is only the page background. See QUALITY_SAMPLES.md.</p>
${results.map(card).join('\n')}`;
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
}

main().catch((e) => { console.error(e); process.exit(1); });
