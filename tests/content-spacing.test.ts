// Guards against missing spaces around inline links in built pages (Astro trims line-end whitespace before a tag).
// Reads dist/ (run `npm run build` first); skipped when dist/ is absent.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const dist = 'dist';
describe.skipIf(!existsSync(dist))('content spacing', () => {
  for (const f of existsSync(dist) ? walk(dist).filter((x) => x.endsWith('.html')) : []) {
    it(`${f}: no word glued to an inline link`, () => {
      const main = (readFileSync(f, 'utf8').match(/<main[^>]*>([\s\S]*?)<\/main>/) || [])[1] ?? '';
      const bad = [...main.matchAll(/[A-Za-z,;:]<a\b[^>]*>|<\/a>[A-Za-z]/g)].map((m) => m[0]);
      expect(bad).toEqual([]);
    });
  }
});
