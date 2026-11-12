// Shared helpers for scripts/verify-html.mjs and scripts/verify-privacy.mjs.
// Parser: parse5 (WHATWG-conformant HTML5 parser, the one used by jsdom/Angular/lit). It tokenises exactly like a
// browser, so unquoted/odd-case/duplicate attributes, comments, <template>, raw-text elements and mis-nested tags
// cannot hide markup from the checks the way they could from the previous regexes. Nothing here executes JS.
//
// Scanning is deliberately CONSERVATIVE: anything that merely *looks* like a risky capability is reported, and the
// only way to silence it is an explicit, justified entry in the allow-lists below (reviewed in docs/verification/VERIFIERS.md).
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname, posix } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';

export const SITE = 'https://sizetune.com';
export const HTML_NS = 'http://www.w3.org/1999/xhtml';

export const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

/* ------------------------------------------------------------------ allow-lists (all empty or evidence-backed) */

// External (non-SITE) RESOURCES (script/img/link/iframe/css url()...) on NON-tool pages. Tool routes never get exceptions.
// Entry: { origin: 'https://example.com', tags: ['img'], pageTypes: ['guide'], reason: '...' }. NONE today (ad-free, self-hosted).
export const EXTERNAL_RESOURCE_ALLOWLIST = [];

// Embedding tags (<iframe>/<object>/<embed>/...) are banned everywhere unless listed here. NONE today.
// Entry: { tag: 'iframe', origin: 'https://...', pageTypes: [...], reason: '...' }
export const EMBED_ALLOWLIST = [];

// Network/side-channel capability found in tool-page JS. Entry applies only to a file whose source matches `signature`
// and only up to `max` occurrences (so growth must be re-audited). Optional `only` restricts WHICH matched strings are
// covered; optional `proof` (global regex) must match at least as many times as the entry covers, i.e. every covered
// occurrence must be a recognised, literal, same-site form (checked on the whole file, not just the matched token).
// Evidence was gathered by reading the built chunks (Preact 11 + preact/compat + @astrojs/preact client, bundled by
// Astro/Vite into _astro/preact.*.js and _astro/client.*.js); full audit in docs/experiments/PREACT.md.
// Everything else the old React 19 react-dom list covered (preconnect/dns-prefetch, script injection, navigator.connection,
// react.dev error URLs) does NOT exist in the Preact chunks, so those four entries were REMOVED, not carried over.
export const JS_PRIMITIVE_ALLOWLIST = [
  { id: 'external-url', signature: /(?=[\s\S]*foreignObject)(?=[\s\S]*http:\/\/www\.w3\.org\/1998\/Math\/MathML)(?=[\s\S]*dangerouslySetInnerHTML)/, max: 6,
    only: /^http:\/\/www\.w3\.org\/(1998\/Math\/MathML|2000\/svg|1999\/xhtml)$/,
    reason: 'preact core (diff/createElementNS) uses the SVG, MathML and XHTML XML-namespace identifiers (svg x2, MathML x2, xhtml x2 in this build) as namespace strings for createElementNS/foreignObject handling. They are identifiers, never fetched (CSP connect-src \'self\' would block it anyway).' },
  { id: 'dyn-import', signature: /data-preact-island-id/, max: 1, proof: /import\(`\.\/signals\.module\.[\w-]+\.js`\)/g,
    reason: '@astrojs/preact client hydrator lazily imports its own bundled @preact/signals chunk (same-site, literal relative specifier ./signals.module.<hash>.js) only when an island carries data-preact-signals, which SizeTune never emits (asserted by tests). `proof` requires the single import() to be exactly that literal form, so any other dynamic import (or a non-literal specifier) still fails.' },
];

/* ------------------------------------------------------------------ parsing */

export const parseDoc = (html) => parse(html, { scriptingEnabled: false }); // noscript content becomes real elements => scanned too

