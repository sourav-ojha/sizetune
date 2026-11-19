// Pure queue logic for the delivery-orchestrator skill. No I/O except reading spec files in discover().
import fs from 'node:fs';
import path from 'node:path';

export const FEATURE_ID = /^FEATURE-\d+$/;

// Allowed state transitions. Anything else throws: the state file cannot jump from "queued" to "merged".
export const TRANSITIONS = {
  queued: ['building', 'skipped', 'blocked'],
  building: ['built', 'blocked'],
  built: ['pr_open', 'blocked'],
  pr_open: ['ci_passed', 'ci_failed', 'awaiting_human', 'blocked'],
  ci_failed: ['fixing', 'blocked'],
  fixing: ['pr_open', 'blocked'],
  ci_passed: ['merged', 'pr_open', 'awaiting_human', 'blocked'],
  awaiting_human: ['merged', 'skipped', 'pr_open'],
  blocked: ['skipped'],
  merged: [],
  skipped: [],
};
export const ACTIVE = ['building', 'built', 'pr_open', 'ci_passed', 'ci_failed', 'fixing'];
export const FAILED = ['blocked'];

export function transition(item, to, reason) {
  if (!(TRANSITIONS[item.state] || []).includes(to)) throw new Error(`${item.id}: cannot go from "${item.state}" to "${to}"`);
  item.state = to;
  if (reason !== undefined) item.reason = String(reason);
  item.history = [...(item.history || []), { ts: new Date().toISOString(), state: to, ...(reason ? { reason: String(reason).slice(0, 200) } : {}) }];
  return item;
}

// Minimal frontmatter reader: top-level "key: value" lines only.
export function frontmatter(text) {
  const m = String(text).replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n/);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

export function parseDeps(v) {
  if (!v) return [];
  return String(v).replace(/^\[|\]$/g, '').split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'feature';
}

// Reads <dir>/FEATURE-NNN.md (strict names). Returns every spec with its status; callers filter.
export function discover(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`features directory not found: ${dir}`);
  const out = [];
  for (const f of fs.readdirSync(dir).sort()) {
    const m = f.match(/^(FEATURE-\d+)\.md$/);
    if (!m) continue;
    const full = path.join(dir, f);
    if (fs.lstatSync(full).isSymbolicLink()) continue; // never follow links out of the folder
    const text = fs.readFileSync(full, 'utf8');
    const fm = frontmatter(text);
    const title = (text.match(/^#\s+(.+)$/m) || [, m[1]])[1].trim().slice(0, 100);
    out.push({ id: m[1], file: full, title, status: (fm.status || '').toLowerCase(), delivery: (fm.delivery || 'none').toLowerCase(), opportunity: fm.opportunity || '', deps: parseDeps(fm.depends_on) });
  }
  return out;
}

// Ready specs, ordered so a feature comes after the ones it depends on (ties: id order).
// A dependency must be in the queue, or already implemented; anything else is an error the user should see before the run starts.
export function buildQueue(specs, { only, limit } = {}) {
  const byId = new Map(specs.map((s) => [s.id, s]));
  if (only?.length) for (const id of only) if (!byId.has(id)) throw new Error(`--only names ${id}, which is not in the features directory`);
  let pick = specs.filter((s) => s.status === 'ready' && s.delivery !== 'complete' && (!only?.length || only.includes(s.id)));
  const inQueue = new Set(pick.map((s) => s.id));
  for (const s of pick) {
    for (const d of s.deps) {
      if (!FEATURE_ID.test(d)) throw new Error(`${s.id}: depends_on has invalid id "${d}"`);
      const dep = byId.get(d);
      if (!inQueue.has(d) && !(dep && (dep.status === 'implemented' || dep.status === 'validated'))) throw new Error(`${s.id} depends on ${d}, which is neither in this queue nor implemented`);
    }
  }
  const ordered = [];
  const seen = new Set();
  const visiting = new Set();
  const visit = (s) => {
    if (seen.has(s.id)) return;
    if (visiting.has(s.id)) throw new Error(`dependency cycle through ${s.id}`);
    visiting.add(s.id);
    for (const d of s.deps) if (inQueue.has(d)) visit(byId.get(d));
    visiting.delete(s.id);
    seen.add(s.id);
    ordered.push(s);
  };
  for (const s of pick) visit(s);
  pick = ordered;
  if (limit && pick.length > limit) pick = pick.slice(0, limit);
  const keep = new Set(pick.map((s) => s.id));
  return pick.map((s) => ({ id: s.id, file: s.file, title: s.title, deps: s.deps.filter((d) => keep.has(d) || !inQueue.has(d)), state: 'queued', fix_rounds: 0, history: [] }));
}

// Next feature to work on. A feature whose dependency did not merge is skipped with the reason, never built on a missing base.
export function pickNext(q) {
  const active = q.features.find((f) => ACTIVE.includes(f.state));
  if (active) return { item: active, resume: true };
  for (const f of q.features) {
    if (f.state !== 'queued') continue;
    const bad = f.deps.map((d) => q.features.find((x) => x.id === d)).find((d) => d && d.state !== 'merged');
    if (bad) {
      if (['blocked', 'skipped', 'awaiting_human'].includes(bad.state)) { transition(f, 'skipped', `dependency ${bad.id} is ${bad.state}, not merged`); continue; }
      continue; // dependency still queued: it comes first in order
    }
    return { item: f, resume: false };
  }
  return { item: null };
}

export function runStop(q) {
  if (q.stop) return q.stop;
  let streak = 0;
  for (const f of [...q.features].reverse()) {
    if (f.state === 'blocked') streak++;
    else if (f.state === 'merged' || f.state === 'awaiting_human') break;
  }
  if (streak >= q.max_failures) return `circuit breaker: ${streak} features blocked in a row`;
  return null;
}

// Paths whose change must be looked at by a person: a feature agent must not be able to edit the checks that gate it.
export const CI_PATHS = [/^\.github\//i, /^\.circleci\//i, /^\.gitlab-ci\.ya?ml$/i, /^Jenkinsfile$/i, /^azure-pipelines\.ya?ml$/i, /^\.buildkite\//i, /(^|\/)CODEOWNERS$/i];
export const touchesCi = (files) => files.filter((f) => CI_PATHS.some((re) => re.test(f)));

export function summarize(q) {
  const by = {};
  for (const f of q.features) (by[f.state] ||= []).push(f);
  return by;
}
