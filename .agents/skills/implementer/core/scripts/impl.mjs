#!/usr/bin/env node
// Task-ledger helper for the implementer skill. Zero dependencies.
// usage: node impl.mjs <init|plan|batch|start|finish|reopen|pass|map|block|unblock|ruling|status|report|retro> [id] --name N [--dir D] ...
import fs from 'node:fs';
import path from 'node:path';
import { logEvent, runId } from './lib/runlog.mjs';
import { validatePlan, nextBatch, startTask, finishTask, blockTask, unblockTask, reopenTask, mapCriterion, passTask, deliveryReport, safeName, TIERS } from './lib/ledger.mjs';

const die = (m) => { console.error(`error: ${m}`); process.exit(1); };
const argv = process.argv.slice(2);
const opt = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i]; else pos.push(argv[i]);
}
const [cmd, id] = pos;
const HELP = 'commands: init --tier T0-T3 | plan --file F | batch [--max N] | start ID | finish ID | reopen ID | pass ID --cmd C --exit 0 | map ID --criterion C (--tests a,b | --no-test R) | block ID --reason R | unblock ID | ruling --what W --why Y --cost C | status | report | retro [--unclear T] [--skipped T] [--improvised T] [--suggest T] (all need --name N, optional --dir D)';
if (!cmd || cmd === 'help') { console.log(HELP); process.exit(0); }

let name;
try { name = safeName(opt.name); } catch (e) { die(e.message); }
const base = path.join(path.resolve(opt.dir || '.'), '.implementation', name);
const file = path.join(base, 'tasks.json');
const log = path.join(base, 'log.md');

// Run log (metadata only; see lib/runlog.mjs). Read-only `status` is not logged.
const t0 = Date.now();
const extra = {};
const dirRoot = path.resolve(opt.dir || '.');
process.on('exit', (code) => {
  if (cmd !== 'status') logEvent(dirRoot, 'implementer', runId('impl', name), { event: cmd, ok: code === 0, ms: Date.now() - t0, ...(id ? { task: id } : {}), ...extra });
});

function load() {
  if (!fs.existsSync(file)) die(`no ledger at ${file}; run init first`);
  let p;
  try { p = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { die(`ledger is invalid JSON (${e.message}); restore it from git or re-plan`); }
  if (!p || typeof p !== 'object' || !Array.isArray(p.tasks)) die('ledger is invalid: expected an object with a tasks array');
  return p;
}
function save(p) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(p, null, 2) + '\n');
  fs.renameSync(tmp, file);
}
const flat = (x) => String(x).replace(/\s+/g, ' ').trim(); // one ruling = one line, no forged log lines
const run = (fn) => { try { fn(); } catch (e) { die(e.message); } };

if (cmd === 'init') {
  if (!TIERS.includes(opt.tier)) die(`--tier must be one of ${TIERS.join(', ')}`);
  if (fs.existsSync(file)) die('ledger already exists');
  fs.mkdirSync(base, { recursive: true });
  save({ name, tier: opt.tier, spec: opt.spec || null, tasks: [] });
  extra.tier = opt.tier;
  if (opt.spec) extra.spec = (String(opt.spec).match(/FEATURE-\d+/) || ['file'])[0];
  console.log(`initialised ${path.relative(process.cwd(), file)}`);
} else if (cmd === 'plan') {
  const p = load();
  if (p.tasks.some((t) => t.status !== 'pending')) die('plan refused: some tasks already started; re-planning would erase progress');
  let incoming;
  try { incoming = JSON.parse(fs.readFileSync(opt.file, 'utf8')); } catch (e) { die(`cannot read plan file: ${e.message}`); }
  if (!incoming || !Array.isArray(incoming.tasks)) die('plan file must be an object with a tasks array');
  // State fields are owned by the helper: a plan file can never preset status, passes or evidence.
  const tasks = incoming.tasks.map((t) => ({ deps: [], ...t, status: 'pending', passes: false, evidence: null }));
  const next = { ...p, tasks };
  const errs = validatePlan(next);
  if (errs.length) die(`invalid plan:\n- ${errs.join('\n- ')}`);
  save(next);
  extra.tasks = tasks.length;
  extra.criteria = tasks.reduce((n, t) => n + (t.criteria?.length || 0), 0);
  console.log(`planned ${tasks.length} task(s)`);
} else if (cmd === 'batch') {
  const b = nextBatch(load(), Math.max(1, Number(opt.max) || 4));
  extra.size = b.length;
  console.log(JSON.stringify(b));
} else if (['start', 'finish', 'reopen', 'block', 'unblock', 'map', 'pass'].includes(cmd)) {
  if (!id) die(`${cmd} needs a task id`);
  const p = load();
  run(() => {
    if (cmd === 'start') startTask(p, id);
    else if (cmd === 'finish') finishTask(p, id);
    else if (cmd === 'reopen') reopenTask(p, id);
    else if (cmd === 'block') blockTask(p, id, opt.reason);
    else if (cmd === 'unblock') unblockTask(p, id);
    else if (cmd === 'map') mapCriterion(p, id, opt.criterion, { tests: opt.tests ? opt.tests.split(',').map((x) => x.trim()).filter(Boolean) : [], noTest: opt['no-test'] });
    else {
      if (opt.exit !== undefined && !/^\d+$/.test(opt.exit)) throw new Error('--exit must be a non-negative integer');
      passTask(p, id, { cmd: opt.cmd, exit: opt.exit === undefined ? undefined : Number(opt.exit) });
    }
  });
  save(p);
  console.log(`${id}: ${cmd} ok`);
} else if (cmd === 'ruling') {
  if (!opt.what || !opt.why || !opt.cost) die('ruling needs --what, --why and --cost');
  fs.mkdirSync(base, { recursive: true });
  fs.appendFileSync(log, `- ${new Date().toISOString().slice(0, 10)} Ruling: ${flat(opt.what)} — ${flat(opt.why)} — cost if wrong: ${flat(opt.cost)}\n`);
  console.log('ruling logged');
} else if (cmd === 'status') {
  const p = load();
  const passed = p.tasks.filter((t) => t.passes).length;
  console.log(`${p.name} [${p.tier}] ${passed}/${p.tasks.length} passed`);
  for (const t of p.tasks) console.log(`  ${t.id} ${t.status}${t.passes ? ' passed' : ''} - ${t.title}`);
  const nb = nextBatch(p);
  console.log(passed === p.tasks.length && p.tasks.length ? 'next: all passed; run the final review' : `next batch: ${nb.join(', ') || '(none ready)'}`);
} else if (cmd === 'report') {
  // Facts for the spec's Delivery log: passed tasks are delivered, everything else pending.
  const r = deliveryReport(load());
  extra.state = r.state; extra.delivered = r.delivered.length; extra.pending = r.pending.length;
  console.log(`state: ${r.state}`);
  console.log(`delivered: ${r.delivered.map((c) => c.id).join(', ') || '-'}`);
  console.log(`pending: ${r.pending.map((c) => c.id).join(', ') || '-'}`);
} else if (cmd === 'retro') {
  // Agent self-report of friction with this skill: short, no code or secrets. Exported redacted by skill-insights.
  const notes = Object.fromEntries(['unclear', 'skipped', 'improvised', 'suggest'].filter((k) => opt[k]).map((k) => [k, opt[k]]));
  if (!Object.keys(notes).length) die('retro needs at least one of --unclear, --skipped, --improvised, --suggest');
  Object.assign(extra, notes);
  console.log('retro logged');
} else die(HELP);
