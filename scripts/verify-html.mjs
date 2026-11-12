// Inspect GENERATED HTML in dist/ with a real HTML5 parser (parse5; no JS executed). Full rule catalogue: docs/verification/VERIFIERS.md
//
// Three classes of finding:
//   FAIL         structural/security defects. Always enforced (exit 1).
//   LAUNCH       content/readiness items. Reported always; enforced by STRICT=1 (or --strict).
//   PLACEHOLDER  `[[HUMAN: description]]` markers left in copy for the human owner (author identity, contact email, ...).
//                They are LAUNCH items listed SEPARATELY as "pending human input":
//                  STRICT=1 (--strict)  fails on every non-placeholder LAUNCH rule; placeholders are only listed (exit 0 if nothing else fails).
//                  STRICT=2 (--final)   additionally FAILS on any remaining placeholder  => the true "ready to launch" gate.
//                A malformed marker (`[[human: x]]`, `[[HUMAN]]`, unterminated) is always a FAIL, so a typo cannot hide one.
//
// Usage:  node scripts/verify-html.mjs [--strict | --final]     (or STRICT=1 / STRICT=2 in the environment)
// API:    verifyDist(dist, { strict: false | true | 1 | 2 })  -> { fails, launch, placeholders, pending, rows, jsFiles }
//         `fails` already reflects the chosen strictness level. Exported for the negative-fixture tests (tests/verify-html.test.ts).
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import {
  SITE, walk, loadPages, classifyUrl, toFile, urlRefs, getAttr, hasAttr, tokens, textOf, mainWords, isHtmlEl, isEl, isJsonLd, isExecutableScript, scriptText,
  parseCsp, cspIssues, cspAllowsInline, jsIssues, cssIssues, jsClosure, externalAllowed, embedAllowed, findTrackers, findPlaceholders, markupText, scanJs,
} from './verify-lib.mjs';

