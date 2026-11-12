// Inspect GENERATED HTML in dist/ (no JS executed).
// Two classes of rule: FAIL (structural defects, always enforced) and LAUNCH (content/readiness, enforced with STRICT=1).
// Exported for negative-fixture tests (tests/verify-html.test.ts), which prove each rule can actually fail.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const SITE = 'https://sizetune.com';
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>"']+))`, 'i')); return m ? (m[1] ?? m[2] ?? m[3]) : undefined; };
const metaTag = (html, key, val) => [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]).find((t) => attr(t, key)?.toLowerCase() === val);
const mainBody = (html) => (html.match(/<main[^>]*>([\s\S]*?)<\/main>/) || [])[1] ?? '';
const words = (html) => mainBody(html).replace(/<astro-island[\s\S]*?<\/astro-island>|<noscript>[\s\S]*?<\/noscript>|<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ').split(/\s+/).filter(Boolean);
const shingleSet = (w) => new Set(w.slice(0, Math.max(0, w.length - 4)).map((_, i) => w.slice(i, i + 5).join(' ').toLowerCase()));
const jaccard = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };
const toFile = (dist, href) => { // same-site href -> dist file or null
  let u; try { u = new URL(href, SITE + '/'); } catch { return undefined; }
  if (u.origin !== SITE) return undefined; // external: ignored
  const p = decodeURIComponent(u.pathname);
  return { path: p, file: p.endsWith('/') ? join(dist, p, 'index.html') : join(dist, p) };
};

