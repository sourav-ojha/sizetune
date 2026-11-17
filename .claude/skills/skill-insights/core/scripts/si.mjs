#!/usr/bin/env node
// skill-insights: read-only analysis of Claude Code session transcripts. Zero dependencies. Never prints paths or message text.
// usage: node si.mjs <inventory|runs|report|export> [--projects-dir D] [--skills-dir D ...] [--since YYYY-MM-DD] [--skill NAME] [--json]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseSession } from './lib/transcripts.mjs';
import { windows, inventory } from './lib/analyze.mjs';
import { parseRunLog, summarizeRuns } from './lib/runs.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = { skillsDir: [] };
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--json') opt.json = true;
  else if (a === '--no-notes') opt.noNotes = true;
  else if (a === '--skills-dir') opt.skillsDir.push(argv[++i]);
  else if (a.startsWith('--')) opt[a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
}
const die = (m) => { console.error(`si: ${m}`); process.exit(1); };
if (!['inventory', 'runs', 'report', 'export'].includes(cmd)) die('usage: si.mjs <inventory|runs|report|export> [--projects-dir D] [--skills-dir D ...] [--since YYYY-MM-DD] [--skill NAME] [--dir PROJECT] [--out FILE] [--no-notes] [--json]');
const home = os.homedir();
const projectsDir = path.resolve(opt.projectsDir || path.join(home, '.claude', 'projects'));
const skillDirs = (opt.skillsDir.length ? opt.skillsDir : [path.join(home, '.claude', 'skills')]).map((d) => path.resolve(d));
if (cmd !== 'export' && !fs.existsSync(projectsDir)) die('projects dir not found (use --projects-dir)');
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 6);

function loadSessions(onlyDir) {
  const out = [];
  for (const p of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (!p.isDirectory() || (onlyDir && p.name !== onlyDir)) continue;
    const dir = path.join(projectsDir, p.name);
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.jsonl')) continue;
      let text;
      try { text = fs.readFileSync(path.join(dir, f), 'utf8'); } catch { continue; }
      const s = parseSession(text);
      if (!s.entries.length) continue;
      const date = new Date(s.entries[0].ts).toISOString().slice(0, 10);
      if (opt.since && date < opt.since) continue;
      out.push({ project: hash(p.name), sessionId: hash(f), date, ...s });
    }
  }
  return out;
}
function installed() {
  const names = new Set();
  for (const d of skillDirs) {
    if (!fs.existsSync(d)) continue;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory() && fs.existsSync(path.join(d, e.name, 'SKILL.md'))) names.add(e.name);
  }
  return [...names].sort();
}
const match = (skill) => !opt.skill || skill === opt.skill || skill.split(':').pop() === opt.skill;
const k = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const min = (ms) => (ms / 60000).toFixed(1);

function runRows(sessions) {
  const rows = [];
  for (const s of sessions) {
    for (const w of windows(s)) {
      if (w.skill === '(none)' && opt.skill !== '(none)') continue;
      if (!match(w.skill)) continue;
      rows.push({ skill: w.skill, project: s.project, session: s.sessionId, date: s.date, tokens: w.tokens, wallMin: Number(min(w.wallMs)), toolCalls: w.toolCalls, toolErrors: w.toolErrors, filesRead: new Set(w.reads).size, repeatedReads: w.repeatedReads, largestResultBytes: w.largestResults[0] || 0 });
    }
  }
  return rows;
}

