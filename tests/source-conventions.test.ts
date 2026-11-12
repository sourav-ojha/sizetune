// Lint-like guard for the Preact migration (docs/experiments/PREACT.md): the UI is compiled with preact/compat, so
// source must import Preact explicitly and must not use patterns whose typing/semantics differ from React's.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const files = walk('src/components').filter((f) => /\.tsx?$/.test(f));

describe('src/components source conventions (Preact)', () => {
  it('finds the component sources', () => expect(files.length).toBeGreaterThan(10));
  it.each(files)('%s: no react / react-dom imports (use preact, preact/hooks, preact/compat)', (f) => {
    expect(readFileSync(f, 'utf8')).not.toMatch(/from\s+['"]react(-dom)?(\/[^'"]*)?['"]|require\(\s*['"]react/);
  });
  it.each(files)('%s: no e.target.value / e.target.checked (Preact types target as EventTarget; use currentTarget)', (f) => {
    expect(readFileSync(f, 'utf8')).not.toMatch(/\b(e|ev|event)\.target\.(value|checked|files)\b/);
  });
});
