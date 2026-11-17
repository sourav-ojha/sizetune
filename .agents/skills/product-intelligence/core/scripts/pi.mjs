#!/usr/bin/env node
// Product Intelligence helper CLI. Zero dependencies (Node 20+).
// It owns every state change that must not depend on model discipline:
// approval hashes, opportunity decisions, lifecycle transitions, feature-ID allocation,
// score arithmetic and the "application source untouched" check.
import fs from 'node:fs';
import path from 'node:path';
import tty from 'node:tty';
import { splitFrontmatter, setFrontmatter } from './lib/fm.mjs';
import { productHash, appendHistory, parseHistory } from './lib/product.mjs';
import { parseRegistry, parseLog, updateRow, appendLog, nextId, parseDetails, contentDigest, logIntegrityErrors } from './lib/registry.mjs';
import { computeScore, computeTier, parseRatings } from './lib/score.mjs';
import { loadConfig, readJson, CORE_DIR } from './lib/config.mjs';
import { saveSnapshot, diffSnapshot, clearSnapshot } from './lib/snapshot.mjs';
import { validateProject, todayStr } from '../validators/validate-artifacts.mjs';
import { logEvent, runId } from './lib/runlog.mjs';
import { daysBetween, findPlaceholders } from './lib/evidence.mjs';

const lifecycle = readJson(path.join(CORE_DIR, 'schemas', 'lifecycle.json'));

function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[k] = true;
      else { flags[k] = next; i++; }
    } else pos.push(a);
  }
  return { pos, flags };
}

function die(msg, code = 1) {
  console.error(`pi: ${msg}`);
  process.exit(code);
}

const { pos, flags } = parseArgs(process.argv.slice(2));
const [cmd, ...rest] = pos;
const dir = path.resolve(flags.dir || '.');
const pdir = path.join(dir, '.product');
const today = todayStr();
const extra = {}; // metadata for the run log (lib/runlog.mjs): ids and counts only, never content
const out = (o) => console.log(typeof o === 'string' ? o : JSON.stringify(o, null, 2));

