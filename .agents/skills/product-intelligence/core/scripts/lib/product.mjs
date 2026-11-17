import { createHash } from 'node:crypto';
import { splitFrontmatter, findSection, parseTableInSection } from './fm.mjs';

// The hash covers the whole PRODUCT.md body except the table rows of the "Revision History" section
// (so recording history does not invalidate the baseline). Any other text, including prose smuggled
// under the Revision History heading, is part of the hash.
export function productHash(text) {
  const { body } = splitFrontmatter(text);
  const stripped = withoutHistoryRows(body)
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .trim();
  return 'sha256:' + createHash('sha256').update(stripped).digest('hex');
}

export function appendHistory(text, row) {
  const line = `| ${row.revision} | ${row.date} | ${row.by} | ${row.action} | ${(row.note || '').replace(/\|/g, '/').replace(/\n/g, ' ')} |`;
  const s = findSection(text, 'Revision History');
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (!s) {
    return lines.join('\n').replace(/\s*$/, '\n') + ['', '## Revision History', '', '| Revision | Date | By | Action | Note |', '|---|---|---|---|---|', line, ''].join('\n');
  }
  let last = s.start;
  for (let i = s.start + 1; i < s.end; i++) if (lines[i].trim().startsWith('|')) last = i;
  if (last === s.start) {
    lines.splice(s.start + 1, 0, '', '| Revision | Date | By | Action | Note |', '|---|---|---|---|---|', line);
  } else lines.splice(last + 1, 0, line);
  return lines.join('\n');
}

export function withoutHistoryRows(body) {
  const s = findSection(body, 'Revision History');
  if (!s) return body;
  return [...s.lines.slice(0, s.start + 1), ...s.lines.slice(s.start + 1, s.end).filter((l) => !l.trim().startsWith('|')), ...s.lines.slice(s.end)].join('\n');
}

// Non-table prose under Revision History is part of the hash and also a validation error.
export function historyHasProse(text) {
  const s = findSection(text, 'Revision History');
  if (!s) return false;
  return s.lines.slice(s.start + 1, s.end).some((l) => l.trim() && !l.trim().startsWith('|'));
}

export const HISTORY_ACTIONS = ['approved', 're-approved', 'reopened', 'reviewed'];

// Rows of the Revision History table: {revision, date, by, action, note, n}.
export function parseHistory(text) {
  const t = parseTableInSection(text, 'Revision History');
  if (!t || !t.header.length) return [];
  return t.rows.map((r) => ({ revision: r.cells[0], date: r.cells[1], by: r.cells[2], action: (r.cells[3] || '').toLowerCase(), note: r.cells[4] ?? '', n: r.cells.length }));
}
