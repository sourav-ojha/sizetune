// Evidence rules for growth-strategy records and markdown. Schema shape first, then the semantic rules
// that keep numbers honest: every metric value has a provenance, every claim cites a source that exists.
import fs from 'node:fs';
import path from 'node:path';
import { validateSchema } from './config.mjs';
import { RECORDS, MD_FILES, today, daysBetween, sha256, normKw, kwText, itemHash } from './state.mjs';

export const CLASSES = ['fact', 'inference', 'estimate', 'hypothesis', 'assumption', 'unknown'];
const SOURCED = ['fact', 'inference', 'estimate'];
export const IMPORTED = ['gsc', 'analytics'];
const MAX_MEDIUM = ['inference', 'estimate', 'assumption'];
export const UNSAFE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/;
const GWT = /\bgiven\b[\s\S]*\bwhen\b[\s\S]*\bthen\b/i;
const TRAFFIC = [
  /\b\d[\d,.]*\s*(k|m|thousand|million)?\+?\s*(new\s+|more\s+|extra\s+|monthly\s+|organic\s+|daily\s+)?(visits|visitors|clicks|searches|sessions|users|pageviews|page views|signups|sign-ups|impressions|downloads)\b/i,
  /\b\d+(\.\d+)?\s*%\s*(ctr|conversion|click-through|more traffic|traffic growth|growth)/i,
];
const MD_NUMBER = [
  /\b\d[\d,.]*\s*(k|m)?\b(?:\s+\S+){0,3}?\s+(searches|search volume|visits|visitors|traffic|sessions|clicks|impressions|pageviews|page views|signups)\b/i,
  /\b(ctr|keyword difficulty|difficulty|kd|search volume)\b[^.]{0,20}\d/i,
];
const def = (name) => ({ $ref: `#/$defs/${name}` });
const shape = (v, name, at) => validateSchema(v, def(name), at, RECORDS);

// Every free-text field ends up in generated markdown and CSV: one line, no control or bidi characters.
function unsafeText(v, at, out) {
  if (typeof v === 'string') { if (UNSAFE.test(v)) out.push(`${at}: contains control characters (one line of plain text only)`); }
  else if (Array.isArray(v)) v.forEach((x, i) => unsafeText(x, `${at}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) unsafeText(x, `${at}.${k}`, out);
}

export function checkSource(s, at = 'source') {
  const e = shape(s, 'source', at);
  unsafeText(s, at, e);
  if (!s.url && !s.ref) e.push(`${at}: needs a url or ref (repo:, file:, user:, tool:)`);
  if (s.url && !/^https?:\/\/[^\s|<>()"'`\\]+$/.test(s.url)) e.push(`${at}: url must be an http(s) address without spaces, quotes, brackets, | or < > (percent-encode them)`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.accessed || '') && s.accessed > today()) e.push(`${at}: accessed date ${s.accessed} is in the future`);
  if (['gsc', 'analytics'].includes(s.type) && !s.sha256) e.push(`${at}: ${s.type} sources are imported files and need a sha256`);
  return e;
}

function checkMetric(m, at, byId, e) {
  if (!m || typeof m !== 'object') return;
  const range = m.min !== undefined || m.max !== undefined;
  if (m.kind === 'unknown') { if (m.value !== null || range) e.push(`${at}: kind unknown, so value must be null and there is no range (never guess a number)`); return; }
  if (range) {
    if (m.kind !== 'estimate' || m.value !== null) e.push(`${at}: a range (min/max) is only for estimates, with value null`);
    if (!(m.min <= m.max)) e.push(`${at}: a range needs both min and max, min <= max`);
  } else if (m.value === null) { e.push(`${at}: kind ${m.kind} needs a value or a min/max range, or use kind unknown`); return; }
  if (!m.source) { e.push(`${at}: a ${m.kind} value needs a source`); return; }
  const src = byId.get(m.source);
  if (!src) { e.push(`${at}: unknown source ${m.source}`); return; }
  if (m.kind === 'measured' && !['gsc', 'analytics'].includes(src.type)) e.push(`${at}: measured values must come from an imported gsc or analytics source (${m.source} is ${src.type})`);
  if (m.kind === 'estimate' && !['tool-export', 'user'].includes(src.type)) e.push(`${at}: an estimate must come from a tool-export or user source (${m.source} is ${src.type}); otherwise the number is unknown`);
}

function checkClaim(r, at, byId, e) {
  for (const id of r.sources || []) if (!byId.has(id)) e.push(`${at}: unknown source ${id}`);
  if (SOURCED.includes(r.evidence) && !(r.sources || []).length) e.push(`${at}: evidence ${r.evidence} needs at least one source`);
  if (r.evidence === 'hypothesis' && r.confidence !== 'low') e.push(`${at}: a hypothesis has confidence low`);
  if (MAX_MEDIUM.includes(r.evidence) && r.confidence === 'high') e.push(`${at}: ${r.evidence} is at most medium confidence`);
  const types = (r.sources || []).map((id) => byId.get(id)?.type).filter(Boolean);
  if ((r.evidence === 'fact' || r.confidence === 'high') && types.length && types.every((t) => t === 'community')) e.push(`${at}: a fact or high-confidence claim cannot rest only on community sources`);
}

