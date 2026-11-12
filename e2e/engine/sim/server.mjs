#!/usr/bin/env node
/**
 * Local-only harness server for Safari / iOS Simulator (see docs/engine/CROSS_BROWSER.md).
 *   node e2e/engine/sim/server.mjs [port]      (bundles the engine first, binds 127.0.0.1 only)
 *   xcrun simctl openurl booted http://127.0.0.1:<port>/sim.html
 * Serves the esbuild engine bundle, the shared harness page and tests/fixtures; the page POSTs JSON results to /report,
 * which are appended to .tmp/engine-sim-results.jsonl. Nothing is sent anywhere else.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import globalSetup from '../global-setup.ts';

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, '../../..');
const BUNDLE = path.join(ROOT, '.tmp/engine-e2e');
const FIX = path.join(ROOT, 'tests/fixtures');
const OUT = path.join(ROOT, '.tmp/engine-sim-results.jsonl');
const port = Number(process.argv[2] || 8799);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic' };

await globalSetup();

const PAGE = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>engine sim</title>
<pre id=o style="font:11px monospace;white-space:pre-wrap">running…</pre>
<script type=module>
import './harness.js';
import { CASES } from './cases.js';
const o = document.getElementById('o');
const post = (m) => fetch('/report', { method: 'POST', body: JSON.stringify(m) }).catch(() => {});
const only = new URLSearchParams(location.search).get('only');
await post({ name: 'start', t: Date.now() });
for (const [name, fn] of CASES) {
  if (only && !only.split(',').includes(name)) continue;
  o.textContent += '\\n' + name + ' …';
  const t = performance.now();
  let r; try { r = await fn(); } catch (e) { r = { threw: String(e) }; }
  await post({ name, ms: Math.round(performance.now() - t), r });
  o.textContent += ' done';
}
await post({ name: 'done' });
o.textContent += '\\nALL DONE';
</script>`;

const send = (res, code, type, body) => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'POST' && u.pathname === '/report') {
    let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => { fs.appendFileSync(OUT, b + '\n'); send(res, 200, 'text/plain', 'ok'); });
    return;
  }
  const p = u.pathname;
  if (p === '/sim.html' || p === '/') return send(res, 200, 'text/html', PAGE);
  if (p === '/harness.js') return send(res, 200, 'text/javascript', fs.readFileSync(path.join(HERE, '../harness-page.js')));
  if (p === '/cases.js') return send(res, 200, 'text/javascript', fs.readFileSync(path.join(HERE, 'cases.js')));
  if (p === '/engine.js') return send(res, 200, 'text/javascript', fs.readFileSync(path.join(BUNDLE, 'engine.js')));
  if (p === '/compress.worker.ts' || p === '/worker-real.js') return send(res, 200, 'text/javascript', fs.readFileSync(path.join(BUNDLE, 'worker-real.js')));
  if (p.startsWith('/fixtures/')) {
    const f = path.join(FIX, decodeURIComponent(p.slice(10)));
    if (f.startsWith(FIX) && fs.existsSync(f)) return send(res, 200, TYPES[path.extname(f)] || 'application/octet-stream', fs.readFileSync(f));
  }
  send(res, 404, 'text/plain', 'nf');
}).listen(port, '127.0.0.1', () => console.log(`engine sim harness on http://127.0.0.1:${port}/sim.html -> results in ${path.relative(ROOT, OUT)}`));
