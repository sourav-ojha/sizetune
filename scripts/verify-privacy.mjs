// Privacy / "files never leave the device" verifier for the BUILT site (dist/). No JS executed. Rule catalogue: docs/verification/VERIFIERS.md
//
// Every finding is a FAIL (exit 1). Checks:
//   P1  third-party origin / script / style / font / embed on any tool route (home + tool pages), incl. <noscript> content and CSS url()/@import
//   P2  strict CSP on every tool route (exact allowed value sets, hashes cover every inline script/style, meta precedes content)
//   P3  no ad / analytics / tracking / CMP identifier ANYWHERE in dist (markup context of HTML, full text of every other file, file names)
//   P4  _headers: frame-ancestors 'none', nosniff, no-referrer-ish policy, Permissions-Policy, COOP, no CORS wildcard, no cookies, no third-party Link/report endpoints
//   P5  no network primitive (fetch/XHR/sendBeacon/WebSocket/EventSource/WebRTC/importScripts/...) in any JS a tool page loads, beyond the documented,
//       evidence-backed allow-list in scripts/verify-lib.mjs (JS_PRIMITIVE_ALLOWLIST). Workers must be created from literal same-site chunks.
// Usage: node scripts/verify-privacy.mjs      API: verifyPrivacy(dist) -> { fails, info }
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  SITE, walk, loadPages, classifyUrl, urlRefs, getAttr, tokens, isHtmlEl, isExecutableScript, scriptText, cspIssues, cspAllowsInline, parseCsp,
  jsIssues, cssIssues, jsClosure, findTrackers, markupText, JS_PRIMITIVE_ALLOWLIST, EXTERNAL_RESOURCE_ALLOWLIST, scanJs, workerRefs,
} from './verify-lib.mjs';

const TEXT_EXT = /\.(html?|js|mjs|css|json|xml|txt|svg|map|webmanifest|md)$/i;
const REFERRER_OK = ['no-referrer', 'same-origin', 'strict-origin', 'strict-origin-when-cross-origin'];

function parseHeaders(text) {
  const blocks = []; let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (/^\S/.test(raw)) { cur = { pattern: raw.trim(), set: [], detach: [] }; blocks.push(cur); continue; }
    if (!cur) continue;
    const t = raw.trim();
    if (t.startsWith('!')) cur.detach.push(t.slice(1).trim().toLowerCase());
    else { const i = t.indexOf(':'); if (i > 0) cur.set.push([t.slice(0, i).trim().toLowerCase(), t.slice(i + 1).trim()]); }
  }
  return blocks;
}