const shingleSet = (w) => new Set(w.slice(0, Math.max(0, w.length - 4)).map((_, i) => w.slice(i, i + 5).join(' ').toLowerCase()));
const jaccard = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };
const level = (s) => (s === 2 || s === '2' || s === 'final' ? 2 : s ? 1 : 0);
const EMBED_TAGS = ['iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'portal'];
const ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const JSONLD_BANNED = ['FAQPage', 'QAPage', 'Review', 'AggregateRating', 'Rating', 'EmployerAggregateRating'];
const JSONLD_KNOWN = ['WebApplication', 'SoftwareApplication', 'Article', 'TechArticle', 'BlogPosting', 'BreadcrumbList', 'ListItem', 'WebSite', 'WebPage', 'Organization', 'Person', 'Offer', 'ImageObject', 'SearchAction'];

const ldNodes = (j) => (Array.isArray(j) ? j.flatMap(ldNodes) : j && typeof j === 'object' ? [j, ...(j['@graph'] ? ldNodes(j['@graph']) : [])] : []);
const ldTypes = (n) => [].concat(n['@type'] ?? []).map(String);
const hasRatingKeys = (v) => (Array.isArray(v) ? v.some(hasRatingKeys) : v && typeof v === 'object' ? Object.entries(v).some(([k, x]) => /^(aggregateRating|review|reviews|reviewRating|ratingValue|ratingCount|reviewCount|bestRating|worstRating)$/.test(k) || (k === '@type' && [].concat(x).some((t) => JSONLD_BANNED.includes(t) && t !== 'FAQPage' && t !== 'QAPage')) || hasRatingKeys(x)) : false);

export function verifyDist(dist = 'dist', { strict = false } = {}) {
  const lvl = level(strict);
  const fails = [], launch = [], placeholders = [], rows = [];
  const all = walk(dist);
  const pages = loadPages(dist);
  const indexable = pages.filter((p) => !p.noindex);
  const titles = new Map(), descs = new Map();
  const pageByRoute = new Map(pages.map((p) => [p.route, p]));
  const idsOf = (p) => new Set(p.els.map((e) => getAttr(e, 'id')).filter(Boolean));

  for (const p of pages) {
    const { route, els } = p; const seen = new Set();
    const e = (m) => { const s = `${route}: ${m}`; if (!seen.has(s)) { seen.add(s); fails.push(s); } };
    const l = (m) => launch.push(`${route}: ${m}`);
    const tag = (t) => els.filter((x) => isHtmlEl(x, t));
    const metaBy = (key, val) => tag('meta').filter((m) => (getAttr(m, key) ?? '').trim().toLowerCase() === val);
    const tool = p.toolRoute;

    /* ---- document basics */
    const htmlEl = tag('html')[0];
    if (!p.type) e('missing data-page-type on <body>');
    if (!/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/i.test(getAttr(htmlEl ?? { attrs: [] }, 'lang') ?? '')) e('missing lang on <html>');
    if (!metaBy('name', 'viewport').length) e('missing viewport meta');
    if (!tag('meta').some((m) => hasAttr(m, 'charset'))) e('missing <meta charset>');
    if (p.main.length !== 1) e(`${p.main.length} <main> landmarks (need exactly 1)`);
    const dupIds = [...els.map((x) => getAttr(x, 'id')).filter(Boolean).reduce((m, i) => m.set(i, (m.get(i) ?? 0) + 1), new Map())].filter(([, n]) => n > 1);
    if (dupIds.length) e(`duplicate id attribute(s): ${dupIds.map(([i]) => i).join(', ')}`);

    /* ---- title / description / canonical / robots */
    const titleEls = tag('title');
    const title = titleEls[0] ? textOf(titleEls[0]).trim() : undefined;
    if (titleEls.length > 1) e(`${titleEls.length} <title> elements (need 1)`);
    const descMetas = metaBy('name', 'description');
    if (descMetas.length > 1) e(`${descMetas.length} meta descriptions (need 1)`);
    const desc = getAttr(descMetas[0] ?? { attrs: [] }, 'content');
    if (!title) e('no <title>'); else { if (title.length > 60) e(`title ${title.length} chars (>60)`); if (titles.has(title)) e(`duplicate title with ${titles.get(title)}`); titles.set(title, route); }
    if (!desc) e('no meta description'); else { if (desc.length < 70 || desc.length > 160) e(`description ${desc.length} chars (need 70-160)`); if (descs.has(desc)) e(`duplicate description with ${descs.get(desc)}`); descs.set(desc, route); }
    const canons = tag('link').filter((x) => tokens(getAttr(x, 'rel')).includes('canonical'));
    if (canons.length > 1) e(`${canons.length} canonical links (need 1)`);
    if (metaBy('http-equiv', 'refresh').length) e('<meta http-equiv=refresh> found');
    const canon = getAttr(canons[0] ?? { attrs: [] }, 'href');
    if (!p.noindex && canon !== SITE + route) e(`canonical ${canon} != ${SITE + route}`);
    if (!p.noindex && p.robotsDirs.includes('nofollow')) e('nofollow robots directive on an indexable page');
    if (p.noindex && p.robotsDirs.includes('index')) e('robots meta says both index and noindex');
    const ogUrl = getAttr(metaBy('property', 'og:url')[0] ?? { attrs: [] }, 'content');
    if (ogUrl && canon && ogUrl !== canon) e(`og:url ${ogUrl} != canonical ${canon}`);
    if (!metaBy('property', 'og:title').length) e('missing og:title');
    if (p.type !== 'error' && !metaBy('property', 'og:image').length) l('missing og:image');

    /* ---- headings / images / links text */
    const heads = els.filter((x) => isHtmlEl(x) && /^h[1-6]$/.test(x.tagName));
    const h1s = heads.filter((h) => h.tagName === 'h1');
    if (h1s.length !== 1) e(`${h1s.length} <h1> elements (need exactly 1)`);
    const levels = heads.map((h) => +h.tagName[1]);
    for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) { e(`heading level skip h${levels[i - 1]} -> h${levels[i]}`); break; }
    for (const h of heads) if (!textOf(h).trim() && !tag('img').some((i) => h.childNodes && getAttr(i, 'alt'))) e(`empty <${h.tagName}>`);
    for (const img of tag('img')) if (!hasAttr(img, 'alt')) e('<img> without alt');

    /* ---- forbidden elements / attributes */
    if (tag('base').length) e('<base> element found (re-bases every relative URL)');
    for (const el of els) if (EMBED_TAGS.includes(el.tagName) && !embedAllowed(el.tagName, getAttr(el, 'src') ?? getAttr(el, 'data'), p.type)) e(`<${el.tagName}> embedding element (not allow-listed)`);
    for (const f of tag('form')) {
      if (hasAttr(f, 'action')) e('<form action> found (upload risk)');
      if ((getAttr(f, 'method') ?? '').trim().toLowerCase() === 'post') e('<form method=post> found');
    }
    for (const el of els) if (hasAttr(el, 'formaction')) e('formaction attribute found (upload risk)');
    if (!tool) for (const i of tag('input')) if ((getAttr(i, 'type') ?? '').toLowerCase() === 'file') e('<input type=file> outside a tool page');
    const handlers = [...new Set(els.flatMap((x) => (x.attrs ?? []).map((a) => a.name).filter((n) => /^on[a-z]+$/.test(n))))];
    if (handlers.length) e(`inline event handler attribute (blocked by CSP): ${handlers.join(', ')}`);
    if (els.some((x) => hasAttr(x, 'style'))) e('inline style="" attribute (blocked by CSP without unsafe-inline)');
    for (const el of els) if (hasAttr(el, 'ping')) e('<a ping> tracking attribute');

    /* ---- URLs: every URL-bearing attribute of every element (quoted, unquoted, any case, srcset, xlink:href, ...) */
    const ids = idsOf(p);
    for (const el of els) for (const r of urlRefs(el)) {
      const k = classifyUrl(r.url, route); const where = `${r.tag}[${r.attr}]`;
      if (k.kind === 'javascript') { e(`data/javascript/blob URL not permitted: ${where} ${r.url.slice(0, 40)}`); continue; }
      if (k.kind === 'data') {
        const okImg = /^data:image\//i.test(k.v) && ((r.tag === 'img' || r.tag === 'source' || r.tag === 'input') && ['src', 'srcset'].includes(r.attr) || (r.tag === 'link' && tokens(getAttr(r.el, 'rel')).includes('icon')));
        if (!okImg) e(`data/javascript/blob URL not permitted: ${where} ${r.url.slice(0, 40)}`);
        continue;
      }
      if (k.kind === 'blob') { if (!(r.tag === 'img' && ['src', 'srcset'].includes(r.attr))) e(`data/javascript/blob URL not permitted: ${where} ${r.url.slice(0, 40)}`); continue; }
      if (k.kind === 'other-scheme') { e(`unsupported URL scheme in ${where}: ${r.url.slice(0, 40)}`); continue; }
      if (k.kind === 'external') {
        if (tool) e(`third-party origin on a tool route: ${r.url}`);
        else if (!r.nav && !externalAllowed(r.url, r.tag, p.type)) e(`external resource on a non-tool page (not allow-listed): ${where} ${r.url}`);
        if (r.tag === 'a' && r.attr === 'href') {
          const rel = tokens(getAttr(r.el, 'rel'));
          if (getAttr(r.el, 'target') && !rel.includes('noopener') && !rel.includes('noreferrer') && /^_blank$/i.test(getAttr(r.el, 'target').trim())) e(`external link without rel=noopener (target=_blank): ${r.url}`);
          if (!rel.includes('noreferrer')) e(`external link without rel=noreferrer: ${r.url}`);
        }
        if (k.u.hostname === 'sizetune.com' || k.u.hostname === 'www.sizetune.com') e(`same-site link not on the canonical https://sizetune.com origin: ${r.url}`);
        continue;
      }
      if (k.kind !== 'internal') continue;
      const target = toFile(dist, k.path); const exists = (existsSync(target) && statSync(target).isFile()) || pageByRoute.has(k.path);
      if (r.tag === 'a' && r.attr === 'href') {
        if (!exists) e(`broken internal link ${r.url}`);
        else if (!k.path.endsWith('/') && !/\.[a-z0-9]+$/i.test(k.path)) e(`non-canonical internal link ${r.url} (Cloudflare would 307)`);
        else if (/^https?:/i.test(r.url) && !k.path.endsWith('/') && !/\.[a-z0-9]+$/i.test(k.path)) e(`absolute non-canonical ${r.url}`);
        else if (k.hash && k.hash !== 'top' && target.endsWith('.html')) { const tp = k.path === route ? p : pageByRoute.get(k.path); if (tp && !idsOf(tp).has(decodeURIComponent(k.hash)) && !(tp.els.some((x) => x.tagName === 'a' && getAttr(x, 'name') === k.hash))) e(`broken in-page anchor ${r.url}`); }
      } else if (r.attr !== 'action' && r.attr !== 'formaction' && !(r.tag === 'link' && r.nav) && !exists) e(`broken resource reference ${where} ${r.url}`);
    }
    for (const a of tag('a')) {
      const href = getAttr(a, 'href'); if (href === undefined || href.startsWith('#')) { if (href && href.length > 1 && !ids.has(decodeURIComponent(href.slice(1))) && href !== '#top' && !tag('a').some((x) => getAttr(x, 'name') === href.slice(1))) e(`broken in-page anchor ${href}`); continue; }
      const named = textOf(a).trim() || getAttr(a, 'aria-label') || getAttr(a, 'aria-labelledby') || getAttr(a, 'title') || [...(function* f(n) { for (const c of n.childNodes ?? []) { yield c; yield* f(c); } })(a)].some((c) => isEl(c) && ((c.tagName === 'img' && getAttr(c, 'alt')) || (c.tagName === 'svg' && (getAttr(c, 'aria-label') || c.childNodes?.some((t) => t.tagName === 'title')))));
      if (!named) e(`link without accessible name: ${href.slice(0, 60)}`);
    }

    /* ---- JSON-LD */
    let hasWebApp = false, hasArticle = false;
    for (const s of els.filter(isJsonLd)) {
      let j; try { j = JSON.parse(scriptText(s)); } catch { e('invalid JSON-LD'); continue; }
      const raw = scriptText(s);
      if (hasRatingKeys(j) || /aggregateRating|"review"/.test(raw)) e('JSON-LD contains rating/review markup (must be real; none exists)');
      for (const n of ldNodes(j)) {
        const types = ldTypes(n);
        if (n === (Array.isArray(j) ? j[0] : j) && ![].concat(n['@context'] ?? []).some((c) => /^https:\/\/schema\.org\/?$/.test(typeof c === 'string' ? c : ''))) e('JSON-LD @context must be https://schema.org');
        if (types.includes('FAQPage') || types.includes('QAPage')) e('FAQPage JSON-LD is not allowed (Google removed FAQ rich results in 2026)');
        for (const t of types) if (!JSONLD_BANNED.includes(t) && !JSONLD_KNOWN.includes(t)) l(`JSON-LD uses unreviewed @type ${t}`);
        const need = (t, keys) => { if (types.includes(t)) for (const k of keys) if (!n[k]) e(`JSON-LD ${t} missing ${k}`); };
        need('WebApplication', ['name', 'url', 'applicationCategory']); need('Article', ['headline', 'dateModified', 'mainEntityOfPage']);
        if (types.some((t) => ['WebApplication', 'SoftwareApplication'].includes(t))) {
          hasWebApp = true;
          if (n.url && !String(n.url).startsWith(SITE + '/')) e(`JSON-LD ${types[0]} url is not on ${SITE}`);
          if (!n.operatingSystem) l(`JSON-LD ${types[0]} missing operatingSystem`);
        }
        if (types.some((t) => ['Article', 'TechArticle', 'BlogPosting'].includes(t))) {
          hasArticle = true;
          if (n.headline && String(n.headline).length > 110) e('JSON-LD Article headline > 110 chars');
          for (const k of ['datePublished', 'dateModified']) if (n[k] && !ISO.test(String(n[k]))) e(`JSON-LD Article ${k} is not ISO 8601`);
          const mep = typeof n.mainEntityOfPage === 'string' ? n.mainEntityOfPage : n.mainEntityOfPage?.['@id'];
          if (mep && mep !== SITE + route) e(`JSON-LD Article mainEntityOfPage ${mep} != page URL`);
          if (!n.datePublished) l('JSON-LD Article missing datePublished');
          if (!(n.author && (n.author.name || (Array.isArray(n.author) && n.author.some((a) => a.name))))) l('JSON-LD Article missing author.name (real author identity or [[HUMAN: ...]])');
        }
      }
    }
    if (tool && !hasWebApp) l('no WebApplication JSON-LD');
    if (p.type === 'guide' && !hasArticle) l('guide without Article JSON-LD');

    /* ---- page-type rules */
    const hasNoscript = tag('noscript').length > 0;
    if (p.type === 'tool' || p.type === 'home') {
      if (!p.isTool) e(`${p.type} page without SSR'd tool markup`);
      if (!hasNoscript) e('tool page without <noscript> fallback');
    } else if (p.isTool) e('tool markup on a non-tool page type');
    const inlineExec = tag('script').filter((s) => isExecutableScript(s) && !hasAttr(s, 'src'));
    const jsRefs = els.filter((x) => (isHtmlEl(x, 'script') && hasAttr(x, 'src')) || (isHtmlEl(x, 'link') && /modulepreload|preload/.test(getAttr(x, 'rel') ?? '') && /\.m?js(\?|$)/.test(getAttr(x, 'href') ?? '')) || (x.tagName === 'astro-island' && (hasAttr(x, 'component-url') || hasAttr(x, 'renderer-url')))).length;
    p.js = jsRefs;
    if (!p.isTool && jsRefs) e(`${jsRefs} JS file(s) referenced on a non-tool page`);
    if (!p.isTool && inlineExec.length) e(`${inlineExec.length} inline <script> on a non-tool page`);

    /* ---- CSP (meta) */
    const cspMetas = metaBy('http-equiv', 'content-security-policy');
    if (!cspMetas.length) e('missing CSP <meta>'); else {
      if (cspMetas.length > 1) e(`${cspMetas.length} CSP <meta> elements (need exactly 1)`);
      const csp = getAttr(cspMetas[0], 'content') ?? '';
      for (const m of cspIssues(csp, { tool })) e(m);
      const at = els.indexOf(cspMetas[0]);
      const early = els.findIndex((x, i) => i < at && ((isExecutableScript(x)) || (isHtmlEl(x, 'link') && /stylesheet|modulepreload|preload/.test(getAttr(x, 'rel') ?? '')) || isHtmlEl(x, 'style') || isHtmlEl(x, 'body')));
      if (early !== -1) e(`CSP <meta> must come before the first <${els[early].tagName}> (it only governs content that follows it)`);
      for (const s of inlineExec) if (!cspAllowsInline(csp, 'script-src', scriptText(s))) e('inline <script> not covered by a CSP script-src hash (browser would block it)');
      for (const s of tag('style')) if (!cspAllowsInline(csp, 'style-src', scriptText(s))) e('inline <style> not covered by a CSP style-src hash (browser would block it)');
    }

    for (const s of tag('style')) for (const m of cssIssues('inline <style>', scriptText(s))) e(m);
    /* ---- tool-route privacy rules */
    if (tool) {
      if (findTrackers(markupText(p)).length) e('ad/analytics code on a tool route (policy P1)');
      for (const s of inlineExec) {
        const t = scriptText(s);
        if (/https?:\/\/|\/\/[a-z0-9.-]+\.[a-z]{2,}\//i.test(t)) e('inline script contains an external URL');
        const ext = scanJs(t).filter((f) => !['dyn-import'].includes(f.id)); // astro-island bootstrap uses import() of same-site chunks only (CSP enforces)
        for (const f of ext) e(`inline script network/side-channel capability '${f.id}' (${f.desc})`);
      }
    }
    // placeholders (anywhere in the file: copy, attributes, JSON-LD, comments)
    const ph = findPlaceholders(p.html);
    for (const b of ph.bad) e(`malformed HUMAN placeholder marker ${b.slice(0, 40)} (exact form: [[HUMAN: description]])`);
    for (const d of ph.valid) placeholders.push(`${route}: ${d}`);
    for (const m of [/lorem ipsum/i, /\bTODO\b/, /\bFIXME\b/, /\bTBD\b/]) if (m.test(p.main.map((x) => textOf(x, (c) => ['script', 'style'].includes(c.tagName))).join(' '))) l(`leftover placeholder text ${m.source}`);
    if (route === '/privacy/' && !/mailto:/i.test(p.html) && !ph.valid.some((d) => /contact|email/i.test(d))) l('privacy policy has no contact method (mailto: link or [[HUMAN: contact ...]])');
  }

  /* ---- JS the tool pages load: network capability scan (could exfiltrate user files) */
  const toolPages = pages.filter((p) => p.toolRoute);
  const { files: jsFilesLoaded, missing } = jsClosure(dist, toolPages);
  for (const m of missing) fails.push(`${m.via}: JS chunk ${m.path} referenced but missing from dist`);
  for (const [path, { src }] of jsFilesLoaded) for (const m of jsIssues(path, src, dist)) fails.push(`[tool JS] ${m}`);
  for (const f of all.filter((x) => /\.m?js$/.test(x))) {
    const rel = '/' + f.slice(dist.length).replace(/^[\\/]+/, '').split('\\').join('/');
    if (!jsFilesLoaded.has(rel)) for (const m of jsIssues(rel, readFileSync(f, 'utf8'), dist)) fails.push(`[unreferenced JS] ${m}`);
  }
  for (const f of all.filter((x) => x.endsWith('.css'))) for (const m of cssIssues(f.slice(dist.length), readFileSync(f, 'utf8'))) fails.push(`[css] ${m}`);

  /* ---- robots.txt */
  const robotsPath = join(dist, 'robots.txt'); let blocked = () => false;
  if (!existsSync(robotsPath)) fails.push('robots.txt missing'); else {
    const r = readFileSync(robotsPath, 'utf8');
    if (!new RegExp(`^Sitemap:\\s*${SITE}/sitemap-index\\.xml\\s*$`, 'm').test(r)) fails.push('robots.txt: missing/incorrect Sitemap line');
    const groups = []; let cur = null, lastWasRule = true;
    for (const line of r.split(/\r?\n/)) {
      const m = line.replace(/#.*/, '').match(/^\s*([A-Za-z-]+)\s*:\s*(.*?)\s*$/); if (!m) continue;
      const k = m[1].toLowerCase();
      if (k === 'user-agent') { if (!cur || lastWasRule) { cur = { uas: [], rules: [] }; groups.push(cur); } cur.uas.push(m[2].toLowerCase()); lastWasRule = false; }
      else if ((k === 'disallow' || k === 'allow') && cur) { cur.rules.push([k, m[2]]); lastWasRule = true; }
    }
    const star = groups.filter((g) => g.uas.includes('*')).flatMap((g) => g.rules);
    const rx = (pat) => new RegExp('^' + pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    blocked = (path) => { let best = null; for (const [k, pat] of star) { if (pat === '' ) continue; if (rx(pat).test(path) && (!best || pat.length >= best[1].length)) best = [k, pat]; } return best?.[0] === 'disallow' ? best[1] : null; };
    for (const [k, pat] of star) if (k === 'disallow' && (pat === '/' || /^\/_astro/.test(pat))) fails.push(`robots.txt: Disallow: ${pat} blocks crawling`);
    for (const p of indexable) { const b = blocked(p.route); if (b && b !== '/') fails.push(`robots.txt: Disallow: ${b} blocks indexable page ${p.route}`); }
    for (const f of all.filter((x) => /_astro[\\/].*\.(m?js|css)$/.test(x))) { const path = '/' + f.slice(dist.length).replace(/^[\\/]+/, '').split('\\').join('/'); const b = blocked(path); if (b && b !== '/') fails.push(`robots.txt: Disallow: ${b} blocks asset ${path} (/_astro must stay crawlable)`); }
  }
  /* ---- sitemaps */
  const idxPath = join(dist, 'sitemap-index.xml'); const dec = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  const smFiles = [];
  if (!existsSync(idxPath)) fails.push('sitemap-index.xml missing (robots.txt points to it)'); else {
    const idx = readFileSync(idxPath, 'utf8');
    if (!/<sitemapindex\b/.test(idx)) fails.push('sitemap-index.xml: root is not <sitemapindex>');
    for (const m of idx.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)) {
      const loc = dec(m[1]); const c = classifyUrl(loc);
      if (c.kind !== 'internal' || !c.path.endsWith('.xml')) { fails.push(`sitemap-index: ${loc} is not a same-site .xml sitemap`); continue; }
      if (c.path === '/sitemap-index.xml') { fails.push('sitemap-index: lists itself'); continue; }
      if (!existsSync(join(dist, c.path))) fails.push(`sitemap-index: ${loc} has no file`); else smFiles.push(c.path);
    }
    if (!smFiles.length) fails.push('sitemap-index.xml lists no sitemap');
  }
  const locs = [];
  for (const sf of smFiles) {
    const sm = readFileSync(join(dist, sf), 'utf8');
    if (!/<urlset\b/.test(sm)) fails.push(`${sf}: root is not <urlset>`);
    for (const m of sm.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)) locs.push(dec(m[1]));
  }
  if (smFiles.length || existsSync(join(dist, 'sitemap-0.xml')) === false) {
    if (!smFiles.length && !existsSync(join(dist, 'sitemap-0.xml'))) fails.push('sitemap-0.xml missing');
    if (new Set(locs).size !== locs.length) fails.push('sitemap: duplicate <loc> entries');
    for (const p of indexable) if (!locs.includes(SITE + p.route)) fails.push(`sitemap: missing indexable ${p.route}`);
    for (const loc of locs) {
      const c = classifyUrl(loc); const pg = pages.find((p) => SITE + p.route === loc);
      if (c.kind !== 'internal' || !existsSync(toFile(dist, c.path))) fails.push(`sitemap: ${loc} has no file`);
      else if (pg?.noindex) fails.push(`sitemap: noindex page ${loc} listed`);
      else if (!loc.endsWith('/') && !/\.[a-z0-9]+$/i.test(loc)) fails.push(`sitemap: non-canonical (no trailing slash) ${loc}`);
      if (c.kind === 'internal' && c.path === '/404/') fails.push('sitemap: lists the 404 page');
    }
  }
  /* ---- 404 must be noindex */
  const nf = pageByRoute.get('/404/'); if (nf && !nf.noindex) fails.push('/404/: 404 page is not noindex');

  /* ---- content / launch rules */
  const words = new Map(pages.map((p) => [p.route, p.main.length ? mainWords(p.main[0]) : []]));
  const sets = new Map(pages.map((p) => [p.route, shingleSet(words.get(p.route))]));
  const uniqueWords = (p) => { const seen = new Set(pages.filter((o) => o !== p).flatMap((o) => [...sets.get(o.route)])); const w = words.get(p.route); let n = 0; for (let i = 0; i + 5 <= w.length; i++) if (!seen.has(w.slice(i, i + 5).join(' ').toLowerCase())) n++; return n; };
  const floorDev = { home: 80, tool: 80, guide: 40, policy: 30, error: 0 };
  const floorLaunch = { home: 400, tool: 300, guide: 400, policy: 150, error: 0 };
  const linkedFromMain = new Set();
  for (const o of indexable) for (const mn of o.main) for (const el of [...(function* f(n) { for (const c of n.childNodes ?? []) { yield c; yield* f(c); } })(mn)]) {
    if (isHtmlEl(el, 'a') && hasAttr(el, 'href')) { const c = classifyUrl(getAttr(el, 'href'), o.route); if (c.kind === 'internal' && c.path !== o.route) linkedFromMain.add(c.path); else if (c.kind === 'internal') linkedFromMain.add('self:' + o.route); }
  }
  for (const p of indexable) {
    const w = words.get(p.route);
    if (w.length < (floorDev[p.type] ?? 40)) fails.push(`${p.route}: ${w.length} words in <main> (min ${floorDev[p.type]})`);
    const u = uniqueWords(p); p.unique = u;
    if (u < (floorLaunch[p.type] ?? 0)) launch.push(`${p.route}: ${u} UNIQUE words in <main> (launch needs >= ${floorLaunch[p.type]})`);
    if ((p.type === 'tool' || p.type === 'home') && !p.els.some((x) => isHtmlEl(x) && x.tagName === 'h2' && /(FAQ|questions)/i.test(textOf(x)))) launch.push(`${p.route}: no visible FAQ heading`);
    if (p.route !== '/' && !linkedFromMain.has(p.route)) launch.push(`${p.route}: orphan (no contextual link from another page's <main>)`);
  }
  for (let i = 0; i < indexable.length; i++) for (let j = i + 1; j < indexable.length; j++) {
    const a = indexable[i], b = indexable[j]; if (a.type !== b.type || ['policy', 'error'].includes(a.type)) continue;
    const s = jaccard(sets.get(a.route), sets.get(b.route)); if (s > 0.35) fails.push(`near-duplicate content (${s.toFixed(2)}): ${a.route} vs ${b.route}`);
  }
  for (const p of pages) rows.push({ route: p.route, type: p.type, words: words.get(p.route).length, unique: p.unique ?? '-', js: p.js, noindex: p.noindex });
  const jsFiles = all.filter((f) => f.endsWith('.js')).map((f) => ({ f: f.slice(dist.length).replace(/^[\\/]+/, ''), gz: gzipSync(readFileSync(f)).length }));
  const effective = [...fails];
  if (lvl >= 1) effective.push(...launch.map((x) => `[LAUNCH] ${x}`));
  if (lvl >= 2) effective.push(...placeholders.map((x) => `[PLACEHOLDER] ${x}`));
  return { fails: effective, hardFails: fails, launch, placeholders, pending: placeholders, rows, jsFiles, level: lvl };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const lvl = args.includes('--final') ? 2 : args.includes('--strict') ? 1 : level(process.env.STRICT);
  if (!existsSync('dist/index.html')) { console.error('dist/ not found: run `npm run build` first'); process.exit(2); }
  const r = verifyDist('dist', { strict: lvl });
  console.table(r.rows);
  console.log('JS files:', r.jsFiles.map((j) => `${j.f} ${j.gz}B gz`).join('\n         '), '\nTotal JS gzip bytes:', r.jsFiles.reduce((n, j) => n + j.gz, 0));
  if (lvl === 0 && r.launch.length) console.log(`\nLaunch-gate items not yet met (${r.launch.length}; enforced by STRICT=1):\n - ` + r.launch.join('\n - '));
  if (r.placeholders.length) console.log(`\nHUMAN-PLACEHOLDER: pending human input (${r.placeholders.length}; ${lvl >= 2 ? 'FAILING (STRICT=2)' : 'reported only, enforced by STRICT=2'}):\n - ` + r.placeholders.join('\n - '));
  if (r.fails.length) { console.error('\nFAILED:\n - ' + r.fails.join('\n - ')); process.exit(1); }
  console.log('\nverify:html OK' + (lvl === 2 ? ' (STRICT=2 final)' : lvl === 1 ? ' (STRICT=1)' : ''));
}