function read(p) { return fs.readFileSync(p, 'utf8'); }
function need(p, what) { if (!fs.existsSync(p)) die(`${what} not found at ${path.relative(dir, p) || p}`); return read(p); }
// C0/C1 controls and bidi/format characters can move the cursor or reorder text in a terminal.
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/;
const escapeUnsafe = (s) => String(s).replace(new RegExp(UNSAFE_CHARS.source, 'g'), (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

function requireBy() {
  if (!flags.by || flags.by === true) die('--by "<name>" is required: record who made this decision (the human user).');
  const by = String(flags.by).trim();
  if (UNSAFE_CHARS.test(by) || !/^[^|"\\]{1,80}$/.test(by)) die('--by must be 1-80 characters without "|", quotes, backslashes or control characters.');
  return by;
}

function optNote(required) {
  if (flags.note === true) die('--note needs a value.');
  const note = flags.note ? String(flags.note).trim() : '';
  if (UNSAFE_CHARS.test(note)) die('--note must not contain control characters (including newlines and escape sequences).');
  if (required && !note) die('--note "<the user\'s words / reason>" is required: it records what the human actually said.');
  return note;
}

// Optional stricter mode (config gates.human_confirmation = "tty"): a human must type "yes" in an interactive
// terminal. A plain agent shell has no TTY, so it cannot satisfy this and the user runs the command themselves.
// This is a deterrent, not a boundary: an agent that can allocate a pseudo-terminal could answer the prompt.
function confirmHuman(summary) {
  const loaded = loadConfig(dir);
  if (loaded.errors.length) die(`cannot read the gate configuration, refusing to continue:\n  ${loaded.errors.join('\n  ')}`);
  const mode = loaded.config.gates?.human_confirmation || 'chat';
  if (mode !== 'tty') return;
  // tty.isatty, not process.stdin.isTTY: touching process.stdin makes fd 0 non-blocking and readSync then fails with EAGAIN.
  if (!tty.isatty(0) || !tty.isatty(1)) {
    const sh = (a) => (/^[A-Za-z0-9_@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`); // POSIX single-quoting
    die(`gates.human_confirmation is "tty": this needs a person at an interactive terminal. Ask the user to run this exact command themselves:\n  ${['node', ...process.argv.slice(1)].map(sh).join(' ')}`);
  }
  process.stdout.write(`${escapeUnsafe(summary)}\nType "yes" to confirm: `); // summary values are JSON-quoted by callers: no raw control characters
  const buf = Buffer.alloc(64);
  let n = 0;
  try { n = fs.readSync(0, buf, 0, 64, null); } catch (e) { die(`could not read the confirmation: ${e.code || e.message}`); }
  if (buf.toString('utf8', 0, n).trim().toLowerCase() !== 'yes') die('not confirmed.');
}

// Decisions and proposals are only meaningful against an approved, unmodified product baseline.
function requireApprovedProduct() {
  const t = need(path.join(pdir, 'PRODUCT.md'), 'PRODUCT.md');
  const { data } = splitFrontmatter(t);
  if (data.status !== 'approved') die('PRODUCT.md is not approved (draft or reopened). Get the baseline approved again before deciding or proposing opportunities.');
  if (data.content_hash !== productHash(t)) die('PRODUCT.md was modified after approval (hash mismatch). Reopen and re-approve it first.');
}

function cmdInit() {
  fs.mkdirSync(path.join(pdir, 'features'), { recursive: true });
  const tpl = path.join(CORE_DIR, '..', 'templates');
  const prod = path.join(pdir, 'PRODUCT.md');
  const opps = path.join(pdir, 'opportunities.md');
  const made = [];
  if (!fs.existsSync(prod)) { fs.copyFileSync(path.join(tpl, 'product-understanding.md'), prod); made.push('.product/PRODUCT.md'); }
  if (flags.registry && !fs.existsSync(opps)) { fs.copyFileSync(path.join(tpl, 'opportunity.md'), opps); made.push('.product/opportunities.md'); }
  const keep = path.join(pdir, 'features', '.gitkeep');
  if (!fs.existsSync(keep)) fs.writeFileSync(keep, '');
  out({ created: made, note: 'Templates contain {{placeholders}}; fill every one before approval. Created PRODUCT.md is status: draft.' });
}

function cmdStatus() {
  const info = { dir, initialized: fs.existsSync(pdir) };
  if (!info.initialized) return out({ ...info, next: 'init' });
  const { config } = loadConfig(dir);
  const pPath = path.join(pdir, 'PRODUCT.md');
  if (fs.existsSync(pPath)) {
    const t = read(pPath);
    const { data } = splitFrontmatter(t);
    info.product = {
      status: data.status,
      revision: Number(data.revision || 0),
      approved_at: data.approved_at || null,
      approved_by: data.approved_by || null,
      approved_by_delegation: data.status === 'approved' ? /^delegated \(auto run\)/.test(parseHistory(t).filter((h) => h.action === 'approved' || h.action === 're-approved').pop()?.note || '') : null,
      last_reviewed: data.last_reviewed || null,
      modified_since_approval: data.status === 'approved' ? data.content_hash !== productHash(t) : null,
      review_age_days: data.last_reviewed ? daysBetween(data.last_reviewed, today) : null,
    };
  }
  const oPath = path.join(pdir, 'opportunities.md');
  if (fs.existsSync(oPath)) {
    const reg = parseRegistry(read(oPath));
    const counts = {};
    for (const r of reg.rows) counts[r.status] = (counts[r.status] || 0) + 1;
    info.opportunities = {
      last_research: reg.fm.last_research || null,
      research_age_days: reg.fm.last_research && /^\d{4}/.test(reg.fm.last_research) ? daysBetween(reg.fm.last_research, today) : null,
      review_mode: reg.fm.review_mode,
      counts,
      awaiting_decision: reg.rows.filter((r) => r.status === 'Proposed').map((r) => r.id),
      approved_without_spec: reg.rows.filter((r) => r.status === 'Approved' && (!r.feature || r.feature === '-')).map((r) => r.id),
    };
  }
  const v = validateProject(dir, { today });
  info.validation = { errors: v.errors.length, warnings: v.warnings.length };
  const p = info.product;
  const o = info.opportunities;
  if (!p) info.next = 'init';
  else if (p.status !== 'approved') info.next = 'await product approval (present PRODUCT.md to the user)';
  else if (!o) info.next = 'research';
  else if (o.awaiting_decision.length) info.next = 'await user decision on proposed opportunities';
  else if (o.approved_without_spec.length) info.next = 'handoff';
  else if (o.research_age_days !== null && o.research_age_days > config.freshness.market_refresh_days) info.next = 'refresh';
  else info.next = 'opportunities | feature <idea> | refresh | research widen | full auto';
  out(info);
}

function cmdApproveProduct() {
  const by = requireBy();
  const p = path.join(pdir, 'PRODUCT.md');
  let t = need(p, 'PRODUCT.md');
  const { data } = splitFrontmatter(t);
  if (data.status === 'approved' && data.content_hash === productHash(t)) die('PRODUCT.md is already approved and unchanged.');
  const ph = findPlaceholders(splitFrontmatter(t).body);
  if (ph.length) die(`PRODUCT.md still contains placeholder-like text on body lines ${ph.slice(0, 5).join(', ')} (counted from the first line after the frontmatter). Flagged: {{...}}, <<...>>, TODO, TBD, FIXME, lorem ipsum, even inside prose: rephrase (e.g. "open to-do comments") or remove.`);
  const pre = validateProject(dir, { today }).errors.filter((e) => e.startsWith('PRODUCT.md'));
  if (pre.length) die(`PRODUCT.md is not valid, refusing to approve:\n  ${pre.join('\n  ')}`);
  let note = optNote(false);
  if (flags.delegated) {
    // Autonomous ("full auto") runs only: the user's own command delegated Gate 1. Recorded as such, never as a personal approval.
    if (loadConfig(dir).config.gates?.allow_delegated_approval === false) die('gates.allow_delegated_approval is false: the user must approve PRODUCT.md themselves.');
    if (!note) die('--delegated needs --note "<the confidence review: why this was safe to approve without the user>"');
    note = `delegated (auto run): ${note}`.slice(0, 400);
  }
  confirmHuman(`Approve PRODUCT.md as revision ${Number(data.revision || 0) + 1}, recorded for ${JSON.stringify(by)}?`);
  const revision = Number(data.revision || 0) + 1;
  t = appendHistory(t, { revision, date: today, by, action: data.approved_at ? 're-approved' : 'approved', note });
  t = setFrontmatter(t, { status: 'approved', revision, approved_by: by, approved_at: today, last_reviewed: today, content_hash: productHash(t) });
  fs.writeFileSync(p, t);
  const v = validateProject(dir, { today });
  out({ approved: true, delegated: !!flags.delegated, revision, validation_errors: v.errors });
  if (v.errors.length) process.exitCode = 1;
}

function cmdReopenProduct() {
  const by = requireBy();
  const p = path.join(pdir, 'PRODUCT.md');
  let t = need(p, 'PRODUCT.md');
  const { data } = splitFrontmatter(t);
  if (data.status !== 'approved') die('PRODUCT.md is not approved; it is already editable.');
  const note = optNote(false) || 'edit requested';
  confirmHuman(`Reopen the approved PRODUCT.md for editing, recorded for ${JSON.stringify(by)}?`);
  t = appendHistory(t, { revision: data.revision, date: today, by, action: 'reopened', note });
  t = setFrontmatter(t, { status: 'draft' });
  fs.writeFileSync(p, t);
  out({ reopened: true, note: 'Edit PRODUCT.md, show the diff to the user, then run approve-product after they confirm.' });
}

function cmdConfirmProduct() {
  const by = requireBy();
  const p = path.join(pdir, 'PRODUCT.md');
  let t = need(p, 'PRODUCT.md');
  const { data } = splitFrontmatter(t);
  if (data.status !== 'approved') die('PRODUCT.md is not approved; use approve-product.');
  if (data.content_hash !== productHash(t)) die('PRODUCT.md was modified after approval; reopen and re-approve instead of confirming.');
  const note = optNote(false) || 'confirmed unchanged';
  confirmHuman(`Confirm PRODUCT.md revision ${data.revision} is still accurate, recorded for ${JSON.stringify(by)}?`);
  t = appendHistory(t, { revision: data.revision, date: today, by, action: 'reviewed', note });
  t = setFrontmatter(t, { last_reviewed: today });
  fs.writeFileSync(p, t);
  out({ confirmed: true, revision: Number(data.revision), last_reviewed: today });
}

function loadOpps() {
  const p = path.join(pdir, 'opportunities.md');
  const t = need(p, 'opportunities.md');
  return { p, t, reg: parseRegistry(t) };
}

function cmdDecide() {
  const [id, decision] = rest;
  if (!id || !decision) die('usage: decide OPP-001 approve|reject|defer|research|modify --by "<user>" [--note "..."]');
  const target = lifecycle.decisions[decision];
  if (!target) die(`unknown decision "${decision}" (use ${Object.keys(lifecycle.decisions).join('|')})`);
  const by = requireBy();
  const { p, t, reg } = loadOpps();
  const row = reg.rows.find((r) => r.id === id);
  if (!row) die(`unknown opportunity ${id}`);
  const allowed = lifecycle.user[row.status] || [];
  if (!allowed.includes(target)) die(`${id} is "${row.status}"; a user decision cannot move it to "${target}". Allowed: ${allowed.join(', ') || 'none'}.`);
  const note = optNote(true);
  requireApprovedProduct();
  const broken = logIntegrityErrors(t);
  if (broken.length) die(`the Decision Log fails its integrity check; refusing to append to it (a later decision would make the damage look legitimate). Show the user, restore it from git, then retry:\n  ${broken.join('\n  ')}`);
  confirmHuman(`Record decision ${JSON.stringify(decision)} for ${JSON.stringify(id)} (title ${JSON.stringify(row.title)}), by ${JSON.stringify(by)}. Note: ${JSON.stringify(note)}`);
  let next = updateRow(t, id, { status: target, updated: today });
  next = appendLog(next, { date: today, id, decision, by, note, content: contentDigest(t, id) });
  const log = parseLog(next);
  next = setFrontmatter(next, { decision_count: log.length, decision_head: log[log.length - 1].seal });
  fs.writeFileSync(p, next);
  // Reversing an approval retires the linked spec; re-approving revives it as a draft to re-check.
  if (row.feature && row.feature !== '-') {
    const sp = path.join(pdir, 'features', `${row.feature}.md`);
    if (fs.existsSync(sp)) {
      const st = splitFrontmatter(read(sp)).data.status;
      const live = lifecycle.feature_allowed_statuses;
      if (!live.includes(target) && st !== 'superseded') fs.writeFileSync(sp, setFrontmatter(read(sp), { status: 'superseded' }));
      else if (live.includes(target) && st === 'superseded') fs.writeFileSync(sp, setFrontmatter(read(sp), { status: 'draft' }));
    }
  }
  out({ id, from: row.status, to: target, by });
}

function cmdTransition() {
  const [id, to] = rest;
  if (!id || !to) die('usage: transition OPP-001 "<Status>"');
  const { p, t, reg } = loadOpps();
  const row = reg.rows.find((r) => r.id === id);
  if (!row) die(`unknown opportunity ${id}`);
  if (!lifecycle.statuses.includes(to)) die(`unknown status "${to}"`);
  if (!(lifecycle.agent[row.status] || []).includes(to)) {
    const viaUser = (lifecycle.user[row.status] || []).includes(to);
    die(`${row.status} -> ${to} is not an agent transition.${viaUser ? ' It needs an explicit user decision: use "decide".' : ''}`);
  }
  if (to === 'Proposed') requireApprovedProduct();
  if (to === 'Proposed' && reg.fm.review_mode === 'pending') die('review_mode is "pending": run the independent review (or record self-review with a reason) before proposing.');
  if (to === 'Ready for Implementation') {
    requireApprovedProduct();
    if (!row.feature || row.feature === '-') die(`${id} has no feature spec; run new-feature first.`);
    const v = validateProject(dir, { today });
    const mine = v.errors.filter((e) => e.includes(row.feature) || e.includes(id));
    if (mine.length) die(`cannot mark ready; spec/registry has errors:\n  ${mine.join('\n  ')}`);
    const spec = splitFrontmatter(read(path.join(pdir, 'features', `${row.feature}.md`))).data;
    if (spec.status !== 'ready') die(`${row.feature} has status "${spec.status}". Set it to "ready" only when the spec is complete, validates cleanly and has no [BLOCKING] decisions.`);
  }
  if (to === 'Proposed') {
    const d = parseDetails(t)[id];
    if (!d) die(`${id} needs a detail block before it can be proposed`);
  }
  const next = updateRow(t, id, { status: to, updated: today });
  fs.writeFileSync(p, next);
  out({ id, from: row.status, to });
}

function cmdNewFeature() {
  const [id] = rest;
  if (!id) die('usage: new-feature OPP-001');
  const { p, t, reg } = loadOpps();
  const row = reg.rows.find((r) => r.id === id);
  if (!row) die(`unknown opportunity ${id}`);
  if (!lifecycle.feature_allowed_statuses.includes(row.status)) die(`${id} is "${row.status}". Feature specifications are created only for opportunities the user has approved.`);
  if (row.feature && row.feature !== '-') die(`${id} already has ${row.feature}`);
  requireApprovedProduct();
  const pd = splitFrontmatter(need(path.join(pdir, 'PRODUCT.md'), 'PRODUCT.md')).data;
  fs.mkdirSync(path.join(pdir, 'features'), { recursive: true });
  const existing = fs.readdirSync(path.join(pdir, 'features')).map((f) => f.replace(/\.md$/, ''));
  const fid = nextId('FEATURE', [...existing, ...reg.rows.map((r) => r.feature)]);
  let tpl = read(path.join(CORE_DIR, '..', 'templates', 'feature-specification.md'));
  tpl = setFrontmatter(tpl, { id: fid, opportunity: id, status: 'draft', product_revision: pd.revision, created: today });
  tpl = tpl.replace(/\{\{feature_title\}\}/g, () => row.title.replace(/[\r\n]+/g, ' '));
  fs.writeFileSync(path.join(pdir, 'features', `${fid}.md`), tpl);
  fs.writeFileSync(p, updateRow(t, id, { feature: fid, updated: today }));
  out({ feature: fid, path: `.product/features/${fid}.md`, note: 'Fill every section; remove all {{placeholders}}. Do not invent requirements the user has not approved — list them under Unresolved decisions.' });
}

function cmdScore() {
  const { config, errors } = loadConfig(dir);
  if (errors.length) die(errors.join('\n'));
  const ratings = flags.ratings ? parseRatings(String(flags.ratings)) : null;
  if (!ratings) die('usage: score --ratings "user_value=5,strategic_alignment=4,..." --confidence Low|Medium|High');
  const r = computeScore(ratings, config);
  if (r.errors.length) die(r.errors.join('; '));
  const confidence = flags.confidence || 'Medium';
  out({ score: r.score, confidence, tier: computeTier(r.score, confidence, config), criteria: Object.keys(config.scoring.criteria) });
}

function cmdNextId() {
  const kind = rest[0] || 'opportunity';
  if (kind === 'opportunity') {
    const { reg } = loadOpps();
    return out(nextId('OPP', reg.rows.map((r) => r.id)));
  }
  die('usage: next-id opportunity');
}

function cmdConfig() {
  const { config, errors } = loadConfig(dir);
  out({ errors, config });
}

const commands = {
  init: cmdInit,
  status: cmdStatus,
  'approve-product': cmdApproveProduct,
  'reopen-product': cmdReopenProduct,
  'confirm-product': cmdConfirmProduct,
  decide: cmdDecide,
  transition: cmdTransition,
  'new-feature': cmdNewFeature,
  score: cmdScore,
  'next-id': cmdNextId,
  config: cmdConfig,
  snapshot() { out({ ...saveSnapshot(dir, flags.tag || 'default'), note: 'baseline of application files stored outside the project (OS temp dir); compare with verify-clean' }); },
  'verify-clean'() {
    const d = diffSnapshot(dir, flags.tag || 'default');
    out(d);
    if (!d.clean) { console.error('pi: application files changed during research. Report this to the user; do not continue silently.'); process.exitCode = 2; }
    else if (flags.discard) clearSnapshot(dir, flags.tag || 'default');
  },
  retro() {
    // Agent self-report of friction with this skill: short, no code or secrets. Exported redacted by skill-insights.
    const notes = Object.fromEntries(['unclear', 'skipped', 'improvised', 'suggest'].filter((k) => typeof flags[k] === 'string').map((k) => [k, flags[k]]));
    if (!Object.keys(notes).length) die('retro needs at least one of --unclear, --skipped, --improvised, --suggest');
    Object.assign(extra, notes);
    out('retro logged');
  },
  validate() {
    const v = validateProject(dir, { today });
    extra.errors = v.errors.length; extra.warnings = v.warnings.length;
    if (flags.json) out(v);
    else {
      for (const e of v.errors) console.log(`ERROR   ${e}`);
      for (const w of v.warnings) console.log(`warning ${w}`);
      console.log(`${v.errors.length} error(s), ${v.warnings.length} warning(s)`);
    }
    if (v.errors.length) process.exitCode = 1;
  },
};

if (!cmd || cmd === 'help' || !commands[cmd]) {
  console.log(`Product Intelligence helper
usage: node pi.mjs <command> [--dir <project>] [flags]

  status                          state, approvals, freshness, suggested next step
  init [--registry]               create .product/ from templates (draft)
  approve-product --by NAME       record user approval + content hash (only after the user confirmed in chat)
  approve-product --by NAME --delegated --note "<confidence review>"
                                  "full auto" runs only: records Gate 1 as delegated by the user's command (never used for opportunity decisions)
  reopen-product  --by NAME       make approved PRODUCT.md editable again (logged)
  confirm-product --by NAME       record that an approved, unchanged PRODUCT.md was re-checked (resets the review age)
  decide OPP-ID approve|reject|defer|research|modify --by NAME [--note ...]
                                  record the USER's decision on a proposed opportunity
  transition OPP-ID "<Status>"    agent-allowed lifecycle moves only
  new-feature OPP-ID              allocate FEATURE-NNN for an approved opportunity
  score --ratings k=v,... --confidence Low|Medium|High
  next-id opportunity
  snapshot | verify-clean [--discard] [--tag T]
                                  prove application files were not modified (snapshot at the start of every run that reads the repo; --discard clears it after a clean check)
  validate [--json]               check all .product artifacts
  config                          show effective configuration
  retro [--unclear T] [--skipped T] [--improvised T] [--suggest T]
                                  record a short self-report of friction with this skill (run once at the end of a run)`);
  process.exit(cmd && cmd !== 'help' ? 1 : 0);
}
if (flags.delegated && cmd !== 'approve-product') die('--delegated applies only to approve-product in an autonomous run; opportunity decisions and every other gate always come from the user\'s own message.');
const t0 = Date.now();
if (/^OPP-\d+$/.test(rest[0] || '')) { extra.opp = rest[0]; if (rest[1]) extra[cmd === 'decide' ? 'decision' : 'to'] = rest[1]; }
process.on('exit', (code) => logEvent(dir, 'product-intelligence', runId('pi', today), { event: cmd, ok: code === 0, ms: Date.now() - t0, ...extra }));
try { commands[cmd](); } catch (e) { die(e.message); }