export function verifyPrivacy(dist = 'dist') {
  const fails = [], info = [];
  const f = (m) => fails.push(m);
  const pages = loadPages(dist);
  const tools = pages.filter((p) => p.toolRoute);
  if (!tools.length) f('no tool routes found (no page with data-page-type=home|tool or data-testid=tool): nothing to verify');
  info.push(`tool routes: ${tools.map((p) => p.route).join(' ')}`);

  /* P1 + P2: per tool route */
  for (const p of tools) {
    const e = (m) => f(`${p.route}: ${m}`);
    for (const el of p.els) {
      for (const r of urlRefs(el)) {
        const k = classifyUrl(r.url, p.route);
        if (k.kind === 'external') e(`third-party origin (${r.tag}[${r.attr}]): ${r.url}`);
        else if (k.kind === 'javascript' || (k.kind === 'data' && !/^data:image\//i.test(k.v)) || k.kind === 'other-scheme') e(`non-self URL scheme (${r.tag}[${r.attr}]): ${r.url.slice(0, 40)}`);
      }
      if (['iframe', 'frame', 'object', 'embed', 'applet', 'portal'].includes(el.tagName)) e(`embedding element <${el.tagName}>`);
      if (isHtmlEl(el, 'link') && tokens(getAttr(el, 'rel')).some((r) => ['preconnect', 'dns-prefetch', 'prefetch', 'prerender'].includes(r))) e(`<link rel=${getAttr(el, 'rel')}> resource hint (contacts a host before any consent)`);
      if (isHtmlEl(el, 'style')) for (const m of cssIssues('inline <style>', scriptText(el))) e(m);
    }
    const meta = p.els.filter((x) => isHtmlEl(x, 'meta') && (getAttr(x, 'http-equiv') ?? '').toLowerCase() === 'content-security-policy');
    if (meta.length !== 1) { e(`${meta.length} CSP <meta> elements (need exactly 1)`); continue; }
    const csp = getAttr(meta[0], 'content') ?? '';
    for (const m of cspIssues(csp, { tool: true })) e(m);
    for (const s of p.els.filter((x) => isExecutableScript(x) && !x.attrs.some((a) => a.name === 'src'))) if (!cspAllowsInline(csp, 'script-src', scriptText(s))) e('inline <script> not covered by a CSP hash');
    for (const s of p.els.filter((x) => isHtmlEl(x, 'style'))) if (!cspAllowsInline(csp, 'style-src', scriptText(s))) e('inline <style> not covered by a CSP hash');
    const at = p.els.indexOf(meta[0]);
    const early = p.els.slice(0, at).find((x) => isExecutableScript(x) || isHtmlEl(x, 'style') || isHtmlEl(x, 'body') || (isHtmlEl(x, 'link') && /stylesheet|preload/.test(getAttr(x, 'rel') ?? '')));
    if (early) e(`CSP <meta> comes after <${early.tagName}> (meta CSP only governs what follows)`);
  }
  for (const file of walk(dist).filter((x) => x.endsWith('.css'))) for (const m of cssIssues(file.slice(dist.length), readFileSync(file, 'utf8'))) f(`[css] ${m}`);
  if (EXTERNAL_RESOURCE_ALLOWLIST.length) info.push(`external-resource allow-list entries (non-tool pages only): ${EXTERNAL_RESOURCE_ALLOWLIST.length}`);

  /* P3: trackers anywhere in dist */
  for (const file of walk(dist)) {
    const rel = file.slice(dist.length).replace(/^[\\/]+/, '');
    const hit = (what, text) => { for (const s of findTrackers(text)) f(`[tracker] ${rel}: ${what} matches /${s}/`); };
    hit('file name', rel);
    if (file.endsWith('.html')) { const pg = pages.find((x) => x.f === file); if (pg) hit('markup', markupText(pg)); }
    else if (TEXT_EXT.test(file) || /(^|[\\/])_headers$|_redirects$/.test(file)) hit('content', readFileSync(file, 'utf8'));
    else if (statSync(file).size < 5_000_000) { const b = readFileSync(file); if (!b.includes(0)) hit('content', b.toString('utf8')); }
  }

  /* P4: _headers */
  const hp = join(dist, '_headers');
  if (!existsSync(hp)) f('_headers missing (frame-ancestors/nosniff/COOP are delivered by headers)'); else {
    const blocks = parseHeaders(readFileSync(hp, 'utf8'));
    const star = blocks.filter((b) => b.pattern === '/*');
    const get = (n) => star.flatMap((b) => b.set).filter(([k]) => k === n).map(([, v]) => v);
    const detached = (n) => star.some((b) => b.detach.includes(n));
    for (const n of ['x-content-type-options', 'x-frame-options', 'content-security-policy', 'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy']) {
      if (!get(n).length) f(`_headers: /* is missing ${n}`); if (detached(n)) f(`_headers: /* detaches ${n}`);
    }
    if (get('x-content-type-options').some((v) => v.toLowerCase() !== 'nosniff')) f('_headers: X-Content-Type-Options must be nosniff');
    if (get('x-frame-options').some((v) => v.toUpperCase() !== 'DENY')) f('_headers: X-Frame-Options must be DENY');
    if (!get('content-security-policy').some((v) => parseCsp(v).dirs.get('frame-ancestors')?.join(' ') === "'none'")) f("_headers: Content-Security-Policy must include frame-ancestors 'none'");
    for (const v of get('content-security-policy')) if (/unsafe-|\*|https?:/.test(v)) f(`_headers: CSP header is weak: ${v}`);
    if (get('referrer-policy').some((v) => !REFERRER_OK.includes(v.toLowerCase()))) f(`_headers: Referrer-Policy must be one of ${REFERRER_OK.join(', ')}`);
    for (const dev of ['camera', 'microphone', 'geolocation']) if (get('permissions-policy').length && !get('permissions-policy').some((v) => new RegExp(`\\b${dev}=\\(\\)`).test(v))) f(`_headers: Permissions-Policy must disable ${dev} (${dev}=())`);
    if (get('cross-origin-opener-policy').some((v) => v !== 'same-origin')) f('_headers: Cross-Origin-Opener-Policy must be same-origin');
    for (const b of blocks) for (const [k, v] of b.set) {
      if (k === 'access-control-allow-origin' && v.trim() === '*') f(`_headers: ${b.pattern} sets Access-Control-Allow-Origin: *`);
      if (k === 'set-cookie') f(`_headers: ${b.pattern} sets a cookie`);
      if (k === 'link' && /https?:\/\/(?!sizetune\.com)|\/\/[a-z]/i.test(v)) f(`_headers: ${b.pattern} Link header points off-site: ${v.slice(0, 60)}`);
      if (/^content-security-policy(-report-only)?$/.test(k)) for (const n of ['report-uri', 'report-to']) for (const u of parseCsp(v).dirs.get(n) ?? []) if (/^(https?:)?\/\//i.test(u) && !u.startsWith(SITE)) f(`_headers: CSP ${n} to third party ${u}`);
    }
    if (!blocks.some((b) => /workers\.dev/.test(b.pattern) && b.set.some(([k, v]) => k === 'x-robots-tag' && /noindex/i.test(v)))) f('_headers: *.workers.dev preview hosts are not X-Robots-Tag: noindex');
    if (!blocks.some((b) => b.pattern.startsWith('/_astro') && b.set.some(([k, v]) => k === 'cache-control' && /immutable/.test(v)))) f('_headers: /_astro/* is not cached immutable');
  }

  /* P5: network capability in JS loaded by tool pages */
  const { files, missing } = jsClosure(dist, tools);
  for (const m of missing) f(`${m.via}: JS chunk ${m.path} referenced but not in dist`);
  if (!files.size) f('tool pages load no JS chunks (wiring changed? cannot prove anything)');
  for (const [path, { src }] of files) {
    for (const m of jsIssues(path, src, dist)) f(`[js] ${m}`);
    const w = workerRefs(src); for (const lit of w.literals) { const r = lit.startsWith('/') ? lit : null; if (r && !existsSync(join(dist, r))) f(`[js] ${path}: Worker script ${lit} not in dist`); }
    info.push(`scanned ${path} (${src.length} B): ${scanJs(src).map((x) => `${x.id}x${x.items.length}`).join(' ') || 'no flagged primitives'}`);
  }
  for (const p of tools) for (const s of p.els.filter((x) => isExecutableScript(x) && !x.attrs.some((a) => a.name === 'src'))) {
    for (const m of jsIssues(`${p.route} <inline script>`, scriptText(s))) if (!/'dyn-import'/.test(m)) f(`[js] ${m}`); // astro-island bootstrap import()s same-site chunks; CSP enforces 'self'
  }
  // The audited dynamic import (island hydrator -> bundled signals) only runs for data-preact-signals: no page may ever carry it.
  for (const p of pages) if (/data-preact-signals/i.test(p.html)) f(`${p.route}: island carries data-preact-signals (would execute the audited dynamic import)`);
  info.push(`JS primitive allow-list: ${JS_PRIMITIVE_ALLOWLIST.map((a) => `${a.id}<=${a.max}`).join(', ')}`);
  return { fails, info };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!existsSync('dist/index.html')) { console.error('dist/ not found: run `npm run build` first'); process.exit(2); }
  const r = verifyPrivacy('dist');
  console.log(r.info.map((x) => ' · ' + x).join('\n'));
  if (r.fails.length) { console.error('\nPRIVACY FAILED:\n - ' + r.fails.join('\n - ')); process.exit(1); }
  console.log('\nverify:privacy OK');
}
