import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

// FEATURE-017 AC-5 / FR-5: one workbench page, no per-keyword or per-variant pages.
describe('text workbench is a single page (AC-5)', () => {
  const pages = readdirSync('src/pages').filter((f) => f.endsWith('.astro'));
  it('exactly one page mounts the text tools', () => {
    const users = pages.filter((f) => /components\/TextTools/.test(readFileSync(`src/pages/${f}`, 'utf8')));
    expect(users).toEqual(['text-tools.astro']);
  });
  it('the one island holds counting, case and filler', () => {
    const src = readFileSync('src/components/TextTools.tsx', 'utf8');
    for (const id of ['count-section', 'case-section', 'filler-section']) expect(src).toContain(id);
  });
});