export function checkKeyword(k, byId, at = 'keyword') {
  const e = shape(k, 'keyword', at);
  unsafeText(k, at, e);
  if (e.length) return e;
  for (const m of ['volume', 'difficulty', 'cpc']) checkMetric(k[m], `${at} "${k.keyword}" ${m}`, byId, e);
  for (const re of TRAFFIC) if (re.test(k.serp_notes || '')) e.push(`${at} "${k.keyword}": serp_notes contains a search or traffic number; numbers go in the metric fields with a source`);
  checkClaim(k, `${at} "${k.keyword}"`, byId, e);
  return e;
}

export function checkItem(i, byId, at = 'item') {
  const e = shape(i, 'item', at);
  unsafeText(i, at, e);
  if (e.length) return e;
  const label = `${at} ${i.id || `"${i.title}"`}`;
  for (const re of TRAFFIC) if (re.test([i.title, i.rationale, ...(i.acceptance || []), ...(i.risks || [])].join(' '))) e.push(`${label}: contains a traffic number; impact stays qualitative (H/M/L), numbers live only in keyword metrics with a source`);
  if (i.owner === 'implementer' && (!(i.acceptance || []).length || !i.acceptance.every((a) => GWT.test(a)))) e.push(`${label}: implementer items need acceptance criteria written as Given/When/Then`);
  if (i.owner === 'human' && !(i.acceptance || []).length) e.push(`${label}: human items need at least one acceptance line ("Done when ...") so a person knows when it is finished`);
  if (i.confidence === 'low' && i.window === 'weeks 1-4' && !(['measurement', 'technical-seo'].includes(i.type) && i.effort === 'S')) e.push(`${label}: low-confidence items cannot start in weeks 1-4 (only small measurement or technical-seo foundations can)`);
  checkClaim(i, label, byId, e);
  return e;
}

export function checkReview(r, s) {
  const e = shape(r, 'review', 'review');
  unsafeText(r, 'review', e);
  if (e.length) return e;
  const ids = new Set(s.items.map((i) => i.id));
  for (const f of r.findings) if (f.item && !ids.has(f.item)) e.push(`review: finding refers to unknown item ${f.item}`);
  const src = new Set(s.sources.map((x) => x.id));
  for (const id of r.checked_sources || []) if (!src.has(id)) e.push(`review: checked unknown source ${id}`);
  return e;
}

// Markdown: evidence tags must parse and cite existing sources; numbers next to metric words without a source warn.
export function checkMarkdown(name, text, byId, out) {
  text.split('\n').forEach((line, n) => {
    if (line.includes('{{')) return; // unfilled template placeholder
    const where = `${name}:${n + 1}`;
    for (const m of line.matchAll(/\[E:([^\]]*)\]/g)) {
      const parts = m[1].split(';').map((x) => x.trim());
      if (parts.length !== 4) { out.errors.push(`${where}: evidence tag needs 4 parts [E: class; confidence; source; date]`); continue; }
      const [cls, conf, src, date] = parts;
      if (!CLASSES.includes(cls)) out.errors.push(`${where}: unknown evidence class "${cls}"`);
      if (!['high', 'medium', 'low'].includes(conf)) out.errors.push(`${where}: confidence must be high, medium or low`);
      if (cls === 'hypothesis' && conf !== 'low') out.errors.push(`${where}: a hypothesis has confidence low`);
      if (MAX_MEDIUM.includes(cls) && conf === 'high') out.errors.push(`${where}: ${cls} is at most medium confidence`);
      if (/^S-\d{3,}$/.test(src)) { if (!byId.has(src)) out.errors.push(`${where}: unknown source ${src}`); }
      else if (src === 'n/a') { if (SOURCED.includes(cls)) out.errors.push(`${where}: ${cls} needs a source`); }
      else if (!/^(https?:\/\/\S+|(repo|search|user|ref|file|tool):.+)$/.test(src)) out.errors.push(`${where}: source must be S-NNN, a URL, repo:, search:, user:, ref:, or n/a`);
      if (date !== 'n/a' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) out.errors.push(`${where}: date must be YYYY-MM-DD or n/a`);
      else if (date === 'n/a' && SOURCED.includes(cls)) out.errors.push(`${where}: ${cls} needs a date`);
      else if (date !== 'n/a' && date > today()) out.errors.push(`${where}: date ${date} is in the future`);
    }
    if (line.length <= 2000 && !/S-\d{3,}/.test(line) && MD_NUMBER.some((re) => re.test(line))) out.warnings.push(`${where}: number next to a search/traffic metric word with no S-NNN source (heuristic; never invent volumes)`);
  });
}