export function* walkNodes(node) {
  for (const c of node.childNodes ?? []) { yield c; yield* walkNodes(c); }
  if (node.content) yield* walkNodes(node.content); // <template>
}
export const isEl = (n) => typeof n.tagName === 'string';
export const isHtmlEl = (n, tag) => isEl(n) && n.namespaceURI === HTML_NS && (tag === undefined || n.tagName === tag);
export const getAttr = (el, name) => el.attrs?.find((a) => a.name === name)?.value;
export const hasAttr = (el, name) => el.attrs?.some((a) => a.name === name) ?? false;
export const tokens = (v) => (v ?? '').toLowerCase().split(/\s+/).filter(Boolean);
export const textOf = (node, skip = () => false) => {
  const out = [];
  (function rec(n) {
    for (const c of n.childNodes ?? []) {
      if (c.nodeName === '#text') out.push(c.value);
      else if (isEl(c) && !skip(c)) rec(c);
    }
  })(node);
  return out.join(' ');
};
const SKIP_TEXT = (el) => ['astro-island', 'noscript', 'script', 'style', 'template'].includes(el.tagName);
export const mainWords = (main) => (main ? textOf(main, SKIP_TEXT) : '').split(/\s+/).filter(Boolean);

export const EXEC_TYPES = /^(|module|text\/javascript|application\/javascript|text\/ecmascript|application\/ecmascript|text\/jscript|application\/x-javascript|text\/x-javascript)$/;
export const scriptType = (el) => (getAttr(el, 'type') ?? '').trim().toLowerCase();
export const isJsonLd = (el) => isHtmlEl(el, 'script') && scriptType(el) === 'application/ld+json';
export const isExecutableScript = (el) => isHtmlEl(el, 'script') && EXEC_TYPES.test(scriptType(el));
export const scriptText = (el) => (el.childNodes ?? []).map((c) => c.value ?? '').join('');

export const routeOf = (rel) => (rel === '404.html' ? '/404/' : '/' + rel.replace(/index\.html$/, ''));

/** Read and parse every .html in dist. */
export function loadPages(dist) {
  const all = walk(dist);
  return all.filter((f) => f.endsWith('.html')).map((f) => {
    const html = readFileSync(f, 'utf8');
    const rel = relative(dist, f).split('\\').join('/');
    const route = routeOf(rel);
    const doc = parseDoc(html);
    const els = [...walkNodes(doc)].filter(isEl);
    const first = (tag) => els.find((e) => isHtmlEl(e, tag));
    const body = first('body');
    const robotsMetas = els.filter((e) => isHtmlEl(e, 'meta') && ['robots', 'googlebot'].includes((getAttr(e, 'name') ?? '').trim().toLowerCase()));
    const robotsDirs = robotsMetas.flatMap((m) => (getAttr(m, 'content') ?? '').toLowerCase().split(/[,\s]+/).filter(Boolean));
    const type = body ? getAttr(body, 'data-page-type') : undefined;
    const isTool = els.some((e) => getAttr(e, 'data-testid') === 'tool');
    return { f, rel, route, html, doc, els, type, isTool, toolRoute: type === 'tool' || type === 'home' || isTool,
      noindex: robotsDirs.includes('noindex') || robotsDirs.includes('none'), robotsDirs, robotsMetas, main: els.filter((e) => isHtmlEl(e, 'main')) };
  });
}

/* ------------------------------------------------------------------ URLs */

/** Classify a raw attribute URL relative to a page route. Browsers strip tabs/newlines and leading C0/space. */
export function classifyUrl(raw, route = '/') {
  const v = String(raw ?? '').replace(/[\t\n\r]/g, '').replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '');
  if (v === '') return { kind: 'empty', v };
  let u; try { u = new URL(v, SITE + route); } catch { return { kind: 'invalid', v }; }
  const scheme = u.protocol;
  if (scheme === 'javascript:') return { kind: 'javascript', v, u };
  if (scheme === 'data:') return { kind: 'data', v, u };
  if (scheme === 'blob:') return { kind: 'blob', v, u };
  if (scheme === 'mailto:' || scheme === 'tel:') return { kind: 'contact', v, u };
  if (scheme !== 'http:' && scheme !== 'https:') return { kind: 'other-scheme', v, u };
  if (u.origin === SITE) return { kind: 'internal', v, u, path: decodeURIComponent(u.pathname), hash: u.hash.slice(1), scheme };
  return { kind: 'external', v, u, scheme };
}
export const toFile = (dist, path) => (path.endsWith('/') ? join(dist, path, 'index.html') : join(dist, path));

