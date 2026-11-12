// Negative-fixture tests: each mutation of a good build must make verify-html FAIL.
// Requires a built dist/ (npm run build). `npm run verify` builds first.
import { describe, it, expect, beforeAll } from 'vitest';
import { cpSync, rmSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyDist } from '../scripts/verify-html.mjs';

const mutate = (file: string, fn: (s: string) => string) => {
  const d = mkdtempSync(join(tmpdir(), 'vh-'));
  cpSync('dist', d, { recursive: true });
  writeFileSync(join(d, file), fn(readFileSync(join(d, file), 'utf8')));
  return verifyDist(d).fails as string[];
};
const has = (fails: string[], re: RegExp) => expect(fails.some((f) => re.test(f)), fails.join('\n')).toBe(true);

describe('verify-html', () => {
  beforeAll(() => { if (!existsSync('dist/index.html')) throw new Error('run `npm run build` first'); });
  it('passes on the real build', () => expect(verifyDist('dist').fails).toEqual([]));
  it('broken internal link', () => has(mutate('index.html', (s) => s.replace('href="/privacy/"', 'href="/does-not-exist/"')), /broken internal link/));
  it('absolute non-canonical link', () => has(mutate('index.html', (s) => s.replace('href="/privacy/"', 'href="https://sizetune.com/privacy"')), /non-canonical|broken/));
  it('robots Disallow /', () => has(mutate('robots.txt', (s) => s.replace('Allow: /', 'Disallow: /')), /Disallow/));
  it('robots blocks /_astro', () => has(mutate('robots.txt', (s) => s + 'Disallow: /_astro/\n'), /_astro/));
  it('noindex, follow on indexable page listed in sitemap', () => has(mutate('privacy/index.html', (s) => s.replace('</head>', '<meta name="robots" content="noindex, follow"></head>')), /noindex page/));
  it('missing lang', () => has(mutate('index.html', (s) => s.replace(' lang="en"', '')), /lang/));
  it('missing viewport', () => has(mutate('index.html', (s) => s.replace(/<meta name="viewport"[^>]*>/, '')), /viewport/));
  it('second h1', () => has(mutate('privacy/index.html', (s) => s.replace('</main>', '<h1>Again</h1></main>')), /<h1>/));
  it('img without alt', () => has(mutate('privacy/index.html', (s) => s.replace('</main>', '<img src="/favicon.svg"></main>')), /alt/));
  it('heading skip', () => has(mutate('privacy/index.html', (s) => s.replace('</main>', '<h4>x</h4></main>')), /skip/));
  it('FAQPage JSON-LD', () => has(mutate('index.html', (s) => s.replace('"@type":"WebApplication"', '"@type":"FAQPage"')), /FAQPage/));
  it('fake rating markup', () => has(mutate('index.html', (s) => s.replace('"offers"', '"aggregateRating":{"ratingValue":5},"offers"')), /rating/));
  it('tool page without tool/noscript', () => has(mutate('index.html', (s) => s.replace(/<noscript>[\s\S]*?<\/noscript>/, '')), /noscript/));
  it('ad script on tool route', () => has(mutate('index.html', (s) => s.replace('</head>', '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script></head>')), /ad\/analytics|third-party/));
  it('third-party origin on tool route', () => has(mutate('index.html', (s) => s.replace('</head>', '<link rel="stylesheet" href="https://cdn.example.com/x.css"></head>')), /third-party/));
  it('missing CSP', () => has(mutate('index.html', (s) => s.replace(/<meta http-equiv="content-security-policy"[^>]*>/, '')), /CSP/));
  it('unsafe-inline in CSP', () => has(mutate('index.html', (s) => s.replace("default-src 'self'", "default-src 'self' 'unsafe-inline'")), /unsafe/));
  it('R2-M1 sitemap-index.xml deleted', () => { const d = mkdtempSync(join(tmpdir(), 'vh-')); cpSync('dist', d, { recursive: true }); rmSync(join(d, 'sitemap-index.xml')); has(verifyDist(d).fails, /sitemap-index/); });
  it('R2-M2 protocol-relative script on tool route', () => has(mutate('index.html', (s) => s.replace('</head>', '<script src="//ads.example.net/x.js"></script></head>')), /third-party/));
  it('R2-M3 FAQPage in script with extra attributes', () => has(mutate('index.html', (s) => s.replace('</head>', '<script id="x" type="application/ld+json">{"@type":"FAQPage"}</script></head>')), /FAQPage/));
  it('R2-M4 CSP allows a CDN script host', () => has(mutate('index.html', (s) => s.replace("script-src 'self'", "script-src 'self' https://cdn.evil.com")), /non-self/));
  it('R2-M5 inline script with external URL', () => has(mutate('index.html', (s) => s.replace('</head>', '<script>fetch("https://evil.com/x")</script></head>')), /external URL|CSP/));
  it('R2-M6 second canonical', () => has(mutate('index.html', (s) => s.replace('</head>', '<link rel="canonical" href="https://evil.com/"></head>')), /canonical/));
  it('R2-M7 meta refresh', () => has(mutate('privacy/index.html', (s) => s.replace('</head>', '<meta http-equiv="refresh" content="0;url=https://evil.com"></head>')), /refresh/));
  it('F3 script-src data:', () => has(mutate('index.html', (s) => s.replace("script-src 'self'", "script-src 'self' data:")), /non-self/));
  it('F3 script-src blob:', () => has(mutate('index.html', (s) => s.replace("script-src 'self'", "script-src 'self' blob:")), /non-self/));
  it('F3 data: script src', () => has(mutate('index.html', (s) => s.replace('</head>', '<script src="data:text/javascript,alert(1)"></script></head>')), /data\/javascript|third-party|CSP/));
  it('F3 external srcset', () => has(mutate('index.html', (s) => s.replace('</main>', '<img alt="x" srcset="https://evil.example/a.png 1x"></main>')), /third-party/));
  it('F3 unquoted iframe src', () => has(mutate('index.html', (s) => s.replace('</main>', '<iframe src=https://evil.example></iframe></main>')), /third-party/));
  it('F3 uppercase CSP directive with CDN', () => has(mutate('index.html', (s) => s.replace("default-src 'self'", "SCRIPT-SRC https://evil.example; default-src 'self'")), /non-self/));
  it('F3 CSP without base-uri none', () => has(mutate('index.html', (s) => s.replace("base-uri 'none'", "base-uri 'self'")), /base-uri/));
  it('F3 CSP without object-src', () => has(mutate('index.html', (s) => s.replace("object-src 'none';", '')), /object-src/));
  it('F3 CSS @import external', () => has(mutate('index.html', (s) => s.replace('</head>', '<style>@import url(https://evil.example/x.css);</style></head>')), /@import|CSP/));
  it('F3 inline onclick', () => has(mutate('privacy/index.html', (s) => s.replace('<h1 ', '<h1 onclick="alert(1)" ')), /event handler/));
  it('F3 form method=post', () => has(mutate('index.html', (s) => s.replace('</main>', '<form method=post><input type=file></form></main>')), /form/));
  it('F3 unquoted META refresh', () => has(mutate('privacy/index.html', (s) => s.replace('</head>', '<META HTTP-EQUIV=REFRESH CONTENT="0;url=https://evil.example"></head>')), /refresh/));
  it('inline style attribute', () => has(mutate('privacy/index.html', (s) => s.replace('<h1 ', '<h1 style="color:red" ')), /style/));
  it('wrong canonical', () => has(mutate('index.html', (s) => s.replace('rel="canonical" href="https://sizetune.com/"', 'rel="canonical" href="https://sizetune.com/x/"')), /canonical/));
  it('404 not noindex', () => has(mutate('404.html', (s) => s.replace(/<meta name="robots"[^>]*>/, '')), /404/));
  it('title too long', () => has(mutate('privacy/index.html', (s) => s.replace('<title>Privacy | SizeTune</title>', '<title>' + 'x'.repeat(80) + '</title>')), /title/));
  it('near-duplicate guide pages', () => {
    const d = mkdtempSync(join(tmpdir(), 'vh-')); cpSync('dist', d, { recursive: true });
    const g = join(d, 'guides/photo-size-for-online-forms/index.html'); const html = readFileSync(g, 'utf8');
    const copy = join(d, 'guides/copy/'); cpSync(join(d, 'guides/photo-size-for-online-forms'), copy, { recursive: true });
    writeFileSync(join(copy, 'index.html'), html.replace('https://sizetune.com/guides/photo-size-for-online-forms/', 'https://sizetune.com/guides/copy/').replace(/<title>[^<]*/, '<title>Copy').replace(/(name="description" content=")[^"]*/, '$1' + 'y'.repeat(90)));
    has(verifyDist(d).fails, /near-duplicate|sitemap/);
  });
  it('STRICT reports unmet launch items on the placeholder copy', () => {
    const r = verifyDist('dist', { strict: true });
    expect(r.fails.some((f: string) => f.startsWith('[LAUNCH]'))).toBe(true);
  });
});
