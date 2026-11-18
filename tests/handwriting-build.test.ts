import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

// FEATURE-038 AC-4: the handwriting fonts are declared on the two pages that use them, and nowhere else.
const html = (p: string) => (existsSync(`dist/${p}`) ? readFileSync(`dist/${p}`, 'utf8') : '');
const FONTS = ['Caveat', 'Dancing Script', 'Homemade Apple'];
describe('handwriting fonts load only where they are used (AC-4)', () => {
  it('the handwriting page declares all three fonts', () => {
    const h = html('text-to-handwriting/index.html');
    expect(h.length).toBeGreaterThan(0);
    for (const f of FONTS) expect(h, f).toContain(f);
  });
  it('no other page declares them, apart from the signature maker', () => {
    for (const p of ['index.html', 'resize-signature/index.html', 'tools/index.html', 'png-to-jpg/index.html', 'text-tools/index.html', 'date-calculators/index.html', 'privacy/index.html']) {
      const h = html(p);
      expect(h.length, p).toBeGreaterThan(0);
      for (const f of FONTS) expect(h, `${p} ${f}`).not.toMatch(new RegExp(`@font-face[^}]*${f}`));
    }
  });
});
