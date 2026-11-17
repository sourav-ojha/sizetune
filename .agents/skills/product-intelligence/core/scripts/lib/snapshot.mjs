import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const SKIP_DIRS = new Set(['.git', 'node_modules', '.product', '.remember', '.DS_Store']);
const MAX_HASH_BYTES = 8 * 1024 * 1024;

// Never application state: git internals and our own artifacts.
const ALWAYS_SKIP = /(^|\/)(\.git|\.product)(\/|$)/;
// Our own run-log files, root only and exactly these shapes (a nested .skill-runs or any other file in it is application state).
const RUNLOG = /^\.skill-runs\/(\.gitignore|[\w.-]+\.jsonl)$/;
// Bulk build/dependency/cache folders. Skipped only for UNTRACKED files: anything git tracks is application
// source, even when it lives in a folder that happens to be called build/ or dist/.
const BULK = /(^|\/)(node_modules|\.venv|venv|__pycache__|dist|build|out|target|coverage|vendor|\.next|\.nuxt|\.cache|\.turbo|\.parcel-cache|\.gradle|\.terraform|\.tox|\.mypy_cache|\.pytest_cache|\.idea|\.vscode)(\/|$)/;

function listFiles(dir) {
  try {
    const run = (args) => execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', 'ls-files', '-z', ...args], { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 }).toString('utf8').split('\0').filter(Boolean);
    // tracked files always count; untracked and ignored files (local secrets/config are application state too)
    // count unless they sit in bulk build/dependency directories.
    const tracked = run(['-c']).filter((f) => !ALWAYS_SKIP.test(f)); // a tracked file is application source, even under .skill-runs
    const others = [...run(['-o', '--exclude-standard']), ...run(['-o', '-i', '--exclude-standard'])].filter((f) => !ALWAYS_SKIP.test(f) && !RUNLOG.test(f) && !BULK.test(f));
    return [...new Set([...tracked, ...others])];
  } catch {
    const acc = [];
    (function walk(d, rel) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (SKIP_DIRS.has(e.name)) continue;
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) walk(path.join(d, e.name), r);
        else if (e.isFile()) acc.push(r);
      }
    })(dir, '');
    return acc.filter((f) => !RUNLOG.test(f));
  }
}

export function takeSnapshot(dir) {
  const map = {};
  for (const f of listFiles(dir)) {
    const p = path.join(dir, f);
    try {
      const st = fs.lstatSync(p);
      const mode = (st.mode & 0o777).toString(8); // permission changes (e.g. chmod +x) are changes too
      if (st.isSymbolicLink()) { map[f] = `link:${fs.readlinkSync(p)}:${mode}`; continue; } // never follow: retargeting a link is a change
      if (!st.isFile()) continue;
      map[f] = `${st.size > MAX_HASH_BYTES ? `size:${st.size}:${st.mtimeMs}` : createHash('sha256').update(fs.readFileSync(p)).digest('hex')}:${mode}`;
    } catch { /* deleted between list and read */ }
  }
  return map;
}

export function snapshotPath(dir, tag = 'default') {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(tag))) throw new Error(`invalid snapshot tag "${tag}" (use letters, digits, - and _)`);
  const id = createHash('sha1').update(path.resolve(dir)).digest('hex').slice(0, 12);
  const uid = typeof process.getuid === 'function' ? process.getuid() : 'u';
  return path.join(os.tmpdir(), `product-intelligence-snapshots-${uid}`, `${id}-${tag}.json`);
}

// Snapshot dir must be a real directory we own, not group/world accessible (guards against pre-planted dirs/symlinks in shared tmp).
function ensureSafeDir(d) {
  fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  const st = fs.lstatSync(d);
  if (!st.isDirectory() || st.isSymbolicLink()) throw new Error(`snapshot dir ${d} is not a plain directory; refusing to use it`);
  if (typeof process.getuid === 'function' && (st.uid !== process.getuid() || (st.mode & 0o077) !== 0)) {
    throw new Error(`snapshot dir ${d} is not private to this user; remove it and retry`);
  }
}

export function saveSnapshot(dir, tag) {
  const p = snapshotPath(dir, tag);
  ensureSafeDir(path.dirname(p));
  const snap = takeSnapshot(dir);
  fs.rmSync(p, { force: true });
  const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0);
  const fd = fs.openSync(p, flags, 0o600);
  try { fs.writeSync(fd, JSON.stringify({ taken: new Date().toISOString(), files: snap })); } finally { fs.closeSync(fd); }
  return { path: p, count: Object.keys(snap).length };
}

export function diffSnapshot(dir, tag) {
  const p = snapshotPath(dir, tag);
  ensureSafeDir(path.dirname(p));
  if (!fs.existsSync(p)) throw new Error(`No snapshot at ${p}. Run "snapshot" before research starts.`);
  const before = JSON.parse(fs.readFileSync(p, 'utf8')).files;
  const after = takeSnapshot(dir);
  const added = Object.keys(after).filter((f) => !(f in before));
  const removed = Object.keys(before).filter((f) => !(f in after));
  const modified = Object.keys(after).filter((f) => f in before && before[f] !== after[f]);
  return { clean: !added.length && !removed.length && !modified.length, added, removed, modified };
}

export function clearSnapshot(dir, tag) {
  fs.rmSync(snapshotPath(dir, tag), { force: true });
}
