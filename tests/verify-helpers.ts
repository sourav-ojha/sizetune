// Shared helpers for the verifier negative-fixture tests. Mutations are applied to TEMP COPIES of dist (never the real dist).
// Every mutation helper THROWS if the mutation did not change anything, so a content change in a page can never turn a
// negative fixture into a silent no-op (which would make the test pass or fail for the wrong reason).
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'vitest';

export const requireDist = () => {
  if (!existsSync('dist/index.html')) throw new Error('dist/ is missing: run `npm run build` before `vitest run tests/verify-*.test.ts`');
};
export const copyDist = () => { const d = mkdtempSync(join(tmpdir(), 'verify-')); cpSync('dist', d, { recursive: true }); return d; };
export const read = (d: string, f: string) => readFileSync(join(d, f), 'utf8');
export const write = (d: string, f: string, s: string) => writeFileSync(join(d, f), s);
export const edit = (d: string, f: string, fn: (s: string) => string) => {
  const before = read(d, f), after = fn(before);
  if (before === after) throw new Error(`mutation was a no-op on ${f} (page content changed? update the fixture)`);
  write(d, f, after);
};
export const has = (fails: string[], re: RegExp) => expect(fails.some((f) => re.test(f)), `expected a failure matching ${re}; got:\n${fails.join('\n') || '(none)'}`).toBe(true);
export const hasNot = (fails: string[], re: RegExp) => expect(fails.filter((f) => re.test(f)), 'unexpected failure').toEqual([]);

/** Build a temp dist, let `fn` mutate it, run `verify(dir)`, clean up. */
export function withDist<T>(fn: (d: string) => void, verify: (d: string) => T): T {
  const d = copyDist();
  try { fn(d); return verify(d); } finally { rmSync(d, { recursive: true, force: true }); }
}

const walk = (d: string, base = ''): string[] => readdirSync(join(d, base), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(d, join(base, e.name)) : [join(base, e.name)]));
export const htmlFiles = (d: string) => walk(d).filter((f) => f.endsWith('.html'));
const type = (s: string) => s.match(/<body\b[^>]*data-page-type=["']?([a-z]+)/i)?.[1];
/** Discover pages by data-page-type so tests survive page additions/renames. */
export const pagesOf = (d: string, t: string | string[]) => htmlFiles(d).filter((f) => [t].flat().includes(type(read(d, f)) ?? ''));
export const firstOf = (d: string, t: string | string[]) => { const f = pagesOf(d, t)[0]; if (!f) throw new Error(`no page of type ${t} in dist`); return f; };
export const toolFile = (d: string) => firstOf(d, ['tool', 'home']);
export const jsChunks = (d: string) => readdirSync(join(d, '_astro')).filter((f) => f.endsWith('.js')).map((f) => `_astro/${f}`);
/** An app-owned (non react-dom) chunk loaded by a tool page. */
export const appChunk = (d: string) => jsChunks(d).find((f) => !/client\./.test(f) && read(d, f).length > 1000 && !/compress\.worker/.test(f)) ?? jsChunks(d).find((f) => !/client\./.test(f))!;
export const cssChunk = (d: string) => '_astro/' + readdirSync(join(d, '_astro')).find((f) => f.endsWith('.css'))!;
export const reactChunk = (d: string) => jsChunks(d).find((f) => /__reactFiber\$|react\.dev\/errors/.test(read(d, f)))!;
export const headEnd = (s: string, add: string) => s.replace('</head>', add + '</head>');
export const mainEnd = (s: string, add: string) => s.replace('</main>', add + '</main>');
