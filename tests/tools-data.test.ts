import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { TOOLS, FAMILIES, relatedTools, toolsByFamily } from '../src/data/tools';

const pageFile = (href: string) => (href === '/' ? 'src/pages/index.astro' : `src/pages${href.replace(/\/$/, '')}.astro`);

describe('tools data (FEATURE-012)', () => {
  it('hrefs are unique and well formed', () => {
    const hrefs = TOOLS.map((t) => t.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const h of hrefs) expect(h).toMatch(/^\/([a-z0-9-]+\/)?$/);
  });

  it('every listed tool has a real page (no coming-soon entries)', () => {
    for (const t of TOOLS) expect(existsSync(pageFile(t.href)), t.href).toBe(true);
  });

  it('every tool has a title, a blurb and a known family', () => {
    for (const t of TOOLS) {
      expect(t.title.length).toBeGreaterThan(3);
      expect(t.blurb.length).toBeGreaterThan(20);
      expect(Object.keys(FAMILIES)).toContain(t.family);
    }
  });

  it('related targets exist, are not self, and every tool has at least two related', () => {
    const hrefs = new Set(TOOLS.map((t) => t.href));
    for (const t of TOOLS) {
      const rel = relatedTools(t.href);
      expect(rel.length, t.href).toBeGreaterThanOrEqual(2);
      for (const r of rel) { expect(hrefs.has(r.href)).toBe(true); expect(r.href).not.toBe(t.href); }
    }
  });

  it('relatedTools of an unknown path is empty, never throws', () => {
    expect(relatedTools('/nope/')).toEqual([]);
  });

  it('toolsByFamily omits empty families and covers every tool once', () => {
    const groups = toolsByFamily();
    expect(groups.every((g) => g.tools.length > 0)).toBe(true);
    expect(groups.flatMap((g) => g.tools).length).toBe(TOOLS.length);
  });

  it('every tool or home page is listed (a new tool page cannot be forgotten)', () => {
    const listed = new Set(TOOLS.map((t) => pageFile(t.href)));
    const pages = readdirSync('src/pages').filter((f) => f.endsWith('.astro'));
    for (const f of pages) {
      const src = readFileSync(`src/pages/${f}`, 'utf8');
      if (/pageType="(tool|home)"/.test(src)) expect(listed.has(`src/pages/${f}`), f).toBe(true);
    }
  });
});
