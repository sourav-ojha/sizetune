// Summarise and redact skill run logs (.skill-runs/*.jsonl) for export. Pure; no I/O.
const NOTE_KEYS = ['unclear', 'skipped', 'improvised', 'suggest'];

// Free text from an agent is redacted again here: absolute paths, emails, long token-like strings.
export function redactText(s, max = 400) {
  return String(s)
    .replace(/\s+/g, ' ')
    .replace(/https?:\/\/\S+/gi, '<url>')
    .replace(/(?:[A-Za-z]:\\|\/)(?:[\w.@~+-]+[\\/])+[\w.@~+-]*/g, '<path>')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    .replace(/\b(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|auth)\s*[=:]\s*\S+/gi, '<secret>')
    .replace(/\b(?:AKIA|ASIA|AIza|ghp_|gho_|ghs_|xox[baprs]-|sk-)[\w-]{8,}/g, '<token>')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '<token>')
    .replace(/[`<>|\\]/g, '')
    .slice(0, max);
}

// Structural fields are allowlisted: anything that does not match its expected shape is replaced, never echoed.
const pick = (v, re, fallback) => (typeof v === 'string' && re.test(v) ? v : fallback);

export function parseRunLog(text) {
  const out = [];
  let skipped = 0;
  for (const l of String(text).split('\n')) {
    if (!l.trim()) continue;
    try { const o = JSON.parse(l); if (o && typeof o === 'object' && o.run && o.event) out.push(o); else skipped++; } catch { skipped++; }
  }
  return { events: out, skipped };
}

export function summarizeRuns(events, { notes: withNotes = true } = {}) {
  const by = new Map();
  for (const e of events) { const a = by.get(e.run) || []; a.push(e); by.set(e.run, a); }
  return [...by.entries()].map(([run, evs]) => {
    evs.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    const count = (name) => evs.filter((e) => e.event === name).length;
    const failed = evs.filter((e) => e.ok === false);
    const notes = !withNotes ? [] : evs.filter((e) => e.event === 'retro').map((e) => Object.fromEntries(NOTE_KEYS.filter((k) => e[k]).map((k) => [k, redactText(e[k])])));
    const init = evs.find((e) => e.event === 'init');
    return {
      run: pick(run, /^[A-Za-z0-9:_.-]{1,80}$/, 'run-?'), skill: pick(evs[0].skill, /^[A-Za-z0-9_-]{1,40}$/, 'unknown'), start: pick(evs[0].ts, /^[0-9T:.\-Z]{10,30}$/, '?'), end: pick(evs[evs.length - 1].ts, /^[0-9T:.\-Z]{10,30}$/, '?'), commands: evs.length,
      failedCommands: failed.map((e) => pick(e.event, /^[a-z-]{1,24}$/, 'other')), tier: pick(init?.tier, /^T[0-3]$/, undefined), spec: pick(init?.spec, /^(FEATURE-\d{1,6}|file)$/, undefined),
      fixRounds: count('reopen'), blocked: count('block'), passed: count('pass') - failed.filter((e) => e.event === 'pass').length,
      rulings: count('ruling'), ids: [...new Set(evs.map((e) => pick(e.opp, /^OPP-\d{1,6}$/, null)).filter(Boolean))],
      validate: evs.filter((e) => e.event === 'validate').map((e) => ({ errors: Number.isFinite(e.errors) ? e.errors : null, warnings: Number.isFinite(e.warnings) ? e.warnings : null })),
      delivery: pick(evs.filter((e) => e.event === 'report').map((e) => e.state).pop(), /^(none|partial|complete)$/, undefined),
      notes,
    };
  });
}
