// Negative-fixture tests: each mutation of a good build must make verify-html FAIL (proving each rule can fail).
// Requires a built dist/ (pnpm run build). `pnpm run verify` builds first. Mutations run on TEMP COPIES, never on dist/.
// The first 41 tests are the original regex-era fixtures, ported 1:1 (same mutation, same assertion) onto the parse5 verifier;
// where a fixture depended on exact copy (page titles etc.) it now uses a pattern so content edits cannot turn it into a no-op.
import { describe, it, expect, beforeAll } from 'vitest';
import { cpSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { verifyDist } from '../scripts/verify-html.mjs';
import { EXTERNAL_RESOURCE_ALLOWLIST, EMBED_ALLOWLIST } from '../scripts/verify-lib.mjs';
import { requireDist, copyDist, edit, read, write, has, hasNot, withDist, firstOf, pagesOf, headEnd, mainEnd, appChunk, cssChunk, jsChunks, preactChunk, clientChunk, toolFile } from './verify-helpers';

type R = ReturnType<typeof verifyDist>;
const run = (d: string, strict: boolean | number = false): R => verifyDist(d, { strict: strict as never });
const mutate = (file: string, fn: (s: string) => string, strict: boolean | number = false) => withDist((d) => edit(d, file, fn), (d) => run(d, strict).fails as string[]);
const mutateDir = (fn: (d: string) => void, strict: boolean | number = false) => withDist(fn, (d) => run(d, strict));
const PRIV = 'privacy/index.html';

beforeAll(requireDist);

describe('verify-html (original fixtures, ported)', () => {
  it('passes on the real build', () => expect(verifyDist('dist').fails).toEqual([]));
  it('broken internal link', () => has(mutate('index.html', (s) => s.replace('href="/privacy/"', 'href="/does-not-exist/"')), /broken internal link/));
  it('absolute non-canonical link', () => has(mutate('index.html', (s) => s.replace('href="/privacy/"', 'href="https://sizetune.com/privacy"')), /non-canonical|broken/));
  it('robots Disallow /', () => has(mutate('robots.txt', (s) => s.replace('Allow: /', 'Disallow: /')), /Disallow/));
  it('robots blocks /_astro', () => has(mutate('robots.txt', (s) => s + 'Disallow: /_astro/\n'), /_astro/));
  it('noindex, follow on indexable page listed in sitemap', () => has(mutate(PRIV, (s) => s.replace('</head>', '<meta name="robots" content="noindex, follow"></head>')), /noindex page/));
  it('missing lang', () => has(mutate('index.html', (s) => s.replace(' lang="en"', '')), /lang/));
  it('missing viewport', () => has(mutate('index.html', (s) => s.replace(/<meta name="viewport"[^>]*>/, '')), /viewport/));
  it('second h1', () => has(mutate(PRIV, (s) => s.replace('</main>', '<h1>Again</h1></main>')), /<h1>/));
  it('img without alt', () => has(mutate(PRIV, (s) => s.replace('</main>', '<img src="/favicon.svg"></main>')), /alt/));
  it('heading skip', () => has(mutate(PRIV, (s) => s.replace('</main>', '<h4>x</h4></main>')), /skip/));
  it('FAQPage JSON-LD', () => has(mutate('index.html', (s) => s.replace('"@type":"WebApplication"', '"@type":"FAQPage"')), /FAQPage/));
  it('fake rating markup', () => has(mutate('index.html', (s) => s.replace('"offers"', '"aggregateRating":{"ratingValue":5},"offers"')), /rating/));
  it('tool page without tool/noscript', () => has(mutate('index.html', (s) => s.replace(/<noscript>[\s\S]*?<\/noscript>/, '')), /noscript/));
  it('ad script on tool route', () => has(mutate('index.html', (s) => s.replace('</head>', '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script></head>')), /ad\/analytics|third-party/));
  it('third-party origin on tool route', () => has(mutate('index.html', (s) => s.replace('</head>', '<link rel="stylesheet" href="https://cdn.example.com/x.css"></head>')), /third-party/));
  it('missing CSP', () => has(mutate('index.html', (s) => s.replace(/<meta http-equiv="content-security-policy"[^>]*>/, '')), /CSP/));
  it('unsafe-inline in CSP', () => has(mutate('index.html', (s) => s.replace("default-src 'self'", "default-src 'self' 'unsafe-inline'")), /unsafe/));
  it('R2-M1 sitemap-index.xml deleted', () => { const d = copyDist(); rmSync(join(d, 'sitemap-index.xml')); has(run(d).fails as string[], /sitemap-index/); rmSync(d, { recursive: true, force: true }); });
  it('R2-M2 protocol-relative script on tool route', () => has(mutate('index.html', (s) => s.replace('</head>', '<script src="//ads.example.net/x.js"></script></head>')), /third-party/));
  it('R2-M3 FAQPage in script with extra attributes', () => has(mutate('index.html', (s) => s.replace('</head>', '<script id="x" type="application/ld+json">{"@type":"FAQPage"}</script></head>')), /FAQPage/));
  it('R2-M4 CSP allows a CDN script host', () => has(mutate('index.html', (s) => s.replace("script-src 'self'", "script-src 'self' https://cdn.evil.com")), /non-self/));
  it('R2-M5 inline script with external URL', () => has(mutate('index.html', (s) => s.replace('</head>', '<script>fetch("https://evil.com/x")</script></head>')), /external URL|CSP/));
  it('R2-M6 second canonical', () => has(mutate('index.html', (s) => s.replace('</head>', '<link rel="canonical" href="https://evil.com/"></head>')), /canonical/));
  it('R2-M7 meta refresh', () => has(mutate(PRIV, (s) => s.replace('</head>', '<meta http-equiv="refresh" content="0;url=https://evil.com"></head>')), /refresh/));
  it('F3 script-src data:', () => has(mutate('index.html', (s) => s.replace("script-src 'self'", "script-src 'self' data:")), /non-self/));
  it('F3 script-src blob:', () => has(mutate('index.html', (s) => s.replace("script-src 'self'", "script-src 'self' blob:")), /non-self/));
  it('F3 data: script src', () => has(mutate('index.html', (s) => s.replace('</head>', '<script src="data:text/javascript,alert(1)"></script></head>')), /data\/javascript|third-party|CSP/));
  it('F3 external srcset', () => has(mutate('index.html', (s) => s.replace('</main>', '<img alt="x" srcset="https://evil.example/a.png 1x"></main>')), /third-party/));
  it('F3 unquoted iframe src', () => has(mutate('index.html', (s) => s.replace('</main>', '<iframe src=https://evil.example></iframe></main>')), /third-party/));
  it('F3 uppercase CSP directive with CDN', () => has(mutate('index.html', (s) => s.replace("default-src 'self'", "SCRIPT-SRC https://evil.example; default-src 'self'")), /non-self/));
  it('F3 CSP without base-uri none', () => has(mutate('index.html', (s) => s.replace("base-uri 'none'", "base-uri 'self'")), /base-uri/));
  it('F3 CSP without object-src', () => has(mutate('index.html', (s) => s.replace("object-src 'none';", '')), /object-src/));
  it('F3 CSS @import external', () => has(mutate('index.html', (s) => s.replace('</head>', '<style>@import url(https://evil.example/x.css);</style></head>')), /@import|CSP/));
  it('F3 inline onclick', () => has(mutate(PRIV, (s) => s.replace('<h1', '<h1 onclick="alert(1)"')), /event handler/));
  it('F3 form method=post', () => has(mutate('index.html', (s) => s.replace('</main>', '<form method=post><input type=file></form></main>')), /form/));
  it('F3 unquoted META refresh', () => has(mutate(PRIV, (s) => s.replace('</head>', '<META HTTP-EQUIV=REFRESH CONTENT="0;url=https://evil.example"></head>')), /refresh/));
  it('inline style attribute', () => has(mutate(PRIV, (s) => s.replace('<h1', '<h1 style="color:red"')), /style/));
  it('wrong canonical', () => has(mutate('index.html', (s) => s.replace('rel="canonical" href="https://sizetune.com/"', 'rel="canonical" href="https://sizetune.com/x/"')), /canonical/));
  it('404 not noindex', () => has(mutate('404.html', (s) => s.replace(/<meta name="robots"[^>]*>/, '')), /404/));
  it('title too long', () => has(mutate(PRIV, (s) => s.replace(/<title>[^<]*<\/title>/, '<title>' + 'x'.repeat(80) + '</title>')), /title/));
  it('near-duplicate guide pages', () => {
    const d = copyDist(); const gf = firstOf(d, 'guide'); const dir = gf.replace(/index\.html$/, ''); const html = read(d, gf);
    const route = '/' + dir;
    cpSync(join(d, dir), join(d, 'guides/copy/'), { recursive: true });
    write(d, 'guides/copy/index.html', html.replace(`https://sizetune.com${route}`, 'https://sizetune.com/guides/copy/').replace(/<title>[^<]*/, '<title>Copy').replace(/(name="description" content=")[^"]*/, '$1' + 'y'.repeat(90)));
    has(run(d).fails as string[], /near-duplicate|sitemap/); rmSync(d, { recursive: true, force: true });
  });
  // Original wording: "STRICT reports unmet launch items on the placeholder copy". The real copy is no longer placeholder-quality,
  // so the equivalent proof is: introduce a launch-only defect and show strict (and only strict) reports it as [LAUNCH].
  it('STRICT reports unmet launch items', () => {
    const f = (strict: boolean) => mutate('index.html', (s) => s.replace(/<meta property="og:image"[^>]*>/g, ''), strict);
    expect(f(true).some((x: string) => x.startsWith('[LAUNCH]'))).toBe(true);
    expect(f(false).some((x: string) => x.startsWith('[LAUNCH]'))).toBe(false);
  });
});

describe('verify-html: parser-level evasions (previously invisible to regexes)', () => {
  it('unquoted external script src on a tool route', () => has(mutate('index.html', (s) => headEnd(s, '<script src=https://evil.example/x.js></script>')), /third-party/));
  it('ODD-CASE attribute names and unquoted values (<IMG SRC=...>)', () => has(mutate('index.html', (s) => mainEnd(s, '<IMG SRC=https://evil.example/a.png ALT=x>')), /third-party/));
  it('single-quoted + whitespace/newline-split URL (java\\nscript:)', () => has(mutate(PRIV, (s) => mainEnd(s, "<a href='java\nscript:alert(1)'>x</a>")), /data\/javascript/));
  it('javascript: href', () => has(mutate(PRIV, (s) => mainEnd(s, '<a href="javascript:alert(1)">x</a>')), /data\/javascript/));
  it('external URL inside <noscript> (tracking pixel)', () => has(mutate('index.html', (s) => mainEnd(s, '<noscript><img alt="" src="https://t.example/p.gif"></noscript>')), /third-party/));
  it('external URL hidden in a <template>', () => has(mutate('index.html', (s) => mainEnd(s, '<template><img alt="" src="https://t.example/p.gif"></template>')), /third-party/));
  it('xlink:href on svg <use>', () => has(mutate('index.html', (s) => mainEnd(s, '<svg><use xlink:href="https://evil.example/s.svg#a"></use></svg>')), /third-party/));
  it('<a ping> tracking attribute', () => has(mutate(PRIV, (s) => mainEnd(s, '<a href="/" ping="/t">home</a>')), /ping/));
  it('duplicate CSP directive', () => has(mutate('index.html', (s) => s.replace("object-src 'none'", "object-src 'none';object-src 'none'")), /duplicate directives/));
  it('CSP nonce source (useless on a static site)', () => has(mutate('index.html', (s) => s.replace("script-src 'self'", "script-src 'self' 'nonce-abc'")), /non-self/));
  it('CSP https: scheme source', () => has(mutate('index.html', (s) => s.replace("img-src 'self'", "img-src 'self' https:")), /non-self|img-src/));
  it('CSP connect-src widened (tool profile)', () => has(mutate('index.html', (s) => s.replace("connect-src 'self'", "connect-src 'self' blob:")), /connect-src must be exactly/));
  it('CSP connect-src wildcard', () => has(mutate('index.html', (s) => s.replace("connect-src 'self'", 'connect-src *')), /wildcard/));
  it('CSP frame-src removed (tool profile)', () => has(mutate('index.html', (s) => s.replace("frame-src 'none';", '')), /missing frame-src/));
  it('CSP form-action removed (tool profile)', () => has(mutate('index.html', (s) => s.replace("form-action 'self';", '')), /missing form-action/));
  it('CSP worker-src blob: (tool profile)', () => has(mutate('index.html', (s) => s.replace("worker-src 'self'", 'worker-src blob:')), /worker-src/));
  it('CSP report-uri to a third party', () => has(mutate('index.html', (s) => s.replace("object-src 'none'", "object-src 'none';report-uri https://r.example/c")), /report-uri|non-self/));
  it('two CSP metas', () => has(mutate('index.html', (s) => headEnd(s, `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none'">`)), /2 CSP/));
  it('inline script changed => CSP hash no longer matches', () => has(mutate('index.html', (s) => s.replace(/<script>([^<]{20,})<\/script>/, '<script>$1;</script>')), /not covered by a CSP script-src hash/));
  it('inline style changed => CSP hash no longer matches', () => has(mutate('index.html', (s) => s.replace(/<style>([^<]+)<\/style>/, '<style>$1 </style>')), /not covered by a CSP style-src hash/));
  it('CSP meta placed after the stylesheet link', () => has(mutate('index.html', (s) => { const m = s.match(/<meta http-equiv="content-security-policy"[^>]*>/)![0]; return s.replace(m, '').replace('</head>', m + '</head>'); }), /CSP <meta> must come before/));
  it('<base> element', () => has(mutate(PRIV, (s) => headEnd(s, '<base href="https://evil.example/">')), /<base>/));
  it.each(['iframe', 'object', 'embed'])('<%s> on a non-tool page (same-site src)', (t) => has(mutate(PRIV, (s) => mainEnd(s, `<${t} src="/favicon.svg"></${t}>`)), /embedding element/));
  it('external srcset on a non-tool page', () => has(mutate(PRIV, (s) => mainEnd(s, '<img alt="x" src="/favicon.svg" srcset="https://evil.example/a.png 1x, /favicon.svg 2x">')), /external resource on a non-tool page/));
  it('external <img> on a non-tool page', () => has(mutate(PRIV, (s) => mainEnd(s, '<img alt="x" src="https://evil.example/a.png">')), /external resource on a non-tool page/));
  it('external stylesheet on a non-tool page', () => has(mutate(PRIV, (s) => headEnd(s, '<link rel=stylesheet href=https://fonts.googleapis.com/css>')), /external resource on a non-tool page/));
  it('external @import in a non-tool inline <style>', () => has(mutate(PRIV, (s) => headEnd(s, '<style>@import "https://evil.example/x.css";</style>')), /@import/));
  it('data: / blob: script src on a non-tool page', () => { has(mutate(PRIV, (s) => headEnd(s, '<script src="data:text/javascript,1"></script>')), /data\/javascript\/blob/); has(mutate(PRIV, (s) => headEnd(s, '<script src="blob:https://sizetune.com/x"></script>')), /data\/javascript\/blob/); });
  it('data:image is only allowed on <img>', () => { has(mutate(PRIV, (s) => mainEnd(s, '<a href="data:image/png;base64,AAAA">x</a>')), /data\/javascript\/blob/); hasNot(mutate(PRIV, (s) => mainEnd(s, '<img alt="" src="data:image/png;base64,AAAA">')), /data\/javascript/); });
  it('JS referenced / inline script on a non-tool page', () => { has(mutate(PRIV, (s) => headEnd(s, '<script type="module" src="/_astro/client.js"></script>')), /non-tool page/); has(mutate(PRIV, (s) => mainEnd(s, '<script>1</script>')), /inline <script> on a non-tool page/); });
  it('inline ODD-CASE event handler (unquoted) on an svg', () => has(mutate(PRIV, (s) => mainEnd(s, '<svg ONLOAD=alert(1)></svg>')), /event handler/));
  it('form method=POST (upper case) on a non-tool page', () => has(mutate(PRIV, (s) => mainEnd(s, '<form METHOD=POST></form>')), /form method=post/));
  it('<form action> and formaction', () => { has(mutate(PRIV, (s) => mainEnd(s, '<form action="/x"></form>')), /form action/); has(mutate(PRIV, (s) => mainEnd(s, '<button formaction="/x">x</button>')), /formaction/); });
  it('<input type=file> outside a tool page', () => has(mutate(PRIV, (s) => mainEnd(s, '<input type="file">')), /input type=file/));
  it('external link rel lint: missing noreferrer / target=_blank without noopener', () => {
    has(mutate(PRIV, (s) => mainEnd(s, '<a href="https://example.org/">x</a>')), /without rel=noreferrer/);
    has(mutate(PRIV, (s) => mainEnd(s, '<a href="https://example.org/" target="_blank" rel="noreferrer">x</a><a href="https://example.org/" target="_blank">y</a>')), /without rel=noopener/);
    hasNot(mutate(PRIV, (s) => mainEnd(s, '<a href="https://example.org/" target="_blank" rel="noopener noreferrer">x</a>')), /external link|external resource/);
  });
  it('external <a> on a tool route is still a third-party origin', () => has(mutate('index.html', (s) => mainEnd(s, '<a href="https://example.org/" rel="noopener noreferrer">x</a>')), /third-party/));
  it('external resource allow-list is explicit (empty today; an entry is origin+tag+page-type specific)', () => {
    expect(EXTERNAL_RESOURCE_ALLOWLIST).toEqual([]); expect(EMBED_ALLOWLIST).toEqual([]);
    const snippet = '<img alt="x" src="https://img.example.org/a.png">';
    EXTERNAL_RESOURCE_ALLOWLIST.push({ origin: 'https://img.example.org', tags: ['img'], pageTypes: ['policy'], reason: 'test' } as never);
    try {
      hasNot(mutate(PRIV, (s) => mainEnd(s, snippet)), /external resource/);
      has(mutate('index.html', (s) => mainEnd(s, snippet)), /third-party/); // never on tool routes
      has(mutate(firstOf(copyDist(), 'guide'), (s) => mainEnd(s, snippet)), /external resource/); // wrong page type
    } finally { EXTERNAL_RESOURCE_ALLOWLIST.pop(); }
  });
  it('same-site link on http:// or www.', () => { has(mutate(PRIV, (s) => mainEnd(s, '<a href="http://sizetune.com/">x</a>')), /same-site link|canonical/); has(mutate(PRIV, (s) => mainEnd(s, '<a href="https://www.sizetune.com/">x</a>')), /same-site link/); });
  it('broken in-page anchor, broken resource reference', () => {
    has(mutate(PRIV, (s) => mainEnd(s, '<a href="#nope">x</a>')), /broken in-page anchor/);
    has(mutate(PRIV, (s) => headEnd(s, '<link rel="stylesheet" href="/_astro/missing.css">')), /broken resource reference/);
  });
  it('link without an accessible name', () => has(mutate(PRIV, (s) => mainEnd(s, '<a href="/"></a>')), /accessible name/));
  it('empty heading', () => has(mutate(PRIV, (s) => mainEnd(s, '<h2></h2>')), /empty <h2>/));
  it('duplicate id, missing meta charset, two <main>, two <title>', () => {
    has(mutate(PRIV, (s) => mainEnd(s, '<p id="dup">a</p><p id="dup">b</p>')), /duplicate id/);
    has(mutate(PRIV, (s) => s.replace(/<meta charset[^>]*>/, '')), /charset/);
    has(mutate(PRIV, (s) => s.replace('</main>', '</main><main>x</main>')), /<main> landmarks/);
    has(mutate(PRIV, (s) => headEnd(s, '<title>Second</title>')), /<title> elements/);
  });
});

describe('verify-html: canonical / robots meta / sitemap / robots.txt', () => {
  it('canonical with attributes in the other order and without trailing slash', () => has(mutate(PRIV, (s) => s.replace(/<link rel="canonical" href="([^"]*)\/">/, '<link href="$1" rel=canonical>')), /canonical/));
  it('relative canonical', () => has(mutate(PRIV, (s) => s.replace(/<link rel="canonical" href="https:\/\/sizetune\.com([^"]*)">/, '<link rel="canonical" href="$1">')), /canonical/));
  it('rel="canonical alternate" counts as a second canonical', () => has(mutate(PRIV, (s) => headEnd(s, '<link rel="alternate canonical" href="https://sizetune.com/x/">')), /canonical links/));
  it.each([
    ['content before name', '<meta content="noindex" name="robots">'],
    ['upper case unquoted', '<META NAME=ROBOTS CONTENT=NOINDEX>'],
    ['googlebot', '<meta name="googlebot" content="noindex">'],
    ['none', '<meta name="robots" content="none">'],
  ])('robots meta any attribute order: %s', (_n, tag) => has(mutate(PRIV, (s) => headEnd(s, tag)), /noindex page/));
  it('nofollow on an indexable page', () => has(mutate(PRIV, (s) => headEnd(s, '<meta name="robots" content="nofollow">')), /nofollow/));
  it('og:url differs from canonical', () => has(mutate(PRIV, (s) => s.replace(/(<meta property="og:url" content=")[^"]*/, '$1https://sizetune.com/zzz/')), /og:url/));
  it('404 robots meta with reversed attributes is still noindex (passes)', () => hasNot(mutate('404.html', (s) => s.replace(/<meta name="robots" content="([^"]*)">/, '<meta content="$1" name="robots">')), /404/));
  it('sitemap: duplicate loc, non-canonical loc, lists 404, missing indexable page, loc without file', () => {
    has(mutate('sitemap-0.xml', (s) => s.replace('</urlset>', s.match(/<url>.*?<\/url>/)![0] + '</urlset>')), /duplicate <loc>/);
    has(mutate('sitemap-0.xml', (s) => s.replace('</urlset>', '<url><loc>https://sizetune.com/privacy</loc></url></urlset>')), /non-canonical|no file/);
    has(mutate('sitemap-0.xml', (s) => s.replace('</urlset>', '<url><loc>https://sizetune.com/404/</loc></url></urlset>')), /404|no file/);
    has(mutate('sitemap-0.xml', (s) => s.replace(/<url><loc>https:\/\/sizetune\.com\/privacy\/<\/loc>.*?<\/url>/, '')), /missing indexable \/privacy\//);
    has(mutate('sitemap-0.xml', (s) => s.replace('</urlset>', '<url><loc>https://sizetune.com/ghost/</loc></url></urlset>')), /has no file/);
  });
  it('sitemap-index: references a missing sitemap / lists itself / external', () => {
    has(mutate('sitemap-index.xml', (s) => s.replace('</sitemapindex>', '<sitemap><loc>https://sizetune.com/sitemap-9.xml</loc></sitemap></sitemapindex>')), /sitemap-9\.xml has no file/);
    has(mutate('sitemap-index.xml', (s) => s.replace('</sitemapindex>', '<sitemap><loc>https://sizetune.com/sitemap-index.xml</loc></sitemap></sitemapindex>')), /lists itself/);
    has(mutate('sitemap-index.xml', (s) => s.replace('</sitemapindex>', '<sitemap><loc>https://evil.example/s.xml</loc></sitemap></sitemapindex>')), /not a same-site/);
  });
  it('sitemap-0.xml removed while sitemap-index still names it', () => { const d = copyDist(); rmSync(join(d, 'sitemap-0.xml')); has(run(d).fails as string[], /sitemap-0\.xml has no file/); rmSync(d, { recursive: true, force: true }); });
  it('robots.txt: Disallow of an indexable page, multi-UA group, specific-UA group is fine, wrong Sitemap line', () => {
    has(mutate('robots.txt', (s) => s + '\nUser-agent: *\nDisallow: /privacy/\n'), /blocks indexable page \/privacy\//);
    has(mutate('robots.txt', (s) => s.replace('User-agent: *', 'User-agent: *\nUser-agent: googlebot').replace('Allow: /', 'Disallow: /')), /Disallow: \//);
    hasNot(mutate('robots.txt', (s) => s + '\nUser-agent: GPTBot\nDisallow: /\n'), /robots/);
    has(mutate('robots.txt', (s) => s.replace('sitemap-index.xml', 'sitemap.xml')), /Sitemap line/);
    has(mutate('robots.txt', (s) => s + '\nUser-agent: *\nDisallow: /*_astro\n'), /blocks indexable|_astro/);
  });
});

describe('verify-html: JSON-LD per type', () => {
  const ld = (file: string, fn: (j: any) => void) => mutate(file, (s) => s.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (_m, a, b, c) => { const j = JSON.parse(b); fn(j); return a + JSON.stringify(j) + c; }));
  it('invalid JSON', () => has(mutate('index.html', (s) => s.replace(/(<script type="application\/ld\+json">)/, '$1{oops')), /invalid JSON-LD/));
  it.each(['name', 'url', 'applicationCategory'])('WebApplication missing %s', (k) => has(ld('index.html', (j) => { const n = j['@graph'] ? j['@graph'].find((x: any) => x['@type'] === 'WebApplication') : j; delete n[k]; }), new RegExp(`WebApplication missing ${k}`)));
  it('WebApplication url off-site', () => has(ld('index.html', (j) => { const n = j['@graph'] ? j['@graph'].find((x: any) => x['@type'] === 'WebApplication') : j; n.url = 'https://evil.example/'; }), /url is not on/));
  it.each(['headline', 'dateModified', 'mainEntityOfPage'])('Article missing %s', (k) => {
    const g = firstOf(copyDist(), 'guide');
    has(mutate(g, (s) => s.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, (m) => { const j = JSON.parse(m.replace(/<[^>]+>/g, '')); const arr = j['@graph'] ?? [j]; for (const n of arr) if (n['@type'] === 'Article') delete n[k]; return `<script type="application/ld+json">${JSON.stringify(j)}</script>`; })), new RegExp(`Article missing ${k}`));
  });
  it('Article with a bad date / wrong mainEntityOfPage', () => {
    const g = firstOf(copyDist(), 'guide');
    const f = (fn: (n: any) => void) => mutate(g, (s) => s.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, (m) => { const j = JSON.parse(m.replace(/<[^>]+>/g, '')); for (const n of j['@graph'] ?? [j]) if (n['@type'] === 'Article') fn(n); return `<script type="application/ld+json">${JSON.stringify(j)}</script>`; }));
    has(f((n) => { n.dateModified = 'yesterday'; }), /not ISO 8601/);
    has(f((n) => { n.mainEntityOfPage = 'https://sizetune.com/other/'; }), /mainEntityOfPage .* != page URL/);
  });
  it.each(['QAPage', 'Review', 'AggregateRating'])('%s type is banned', (t) => has(mutate('index.html', (s) => s.replace('"@type":"WebApplication"', `"@type":"${t}"`)), /rating\/review|FAQPage/));
  it.each([['review', '"review":{"@type":"Review"}'], ['ratingValue', '"ratingValue":4'], ['reviewCount', '"reviewCount":3']])('no %s key anywhere in JSON-LD', (_k, frag) => has(mutate('index.html', (s) => s.replace('"offers"', `${frag},"offers"`)), /rating\/review/));
  it('JSON-LD @context must be schema.org', () => has(mutate('index.html', (s) => s.replace('"@context":"https://schema.org"', '"@context":"https://evil.example"')), /@context/));
  it('unreviewed @type is a LAUNCH item (strict only)', () => { const f = (st: boolean) => mutate('index.html', (s) => s.replace('"@type":"WebApplication"', '"@type":"WebApplication","additionalType":"x"').replace('</head>', '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Recipe"}</script></head>'), st); has(f(true), /\[LAUNCH\].*unreviewed @type Recipe/); hasNot(f(false), /unreviewed/); });
  it('JSON-LD in an odd-case type attribute is still parsed', () => has(mutate('index.html', (s) => s.replace('</head>', '<script TYPE=" APPLICATION/LD+JSON ">{"@type":"FAQPage"}</script></head>')), /FAQPage/));
});

describe('verify-html: JS referenced by tool pages (network capability)', () => {
  const cases: [string, string][] = [
    ['fetch', 'fetch("/api")'], ['XMLHttpRequest', 'new XMLHttpRequest()'], ['sendBeacon', 'navigator.sendBeacon("/b",x)'], ['WebSocket', 'new WebSocket("wss://x")'],
    ['EventSource', 'new EventSource("/s")'], ['importScripts', 'importScripts("/x.js")'], ['pixel beacon', 'new Image().src="/p?"+1'], ['WebRTC', 'new RTCPeerConnection()'],
    ['dynamic import', 'import("/_astro/x.js")'], ['eval', 'eval("1")'], ['Function ctor', 'new Function("1")'], ['document.write', 'document.write("x")'],
    ['cookie', 'document.cookie="a=b"'], ['window.open', 'window.open("/")'], ['location redirect', 'location.href="/x"'], ['external URL', 'var u="https://collect.example/x"'],
    ['protocol-relative URL', 'var u="//collect.example.com/x"'], ['serviceWorker', 'navigator.serviceWorker.register("/sw.js")'], ['localStorage', 'localStorage.setItem("a","b")'],
  ];
  it.each(cases)('%s in the app chunk', (_n, code) => has(mutateDir((d) => edit(d, appChunk(d), (s) => s + `\n;${code};`)).fails as string[], /\[tool JS\]/));
  it('network primitive in the web worker chunk', () => has(mutateDir((d) => { const w = jsChunks(d).find((f) => /compress\.worker/.test(f))!; edit(d, w, (s) => s + ';self.fetch("/x");'); }).fails as string[], /\[tool JS\].*fetch/));
  it('fetch added to the Preact chunk is NOT covered by the allow-list', () => has(mutateDir((d) => edit(d, preactChunk(d), (s) => s + ';fetch("/x");')).fails as string[], /\[tool JS\].*'fetch'/));
  it('allow-listed Preact namespace URL appearing more often than audited', () => has(mutateDir((d) => edit(d, preactChunk(d), (s) => s + ';var a="http://www.w3.org/2000/svg";')).fails as string[], /re-audit/));
  it('a second dynamic import in the island client is NOT covered by the allow-list', () => has(mutateDir((d) => edit(d, clientChunk(d), (s) => s + ';import("/_astro/x.js");')).fails as string[], /\[tool JS\].*dyn-import|re-audit/));
  it('a non-literal dynamic import in the island client is NOT covered (proof of literal form)', () => has(mutateDir((d) => edit(d, clientChunk(d), (s) => s.replace(/import\(`\.\/signals\.module\.[\w-]+\.js`\)/, 'import(location.hash.slice(1))'))).fails as string[], /dyn-import/));
  it('the audited allow-list entries do not hide the same token in app code', () => has(mutateDir((d) => edit(d, appChunk(d), (s) => s + ';var a="preconnect";')).fails as string[], /resource-hint/));
  it('Worker constructed from a non-literal URL', () => has(mutateDir((d) => edit(d, appChunk(d), (s) => s + ';new Worker(location.hash.slice(1));')).fails as string[], /non-literal URL/));
  it('unreferenced JS chunk with fetch is still scanned', () => has(mutateDir((d) => write(d, '_astro/stray.js', 'fetch("/x")')).fails as string[], /\[unreferenced JS\]/));
  it('referenced chunk missing from dist', () => has(mutateDir((d) => rmSync(join(d, jsChunks(d).find((f) => /compress\.worker/.test(f))!))).fails as string[], /referenced but missing/));
  it('network primitive in an inline script on a tool page', () => has(mutate('index.html', (s) => headEnd(s, '<script>navigator.sendBeacon("/x")</script>')), /sendBeacon|CSP/));
  it('inline script network capability named explicitly', () => has(mutate('index.html', (s) => headEnd(s, '<script>new WebSocket("wss://x")</script>')), /inline script network\/side-channel capability 'websocket'/));
  it('external @import / url() in a stylesheet file', () => {
    has(mutateDir((d) => edit(d, cssChunk(d), (s) => s + '@import url(https://evil.example/a.css);')).fails as string[], /\[css\].*@import/);
    has(mutateDir((d) => edit(d, cssChunk(d), (s) => s + '@font-face{font-family:x;src:url(https://fonts.gstatic.com/x.woff2)}')).fails as string[], /\[css\].*url\(\)/);
  });
});

describe('verify-html: HUMAN placeholders and strictness levels', () => {
  const PH = '<p>[[HUMAN: owner contact email]]</p>';
  const withPh = (strict: boolean | number, extra: (s: string) => string = (s) => s) => mutate(PRIV, (s) => extra(mainEnd(s, PH)), strict);
  it('placeholders are collected and listed separately', () => {
    const r = mutateDir((d) => edit(d, PRIV, (s) => mainEnd(s, PH)));
    expect(r.placeholders).toContain('/privacy/: owner contact email');
    expect(r.hardFails.filter((x: string) => /PLACEHOLDER|HUMAN/.test(x))).toEqual([]);
  });
  it('level 0 and STRICT=1 do not fail on a placeholder', () => { hasNot(withPh(false), /PLACEHOLDER|HUMAN/); hasNot(withPh(true), /PLACEHOLDER|HUMAN/); hasNot(withPh(1), /PLACEHOLDER/); });
  it('STRICT=2 fails on every remaining placeholder', () => has(withPh(2), /^\[PLACEHOLDER\] \/privacy\/: owner contact email/));
  it('STRICT=1 still fails on non-placeholder LAUNCH rules even when placeholders are present', () => has(withPh(1, (s) => s.replace(/<meta property="og:image"[^>]*>/g, '')), /^\[LAUNCH\].*og:image/));
  it('STRICT=2 reports LAUNCH and PLACEHOLDER together', () => { const f = withPh(2, (s) => s.replace(/<meta property="og:image"[^>]*>/g, '')); has(f, /\[LAUNCH\]/); has(f, /\[PLACEHOLDER\]/); });
  it('a placeholder in an attribute / JSON-LD / title is found', () => {
    const r = mutateDir((d) => edit(d, PRIV, (s) => s.replace('</head>', '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"[[HUMAN: legal entity name]]"}</script></head>')));
    expect(r.placeholders).toContain('/privacy/: legal entity name');
  });
  it.each(['[[human: x]]', '[[HUMAN]]', '[[HUMAN:]]', '[[ HUMAN : x ]]', '[[HUMAN: unterminated'])('malformed marker %s is always a FAIL', (m) => has(mutate(PRIV, (s) => mainEnd(s, `<p>${m}</p>`)), /malformed HUMAN placeholder/));
  it('contact-method launch rule is satisfied by a mailto: link or a contact placeholder, otherwise strict-only', () => {
    const base = (s: string) => s.replace(/<a [^>]*href="mailto:[^"]*"[^>]*>/gi, '<a href="/">').replace(/\[\[HUMAN: [^\]]*(contact|email)[^\]]*\]\]/gi, 'x');
    has(mutate(PRIV, base, true), /\[LAUNCH\].*no contact method/); hasNot(mutate(PRIV, base, false), /no contact method/);
    hasNot(mutate(PRIV, (s) => mainEnd(base(s), '<p>[[HUMAN: contact email]]</p>'), true), /no contact method/);
  });
  it('orphan page is a LAUNCH item', () => {
    const r = mutateDir((d) => { for (const f of pagesOf(d, ['home', 'tool', 'guide', 'policy'])) if (f !== PRIV && read(d, f).includes('href="/privacy/"')) edit(d, f, (s) => s.replace(/(<main[\s\S]*?<\/main>)/, (m) => m.replace(/href="\/privacy\/"/g, 'href="/about/"'))); }, true);
    has(r.fails as string[], /\[LAUNCH\].*\/privacy\/: orphan/);
  });
  it('FAQ heading missing on a tool page is a LAUNCH item', () => {
    const f = toolFile(copyDist());
    has(mutate(f, (s) => s.replace(/(<h2[^>]*>)([^<]*(FAQ|[Qq]uestions)[^<]*)/g, '$1Other'), true), /\[LAUNCH\].*FAQ/);
  });
  it('CLI: exit codes and output for the three levels', () => {
    const d = copyDist(); edit(d, PRIV, (s) => mainEnd(s, PH));
    // the CLI reads ./dist, so run it from a directory whose `dist` is the (mutated) temp copy
    const root = mkdtempSync(join(tmpdir(), 'verify-cli-')); cpSync(d, join(root, 'dist'), { recursive: true });
    const go = (args: string[], env: Record<string, string> = {}) => spawnSync(process.execPath, [join(process.cwd(), 'scripts/verify-html.mjs'), ...args], { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8' });
    const a = go([]); expect(a.status, a.stderr).toBe(0); expect(a.stdout).toMatch(/HUMAN-PLACEHOLDER: pending human input/);
    const b = go(['--strict']); expect(b.status, b.stderr).toBe(0); expect(b.stdout).toMatch(/owner contact email/);
    const c = go([], { STRICT: '1' }); expect(c.status, c.stderr).toBe(0);
    const f = go(['--final']); expect(f.status).toBe(1); expect(f.stderr).toMatch(/\[PLACEHOLDER\] \/privacy\/: owner contact email/);
    const g = go([], { STRICT: '2' }); expect(g.status).toBe(1);
    rmSync(root, { recursive: true, force: true }); rmSync(d, { recursive: true, force: true });
  });
});
