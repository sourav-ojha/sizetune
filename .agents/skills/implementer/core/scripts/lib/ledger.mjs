// Pure task-ledger logic for the implementer skill. No I/O. Mutators throw Error on violation.
export const TIERS = ['T0', 'T1', 'T2', 'T3'];

const norm = (p) => String(p).replace(/^\.\//, '').replace(/\/+/g, '/').replace(/\/$/, '');

// Two ownership lists conflict when any entry is equal or one is a directory prefix of the other.
export function ownsOverlap(a, b) {
  return a.some((x) => b.some((y) => {
    const p = norm(x), q = norm(y);
    return p === q || q.startsWith(`${p}/`) || p.startsWith(`${q}/`);
  }));
}

export function safeName(name) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(String(name || '')) || String(name).includes('..')) throw new Error(`unsafe or missing --name: ${JSON.stringify(name)}`);
  return name;
}

export function validatePlan(plan) {
  const errs = [];
  if (!TIERS.includes(plan.tier)) errs.push(`tier must be one of ${TIERS.join(', ')}`);
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  if (!tasks.length) errs.push('plan has no tasks');
  const ids = new Set();
  for (const t of tasks) {
    if (!t.id || ids.has(t.id)) errs.push(`missing or duplicate task id: ${t.id}`);
    ids.add(t.id);
  }
  for (const t of tasks) {
    for (const d of t.deps || []) if (!ids.has(d) || d === t.id) errs.push(`${t.id}: invalid dependency ${d}`);
    if (!Array.isArray(t.files) || !t.files.length) errs.push(`${t.id}: must own at least one file`);
    if (!Array.isArray(t.criteria) || !t.criteria.length) errs.push(`${t.id}: needs at least one acceptance criterion`);
    if (!t.verify) errs.push(`${t.id}: needs a verify command`);
  }
  const state = {};
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const visit = (id) => {
    if (state[id] === 2) return false;
    if (state[id] === 1) return true;
    state[id] = 1;
    const cyc = (byId[id]?.deps || []).some((d) => byId[d] && visit(d));
    state[id] = 2;
    return cyc;
  };
  if (tasks.some((t) => visit(t.id))) errs.push('dependency cycle');
  return errs;
}

const get = (plan, id) => {
  const t = plan.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`unknown task ${id}`);
  return t;
};
const depsPassed = (plan, t) => (t.deps || []).every((d) => get(plan, d).passes);
// Files stay owned from start until the task passes (a done-but-unpassed task may still be reworked after QA).
const heldFiles = (plan) => plan.tasks.filter((t) => t.status === 'in_progress' || (t.status === 'done' && !t.passes)).flatMap((t) => t.files);

export function nextBatch(plan, max = 4) {
  const taken = [...heldFiles(plan)];
  const out = [];
  for (const t of plan.tasks) {
    if (out.length >= max) break;
    if (t.status !== 'pending' || !depsPassed(plan, t) || ownsOverlap(t.files, taken)) continue;
    out.push(t.id);
    taken.push(...t.files);
  }
  return out;
}

export function startTask(plan, id) {
  const t = get(plan, id);
  if (t.status !== 'pending') throw new Error(`${id} is ${t.status}, not pending`);
  if (!depsPassed(plan, t)) throw new Error(`${id}: dependencies have not passed`);
  if (ownsOverlap(t.files, heldFiles(plan))) throw new Error(`${id}: file ownership conflict with an in-progress task`);
  t.status = 'in_progress';
}

export function finishTask(plan, id) {
  const t = get(plan, id);
  if (t.status !== 'in_progress') throw new Error(`${id} is ${t.status}, not in_progress`);
  t.status = 'done'; // finishing never sets passes; only passTask (QA, with evidence) does
}

export function reopenTask(plan, id) {
  const t = get(plan, id);
  if (t.status !== 'done' || t.passes) throw new Error(`${id} can only be reopened when done and not yet passed`);
  t.status = 'in_progress'; // QA failed: back to the engineer, files stay owned
}

export function blockTask(plan, id, reason) {
  const t = get(plan, id);
  if (t.passes) throw new Error(`${id} has already passed and cannot be blocked`);
  if (t.status === 'blocked') throw new Error(`${id} is already blocked`);
  t.status = 'blocked';
  t.note = String(reason || '');
}

export function unblockTask(plan, id) {
  const t = get(plan, id);
  if (t.status !== 'blocked') throw new Error(`${id} is ${t.status}, not blocked`);
  t.status = 'pending';
  t.note = '';
}

// QA records which tests prove a criterion (or why none is possible).
export function mapCriterion(plan, id, criterionId, { tests, noTest } = {}) {
  const t = get(plan, id);
  const c = t.criteria.find((x) => x.id === criterionId);
  if (!c) throw new Error(`${id} has no criterion ${criterionId}`);
  if (tests?.length) c.tests = tests;
  else if (noTest) c.noTest = noTest;
  else throw new Error('map needs --tests a,b or --no-test <reason>');
}

export function passTask(plan, id, { cmd, exit, at } = {}) {
  const t = get(plan, id);
  if (t.status !== 'done') throw new Error(`${id} must be done before it can pass`);
  if (!cmd) throw new Error('pass requires the verification command that was run');
  if (exit !== 0) throw new Error(`pass requires exit 0, got ${exit}`);
  const bad = t.criteria.filter((c) => !(c.tests?.length || c.noTest));
  if (bad.length) throw new Error(`criteria without tests or a noTest reason: ${bad.map((c) => c.id).join(', ')}`);
  t.passes = true;
  t.evidence = { cmd, exit, at: at || new Date().toISOString() };
}

// What is actually delivered: criteria of passed tasks only. Everything else is pending.
export function deliveryReport(plan) {
  const delivered = [];
  const pending = [];
  for (const t of plan.tasks) {
    for (const c of t.criteria) (t.passes ? delivered : pending).push({ id: c.id, text: c.text, task: t.id });
  }
  const state = !delivered.length ? 'none' : pending.length ? 'partial' : 'complete';
  return { state, delivered, pending };
}
