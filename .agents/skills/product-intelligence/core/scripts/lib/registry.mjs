import { createHash } from 'node:crypto';
import { splitFrontmatter, findSection, parseTableInSection, splitRow, cell } from './fm.mjs';

export function parseRegistry(text) {
  const { data: fm } = splitFrontmatter(text);
  const t = parseTableInSection(text, 'Registry');
  const rows = [];
  if (t && t.header.length) {
    for (const r of t.rows) {
      const o = {};
      t.header.forEach((h, i) => { o[h] = r.cells[i] ?? ''; });
      o._line = r.lineIndex;
      rows.push(o);
    }
  }
  return { fm, rows, header: t?.header ?? [], hasRegistry: !!t };
}

export function parseLog(text) {
  const t = parseTableInSection(text, 'Decision Log');
  if (!t) return [];
  return t.rows.map((r) => {
    const o = {};
    t.header.forEach((h, i) => { o[h] = r.cells[i] ?? ''; });
    return o;
  });
}

// Opportunity detail blocks: "### OPP-001 — Title" until next heading of same/higher level.
export function parseDetails(text) {
  const sec = findSection(text, 'Opportunity Details');
  const out = {};
  if (!sec) return out;
  const lines = sec.lines.slice(sec.start + 1, sec.end);
  let cur = null;
  for (const l of lines) {
    const m = l.match(/^###\s+(OPP-\d+)\b/);
    if (m) { cur = { id: m[1], lines: [] }; out[m[1]] = cur; continue; }
    if (cur) cur.lines.push(l);
  }
  for (const d of Object.values(out)) d.text = d.lines.join('\n');
  return out;
}

export function updateRow(text, id, patch) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const t = parseTableInSection(text, 'Registry');
  if (!t) throw new Error('opportunities.md has no "## Registry" table');
  const idCol = t.header.indexOf('id');
  const row = t.rows.find((r) => r.cells[idCol] === id);
  if (!row) throw new Error(`Unknown opportunity ${id}`);
  const cells = [...row.cells];
  for (const [k, v] of Object.entries(patch)) {
    const i = t.header.indexOf(k);
    if (i === -1) throw new Error(`Registry has no "${k}" column`);
    cells[i] = String(v); // cells are already unescaped by splitRow; escaping happens once when the row is written
  }
  lines[row.lineIndex] = `| ${cells.map(cell).join(' | ')} |`;
  return lines.join('\n');
}

// Tamper-evidence: every Decision Log row carries a seal = sha256(previous seal + row content).
// Editing, inserting or deleting a row by hand breaks the chain unless the editor also recomputes
// every later seal. This detects accidents and careless edits; it is NOT a defence against an actor
// who deliberately recomputes seals. The human reading the log (and git history) is the real gate.
export function sealOf(prev, e) {
  const body = [e.date, e.id, e.decision, e.by, e.note, e.content].map((x) => String(x ?? '')).join('\u241f');
  return createHash('sha256').update(`${prev}\u241e${body}`).digest('hex').slice(0, 12);
}

export function verifyChain(log) {
  const errs = [];
  let prev = '';
  log.forEach((e, i) => {
    const want = sealOf(prev, e);
    if (e.seal !== want) errs.push(`Decision Log row ${i + 1} (${e.id} ${e.decision}): seal "${e.seal || ''}" does not match; the log was edited by hand or reordered`);
    prev = e.seal || want;
  });
  return errs;
}

// Fingerprint of what the user is deciding on: the registry row (minus status/dates/links) and the detail block.
// It is sealed into the Decision Log, so an approved idea cannot be quietly rewritten into a different one.
export function contentDigest(text, id) {
  const r = parseRegistry(text).rows.find((x) => x.id === id);
  if (!r) return '';
  const d = parseDetails(text)[id];
  const body = (d ? d.lines : []).map((l) => l.replace(/\s+$/, '')).join('\n').trim();
  const head = [r.title, r.score, r.confidence, r.tier, r.effort].join('\u241f');
  return createHash('sha256').update(`${head}\u241e${body}`).digest('hex').slice(0, 12);
}

// The log's row count and last seal are mirrored in the frontmatter so removing rows from the end is detected.
export function checkLogHead(fm, log) {
  const errs = [];
  if (log.length) {
    const head = log[log.length - 1].seal || '';
    if (fm.decision_count !== String(log.length) || fm.decision_head !== head) errs.push(`Decision Log: ${log.length} row(s) with head seal "${head}" do not match frontmatter decision_count="${fm.decision_count ?? ''}" / decision_head="${fm.decision_head ?? ''}" (rows were removed or edited by hand; "pi.mjs decide" maintains these fields)`);
  } else if (fm.decision_count !== undefined && fm.decision_count !== '0') {
    errs.push(`Decision Log is empty but frontmatter decision_count is ${fm.decision_count}: logged decisions were deleted`);
  }
  return errs;
}

// Everything that must hold before the log may be appended to or trusted.
export function logIntegrityErrors(text) {
  const { data: fm } = splitFrontmatter(text);
  const log = parseLog(text);
  const errs = [];
  if (log.length && !log.every((e) => 'seal' in e && 'content' in e)) errs.push('Decision Log: missing "Content"/"Seal" column (rows must be written by pi.mjs decide)');
  else errs.push(...verifyChain(log));
  errs.push(...checkLogHead(fm, log));
  return errs;
}

export function appendLog(text, entry) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const clean = { date: cell(entry.date), id: cell(entry.id), decision: cell(entry.decision), by: cell(entry.by), note: cell(entry.note || ''), content: cell(entry.content || '') };
  const existing = parseLog(text);
  const prev = existing.length ? existing[existing.length - 1].seal || '' : '';
  const unesc = Object.fromEntries(Object.entries(clean).map(([k, v]) => [k, parseLogCell(v)]));
  const row = `| ${clean.date} | ${clean.id} | ${clean.decision} | ${clean.by} | ${clean.note} | ${clean.content} | ${sealOf(prev, unesc)} |`;
  const t = parseTableInSection(text, 'Decision Log');
  if (!t) {
    const add = ['', '## Decision Log', '', '| Date | ID | Decision | By | Note | Content | Seal |', '|---|---|---|---|---|---|---|', row, ''];
    return lines.join('\n').replace(/\s*$/, '\n') + add.join('\n');
  }
  lines.splice(t.lastIndex + 1, 0, row);
  return lines.join('\n');
}

// What the parser will read back for a cell we wrote (unescaped pipes).
function parseLogCell(s) { return s.replace(/\\\|/g, '|'); }

export function nextId(prefix, existing, pad = 3) {
  let max = 0;
  for (const e of existing) {
    const m = e.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(pad, '0')}`;
}

export { splitRow };
