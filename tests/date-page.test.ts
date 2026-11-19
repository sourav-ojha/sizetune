import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

// FEATURE-016 AC-5 / FR-5: one workbench page, no per-keyword or per-variant pages.
describe('date workbench is a single page (AC-5)', () => {
  const pages = readdirSync('src/pages').filter((f) => f.endsWith('.astro'));
  const users = pages.filter((f) => /components\/DateTools/.test(readFileSync(`src/pages/${f}`, 'utf8')));

  it('exactly one page mounts the date tools', () => {
    expect(users).toEqual(['date-calculators.astro']);
  });

  it('the one island holds all three calculators', () => {
    const src = readFileSync('src/components/DateTools.tsx', 'utf8');
    for (const id of ['age-section', 'days-section', 'ts-section']) expect(src).toContain(id);
  });
});
