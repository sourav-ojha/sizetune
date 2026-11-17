import fs from 'node:fs';
import path from 'node:path';

// Evidence tag grammar:
//   [E: <class>; <confidence>; <source>; <YYYY-MM-DD>]
//   class:      fact | inference | hypothesis | assumption | unknown
//   confidence: high | medium | low
//   source:     https URL | repo:<path>[:line|:start-end] | search:<queries run> | user:<what the user said> | ref:<claim> | n/a
//   date:       accessed date; required for URL sources.

export const TAG_RE = /\[E:\s*([^\];]*?)\s*;\s*([^\];]*?)\s*;\s*([^\];]*?)\s*(?:;\s*([^\];]*?)\s*)?\]/g;
const CLASSES = ['fact', 'inference', 'hypothesis', 'assumption', 'unknown'];
const CONFS = ['high', 'medium', 'low'];

export function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}

export function lintEvidence(text, { file = '', today, maxAgeDays = 180, repoRoot = null } = {}) {
  const errors = [];
  const warnings = [];
  const tags = [];
  const where = (idx) => `${file}:${text.slice(0, idx).split('\n').length}`;

  // Malformed: opens "[E:" but does not match the grammar.
  const opens = [...text.matchAll(/\[E:/g)].map((m) => m.index);
  const good = new Set();

  for (const m of text.matchAll(TAG_RE)) {
    good.add(m.index);
    const [, cls0, conf0, src, date] = m;
    const cls = cls0.toLowerCase();
    const conf = conf0.toLowerCase();
    const loc = where(m.index);
    tags.push({ cls, conf, src, date, loc });
    if (!CLASSES.includes(cls)) { errors.push(`${loc}: unknown evidence class "${cls0}"`); continue; }
    if (!CONFS.includes(conf)) { errors.push(`${loc}: unknown confidence "${conf0}"`); continue; }
    if (cls === 'hypothesis' && conf !== 'low') errors.push(`${loc}: hypothesis must have low confidence`);
    if (cls === 'inference' && conf === 'high') errors.push(`${loc}: inference cannot be high confidence`);
    if (cls === 'assumption' && conf === 'high') errors.push(`${loc}: assumption cannot be high confidence`);
    if (cls === 'unknown') continue;
    if (!src || src === 'n/a') {
      if (cls === 'fact') errors.push(`${loc}: fact requires a source`);
      continue;
    }
    if (/^https?:\/\//i.test(src)) {
      let u;
      try { u = new URL(src); } catch { errors.push(`${loc}: invalid URL "${src}"`); continue; }
      if (isPrivateHost(u.hostname)) errors.push(`${loc}: source must be a public URL, got "${src}" (URLs containing ";" or "]" must be percent-encoded)`);
      if (!date) errors.push(`${loc}: URL source needs an accessed date`);
      else if (!isValidDate(date)) errors.push(`${loc}: invalid accessed date "${date}"`);
      else if (today) {
        if (date > today) errors.push(`${loc}: accessed date ${date} is in the future`);
        else if (daysBetween(date, today) > maxAgeDays) warnings.push(`${loc}: source accessed ${daysBetween(date, today)} days ago (> ${maxAgeDays}); refresh before relying on it`);
      }
    } else if (/^repo:\S+/.test(src) || /^search:.+/.test(src) || /^user:.+/.test(src) || /^ref:.+/.test(src)) {
      if (date && !isValidDate(date)) errors.push(`${loc}: invalid date "${date}"`);
      if (cls === 'fact' && conf !== 'low' && /^(search|ref):/.test(src)) errors.push(`${loc}: a ${src.split(':')[0]}: source cannot back a medium/high-confidence fact (search logs record absence, ref: records reasoning); use inference/unknown, or low confidence`);
      if (repoRoot && /^repo:\S+/.test(src) && !repoSourceExists(repoRoot, src, { dirOk: true })) warnings.push(`${loc}: ${src} does not point to an existing file or folder in the project`);
    } else if (cls === 'fact') {
      errors.push(`${loc}: fact source must be an https URL, repo:<path>, search:<queries>, or user:<note> (got "${src}")`);
    }
  }
  for (const idx of opens) if (!good.has(idx)) errors.push(`${where(idx)}: malformed evidence tag`);
  return { errors, warnings, tags };
}

// repo:<path>[:line|:start-end] -> the file path part.
export function repoSourcePath(src) {
  return src.replace(/^repo:/, '').replace(/:\d+(?:-\d+)?$/, '');
}

export function repoSourceExists(root, src, { dirOk = false } = {}) {
  const abs = path.resolve(root, repoSourcePath(src));
  const rel = path.relative(path.resolve(root), abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return false;
  try { const st = fs.statSync(abs); return st.isFile() || (dirOk && st.isDirectory()); } catch { return false; }
}

// Canonical identity of a primary source for counting distinct evidence; null when it is not a primary source
// (not https, a repo path that is missing, or one of our own artifacts / git internals).
export function sourceKey(root, src) {
  if (/^https?:\/\//i.test(src)) {
    try {
      const u = new URL(src);
      return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}${u.search}`;
    } catch { return null; }
  }
  if (/^repo:\S+/.test(src) && repoSourceExists(root, src)) {
    const rel = path.relative(path.resolve(root), path.resolve(root, repoSourcePath(src))).split(path.sep).join('/');
    return /^(\.product|\.git)(\/|$)/.test(rel) ? null : `repo:${rel}`;
  }
  return null;
}

export function findPlaceholders(text) {
  const hits = [];
  const lines = text.split('\n');
  lines.forEach((l, i) => {
    if (/\{\{[^}]*\}\}|\bTODO\b|\bTBD\b|\bFIXME\b|lorem ipsum|<<[^>]*>>/i.test(l)) hits.push(i + 1);
  });
  return hits;
}

export function isPrivateHost(h) {
  const host = h.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host === '::1' || host === '0.0.0.0') return true;
  if (!host.includes('.') && !host.includes(':')) return true; // single-label intranet names
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  return /^(fc|fd|fe80)/.test(host) && host.includes(':');
}