export function verifyDist(dist = 'dist', { strict = false } = {}) {
  const fails = [], launch = [], rows = [];
  const all = walk(dist);
  const htmlFiles = all.filter((f) => f.endsWith('.html'));
  const pages = htmlFiles.map((f) => {
    const html = readFileSync(f, 'utf8');
    const rel = relative(dist, f);
    const route = rel === '404.html' ? '/404/' : '/' + rel.replace(/index\.html$/, '');
    const body = (html.match(/<body[^>]*>/) || [''])[0];
    const robots = metaTag(html, 'name', 'robots');
    return { f, html, route, type: attr(body, 'data-page-type'), noindex: /noindex/i.test(attr(robots || '', 'content') || ''), w: words(html) };
  });
  const indexable = pages.filter((p) => !p.noindex);
  const titles = new Map(), descs = new Map();

  for (const p of pages) {
    const { html, route } = p; const e = (m) => fails.push(`${route}: ${m}`); const l = (m) => launch.push(`${route}: ${m}`);
    if (!p.type) e('missing data-page-type on <body>');
    if (!/<html[^>]*\blang="[a-z-]+"/i.test(html)) e('missing lang on <html>');
    if (!metaTag(html, 'name', 'viewport')) e('missing viewport meta');
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
    const desc = attr(metaTag(html, 'name', 'description') || '', 'content');
    if (!title) e('no <title>'); else { if (title.length > 60) e(`title ${title.length} chars (>60)`); if (titles.has(title)) e(`duplicate title with ${titles.get(title)}`); titles.set(title, route); }
    if (!desc) e('no meta description'); else { if (desc.length < 70 || desc.length > 160) e(`description ${desc.length} chars (need 70-160)`); if (descs.has(desc)) e(`duplicate description with ${descs.get(desc)}`); descs.set(desc, route); }
    const canons = [...html.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi)];
    if (canons.length > 1) e(`${canons.length} canonical links (need 1)`);
    if (metaTag(html, 'http-equiv', 'refresh')) e('<meta http-equiv=refresh> found');
    const canon = attr((canons[0] || [''])[0], 'href');
    if (p.noindex) { /* canonical optional */ } else if (canon !== SITE + route) e(`canonical ${canon} != ${SITE + route}`);
    const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
    if (h1s.length !== 1) e(`${h1s.length} <h1> elements (need exactly 1)`);
    const levels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => +m[1]);
    for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) { e(`heading level skip h${levels[i - 1]} -> h${levels[i]}`); break; }
    for (const img of html.matchAll(/<img\b[^>]*>/gi)) if (attr(img[0], 'alt') === undefined) e('<img> without alt');
    if (/<form[^>]*\baction=/i.test(html)) e('<form action> found (upload risk)');
    if (!metaTag(html, 'property', 'og:title')) e('missing og:title');
    if (p.type !== 'error' && !metaTag(html, 'property', 'og:image')) l('missing og:image');
    // JSON-LD
    for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      let j; try { j = JSON.parse(m[1]); } catch { e('invalid JSON-LD'); continue; }
      const t = j['@type'];
      if (t === 'FAQPage') e('FAQPage JSON-LD is not allowed (Google removed FAQ rich results in 2026)');
      const need = { WebApplication: ['name', 'url', 'applicationCategory'], Article: ['headline', 'dateModified', 'mainEntityOfPage'] }[t];
      if (need) for (const k of need) if (!j[k]) e(`JSON-LD ${t} missing ${k}`);
      if (/aggregateRating|"review"/.test(m[1])) e('JSON-LD contains rating/review markup (must be real; none exists)');
    }
    // links
    const hrefs = [...html.matchAll(/<a\b[^>]*>/gi)].map((m) => attr(m[0], 'href')).filter((h) => h && !h.startsWith('#') && !/^(mailto:|tel:|javascript:)/i.test(h));
    for (const h of hrefs) {
      const r = toFile(dist, h); if (r === undefined) continue; // external
      if (!existsSync(r.file) || statSync(r.file).isDirectory()) e(`broken internal link ${h}`);
      else if (!r.path.endsWith('/') && !/\.[a-z0-9]+$/i.test(r.path)) e(`non-canonical internal link ${h} (Cloudflare would 307)`);
      else if (/^https?:/i.test(h) && h.startsWith(SITE) && !r.path.endsWith('/') && !/\.[a-z0-9]+$/i.test(r.path)) e(`absolute non-canonical ${h}`);
    }
    // page-type rules
    const isTool = /data-testid="tool"/.test(html);
    if (p.type === 'tool' || p.type === 'home') {
      if (!isTool) e(`${p.type} page without SSR'd tool markup`);
      if (!/<noscript>/.test(html)) e('tool page without <noscript> fallback');
    } else if (isTool) e('tool markup on a non-tool page type');
    const js = [...html.matchAll(/(?:src|component-url|renderer-url)="([^"]+\.js)"/g)].length;
    if (!isTool && js) e(`${js} JS file(s) referenced on a non-tool page`);
    // Ad-free tool routes (security review P1): no third-party origins, no ad/CMP script, strict CSP present.
    const cspMeta = metaTag(html, 'http-equiv', 'content-security-policy');
    if (!cspMeta) e('missing CSP <meta>'); else {
      const csp = attr(cspMeta, 'content');
      if (/unsafe-inline|unsafe-eval|\*/.test(csp)) e("CSP contains 'unsafe-inline'/'unsafe-eval'/wildcard");
      const list = csp.split(';').map((x) => x.trim()).filter(Boolean).map((d) => { const [n, ...v] = d.split(/\s+/); return [n.toLowerCase(), v]; });
      const dirs = new Map(list.filter(([n], i) => list.findIndex(([m]) => m === n) === i)); // browsers honour the first occurrence
      if (dirs.size !== list.length) e('CSP has duplicate directives');
      for (const need of ['default-src', 'script-src', 'object-src', 'base-uri']) if (!dirs.has(need)) e(`CSP missing ${need}`);
      if (dirs.get('object-src')?.join(' ') !== "'none'") e("CSP object-src must be 'none'");
      if (dirs.get('base-uri')?.join(' ') !== "'none'") e("CSP base-uri must be 'none'");
      const common = /^('self'|'none'|'sha(256|384|512)-[A-Za-z0-9+/=]+')$/;
      for (const [name, vals] of list) {
        if (['report-uri', 'report-to', 'sandbox', 'upgrade-insecure-requests', 'frame-ancestors'].includes(name)) continue;
        for (const v of vals) {
          const okExtra = name === 'img-src' && /^(blob:|data:)$/.test(v); // blob:/data: only for images
          if (!common.test(v) && !okExtra) e(`CSP ${name} allows non-self source ${v}`);
        }
      }
    }
    if (/\sstyle\s*=\s*["']/i.test(html.replace(/<script[\s\S]*?<\/script>/g, ''))) e('inline style="" attribute (blocked by CSP without unsafe-inline)');
    if (isTool || p.type === 'home') {
      if (/adsbygoogle|googlesyndication|doubleclick|googletagmanager|google-analytics/i.test(html)) e('ad/analytics code on a tool route (policy P1)');
      for (const m of html.matchAll(/\b(?:src|href|action|data|poster|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/gi)) {
        const v = (m[1] ?? m[2] ?? m[3] ?? '').trim();
        for (const u of v.split(',').map((x) => x.trim().split(/\s+/)[0])) {
          if (/^(?:https?:)?\/\//i.test(u) && !u.startsWith(SITE) && !/schema\.org/.test(u)) e(`third-party origin on a tool route: ${u}`);
          if (/^(data|blob|javascript):/i.test(u) && !/^data:image\//i.test(u) && !/^blob:/i.test(u)) e(`data/javascript URL on a tool route: ${u.slice(0, 30)}`);
        }
      }
      if (/@import\s+(url\()?["']?(https?:)?\/\//i.test(html)) e('CSS @import of an external URL');
      if (/<form\b[^>]*method\s*=\s*["']?post/i.test(html)) e('<form method=post> on a tool route');
      for (const m of html.matchAll(/<script\b(?![^>]*src=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/gi)) if (/https?:\/\/|\/\/[a-z0-9.-]+\.[a-z]{2,}\//i.test(m[1])) e('inline script contains an external URL');
    }
    for (const m of html.matchAll(/<[a-z][^>]*\son[a-z]+\s*=/gi)) { e('inline event handler attribute (blocked by CSP)'); break; }
    p.js = js;
  }
  // robots.txt
  const robotsPath = join(dist, 'robots.txt');
  if (!existsSync(robotsPath)) fails.push('robots.txt missing'); else {
    const r = readFileSync(robotsPath, 'utf8');
    if (!new RegExp(`^Sitemap:\\s*${SITE}/sitemap-index\\.xml\\s*$`, 'm').test(r)) fails.push('robots.txt: missing/incorrect Sitemap line');
    let star = false;
    for (const line of r.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z-]+)\s*:\s*(.*?)\s*$/); if (!m) continue;
      if (/^user-agent$/i.test(m[1])) star = m[2] === '*';
      if (star && /^disallow$/i.test(m[1]) && (m[2] === '/' || /^\/_astro/.test(m[2]))) fails.push(`robots.txt: Disallow: ${m[2]} blocks crawling`);
    }
  }
  // sitemap
  if (!existsSync(join(dist, 'sitemap-index.xml'))) fails.push('sitemap-index.xml missing (robots.txt points to it)');
  const smPath = join(dist, 'sitemap-0.xml');
  if (!existsSync(smPath)) fails.push('sitemap-0.xml missing'); else {
    const sm = readFileSync(smPath, 'utf8');
    const locs = [...sm.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
    for (const p of indexable) if (!locs.includes(SITE + p.route)) fails.push(`sitemap: missing indexable ${p.route}`);
    for (const loc of locs) { const r = toFile(dist, loc); const pg = pages.find((p) => SITE + p.route === loc);
      if (!r || !existsSync(r.file)) fails.push(`sitemap: ${loc} has no file`); else if (pg?.noindex) fails.push(`sitemap: noindex page ${loc} listed`); }
  }
  // 404 must be noindex
  const nf = pages.find((p) => p.route === '/404/'); if (nf && !nf.noindex) fails.push('/404/: 404 page is not noindex');
  // content/launch rules
  const sets = new Map(pages.map((p) => [p.route, shingleSet(p.w)]));
  const uniqueWords = (p) => { const others = pages.filter((o) => o !== p); const seen = new Set(others.flatMap((o) => [...sets.get(o.route)]));
    const w = p.w; let n = 0; for (let i = 0; i + 5 <= w.length; i++) if (!seen.has(w.slice(i, i + 5).join(' ').toLowerCase())) n++; return n; };
  const floorDev = { home: 80, tool: 80, guide: 40, policy: 30, error: 0 };
  const floorLaunch = { home: 400, tool: 300, guide: 400, policy: 150, error: 0 };
  for (const p of indexable) {
    if (p.w.length < (floorDev[p.type] ?? 40)) fails.push(`${p.route}: ${p.w.length} words in <main> (min ${floorDev[p.type]})`);
    const u = uniqueWords(p); p.unique = u;
    if (u < (floorLaunch[p.type] ?? 0)) launch.push(`${p.route}: ${u} UNIQUE words in <main> (launch needs >= ${floorLaunch[p.type]})`);
    if ((p.type === 'tool' || p.type === 'home') && !/<h2[^>]*>[^<]*(FAQ|questions)/i.test(p.html)) launch.push(`${p.route}: no visible FAQ heading`);
    if (p.route !== '/' && !indexable.some((o) => o !== p && [...mainBody(o.html).matchAll(/<a\b[^>]*>/gi)].some((m) => toFile(dist, attr(m[0], 'href') || '')?.path === p.route))) launch.push(`${p.route}: orphan (no contextual link from another page's <main>)`);
  }
  for (let i = 0; i < indexable.length; i++) for (let j = i + 1; j < indexable.length; j++) {
    const a = indexable[i], b = indexable[j]; if (a.type !== b.type || ['policy', 'error'].includes(a.type)) continue;
    const s = jaccard(sets.get(a.route), sets.get(b.route)); if (s > 0.35) fails.push(`near-duplicate content (${s.toFixed(2)}): ${a.route} vs ${b.route}`);
  }
  for (const p of pages) rows.push({ route: p.route, type: p.type, words: p.w.length, unique: p.unique ?? '-', js: p.js, noindex: p.noindex });
  const jsFiles = all.filter((f) => f.endsWith('.js')).map((f) => ({ f: relative(dist, f), gz: gzipSync(readFileSync(f)).length }));
  return { fails: strict ? [...fails, ...launch.map((x) => `[LAUNCH] ${x}`)] : fails, launch, rows, jsFiles };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const strict = process.env.STRICT === '1';
  const r = verifyDist('dist', { strict });
  console.table(r.rows);
  console.log('JS files:', r.jsFiles.map((j) => `${j.f} ${j.gz}B gz`).join('\n         '), '\nTotal JS gzip bytes:', r.jsFiles.reduce((n, j) => n + j.gz, 0));
  if (!strict && r.launch.length) console.log(`\nLaunch-gate items not yet met (${r.launch.length}; shown by STRICT=1):\n - ` + r.launch.join('\n - '));
  if (r.fails.length) { console.error('\nFAILED:\n - ' + r.fails.join('\n - ')); process.exit(1); }
  console.log('\nverify:html OK' + (strict ? ' (STRICT)' : ''));
}
