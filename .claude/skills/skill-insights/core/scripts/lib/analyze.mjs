// Attribute session activity to skill windows and summarise skill usage. Pure; no I/O.
const sum = (a, b) => ({ in: a.in + b.in, out: a.out + b.out, cacheRead: a.cacheRead + b.cacheRead, cacheWrite: a.cacheWrite + b.cacheWrite });
const zero = () => ({ in: 0, out: 0, cacheRead: 0, cacheWrite: 0 });

// A window starts at a Skill invocation and ends at the next one (or session end). Entries before any skill are "(none)".
export function windows(session, { idleMs = 10 * 60_000 } = {}) {
  const out = [];
  let cur = null;
  let last = null;
  const open = (skill) => { cur = { skill, tokens: zero(), wallMs: 0, toolCalls: 0, toolErrors: 0, reads: [], repeatedReads: 0, largestResults: [] }; out.push(cur); last = null; };
  for (const e of session.entries) {
    if (e.skill) open(e.skill);
    else if (!cur) open('(none)');
    if (last !== null && e.ts >= last && e.ts - last <= idleMs) cur.wallMs += e.ts - last;
    last = e.ts;
    if (e.usage) cur.tokens = sum(cur.tokens, e.usage);
    if (e.tool || e.skill) cur.toolCalls++;
    if (e.read) { cur.toolCalls++; if (cur.reads.includes(e.read.file)) cur.repeatedReads++; cur.reads.push(e.read.file); }
    if (e.error) cur.toolErrors++;
    if (e.bytes) cur.largestResults = [...cur.largestResults, e.bytes].sort((a, b) => b - a).slice(0, 3);
  }
  return out;
}

// sessions: [{ project, sessionId, date, entries }]. installed: skill names found on disk.
export function inventory(sessions, installed = []) {
  const m = new Map();
  for (const s of sessions) {
    for (const e of s.entries) {
      if (!e.skill) continue;
      const r = m.get(e.skill) || { skill: e.skill, invocations: 0, sessionSet: new Set(), projectSet: new Set(), lastUsed: '' };
      r.invocations++; r.sessionSet.add(`${s.project}/${s.sessionId}`); r.projectSet.add(s.project);
      if (s.date > r.lastUsed) r.lastUsed = s.date;
      m.set(e.skill, r);
    }
  }
  const used = [...m.values()].map(({ sessionSet, projectSet, ...r }) => ({ ...r, sessions: sessionSet.size, projects: projectSet.size })).sort((a, b) => b.invocations - a.invocations);
  const seen = new Set(used.map((u) => u.skill).concat(used.map((u) => u.skill.split(':').pop())));
  return { used, unused: installed.filter((n) => !seen.has(n)) };
}
