// Minimal frontmatter helpers. Supports flat `key: value` plus one level of nested maps.
// Zero dependencies on purpose.

export function splitFrontmatter(input) {
  const text = input.replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!m) return { data: {}, body: text, hasFrontmatter: false, error: null };
  const data = {};
  let parent = null;
  for (const line of m[1].split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const nested = line.match(/^\s+([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (nested && parent) {
      if (typeof data[parent] !== 'object') data[parent] = {};
      data[parent][nested[1]] = unquote(nested[2]);
      continue;
    }
    const top = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!top) return { data, body: text, hasFrontmatter: true, error: `Unparseable frontmatter line: "${line}"` };
    parent = top[2] === '' ? top[1] : null;
    data[top[1]] = top[2] === '' ? '' : unquote(top[2]);
  }
  return { data, body: text.slice(m[0].length), hasFrontmatter: true, error: null };
}

function unquote(v) {
  const s = v.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}

function fmtValue(v) {
  const s = String(v);
  return /[:#]|^\s|\s$|^$|^['"]/.test(s) ? JSON.stringify(s) : s;
}

// Update top-level scalar keys, preserving order and everything else.
export function setFrontmatter(input, updates) {
  const text = input.replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---(\n|$)/);
  const lines = m ? m[1].split('\n') : [];
  const remaining = { ...updates };
  const out = lines.map((line) => {
    const top = line.match(/^([A-Za-z0-9_.-]+):/);
    if (top && top[1] in remaining) {
      const v = remaining[top[1]];
      delete remaining[top[1]];
      return `${top[1]}: ${fmtValue(v)}`;
    }
    return line;
  });
  for (const [k, v] of Object.entries(remaining)) out.push(`${k}: ${fmtValue(v)}`);
  const head = `---\n${out.join('\n')}\n---\n`;
  return m ? head + text.slice(m[0].length) : head + text;
}

// ---- section helpers -------------------------------------------------------

export function findSection(text, heading, level = 2) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const prefix = '#'.repeat(level) + ' ';
  const start = lines.findIndex((l) => l.startsWith(prefix) && l.slice(prefix.length).trim().toLowerCase().startsWith(heading.toLowerCase()));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const hm = lines[i].match(/^(#{1,6}) /);
    if (hm && hm[1].length <= level) { end = i; break; }
  }
  return { lines, start, end };
}

export function sectionText(text, heading, level = 2) {
  const s = findSection(text, heading, level);
  return s ? s.lines.slice(s.start + 1, s.end).join('\n') : null;
}

export function removeSection(text, heading, level = 2) {
  const s = findSection(text, heading, level);
  if (!s) return text.replace(/\r\n/g, '\n');
  return [...s.lines.slice(0, s.start), ...s.lines.slice(s.end)].join('\n');
}

// ---- table helpers ----------------------------------------------------------

export function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

// Make any string safe to write into one markdown table cell.
export function cell(s) {
  return String(s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\|/g, '\\|').trim();
}

// Pipe-lines that appear in a section after its first table ended (e.g. after a blank line). The table
// parser stops at the gap and would silently ignore them, so the validator reports them.
export function strayTableRows(text, heading, level = 2) {
  const t = parseTableInSection(text, heading, level);
  if (!t || t.headerIndex === -1) return 0;
  let n = 0;
  for (let j = t.lastIndex + 1; j < t.section.end; j++) if (t.section.lines[j].trim().startsWith('|')) n++;
  return n;
}

export function isSeparator(line) {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
}

// Returns {header:[], rows:[{cells, lineIndex}], headerIndex, lastIndex} for the first table inside a section.
export function parseTableInSection(text, heading, level = 2) {
  const s = findSection(text, heading, level);
  if (!s) return null;
  let i = s.start + 1;
  while (i < s.end && !s.lines[i].trim().startsWith('|')) i++;
  if (i >= s.end) return { header: [], rows: [], headerIndex: -1, lastIndex: s.end - 1, section: s };
  const header = splitRow(s.lines[i]).map((h) => h.toLowerCase());
  const rows = [];
  let last = i;
  for (let j = i + 1; j < s.end; j++) {
    const l = s.lines[j];
    if (!l.trim().startsWith('|')) break;
    last = j;
    if (isSeparator(l)) continue;
    rows.push({ cells: splitRow(l), lineIndex: j });
  }
  return { header, rows, headerIndex: i, lastIndex: last, section: s };
}