// Print, or write to --out (never through a symlink, owner-only).
function emit(text) {
  if (!opt.out) { console.log(text); return; }
  const f = path.resolve(opt.out);
  try { if (fs.lstatSync(f).isSymbolicLink()) die('--out is a symlink; refusing to write through it'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  fs.writeFileSync(f, text + '\n', { mode: 0o600 });
  console.log(`wrote ${path.basename(f)}`);
}

function exportBundle() {
  const dir = path.resolve(opt.dir || '.');
  const rl = path.join(dir, '.skill-runs');
  const files = fs.existsSync(rl) ? fs.readdirSync(rl).filter((f) => f.endsWith('.jsonl')) : [];
  if (!files.length) { console.log('no run logs found in this project (.skill-runs is empty). Run a skill first, then export.'); return; }
  const events = files.flatMap((f) => parseRunLog(fs.readFileSync(path.join(rl, f), 'utf8')).events);
  const runs = summarizeRuns(events, { notes: !opt.noNotes });
  // Transcript cost for this project only: transcript folders are the project path with non-alphanumerics replaced by "-".
  const mine = dir.replace(/[^A-Za-z0-9]/g, '-');
  const cost = fs.existsSync(path.join(projectsDir, mine))
    ? loadSessions(mine).flatMap((s) => windows(s).filter((w) => w.skill !== '(none)').map((w) => ({ skill: w.skill, date: s.date, tokens: w.tokens, wallMin: Number(min(w.wallMs)), toolErrors: w.toolErrors, repeatedReads: w.repeatedReads })))
    : [];
  if (opt.json) { emit(JSON.stringify({ runs, cost }, null, 2)); return; }
  const L = ['# Skill run bundle (redacted)', '', 'Metadata-only run logs plus agent self-report. No prompts, code, paths or emails. Review it, then bring it to the skill author (use --no-notes to leave out the agent self-report).', '', '## Runs', ''];
  for (const r of runs) {
    L.push(`### ${r.skill} (${r.run})`, `- window: ${r.start} .. ${r.end}; commands: ${r.commands}; failed commands: ${r.failedCommands.join(', ') || 'none'}`);
    if (r.skill === 'implementer') L.push(`- tier: ${r.tier || '?'}; input spec: ${r.spec || 'idea'}; tasks passed: ${r.passed}; fix rounds: ${r.fixRounds}; blocked: ${r.blocked}; rulings: ${r.rulings}; delivery: ${r.delivery || 'not reported'}`);
    else L.push(`- opportunities touched: ${r.ids.join(', ') || 'none'}; validate runs: ${r.validate.map((v) => `${v.errors}E/${v.warnings}W`).join(', ') || 'none'}`);
    for (const n of r.notes) for (const [k, v] of Object.entries(n)) L.push(`- ${k}: ${v}`);
    L.push('');
  }
  if (cost.length) {
    L.push('## Transcript cost for these skills', '', '| Skill | Date | In | Out | Cache-read | Min | Tool errors | Repeated reads |', '|---|---|---|---|---|---|---|---|');
    for (const c of cost) L.push(`| ${c.skill} | ${c.date} | ${k(c.tokens.in)} | ${k(c.tokens.out)} | ${k(c.tokens.cacheRead)} | ${c.wallMin} | ${c.toolErrors} | ${c.repeatedReads} |`);
  }
  emit(L.join('\n'));
}

if (cmd === 'export') { exportBundle(); process.exit(0); }
const sessions = loadSessions();
if (!sessions.length) { console.log('no sessions found (0 sessions in range)'); process.exit(0); }

if (cmd === 'inventory') {
  const inv = inventory(sessions, installed());
  if (opt.json) console.log(JSON.stringify(inv, null, 2));
  else {
    console.log(`${sessions.length} session(s)\nskill | invocations | sessions | projects | last used`);
    for (const u of inv.used) console.log(`${u.skill} | ${u.invocations} | ${u.sessions} | ${u.projects} | ${u.lastUsed}`);
    console.log(`\ninstalled but never used in range: ${inv.unused.join(', ') || '(none)'}`);
  }
} else if (cmd === 'runs') {
  const rows = runRows(sessions);
  if (opt.json) console.log(JSON.stringify(rows, null, 2));
  else for (const r of rows) console.log(`${r.date} ${r.project}/${r.session} ${r.skill}: in ${k(r.tokens.in)} out ${k(r.tokens.out)} cache-read ${k(r.tokens.cacheRead)} | ${r.wallMin} min | tools ${r.toolCalls} errors ${r.toolErrors} | files read ${r.filesRead} repeated ${r.repeatedReads} | largest result ${k(r.largestResultBytes)}B`);
} else {
  const inv = inventory(sessions, installed());
  const rows = runRows(sessions);
  const by = new Map();
  for (const r of rows) { const a = by.get(r.skill) || []; a.push(r); by.set(r.skill, a); }
  const lines = [`# Skill insights (${sessions.length} sessions)`, '', '> Attribution is approximate: a skill owns activity from its invocation until the next skill invocation. Idle gaps over 10 min are excluded.', '', '## Usage', '', '| Skill | Invocations | Sessions | Projects | Last used |', '|---|---|---|---|---|'];
  for (const u of inv.used) lines.push(`| ${u.skill} | ${u.invocations} | ${u.sessions} | ${u.projects} | ${u.lastUsed} |`);
  lines.push('', `Installed but never used in range: ${inv.unused.join(', ') || '(none)'}`, '', '## Cost and friction per skill', '', '| Skill | Runs | Avg in | Avg out | Avg cache-read | Total min | Tool errors | Repeated reads | Largest result |', '|---|---|---|---|---|---|---|---|---|');
  const flags = [];
  for (const [skill, rs] of by) {
    const n = rs.length; const avg = (f) => Math.round(rs.reduce((t, r) => t + f(r), 0) / n);
    const errs = rs.reduce((t, r) => t + r.toolErrors, 0); const rep = rs.reduce((t, r) => t + r.repeatedReads, 0);
    const big = Math.max(...rs.map((r) => r.largestResultBytes));
    lines.push(`| ${skill} | ${n} | ${k(avg((r) => r.tokens.in))} | ${k(avg((r) => r.tokens.out))} | ${k(avg((r) => r.tokens.cacheRead))} | ${rs.reduce((t, r) => t + r.wallMin, 0).toFixed(1)} | ${errs} | ${rep} | ${k(big)}B |`);
    if (errs / n >= 2) flags.push(`${skill}: ${(errs / n).toFixed(1)} tool errors per run`);
    if (rep > 0) flags.push(`${skill}: ${rep} repeated read(s) of the same skill file`);
    if (big > 100_000) flags.push(`${skill}: a single tool result of ${k(big)}B (large outputs inflate every later turn)`);
  }
  lines.push('', '## Flags', '', ...(flags.length ? flags.map((f) => `- ${f}`) : ['- none']));
  console.log(lines.join('\n'));
}
