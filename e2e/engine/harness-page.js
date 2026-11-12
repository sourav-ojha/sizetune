// Runs inside the blank test page (served at http://engine.test/harness.js). Plain JS on purpose: the same file is used by
// the Safari/iOS-Simulator harness (docs/engine/CROSS_BROWSER.md). Never sends anything anywhere except, in the
// simulator harness, results to the local test server that served it.
import * as E from './engine.js';

window.E = E;
const hex = (u) => [...u].map((b) => b.toString(16).padStart(2, '0')).join('');

function app1Exif(u) {
  // true if any APP1 segment before SOS carries an "Exif\0\0" header
  if (u[0] !== 0xff || u[1] !== 0xd8) return false;
  let i = 2;
  while (i + 4 <= u.length) {
    if (u[i] !== 0xff) return false;
    const m = u[i + 1];
    if (m === 0xda) return false;
    const len = (u[i + 2] << 8) | u[i + 3];
    if (m === 0xe1 && String.fromCharCode(...u.slice(i + 4, i + 8)) === 'Exif') return true;
    i += 2 + len;
  }
  return false;
}

export async function fixture(name) {
  const r = await fetch('/fixtures/' + name);
  if (!r.ok) throw new Error('fixture missing ' + name);
  const b = await r.blob();
  return new File([b], name, { type: r.headers.get('content-type') || '' });
}

/** Deterministic photo-ish image generated on the fly (not committed): gradient + translucent discs + grain. */
export async function makeLarge(w, h, quality = 0.9) {
  const c = new OffscreenCanvas(w, h);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#3b6ea5'); g.addColorStop(0.5, '#e0c080'); g.addColorStop(1, '#2d5a27');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  let s = 12345;
  const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 2500; i++) {
    x.fillStyle = `rgba(${(R() * 255) | 0},${(R() * 255) | 0},${(R() * 255) | 0},${0.15 + R() * 0.3})`;
    x.beginPath(); x.arc(R() * w, R() * h, 5 + R() * Math.min(w, h) * 0.05, 0, Math.PI * 2); x.fill();
  }
  const blob = await c.convertToBlob({ type: 'image/jpeg', quality });
  c.width = 0; c.height = 0;
  return new File([blob], `large-${w}x${h}.jpg`, { type: 'image/jpeg' });
}

export async function summarize(r) {
  const u = new Uint8Array(await r.blob.arrayBuffer());
  const txt = new TextDecoder('latin1').decode(u);
  let decoded;
  try { const bm = await createImageBitmap(r.blob); decoded = { w: bm.width, h: bm.height }; bm.close(); } catch (e) { decoded = { error: String(e) }; }
  return {
    status: r.status, bytes: r.bytes, blobSize: r.blob.size, mime: r.mime, width: r.width, height: r.height, quality: r.quality,
    attempts: r.attempts, window: r.window, source: r.source, notes: r.notes, message: r.message, mode: r.mode, elapsedMs: r.elapsedMs,
    originalFits: r.originalFits, magic: hex(u.slice(0, 12)), decoded,
    hasTestCam: txt.includes('TestCam'), hasModel9: txt.includes('Model9'), hasExifApp1: app1Exif(u), hasIcc: txt.includes('ICC_PROFILE'),
  };
}

let engine = null;
/** A dedicated engine with custom limits (the default processImage uses DEFAULT_LIMITS). */
export function makeEngine(limits) {
  return E.createEngine({ createWorker: () => new Worker(new URL('./compress.worker.ts', import.meta.url), { type: 'module' }), limits });
}

export async function run(input, opts, { limits, keep = true } = {}) {
  const file = typeof input === 'string' ? await fixture(input) : input && input.large ? (window.lastLarge = await makeLarge(input.large[0], input.large[1])) : input;
  const t = performance.now();
  try {
    const eng = limits ? (engine = makeEngine(limits)) : null;
    const r = await (eng ? eng.process(file, opts) : E.processImage(file, opts));
    if (keep) window.last = r.blob;
    return { ok: true, wallMs: Math.round(performance.now() - t), ...(await summarize(r)) };
  } catch (e) {
    return { ok: false, wallMs: Math.round(performance.now() - t), code: e && e.code, name: e && e.name, message: String(e && e.message) };
  }
}

/** RGBA of `window.last` at the given points (pixel coords). */
export async function pixels(points, blob = window.last) {
  const bm = await createImageBitmap(blob);
  const c = new OffscreenCanvas(bm.width, bm.height);
  const x = c.getContext('2d');
  x.drawImage(bm, 0, 0);
  bm.close();
  return points.map(([px, py]) => [...x.getImageData(px, py, 1, 1).data]);
}

Object.assign(window, { fixture, makeLarge, summarize, run, pixels, makeEngine, harnessReady: true });