export function validateAll(s, config) {
  const out = { errors: [], warnings: [] };
  const byId = new Map();
  s.sources.forEach((src, i) => {
    out.errors.push(...checkSource(src, `sources[${i}]`));
    if (!/^S-\d{3,}$/.test(src.id || '')) out.errors.push(`sources[${i}]: missing id`);
    else if (byId.has(src.id)) out.errors.push(`sources: duplicate id ${src.id}`);
    else byId.set(src.id, src);
  });
  for (const src of s.sources) {
    if (src.accessed && daysBetween(src.accessed, today()) > config.freshness.source_max_age_days) out.warnings.push(`source ${src.id} is stale (accessed ${src.accessed}); refresh before relying on it`);
    if (src.ref?.startsWith('file:') && !path.resolve(s.p.root, src.ref.slice(5)).startsWith(s.p.root + path.sep)) out.errors.push(`source ${src.id}: ${src.ref} is outside the project`);
    const file = src.ref?.startsWith('file:') ? path.resolve(s.p.root, src.ref.slice(5)) : src.ref?.startsWith('repo:') ? path.resolve(s.p.root, src.ref.slice(5).replace(/[#:].*$/, '')) : null;
    if (src.sha256 && file) {
      if (!file.startsWith(s.p.root + path.sep)) out.errors.push(`source ${src.id}: path escapes the project`);
      else if (!fs.existsSync(file) || !fs.statSync(file).isFile()) out.warnings.push(`source ${src.id}: ${src.ref} not found, cannot verify its sha256`);
      else if (sha256(fs.readFileSync(file)) !== src.sha256) (IMPORTED.includes(src.type) ? out.errors : out.warnings).push(`source ${src.id}: ${src.ref} changed since it was ${IMPORTED.includes(src.type) ? 'imported' : 'cited'}; re-check the claims that use it`);
    }
    if (IMPORTED.includes(src.type) && !src.ref?.startsWith('file:')) out.errors.push(`source ${src.id}: ${src.type} sources are created by gs import from a file in the project`);
  }
  const seen = new Map();
  s.keywords.forEach((k, i) => {
    out.errors.push(...checkKeyword(k, byId, `keywords[${i}]`));
    const key = normKw(k);
    if (seen.has(key)) out.errors.push(`keywords: duplicate keyword "${k.keyword}" (${k.geo})`); else seen.set(key, i);
  });
  const tracked = new Set(s.keywords.map((k) => kwText(k.keyword)));
  const byKw = new Map();
  const itemIds = new Set();
  s.items.forEach((it, i) => {
    out.errors.push(...checkItem(it, byId, `items[${i}]`));
    if (!/^GRO-\d{3,}$/.test(it.id || '')) out.errors.push(`items[${i}]: missing id`);
    else if (itemIds.has(it.id)) out.errors.push(`items: duplicate id ${it.id}`); else itemIds.add(it.id);
    if (['superseded', 'rejected'].includes(it.status)) return;
    for (const kw of it.keywords || []) {
      const n = kwText(kw);
      if (!tracked.has(n)) out.warnings.push(`${it.id}: keyword "${kw}" is not in keywords.json`);
      byKw.set(n, [...(byKw.get(n) || []), it.id]);
    }
  });
  for (const [kw, ids] of byKw) if (ids.length > 1) out.warnings.push(`possible keyword cannibalization: "${kw}" is targeted by ${ids.join(', ')}`);
  // Item status must agree with the append-only decision log: a status edited by hand (or shipped in a cloned repo) is not a decision.
  const EXPECT = { approved: 'approve', 'handed-off': 'approve', done: 'approve', rejected: 'reject', deferred: 'defer', 'needs-research': 'research', superseded: 'supersede' };
  for (const it of s.items) {
    const last = (s.growth?.decisions || []).filter((d) => d.target === it.id).at(-1);
    if (it.status === 'proposed' ? last : last?.decision !== EXPECT[it.status]) out.errors.push(`${it.id}: status ${it.status} does not match the decision log (${last ? last.decision : 'no decision'}); statuses change only through gs`);
    else if (['approved', 'handed-off', 'done'].includes(it.status) && last.content !== itemHash(it)) out.errors.push(`${it.id}: content changed after the user approved it; add a new item and supersede this one`);
  }
  for (const f of MD_FILES) {
    const file = s.p.md(f);
    if (fs.existsSync(file)) checkMarkdown(f, fs.readFileSync(file, 'utf8'), byId, out);
  }
  return out;
}

export const sourceIndex = (s) => new Map(s.sources.map((x) => [x.id, x]));
