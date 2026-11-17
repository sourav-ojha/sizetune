// Parse one Claude Code session transcript (JSONL) into normalised entries. Pure; no I/O.
// Entry: { ts, usage?, skill?, read?, tool?, error?, bytes? }. Message text is never kept.
const SKILL_PATH = /\/skills\/([^/]+)\//;

const num = (n) => (Number.isFinite(n) ? n : 0);
const size = (c) => (typeof c === 'string' ? c.length : JSON.stringify(c ?? '').length);

export function parseSession(text) {
  const entries = [];
  const byMsg = new Map(); // streamed chunks repeat a message id: keep one copy (the latest)
  let skippedLines = 0;
  let pending = null; // a slash command waiting for its skill body (builtins like /clear never get one)
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { skippedLines++; continue; }
    if (!o || typeof o !== 'object') { skippedLines++; continue; }
    const ts = o.timestamp ? Date.parse(o.timestamp) : NaN;
    const m = o.message;
    if (!m || typeof m !== 'object' || Number.isNaN(ts)) continue;
    const mine = [];
    if (o.type === 'assistant') {
      for (const b of Array.isArray(m.content) ? m.content : []) {
        if (b.type !== 'tool_use') continue;
        if (b.name === 'Skill' && b.input?.skill) { mine.push({ ts, skill: String(b.input.skill) }); continue; }
        const file = b.input?.file_path;
        const sk = typeof file === 'string' && b.name === 'Read' ? file.match(SKILL_PATH) : null;
        if (sk) mine.push({ ts, read: { skill: sk[1], file } });
        else mine.push({ ts, tool: String(b.name) });
      }
      // After the tool blocks, so a Skill invocation's own tokens are charged to the skill it opens.
      if (m.usage) mine.push({ ts, usage: { in: num(m.usage.input_tokens), out: num(m.usage.output_tokens), cacheRead: num(m.usage.cache_read_input_tokens), cacheWrite: num(m.usage.cache_creation_input_tokens) } });
    } else if (o.type === 'user') {
      const texts = typeof m.content === 'string' ? [m.content] : (Array.isArray(m.content) ? m.content : []).filter((b) => b.type === 'text').map((b) => b.text || '');
      for (const t of texts) {
        const c = t.match(/<command-name>\/?([^<\s]+)<\/command-name>/);
        if (c) pending = { name: c[1], ts, left: 6 };
        else if (pending && /Base directory for this skill:/.test(t)) { mine.push({ ts: pending.ts, skill: pending.name }); pending = null; }
      }
      if (pending && --pending.left <= 0) pending = null;
      for (const b of Array.isArray(m.content) ? m.content : []) {
        if (b.type === 'tool_result') mine.push({ ts, bytes: size(b.content), ...(b.is_error ? { error: true } : {}) });
      }
    }
    if (o.type === 'assistant' && m.id) {
      const prev = byMsg.get(m.id);
      if (prev) { prev.forEach((e) => { e.dead = true; }); }
      byMsg.set(m.id, mine);
    }
    entries.push(...mine);
  }
  return { entries: entries.filter((e) => !e.dead), skippedLines };
}
