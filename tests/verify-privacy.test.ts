// Negative fixtures for scripts/verify-privacy.mjs (and unit tests for the shared scanners in scripts/verify-lib.mjs).
// Requires a built dist/ (pnpm run build). Mutations run on TEMP COPIES of dist.
import { describe, it, expect, beforeAll } from 'vitest';
import { rmSync, mkdtempSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { verifyPrivacy } from '../scripts/verify-privacy.mjs';
import { scanJs, jsIssues, cssIssues, cspIssues, parseCsp, findTrackers, findPlaceholders, parseSrcset, classifyUrl, workerRefs, JS_PRIMITIVE_ALLOWLIST } from '../scripts/verify-lib.mjs';
import { requireDist, copyDist, htmlFiles, pagesOf, edit, read, write, has, hasNot, withDist, firstOf, toolFile, headEnd, mainEnd, appChunk, preactChunk, clientChunk, jsChunks, cssChunk } from './verify-helpers';

const vp = (fn: (d: string) => void) => withDist(fn, (d) => verifyPrivacy(d).fails as string[]);
const onTool = (fn: (s: string) => string) => vp((d) => edit(d, toolFile(d), fn));
const onHome = (fn: (s: string) => string) => vp((d) => edit(d, 'index.html', fn));
const headers = (fn: (s: string) => string) => vp((d) => edit(d, '_headers', fn));
const PRIV = 'privacy/index.html';

beforeAll(requireDist);

describe('verify-privacy: real build', () => {
  it('passes on the real build', () => expect(verifyPrivacy('dist').fails).toEqual([]));
  it('discovers the tool routes and scans every JS chunk they load, including the worker', () => {
    const r = verifyPrivacy('dist');
    expect(r.info.join('\n')).toMatch(/tool routes: \//);
    expect(r.info.some((x: string) => /compress\.worker/.test(x))).toBe(true);
    expect(r.info.some((x: string) => /client\./.test(x))).toBe(true);
  });
  it('the app chunks contain NO flagged primitive at all; only the audited Preact runtime chunks do (exact ids and counts)', () => {
    const r = verifyPrivacy('dist').info.filter((x: string) => x.startsWith('scanned'));
    for (const line of r) {
      if (/_astro\/client\./.test(line)) expect(line, line).toMatch(/: dyn-importx1$/);
      else if (/_astro\/preact\./.test(line)) expect(line, line).toMatch(/: external-urlx6$/);
      else expect(line, line).toMatch(/no flagged primitives/);
    }
  });
  it('no island carries data-preact-signals (the precondition for the audited dynamic import ever running)', () => {
    for (const f of htmlFiles('dist')) expect(read('dist', f), f).not.toMatch(/data-preact-signals/);
  });
  it('CLI exits 0 on the real build and 1 on a mutated one', () => {
    const ok = spawnSync(process.execPath, ['scripts/verify-privacy.mjs'], { encoding: 'utf8' });
    expect(ok.status, ok.stderr).toBe(0);
    const root = mkdtempSync(join(tmpdir(), 'vp-cli-')); cpSync('dist', join(root, 'dist'), { recursive: true });
    edit(join(root, 'dist'), 'index.html', (s) => headEnd(s, '<script src="https://www.googletagmanager.com/gtag/js"></script>'));
    const bad = spawnSync(process.execPath, [join(process.cwd(), 'scripts/verify-privacy.mjs')], { cwd: root, encoding: 'utf8' });
    expect(bad.status).toBe(1); expect(bad.stderr).toMatch(/PRIVACY FAILED/);
    rmSync(root, { recursive: true, force: true });
  });
});

describe('P1 third-party origins / scripts / styles / fonts on tool routes', () => {
  it('external script', () => has(onTool((s) => headEnd(s, '<script src="https://cdn.example.com/a.js"></script>')), /third-party origin/));
  it('protocol-relative script', () => has(onTool((s) => headEnd(s, '<script src=//cdn.example.com/a.js></script>')), /third-party origin/));
  it('external stylesheet', () => has(onTool((s) => headEnd(s, '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">')), /third-party origin/));
  it('external font preload', () => has(onTool((s) => headEnd(s, '<link rel="preload" as="font" href="https://fonts.gstatic.com/s/inter.woff2" crossorigin>')), /third-party origin/));
  it('external image / srcset / poster', () => { has(onTool((s) => mainEnd(s, '<img alt="" src="https://i.example/a.png">')), /third-party/); has(onTool((s) => mainEnd(s, '<img alt="" srcset="/a.png 1x, https://i.example/b.png 2x">')), /third-party/); has(onTool((s) => mainEnd(s, '<video poster="https://i.example/p.png"></video>')), /third-party/); });
  it('tracking pixel inside <noscript>', () => has(onTool((s) => mainEnd(s, '<noscript><img alt="" src="https://t.example/p.gif"></noscript>')), /third-party/));
  it('preconnect / dns-prefetch resource hints even to the same origin', () => { has(onTool((s) => headEnd(s, '<link rel="preconnect" href="https://fonts.gstatic.com">')), /resource hint|third-party/); has(onTool((s) => headEnd(s, '<link rel="dns-prefetch" href="/">')), /resource hint/); });
  it('iframe / object / embed', () => { for (const t of ['iframe', 'object', 'embed']) has(onTool((s) => mainEnd(s, `<${t} src="/favicon.svg"></${t}>`)), /embedding element/); });
  it('data: / javascript: URLs', () => { has(onTool((s) => headEnd(s, '<script src="data:text/javascript,1"></script>')), /non-self URL scheme/); has(onTool((s) => mainEnd(s, '<a href="javascript:void(0)">x</a>')), /non-self URL scheme/); });
  it('external CSS in a stylesheet file: @import and @font-face url()', () => {
    has(vp((d) => edit(d, cssChunk(d), (s) => s + '@import url("https://fonts.googleapis.com/css");')), /\[css\]/);
    has(vp((d) => edit(d, cssChunk(d), (s) => s + '@font-face{font-family:F;src:url(//fonts.example.com/f.woff2)}')), /\[css\]/);
  });
  it('external @import in an inline <style>', () => has(onTool((s) => headEnd(s, '<style>@import url(https://x.example/a.css);</style>')), /@import|CSP/));
  it('unquoted / odd-case attribute forms', () => has(onTool((s) => mainEnd(s, '<IMG ALT=x SRC=HTTPS://I.EXAMPLE/a.png>')), /third-party/));
  it('no tool route at all is itself a failure (cannot verify nothing)', () => has(vp((d) => { for (const f of htmlFiles(d)) { const s = read(d, f); write(d, f, s.replace(/data-page-type="(home|tool)"/, 'data-page-type="policy"').replace(/data-testid="tool"/g, 'data-x="tool"')); } }), /no tool routes found/));
});

describe('P2 CSP strictness on tool routes', () => {
  it('missing CSP meta', () => has(onHome((s) => s.replace(/<meta http-equiv="content-security-policy"[^>]*>/, '')), /0 CSP/));
  it('duplicate CSP meta', () => has(onHome((s) => headEnd(s, `<meta http-equiv="content-security-policy" content="default-src 'none'">`)), /2 CSP/));
  it.each([
    ["connect-src 'self'", 'connect-src https://api.example.com'],
    ["connect-src 'self'", 'connect-src *'],
    ["connect-src 'self'", "connect-src 'self' https:"],
    ["default-src 'self'", "default-src 'self' 'unsafe-inline'"],
    ["default-src 'self'", "default-src 'self' 'unsafe-eval'"],
    ["default-src 'self'", 'default-src https:'],
    ["worker-src 'self'", 'worker-src blob:'],
    ["frame-src 'none'", "frame-src 'self'"],
    ["form-action 'self'", 'form-action https://evil.example'],
    ["base-uri 'none'", "base-uri 'self'"],
    ["object-src 'none'", "object-src 'self'"],
    ["font-src 'self'", 'font-src https://fonts.gstatic.com'],
    ["manifest-src 'self'", 'manifest-src https://evil.example'],
    ["img-src 'self' blob: data:", "img-src 'self' blob: data: https:"],
    ["script-src 'self'", "script-src 'self' blob:"],
    ["script-src 'self'", "script-src 'self' 'strict-dynamic'"],
    ["script-src 'self'", "script-src 'self' https://cdn.example.com"],
    ["style-src 'self'", "style-src 'self' https://fonts.googleapis.com"],
  ])('CSP: %s -> %s', (from, to) => has(onHome((s) => s.replace(from, to)), /CSP/));
  it.each(['frame-src', 'form-action', 'worker-src', 'connect-src', 'object-src', 'base-uri'])('CSP directive %s removed', (dir) => has(onHome((s) => s.replace(new RegExp(`${dir} [^;"]*;?`), '')), new RegExp(`missing ${dir}|must be`)));
  it('upper-case duplicate directive smuggling a CDN', () => has(onHome((s) => s.replace("default-src 'self'", "SCRIPT-SRC https://evil.example; default-src 'self'")), /CSP/));
  it('inline script no longer covered by a hash', () => has(onHome((s) => s.replace(/<script>([^<]{20,})<\/script>/, '<script>$1;</script>')), /not covered by a CSP hash/));
  it('CSP meta placed after a stylesheet', () => has(onHome((s) => { const m = s.match(/<meta http-equiv="content-security-policy"[^>]*>/)![0]; return s.replace(m, '').replace('</head>', m + '</head>'); }), /comes after/));
  it('the strict profile is enforced on EVERY tool route, not only the home page', () => {
    const d = copyDist(); const tools = pagesOf(d, ['home', 'tool']); expect(tools.length).toBeGreaterThan(1);
    for (const f of tools) { const fails = withDist((x) => edit(x, f, (s) => s.replace("connect-src 'self'", 'connect-src *')), (x) => verifyPrivacy(x).fails as string[]); has(fails, new RegExp(`/${f.replace(/index\.html$/, '')}: CSP`)); }
    rmSync(d, { recursive: true, force: true });
  });
});

describe('P3 ad / analytics identifiers anywhere in dist', () => {
  const names: [string, string][] = [
    ['adsbygoogle', 'adsbygoogle'], ['googlesyndication', 'https://pagead2.googlesyndication.com/x.js'], ['doubleclick', 'https://stats.g.doubleclick.net/x'], ['googletagmanager', 'https://www.googletagmanager.com/gtm.js'],
    ['google-analytics', 'https://www.google-analytics.com/analytics.js'], ['gtag', 'window.gtag=function(){}'], ['plausible', 'https://plausible.io/js/script.js'], ['fathom', 'https://cdn.usefathom.com/script.js'],
    ['hotjar', 'https://static.hotjar.com/c/hotjar-1.js'], ['clarity', 'https://www.clarity.ms/tag/x'], ['segment', 'https://cdn.segment.com/analytics.js/v1/x'], ['cloudflare beacon', 'https://static.cloudflareinsights.com/beacon.min.js'],
    ['sentry', 'https://o1.ingest.sentry.io/1'], ['posthog', 'https://app.posthog.com'], ['facebook pixel', 'https://connect.facebook.net/en_US/fbevents.js'], ['onetrust CMP', 'https://cdn.cookielaw.org/onetrust.js'],
  ];
  it.each(names)('%s in tool-page markup', (_n, v) => has(onTool((s) => headEnd(s, `<script async src="${v}"></script><!-- ${v} -->`)), /\[tracker\]/));
  it.each(names)('%s in a NON-tool page (markup)', (_n, v) => has(vp((d) => edit(d, PRIV, (s) => mainEnd(s, `<a href="/" data-x="${v}">x</a>`))), /\[tracker\]/));
  it('in a JS chunk', () => has(vp((d) => edit(d, appChunk(d), (s) => s + '\n/*googletagmanager*/')), /\[tracker\].*googletagmanager/));
  it('in the Preact chunk', () => has(vp((d) => edit(d, preactChunk(d), (s) => s + '\n;"hotjar";')), /\[tracker\]/));
  it('in CSS', () => has(vp((d) => edit(d, cssChunk(d), (s) => s + '\n/*doubleclick.net*/')), /\[tracker\]/));
  it('in robots.txt, sitemap and _headers', () => { has(vp((d) => edit(d, 'robots.txt', (s) => s + '# adsbygoogle\n')), /\[tracker\]/); has(vp((d) => edit(d, 'sitemap-0.xml', (s) => s + '<!-- googletagmanager -->')), /\[tracker\]/); has(headers((s) => s + '\n/x\n  Link: <https://www.google-analytics.com>; rel=preconnect\n'), /\[tracker\]/); });
  it('in a file NAME', () => has(vp((d) => write(d, '_astro/gtag.js', 'var a=1;')), /\[tracker\].*file name/));
  it('in an SVG / text asset', () => has(vp((d) => write(d, 'extra.svg', '<svg><!-- googlesyndication --></svg>')), /\[tracker\]/));
  it('documented scope: visible prose that merely NAMES a tracker is not a code identifier (privacy copy may say what is NOT used)', () => hasNot(vp((d) => edit(d, PRIV, (s) => mainEnd(s, '<p>We do not use Hotjar or Mixpanel.</p>'))), /\[tracker\]/));
  it('React event names like onDoubleClick are not an ad network', () => expect(findTrackers('case`onDoubleClick`:Oi(`dblclick`,`onDoubleClick`)')).toEqual([]));
});

describe('P4 _headers', () => {
  it('missing file', () => has(vp((d) => rmSync(join(d, '_headers'))), /_headers missing/));
  it("frame-ancestors 'none' removed", () => has(headers((s) => s.replace("frame-ancestors 'none'", "frame-ancestors 'self'")), /frame-ancestors/));
  it('nosniff removed / wrong', () => { has(headers((s) => s.replace(/ *X-Content-Type-Options: nosniff\n/, '')), /x-content-type-options/); has(headers((s) => s.replace('nosniff', 'sniff')), /nosniff/); });
  it('X-Frame-Options not DENY', () => has(headers((s) => s.replace('X-Frame-Options: DENY', 'X-Frame-Options: SAMEORIGIN')), /X-Frame-Options must be DENY/));
  it('weak Referrer-Policy', () => has(headers((s) => s.replace(/Referrer-Policy: .*/, 'Referrer-Policy: unsafe-url')), /Referrer-Policy/));
  it('Permissions-Policy missing / does not disable the camera', () => { has(headers((s) => s.replace(/ *Permissions-Policy: .*\n/, '')), /permissions-policy/); has(headers((s) => s.replace('camera=()', 'camera=*')), /disable camera/); });
  it('COOP missing / weakened', () => { has(headers((s) => s.replace(/ *Cross-Origin-Opener-Policy: .*\n/, '')), /cross-origin-opener-policy/); has(headers((s) => s.replace('Cross-Origin-Opener-Policy: same-origin', 'Cross-Origin-Opener-Policy: unsafe-none')), /Opener/); });
  it('header detached with `! Name`', () => has(headers((s) => s.replace('/*\n', '/*\n  ! X-Frame-Options\n')), /detaches x-frame-options/));
  it('CORS wildcard, cookie, off-site Link, third-party CSP report endpoint', () => {
    has(headers((s) => s + '\n/*\n  Access-Control-Allow-Origin: *\n'), /Access-Control-Allow-Origin/);
    has(headers((s) => s + '\n/*\n  Set-Cookie: a=b\n'), /cookie/);
    has(headers((s) => s + '\n/*\n  Link: <https://cdn.example.com>; rel=preconnect\n'), /Link header/);
    has(headers((s) => s + "\n/*\n  Content-Security-Policy-Report-Only: default-src 'self'; report-uri https://r.example/c\n"), /report-uri|weak/);
  });
  it('weak CSP header (unsafe / host source)', () => has(headers((s) => s.replace("frame-ancestors 'none'", "frame-ancestors 'none'; script-src https://x.example 'unsafe-inline'")), /weak/));
  it('workers.dev preview not noindex / /_astro not immutable', () => { has(headers((s) => s.replace('X-Robots-Tag: noindex', 'X-Robots-Tag: all')), /noindex/); has(headers((s) => s.replace('immutable', 'no-cache')), /immutable/); });
});

describe('P5 network primitives in JS loaded by tool pages', () => {
  const prims: [string, string][] = [
    ['fetch', 'fetch("/x",{method:"POST",body:f})'], ['globalThis.fetch', 'globalThis["fetch"]("/x")'], ['XMLHttpRequest', 'var x=new XMLHttpRequest;x.open("POST","/u")'], ['sendBeacon', 'navigator.sendBeacon("/b",blob)'],
    ['WebSocket', 'new WebSocket("wss://x.example")'], ['EventSource', 'new EventSource("/e")'], ['WebTransport', 'new WebTransport("https://x")'], ['WebRTC', 'new RTCPeerConnection'],
    ['importScripts', 'importScripts("https://x.example/a.js")'], ['SharedWorker', 'new SharedWorker("/x.js")'], ['BroadcastChannel', 'new BroadcastChannel("c")'], ['serviceWorker', 'navigator.serviceWorker.register("/sw.js")'],
    ['image beacon', 'new Image().src="/p?d="+d'], ['script injection', 'document.createElement("script").src="/x.js"'], ['iframe injection', 'document.createElement("iframe")'],
    ['dynamic import', 'import("https://x.example/a.js")'], ['eval', 'eval(a)'], ['Function', 'new Function(a)'], ['document.write', 'document.write(a)'],
    ['redirect', 'location.assign("/x")'], ['window.open', 'window.open(u)'], ['cross-window postMessage', 'parent.postMessage(d,"*")'],
    ['cookie', 'document.cookie="a=1"'], ['localStorage', 'localStorage.x=1'], ['indexedDB', 'indexedDB.open("a")'], ['geolocation', 'navigator.geolocation.getCurrentPosition(f)'],
    ['external URL', 'var u="https://collect.example.com/c"'], ['ws URL', 'var u="wss://collect.example.com/c"'], ['protocol-relative URL', "var u='//collect.example.com/c'"],
  ];
  it.each(prims)('%s in the app chunk', (_n, code) => has(vp((d) => edit(d, appChunk(d), (s) => s + `\n;${code};`)), /\[js\]/));
  it.each(prims.slice(0, 6))('%s in the web worker chunk', (_n, code) => has(vp((d) => edit(d, jsChunks(d).find((f) => /compress\.worker/.test(f))!, (s) => s + `\n;${code};`)), /\[js\]/));
  it('primitives in the Preact chunk beyond the audited allow-list', () => { has(vp((d) => edit(d, preactChunk(d), (s) => s + ';fetch("/x");')), /\[js\].*'fetch'/); has(vp((d) => edit(d, preactChunk(d), (s) => s + ';navigator.sendBeacon("/x");')), /\[js\].*sendBeacon/); has(vp((d) => edit(d, preactChunk(d), (s) => s + ';var u="https://collect.example.com/x";')), /\[js\].*external-url/); });
  it('the old React-era tokens (preconnect, navigator.connection, script injection) are NOT allow-listed any more, not even in the Preact chunk', () => { has(vp((d) => edit(d, preactChunk(d), (s) => s + ';"preconnect";')), /resource-hint/); has(vp((d) => edit(d, preactChunk(d), (s) => s + ';navigator.connection;')), /navigator-api/); has(vp((d) => edit(d, preactChunk(d), (s) => s + ';document.createElement("script");')), /script-inject/); });
  it('allow-listed namespace URLs growing past the audited count', () => has(vp((d) => edit(d, preactChunk(d), (s) => s + ';"http://www.w3.org/2000/svg";')), /re-audit/));
  it('a second / non-literal dynamic import in the island client is not a free pass', () => { has(vp((d) => edit(d, clientChunk(d), (s) => s + ';import("/_astro/x.js");')), /dyn-import|re-audit/); has(vp((d) => edit(d, clientChunk(d), (s) => s.replace(/import\(`\.\/signals\.module\.[\w-]+\.js`\)/, 'import(location.hash.slice(1))'))), /dyn-import/); });
  const sigName = (d: string) => jsChunks(d).find((f) => /signals\.module\./.test(f))!.split('/').pop()!;
  const realImport = /import\(`\.\/signals\.module\.[\w-]+\.js`\)/;
  it('M10: a non-literal import() in the client with a decoy literal string elsewhere in the file is flagged', () => has(vp((d) => edit(d, clientChunk(d), (s) => s.replace(realImport, 'import(location.hash.slice(1))') + `;var decoy="import(\`./${sigName(d)}\`)";`)), /dyn-import/));
  it('M10b: import(atob(..)) with a decoy `a.import(`./signals..`)` / `$import(...)` is flagged', () => has(vp((d) => edit(d, clientChunk(d), (s) => s.replace(realImport, 'import(atob("L3gu"))') + `;a.import(\`./${sigName(d)}\`);$import(\`./${sigName(d)}\`);`)), /dyn-import/));
  it('M11: the literal import is only excused when the target chunk exists in dist', () => has(vp((d) => edit(d, clientChunk(d), (s) => s.replace(realImport, 'import(`./signals.module.Missing1.js`)'))), /dyn-import/));
  it('allowances are pinned to their audited file: an app chunk carrying the signature strings gets nothing', () => {
    has(vp((d) => edit(d, appChunk(d), (s) => s + ';var q="foreignObject dangerouslySetInnerHTML http://www.w3.org/1998/Math/MathML http://www.w3.org/2000/svg";')), /\[js\].*external-url/);
    has(vp((d) => edit(d, appChunk(d), (s) => s + ';var q="data-preact-island-id";import(`./' + sigName(d) + '`);')), /\[js\].*dyn-import/);
  });
  it('F3: an island carrying data-preact-signals fails the privacy verifier itself', () => has(onHome((s) => s.replace('<astro-island ', '<astro-island data-preact-signals="{}" ')), /data-preact-signals/));
  it('allow-listed Preact tokens are not a free pass in app code', () => has(vp((d) => edit(d, appChunk(d), (s) => s + ';var u="http://www.w3.org/2000/svg";import("./signals.module.x.js");')), /\[js\]/));
  it('inline script on a tool page', () => { has(onHome((s) => headEnd(s, '<script>fetch("/x")</script>')), /\[js\]|CSP/); });
  it('Worker from a non-literal / cross-origin URL', () => { has(vp((d) => edit(d, appChunk(d), (s) => s + ';new Worker(u);')), /non-literal/); has(vp((d) => edit(d, appChunk(d), (s) => s + ';new Worker("https://x.example/w.js");')), /\[js\]/); });
  it('chunk referenced by the page but missing', () => has(vp((d) => rmSync(join(d, jsChunks(d).find((f) => /compress\.worker/.test(f))!))), /not in dist/));
  it('a new transitively-imported chunk is scanned', () => has(vp((d) => { write(d, '_astro/extra.js', 'fetch("/x")'); edit(d, appChunk(d), (s) => s + ';import("/_astro/extra.js");'); }), /extra\.js/));
});

describe('shared scanners (unit)', () => {
  const ids = (src: string): string[] => (scanJs(src) as Array<{ id: string }>).map((f) => f.id);
  it('flags each primitive family', () => { for (const [src, id] of [['fetch(1)', 'fetch'], ['new XMLHttpRequest', 'xhr'], ['navigator.sendBeacon(1)', 'beacon'], ['new WebSocket(1)', 'websocket'], ['new EventSource(1)', 'eventsource'], ['importScripts(1)', 'importscripts'], ['"https://a.example/x"', 'external-url'], ['"//a.example.com/x"', 'external-url']]) expect(ids(src), src).toContain(id); });
  it('no false positives on look-alikes (React internals)', () => {
    expect(ids('fetchPriority:1,prefetchDNS(e),onDoubleClick,"dblclick"')).toEqual(['resource-hint'].filter(() => false));
    expect(ids('typeof t.contentWindow.location.href==`string`')).toEqual([]);
    expect(ids('a.prefetch=1;b.fetchStatus')).toEqual([]);
  });
  it('allow-list entries are evidence-backed and bounded', () => { for (const a of JS_PRIMITIVE_ALLOWLIST) { expect(a.reason.length).toBeGreaterThan(40); expect(a.max).toBeGreaterThan(0); expect(a.signature).toBeInstanceOf(RegExp); } });
  it('jsIssues applies the allow-list only to the audited file AND signature (and proves literal imports exist)', () => {
    const NS = 'foreignObject dangerouslySetInnerHTML "http://www.w3.org/1998/Math/MathML" a="http://www.w3.org/2000/svg"';
    expect(jsIssues('/_astro/x.js', 'a="http://www.w3.org/2000/svg"')).not.toEqual([]);
    expect(jsIssues('/_astro/preact.AbC.js', NS)).toEqual([]);
    expect(jsIssues('/_astro/useSession.AbC.js', NS), 'right signature, wrong file').not.toEqual([]);
    expect(jsIssues('/_astro/preact.AbC.js', 'foreignObject dangerouslySetInnerHTML "http://www.w3.org/1998/Math/MathML" a="https://evil.example/x"')).not.toEqual([]);
    const d = mkdtempSync(join(tmpdir(), 'ji-')); mkdirSync(join(d, '_astro')); writeFileSync(join(d, '_astro', 'signals.module.AbC-1.js'), 'x');
    const ok = 'data-preact-island-id import(`./signals.module.AbC-1.js`)';
    expect(jsIssues('/_astro/client.Q.js', ok, d)).toEqual([]);
    expect(jsIssues('/_astro/client.Q.js', ok), 'no dist => cannot prove the target exists').not.toEqual([]);
    expect(jsIssues('/_astro/client.Q.js', 'data-preact-island-id import(`./signals.module.Nope.js`)', d), 'target missing').not.toEqual([]);
    expect(jsIssues('/_astro/client.Q.js', 'data-preact-island-id import(`./other.js`)', d)).not.toEqual([]);
    expect(jsIssues('/_astro/useSession.Q.js', ok, d), 'right signature, wrong file').not.toEqual([]);
    // reviewer M10/M11: a decoy elsewhere in the file must not vouch for a different call
    expect(jsIssues('/_astro/client.Q.js', ok + ';import(location.hash.slice(1));', d)).not.toEqual([]);
    expect(jsIssues('/_astro/client.Q.js', 'data-preact-island-id import(atob("x")); a.import(`./signals.module.AbC-1.js`); $import(`./signals.module.AbC-1.js`)', d)).not.toEqual([]);
    expect(jsIssues('/_astro/client.Q.js', 'data-preact-island-id "import(`./signals.module.AbC-1.js`)"; import(location.hash.slice(1))', d)).not.toEqual([]);
    rmSync(d, { recursive: true, force: true });
  });
  it('workerRefs', () => { expect(workerRefs('new Worker(new URL(`/_astro/w.js`,``+import.meta.url),{type:`module`})').literals).toEqual(['/_astro/w.js']); expect(workerRefs('new Worker(u)').bad.length).toBe(1); });
  it('cssIssues ignores comments, data:image, same-site; flags external', () => {
    expect(cssIssues('a.css', '/*! https://tailwindcss.com */ a{background:url(data:image/svg+xml;base64,AAAA)} b{background:url(/x.png)}')).toEqual([]);
    expect(cssIssues('a.css', '@import "//x.example/a.css";').length).toBe(1);
    expect(cssIssues('a.css', 'a{b:url( "https://x.example/a.png" )}').length).toBe(1);
  });
  it('cspIssues: strict profile vs permissive profile', () => {
    const good = "default-src 'self';img-src 'self' blob: data:;connect-src 'self';worker-src 'self';font-src 'self';object-src 'none';base-uri 'none';form-action 'self';frame-src 'none';script-src 'self' 'sha256-AAAA=';style-src 'self'";
    expect(cspIssues(good, { tool: true })).toEqual([]);
    expect(cspIssues(good.replace("connect-src 'self'", "connect-src 'self' https://x.example"), { tool: true }).length).toBeGreaterThan(0);
    expect(cspIssues(good.replace("frame-src 'none';", ''), { tool: true })).toContain('CSP (tool route) missing frame-src');
    expect(cspIssues(good.replace("frame-src 'none';", ''), { tool: false })).toEqual([]);
    expect(parseCsp("A 'self';a 'none'").dupes).toBe(true);
  });
  it('parseSrcset / classifyUrl', () => {
    expect(parseSrcset('a.png 1x, https://x.example/b.png 2x,c.png')).toEqual(['a.png', 'https://x.example/b.png', 'c.png']);
    expect(parseSrcset('data:image/png;base64,AAA= 1x')).toEqual(['data:image/png;base64,AAA=']);
    expect(classifyUrl(' \tjava\nscript:alert(1)').kind).toBe('javascript');
    expect(classifyUrl('//evil.example/x').kind).toBe('external');
    expect(classifyUrl('HTTPS://SIZETUNE.COM/a/').kind).toBe('internal');
    expect(classifyUrl('../x/', '/a/b/').kind).toBe('internal');
    expect(classifyUrl('mailto:a@b.c').kind).toBe('contact');
  });
  it('findPlaceholders: valid, malformed', () => {
    expect(findPlaceholders('x [[HUMAN: author name]] y').valid).toEqual(['author name']);
    for (const bad of ['[[human: x]]', '[[HUMAN]]', '[[HUMAN:]]', '[[HUMAN:x]]', '[[HUMAN: open']) expect(findPlaceholders(bad).bad.length, bad).toBeGreaterThan(0);
    expect(findPlaceholders('no markers [here]').valid).toEqual([]);
  });
});
