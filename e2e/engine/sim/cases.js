// Standard engine cases shared by the Safari/iOS-Simulator page (and usable from any browser console).
// Each case returns a small JSON summary; nothing here leaves the device except the POST to the local test server.
const B = { format: 'jpeg', strategy: 'quality-first', lockAspect: true, fit: 'contain', background: 'white' };
const pick = (r) => (r.ok ? { ok: true, status: r.status, bytes: r.bytes, mime: r.mime, w: r.width, h: r.height, q: r.quality, attempts: r.attempts, ms: r.elapsedMs, wallMs: r.wallMs, mode: r.mode, notes: r.notes, hasTestCam: r.hasTestCam, hasModel9: r.hasModel9, hasExifApp1: r.hasExifApp1, hasIcc: r.hasIcc, magic: r.magic.slice(0, 8), decoded: r.decoded, source: r.source, message: r.message } : { ok: false, code: r.code, message: r.message, wallMs: r.wallMs });

export const CASES = [
  ['env', async () => ({ ua: navigator.userAgent, mode: window.E.engineMode(), webp: await window.E.canEncode('webp'), jpeg: await window.E.canEncode('jpeg'), png: await window.E.canEncode('png'), offscreen: typeof OffscreenCanvas !== 'undefined' })],
  ['jpeg-max50', () => window.run('photo-1200x800.jpg', { ...B, maxKb: 50 }).then(pick)],
  ['12mp-max100', () => window.run('.generated/photo-12mp.jpg', { ...B, maxKb: 100 }).then(pick)],
  ['12mp-range-20-50', () => window.run('.generated/photo-12mp.jpg', { ...B, minKb: 20, maxKb: 50 }).then(pick)],
  ['12mp-range-19-20', () => window.run('.generated/photo-12mp.jpg', { ...B, minKb: 19, maxKb: 20 }).then(pick)],
  ['36mp-generated-max50', () => window.run({ large: [6000, 6000] }, { ...B, maxKb: 50 }).then(pick)],
  ['48mp-generated-max50', () => window.run({ large: [8000, 6000] }, { ...B, maxKb: 50 }).then(pick)],
  ['transparent-auto-keep', () => window.run('transparent.png', { ...B, format: 'auto', background: 'keep' }).then(pick)],
  ['transparent-jpeg-white', async () => { const r = pick(await window.run('transparent.png', { ...B, background: 'white' })); r.corner = (await window.pixels([[10, 10]]))[0]; return r; }],
  ['exif6-orientation', async () => { const r = pick(await window.run('exif6-gps.jpg', { ...B })); const [top, bottom] = await window.pixels([[150, 20], [150, 380]]); return { ...r, top, bottom }; }],
  ['exif6-gps-stripped-jpeg', () => window.run('exif6-gps.jpg', { ...B, maxKb: 50 }).then(pick)],
  ['signature-140x60-below-min', () => window.run('signature-140x60.png', { ...B, width: 140, height: 60, minKb: 10, maxKb: 20 }).then(pick)],
  ['raise-200x230', async () => {
    const p = await window.run('photo-1200x800.jpg', { ...B, width: 200, height: 230, fit: 'cover', quality: 95 });
    const minKb = Math.ceil((p.bytes * 1.12) / 1024);
    return { q95: p.bytes, minKb, ...pick(await window.run('photo-1200x800.jpg', { ...B, width: 200, height: 230, fit: 'cover', minKb, maxKb: minKb * 3 })) };
  }],
  ['impossible-max-free', () => window.run('noise-256.png', { ...B, maxKb: 0.5 }).then(pick)],
  ['impossible-max-fixed', () => window.run('noise-256.png', { ...B, width: 256, height: 256, maxKb: 0.5 }).then(pick)],
  ['webp-requested', () => window.run('photo-1200x800.jpg', { ...B, format: 'webp', maxKb: 50 }).then(pick)],
  ['webp-input-auto', () => window.run('photo-800x600.webp', { ...B, format: 'auto', maxKb: 50 }).then(pick)],
  ['strip-icc', async () => { const a = pick(await window.run('photo-200x230.jpg', { ...B, quality: 80 })); const b = pick(await window.run('photo-200x230.jpg', { ...B, quality: 80, stripIcc: true })); return { plain: a.bytes, plainIcc: a.hasIcc, stripped: b.bytes, strippedIcc: b.hasIcc, notes: b.notes }; }],
  ['corrupt-garbage', () => window.run('corrupt-garbage.jpg', B).then(pick)],
  ['corrupt-truncated', () => window.run('corrupt-truncated.jpg', { ...B, maxKb: 10 }).then(pick)],
  ['corrupt-truncated-png', () => window.run('corrupt-truncated.png', B).then(pick)],
  ['corrupt-truncated-webp', () => window.run('corrupt-truncated.webp', B).then(pick)],
  ['trailing-garbage', () => window.run('trailing-garbage.jpg', B).then(pick)],
  ['motion-photo-like', () => window.run('motion-photo-like.jpg', B).then(pick)],
  ['inspect-gps', async () => window.E.inspectFile(await window.fixture('exif6-gps.jpg'))],
  ['svg-renamed', () => window.run('svg-renamed.png', B).then(pick)],
  ['cancel', async () => {
    const f = await window.makeLarge(6000, 6000);
    const ac = new AbortController();
    let tA = 0;
    try {
      await window.E.processImage(f, { ...B, maxKb: 50 }, { signal: ac.signal, onProgress: (x) => { if (x.attempt === 2 && !tA) { tA = performance.now(); ac.abort(); } } });
      return { resolved: true };
    } catch (e) { return { code: e.code, afterAbortMs: Math.round(performance.now() - tA) }; }
  }],
  ['repeat-12mp-x10', async () => { const ms = []; for (let i = 0; i < 10; i++) { const r = await window.run('.generated/photo-12mp.jpg', { ...B, maxKb: 100 }, { keep: false }); ms.push(r.ok ? r.elapsedMs : r.code); } return { ms }; }],
];
