// .growth/ state for growth-strategy: paths, symlink-safe IO, hashes, ids. Zero dependencies.
// State fields (status, decisions, review records, performance) are owned by the helper; input files can never preset them.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CORE_DIR, readJson } from './config.mjs';

export const ARTS = readJson(path.join(CORE_DIR, 'schemas', 'artifacts.json'));
export const RECORDS = readJson(path.join(CORE_DIR, 'schemas', 'records.schema.json'));
export const MD_FILES = Object.keys(ARTS.markdown);
export const PHASES = ['audit', 'research', 'plan'];
export const PLAN_MD = ['content-strategy.md', 'measurement-plan.md', 'monetization.md'];

export const today = () => {
  const t = process.env.GS_TODAY;
  if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return new Date().toISOString().slice(0, 10);
};
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export const paths = (dir) => {
  const base = path.join(path.resolve(dir), '.growth');
  const p = (f) => path.join(base, f);
  return { root: path.resolve(dir), base, growth: p('growth.json'), sources: p('sources.json'), keywords: p('keywords.json'), items: p('items.json'), config: p('config.json'),
    decisions: p('decisions.md'), roadmap: p('roadmap.md'), csv: p('keywords.csv'), reviews: p('reviews'), handoff: p('handoff'), gitignore: p('.gitignore'), md: p };
};

const isLink = (p) => { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } };
// A cloned repository could ship .growth (or files in it) as links to somewhere else: never write through one.
export function ensureDir(d) {
  if (isLink(d)) throw new Error(`refusing to use ${path.basename(d)}: it is a symbolic link`);
  fs.mkdirSync(d, { recursive: true });
  const st = fs.lstatSync(d);
  if (!st.isDirectory() || st.isSymbolicLink()) throw new Error(`refusing to use ${path.basename(d)}: not a plain directory`);
}
export function assertNoLink(file) { if (isLink(file)) throw new Error(`refusing to write ${path.basename(file)}: it is a symbolic link`); }
export function writeFile(file, text, mode = 'replace') { // 'replace' (temp + rename) | 'append' | 'create' (exclusive)
  const F = fs.constants;
  assertNoLink(file);
  if (mode === 'replace') {
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, text, { flag: F.O_WRONLY | F.O_CREAT | F.O_EXCL | (F.O_NOFOLLOW || 0), mode: 0o644 });
    fs.renameSync(tmp, file);
    return;
  }
  const fd = fs.openSync(file, F.O_WRONLY | F.O_CREAT | (mode === 'create' ? F.O_EXCL : F.O_APPEND) | (F.O_NOFOLLOW || 0), 0o644);
  try { fs.writeSync(fd, text); } finally { fs.closeSync(fd); }
}
const writeJson = (file, v) => writeFile(file, JSON.stringify(v, null, 2) + '\n');

export function exists(dir) { return fs.existsSync(paths(dir).growth); }
function readState(file, what) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`${what} is not valid JSON (${e.message}); restore it from git`); }
}
// Load everything once per command; save writes only what changed.
export function load(dir) {
  const p = paths(dir);
  if (!exists(dir)) throw new Error('no .growth/ here; run init first');
  const s = { dir, p, growth: readState(p.growth, 'growth.json'), sources: readState(p.sources, 'sources.json'), keywords: readState(p.keywords, 'keywords.json'), items: readState(p.items, 'items.json') };
  for (const k of ['sources', 'keywords', 'items']) if (!Array.isArray(s[k])) throw new Error(`${k}.json must be an array`);
  for (const k of ['decisions', 'reviews', 'refreshes', 'performance']) if (!Array.isArray(s.growth[k])) throw new Error(`growth.json: ${k} must be an array`);
  return s;
}
export function save(s, which = ['growth', 'sources', 'keywords', 'items']) {
  ensureDir(s.p.base);
  for (const k of which) assertNoLink(s.p[k]);
  for (const k of which) writeJson(s.p[k], s[k]);
}

export function emptyGrowth() {
  return { version: 1, created: today(), baseline: { status: 'draft' }, phases: { audit: {}, research: {}, plan: {} }, reviews: [], decisions: [], refreshes: [], performance: [] };
}

// Stable JSON for hashing: sorted keys.
const stable = (v) => (Array.isArray(v) ? `[${v.map(stable).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}` : JSON.stringify(v));
export const BASELINE_KEYS = Object.keys(RECORDS.$defs.baseline.properties);
export const baselineHash = (b) => sha256(stable(Object.fromEntries(BASELINE_KEYS.filter((k) => k in b).map((k) => [k, b[k]]))));
export const ITEM_STATE = ['status', 'superseded_by'];
const content = (o, drop) => Object.fromEntries(Object.entries(o).filter(([k]) => !drop.includes(k)));
// The plan a review covers: item content, keyword content and the plan markdown. Status and imported performance are excluded,
// so decisions and data imports do not invalidate a review, but any content edit (including a refresh) or a re-approved baseline does.
export function planHash(s) {
  const md = PLAN_MD.map((f) => { try { return fs.readFileSync(s.p.md(f), 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } });
  return sha256(stable({ baseline: s.growth.baseline.content_hash || null, items: s.items.map((i) => content(i, ITEM_STATE)), keywords: s.keywords.map((k) => content(k, ['performance'])), md }));
}

// Hash of an item's content (what the user approved); stored with each decision so later edits are detected.
export const itemHash = (i) => sha256(stable(content(i, ITEM_STATE)));
export const kwText = (k) => String(k).toLowerCase().replace(/\s+/g, ' ').trim();

export const nextId = (list, prefix) => {
  const n = list.map((x) => Number(String(x.id || '').replace(`${prefix}-`, ''))).filter(Number.isFinite);
  return `${prefix}-${String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0')}`;
};
export const normKw = (k) => kwText(k.keyword) + '|' + String(k.geo || '').toLowerCase();

const csvCell = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula injection
  return /[",\n\r']/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const KEYWORD_CSV = ['keyword', 'cluster', 'intent', 'geo', 'language', 'volume', 'volume_kind', 'volume_source', 'difficulty', 'difficulty_kind', 'difficulty_source', 'priority', 'evidence', 'confidence', 'target_page', 'serp_notes', 'competitors', 'sources', 'researched', 'clicks', 'impressions', 'ctr', 'position', 'performance_period'];
export function keywordsCsv(keywords) {
  const val = (m) => (m.value !== null ? m.value : m.min !== undefined ? `${m.min}-${m.max}` : null);
  const rows = keywords.map((k) => [k.keyword, k.cluster, k.intent, k.geo, k.language, val(k.volume), k.volume.kind, k.volume.source, val(k.difficulty), k.difficulty.kind, k.difficulty.source,
    k.priority, k.evidence, k.confidence, k.target_page, k.serp_notes, (k.competitors || []).join('; '), k.sources.join('; '), k.researched,
    k.performance?.clicks, k.performance?.impressions, k.performance?.ctr, k.performance?.position, k.performance?.period]);
  return [KEYWORD_CSV, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

// Minimal RFC 4180 parser (quotes, escaped quotes, commas, CRLF).
export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