export function parseSrcset(s) {
  const urls = []; let i = 0; const n = s.length;
  while (i < n) {
    while (i < n && /[\s,]/.test(s[i])) i++;
    if (i >= n) break;
    let j = i; while (j < n && !/\s/.test(s[j])) j++;
    let url = s.slice(i, j); i = j;
    if (/,+$/.test(url)) url = url.replace(/,+$/, ''); // no descriptor
    else { while (i < n && s[i] !== ',') { if (s[i] === '(') { while (i < n && s[i] !== ')') i++; } i++; } }
    if (url) urls.push(url);
  }
  return urls;
}

const NAV_LINK_RELS = new Set(['canonical', 'alternate', 'author', 'license', 'help', 'me', 'prev', 'next', 'search', 'bookmark', 'amphtml', 'sitemap']);
/** Every URL-bearing attribute of an element => [{tag, attr, url, nav}] (nav = navigation, not a subresource fetch). */
export function urlRefs(el) {
  const tag = el.tagName, out = [];
  const add = (attr, url, nav = false) => { if (url !== undefined) out.push({ tag, attr, url, nav, el }); };
  for (const a of el.attrs ?? []) {
    const name = a.name.replace(/^xlink:/, '');
    if (name === 'srcset' || name === 'imagesrcset') for (const u of parseSrcset(a.value)) add(name, u);
    else if (name === 'ping') for (const u of a.value.split(/\s+/).filter(Boolean)) add('ping', u);
    else if (['src', 'poster', 'data', 'background', 'manifest', 'longdesc', 'codebase', 'cite'].includes(name)) add(name, a.value);
    else if (name === 'href') {
      const nav = tag === 'a' || tag === 'area' || (tag === 'link' && tokens(getAttr(el, 'rel')).every((r) => NAV_LINK_RELS.has(r)));
      add('href', a.value, nav);
    } else if (name === 'action' || name === 'formaction') add(name, a.value, true);
  }
  if (tag === 'meta' && (getAttr(el, 'http-equiv') ?? '').toLowerCase() === 'refresh') {
    const m = (getAttr(el, 'content') ?? '').match(/url\s*=\s*['"]?([^'"]*)/i); if (m) add('content', m[1], true);
  }
  return out;
}

/* ------------------------------------------------------------------ CSP */

export function parseCsp(s) {
  const list = s.split(';').map((x) => x.trim()).filter(Boolean).map((d) => { const [n, ...v] = d.split(/\s+/); return [n.toLowerCase(), v]; });
  const dirs = new Map(); for (const [n, v] of list) if (!dirs.has(n)) dirs.set(n, v); // browsers honour the first occurrence
  return { list, dirs, dupes: dirs.size !== list.length };
}
const SOURCE_OK = /^('self'|'none'|'sha(256|384|512)-[A-Za-z0-9+/=]+')$/;
const NON_SOURCE_DIRECTIVES = ['report-uri', 'report-to', 'sandbox', 'upgrade-insecure-requests', 'frame-ancestors', 'require-trusted-types-for', 'trusted-types', 'block-all-mixed-content'];
// Strict policy REQUIRED on tool routes (the ad-free, file-handling pages): value must be exactly one of the listed sets.
export const TOOL_CSP_EXACT = {
  'default-src': ["'self'", "'none'"], 'connect-src': ["'self'", "'none'"], 'object-src': ["'none'"], 'base-uri': ["'none'"],
  'frame-src': ["'none'"], 'form-action': ["'self'", "'none'"], 'worker-src': ["'self'", "'none'"],
};
const TOOL_CSP_REQUIRED = ['default-src', 'script-src', 'object-src', 'base-uri', 'connect-src', 'form-action', 'frame-src', 'worker-src'];

/** CSP problems for one policy string. `tool` => strict tool-route profile. */
export function cspIssues(csp, { tool = false } = {}) {
  const out = []; const { list, dirs, dupes } = parseCsp(csp);
  if (/unsafe-inline|unsafe-eval|unsafe-hashes|\*/.test(csp)) out.push("CSP contains 'unsafe-inline'/'unsafe-eval'/wildcard");
  if (dupes) out.push('CSP has duplicate directives');
  for (const need of ['default-src', 'script-src', 'object-src', 'base-uri']) if (!dirs.has(need)) out.push(`CSP missing ${need}`);
  if (dirs.has('object-src') && dirs.get('object-src').join(' ') !== "'none'") out.push("CSP object-src must be 'none'");
  if (dirs.has('base-uri') && dirs.get('base-uri').join(' ') !== "'none'") out.push("CSP base-uri must be 'none'");
  for (const [name, vals] of list) {
    if (NON_SOURCE_DIRECTIVES.includes(name)) continue;
    for (const v of vals) {
      const okExtra = name === 'img-src' && /^(blob:|data:)$/.test(v); // blob:/data: only for images
      if (!SOURCE_OK.test(v) && !okExtra) out.push(`CSP ${name} allows non-self source ${v}`);
    }
  }
  for (const n of ['report-uri', 'report-to']) for (const v of dirs.get(n) ?? []) {
    const c = classifyUrl(v); if (c.kind === 'external' || c.kind === 'other-scheme') out.push(`CSP ${n} sends violation reports to a third party: ${v}`);
  }
  if (tool) {
    for (const need of TOOL_CSP_REQUIRED) if (!dirs.has(need)) out.push(`CSP (tool route) missing ${need}`);
    for (const [name, allowed] of Object.entries(TOOL_CSP_EXACT)) {
      const v = dirs.get(name); if (v && !(v.length === 1 && allowed.includes(v[0]))) out.push(`CSP (tool route) ${name} must be exactly ${allowed.join(' or ')}, got ${v.join(' ')}`);
    }
    for (const name of ['script-src', 'style-src', 'font-src', 'manifest-src', 'media-src', 'child-src', 'script-src-elem', 'style-src-elem', 'script-src-attr']) {
      for (const v of dirs.get(name) ?? []) if (/^(blob:|data:|https?:.*|\*)$/.test(v)) out.push(`CSP (tool route) ${name} must not allow ${v}`);
    }
    for (const v of dirs.get('img-src') ?? []) if (!/^('self'|'none'|blob:|data:)$/.test(v)) out.push(`CSP (tool route) img-src allows ${v}`);
  }
  return out;
}
export const cspHash = (text, alg) => `'${alg}-${createHash(alg).update(text, 'utf8').digest('base64')}'`;
export const cspAllowsInline = (csp, directive, text) => {
  const { dirs } = parseCsp(csp);
  const vals = dirs.get(directive) ?? dirs.get('default-src') ?? [];
  return ['sha256', 'sha384', 'sha512'].some((a) => vals.includes(cspHash(text, a)));
};

/* ------------------------------------------------------------------ JS / CSS scanning */

export const JS_PATTERNS = [
  ['fetch', /\bfetch\b/g, 'fetch()'],
  ['xhr', /\bXMLHttpRequest\b/g, 'XMLHttpRequest'],
  ['beacon', /\bsendBeacon\b/g, 'navigator.sendBeacon'],
  ['websocket', /\bWebSocket(Stream)?\b/g, 'WebSocket'],
  ['eventsource', /\bEventSource\b/g, 'EventSource (SSE)'],
  ['webtransport', /\bWebTransport\b/g, 'WebTransport'],
  ['webrtc', /\b(webkit)?RTC(PeerConnection|DataChannel)\b/g, 'WebRTC'],
  ['importscripts', /\bimportScripts\b/g, 'importScripts'],
  ['serviceworker', /\bserviceWorker\b|\bServiceWorker/g, 'ServiceWorker'],
  ['sharedworker', /\bSharedWorker\b/g, 'SharedWorker'],
  ['broadcast', /\bBroadcastChannel\b/g, 'BroadcastChannel'],
  ['image-beacon', /\bnew\s+Image\s*\(/g, 'new Image() (pixel beacon)'],
  ['dyn-import', /(?<![\w$.])import\s*\(/g, 'dynamic import()'],
  ['eval', /(?<![\w$.])eval\s*\(|\bnew\s+Function\s*\(|(?<![\w$.])Function\s*\(/g, 'eval/Function constructor'],
  ['doc-write', /\bdocument\.write(ln)?\s*\(/g, 'document.write'],
  ['script-inject', /createElement\(\s*[`'"]script[`'"]/g, 'dynamic <script> injection'],
  ['embed-inject', /createElement\(\s*[`'"](iframe|embed|object|frame)[`'"]/g, 'dynamic iframe/embed/object injection'],
  ['resource-hint', /dns-prefetch|preconnect/g, 'preconnect/dns-prefetch resource hint'],
  ['navigation', /(?<![\w$])location\s*\.\s*(assign|replace)\s*\(|(?<![\w$])location\s*\.\s*href\s*=(?!=)|\bwindow\.open\s*\(/g, 'programmatic navigation / window.open'],
  ['navigator-api', /\bnavigator\.(connection|sendBeacon|serviceWorker|mediaDevices|geolocation|clipboard|getBattery|credentials|bluetooth|usb|hid|serial|storage)\b/g, 'sensitive navigator API'],
  ['storage', /\b(document\.cookie|localStorage|sessionStorage|indexedDB)\b/g, 'cookie/web-storage/IndexedDB'],
  ['cross-window', /\b(parent|top|opener)\.postMessage\b/g, 'cross-window postMessage'],
];
const EXT_URL = /(?:https?|wss?|ftp):\/\/[^\s`'"\\)<>]+|[`'"]\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}[^\s`'"]*/gi;

/** -> [{id, desc, items: [matched strings]}] (every match; no allow-list applied). */
export function scanJs(src) {
  const found = [];
  for (const [id, re, desc] of JS_PATTERNS) { const items = [...src.matchAll(re)].map((m) => m[0]); if (items.length) found.push({ id, desc, items }); }
  const urls = [...src.matchAll(EXT_URL)].map((m) => m[0].replace(/^[`'"]/, ''));
  if (urls.length) found.push({ id: 'external-url', desc: 'hard-coded external URL', items: urls });
  return found;
}
/** Worker constructors must point at a literal same-site module chunk; returns {literals, bad}. */
export function workerRefs(src) {
  const literals = [], bad = [];
  for (const m of src.matchAll(/\bnew\s+(?:Shared)?Worker\s*\(/g)) {
    const rest = src.slice(m.index + m[0].length, m.index + m[0].length + 160);
    const lit = rest.match(/^\s*new\s+URL\(\s*[`'"]([^`'"]+\.js)[`'"]/) ?? rest.match(/^\s*[`'"]([^`'"]+\.js)[`'"]/);
    if (lit) literals.push(lit[1]); else bad.push(rest.slice(0, 60));
  }
  return { literals, bad };
}
/** Apply the allow-list; returns failure strings (prefixed with file). */
export function jsIssues(file, src) {
  const out = [];
  for (const f of scanJs(src)) {
    let items = f.items;
    const rules = JS_PRIMITIVE_ALLOWLIST.filter((r) => r.id === f.id && r.signature.test(src));
    if (rules.length) {
      const r = rules[0]; const cand = r.only ? items.filter((x) => r.only.test(x)) : items;
      const proven = !r.proof || cand.length <= [...src.matchAll(r.proof)].length;
      if (!proven) out.push(`${file}: allow-listed '${f.id}' is not in the audited literal form (${r.proof}) — re-audit`);
      else if (cand.length <= r.max) items = items.filter((x) => !cand.includes(x));
      else out.push(`${file}: allow-listed '${f.id}' appears ${cand.length}x (> ${r.max} audited) — re-audit`);
    }
    if (items.length) out.push(`${file}: network/side-channel capability '${f.id}' (${f.desc}) x${items.length}: ${[...new Set(items)].slice(0, 3).join(' | ').slice(0, 120)}`);
  }
  const w = workerRefs(src); for (const b of w.bad) out.push(`${file}: Worker created from a non-literal URL: ${b}`);
  return out;
}
/** CSS: external @import / url(), javascript: url. Comments stripped (they hold licence URLs). */
export function cssIssues(file, css) {
  const out = []; const c = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of c.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)/gi)) { const k = classifyUrl(m[1]); if (k.kind === 'external' || k.kind === 'javascript' || k.kind === 'data') out.push(`${file}: CSS @import of ${k.kind} URL ${m[1].slice(0, 60)}`); }
  for (const m of c.matchAll(/url\(\s*["']?([^"')]+)/gi)) { const k = classifyUrl(m[1]); if (k.kind === 'external' || k.kind === 'javascript') out.push(`${file}: CSS url() to ${k.kind} URL ${m[1].slice(0, 60)}`); if (k.kind === 'data' && !/^data:(image|font)\//i.test(k.v)) out.push(`${file}: CSS url() data: URL of non-image type`); }
  return out;
}
export const externalAllowed = (url, tag, pageType) => EXTERNAL_RESOURCE_ALLOWLIST.some((a) => { try { return new URL(url, SITE).origin === a.origin && (!a.tags || a.tags.includes(tag)) && (!a.pageTypes || a.pageTypes.includes(pageType)); } catch { return false; } });
export const embedAllowed = (tag, url, pageType) => EMBED_ALLOWLIST.some((a) => a.tag === tag && (!a.origin || (url && new URL(url, SITE).origin === a.origin)) && (!a.pageTypes || a.pageTypes.includes(pageType)));

/**
 * JS files a page loads (script src, modulepreload, astro-island component/renderer urls) plus, transitively, every
 * same-site .js path literal inside those files (static imports, `new Worker(new URL('/_astro/x.js', ...))`).
 * -> Map<distRelativePath, {src, via}>. Missing files are reported in `missing`.
 */
export function jsClosure(dist, pages) {
  const files = new Map(), missing = [];
  const queue = [];
  const resolve = (url, fromRoute) => { const c = classifyUrl(url, fromRoute); return c.kind === 'internal' && /\.m?js$/.test(c.path) ? c.path : null; };
  for (const p of pages) for (const el of p.els) {
    const cands = [];
    if (isHtmlEl(el, 'script') && hasAttr(el, 'src')) cands.push(getAttr(el, 'src'));
    if (isHtmlEl(el, 'link') && /modulepreload|preload|prefetch/.test(getAttr(el, 'rel') ?? '')) cands.push(getAttr(el, 'href'));
    if (el.tagName === 'astro-island') for (const a of ['component-url', 'renderer-url']) cands.push(getAttr(el, a));
    if (isExecutableScript(el) && !hasAttr(el, 'src')) for (const m of scriptText(el).matchAll(/[`'"]([^`'"\s]+\.m?js)[`'"]/g)) cands.push(m[1]);
    for (const c of cands) { const r = c && resolve(c, p.route); if (r) queue.push({ path: r, via: p.route }); }
  }
  while (queue.length) {
    const { path, via } = queue.shift(); if (files.has(path)) continue;
    const abs = join(dist, path);
    if (!existsSync(abs) || !statSync(abs).isFile()) { missing.push({ path, via }); continue; }
    const src = readFileSync(abs, 'utf8'); files.set(path, { src, via });
    for (const m of src.matchAll(/[`'"]((?:\/|\.\/|\.\.\/)[^`'"\s]*?\.m?js)[`'"]/g)) {
      const r = m[1].startsWith('/') ? m[1] : posix.normalize(posix.join(dirname(path), m[1]));
      queue.push({ path: r.startsWith('/') ? r : '/' + r, via: path });
    }
  }
  return { files, missing };
}

/* ------------------------------------------------------------------ misc shared rules */

// Ad / analytics / tracking / CMP identifiers that must appear NOWHERE in dist (policy P1: tool routes are ad-free; today the whole site is).
export const TRACKER_PATTERNS = [
  /adsbygoogle/i, /googlesyndication/i, /\bdoubleclick/i, /* \b: React's "onDoubleClick" is not the ad network */ /googletagmanager/i, /google-analytics/i, /googletagservices/i, /\bgtag\b/i, /\bgtm\.js\b/i, /analytics\.google\./i, /\bga\(\s*['"]create/i,
  /plausible\.io|\bplausible\.js\b|data-domain=/i, /usefathom|cdn\.usefathom|\bfathom\.js\b/i, /hotjar/i, /clarity\.ms/i,
  /cdn\.segment\.|api\.segment\.|segment\.io|segment\.com/i, /mixpanel/i, /amplitude\.com|cdn\.amplitude/i, /heapanalytics|heap-\d+\.js/i, /fullstory/i, /logrocket/i,
  /sentry\.io|sentry-cdn|ingest\.sentry/i, /datadoghq|datadog-rum|dd-rum/i, /newrelic|nr-data\.net/i, /cloudflareinsights|static\.cloudflareinsights|beacon\.min\.js/i,
  /matomo|piwik/i, /posthog/i, /umami\.is|umami\.js/i, /statcounter/i, /mc\.yandex|metrika/i, /connect\.facebook\.net|facebook\.net\/|\bfbq\(/i, /ads-twitter|static\.ads-twitter/i,
  /snap\.licdn|px\.ads\.linkedin/i, /\bpintrk\b|ct\.pinterest/i, /analytics\.tiktok|tiktok\.com\/i18n\/pixel/i, /taboola|outbrain|criteo|adnxs|pubmatic|amazon-adsystem|quantserve|scorecardresearch/i,
  /onetrust|cookiebot|quantcast|consensu\.org|fundingchoicesmessages|usercentrics|osano|trustarc|iubenda/i, /\bdataLayer\b/,
];
export const findTrackers = (text) => TRACKER_PATTERNS.filter((re) => re.test(text)).map((re) => re.source);

// HUMAN placeholders: `[[HUMAN: description]]`. Valid form is exact; any other `[[HUMAN...]]` spelling is a FAIL (typo would hide it).
export function findPlaceholders(text) {
  const valid = [], bad = [];
  for (const m of text.matchAll(/\[\[\s*HUMAN[^\]]*\]\]|\[\[\s*human\b[^\]]*\]\]/gi)) {
    if (/^\[\[HUMAN: [^\[\]]*\S[^\[\]]*\]\]$/.test(m[0])) valid.push(m[0].slice(9, -2).trim()); else bad.push(m[0]);
  }
  if (/\[\[\s*HUMAN(?![^\]]*\]\])/i.test(text)) bad.push('[[HUMAN (unterminated)');
  return { valid, bad };
}

/** Everything in a page that is CODE/MARKUP rather than visible prose: tag names, attribute values, script/style bodies, comments. */
export function markupText(page) {
  const parts = [];
  for (const n of walkNodes(page.doc)) {
    if (n.nodeName === '#comment') parts.push(n.data);
    else if (isEl(n)) { parts.push(n.tagName); for (const a of n.attrs ?? []) parts.push(a.name, a.value); if (['script', 'style'].includes(n.tagName)) parts.push(scriptText(n)); }
  }
  return parts.join('\n');
}
