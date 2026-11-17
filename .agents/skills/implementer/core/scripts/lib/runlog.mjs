// Run log: one metadata-only JSON line per helper command, for later analysis of how a skill performed.
// Never throws, never blocks the run. Off with SKILL_RUNLOG=off. Lives in <project>/.skill-runs/ (self-ignoring).
// Keep this file identical in every skill that has helpers (a test enforces it).
import fs from 'node:fs';
import path from 'node:path';

const NOTE_KEYS = new Set(['unclear', 'skipped', 'improvised', 'suggest']); // agent self-report: short free text, exported redacted
const clean = (s, max) => String(s).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);

const isLink = (p) => { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } };
function appendNoFollow(file, text, onlyIfNew) {
  const F = fs.constants;
  const flags = F.O_WRONLY | F.O_CREAT | (onlyIfNew ? F.O_EXCL : F.O_APPEND) | (F.O_NOFOLLOW || 0);
  let fd;
  try { fd = fs.openSync(file, flags, 0o600); } catch (e) { if (onlyIfNew && e.code === 'EEXIST') return; throw e; }
  try { fs.writeSync(fd, text); } finally { fs.closeSync(fd); }
}

export function logEvent(dir, skill, run, fields) {
  try {
    if (process.env.SKILL_RUNLOG === 'off') return;
    const rec = { ts: new Date().toISOString(), skill, run };
    if (process.env.SKILL_PARENT_RUN) rec.parent = clean(process.env.SKILL_PARENT_RUN, 80);
    for (const [k, v] of Object.entries(fields || {})) {
      if (typeof v === 'number' || typeof v === 'boolean') rec[k] = v;
      else if (typeof v === 'string') rec[k] = clean(v, NOTE_KEYS.has(k) ? 500 : 200);
    }
    const d = path.join(path.resolve(dir), '.skill-runs');
    // A cloned repo could ship .skill-runs (or its files) as symlinks: never write through a link.
    const plainDir = () => { const st = fs.lstatSync(d); return st.isDirectory() && !st.isSymbolicLink(); };
    if (fs.existsSync(d) || isLink(d)) { if (!plainDir()) return; } else { fs.mkdirSync(d, { recursive: true }); if (!plainDir()) return; }
    appendNoFollow(path.join(d, '.gitignore'), '*\n', true);
    appendNoFollow(path.join(d, `${skill}.jsonl`), JSON.stringify(rec) + '\n', false);
  } catch { /* logging must never break a run */ }
}

export const runId = (skill, key) => clean(process.env.SKILL_RUN_ID || `${skill}:${key}`, 80);
