import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

// FEATURE-020 AC-5: the handwriting fonts are declared on the signature maker page only.
const html = (p: string) => (existsSync(`dist/${p}`) ? readFileSync(`dist/${p}`, 'utf8') : '');
describe('handwriting fonts load only on the signature maker page (AC-5)', () => {
  it('the maker page declares all three fonts', () => {
    const h = html('signature-maker/index.html');
    for (const f of ['Caveat', 'Dancing Script', 'Homemade Apple']) expect(h, f).toContain(f);
  });
  it('no other page declares them', () => {
    for (const p of ['index.html', 'resize-signature/index.html', 'tools/index.html', 'png-to-jpg/index.html', 'text-tools/index.html', 'qr-code-generator/index.html', 'privacy/index.html']) {
      const h = html(p);
      expect(h.length, p).toBeGreaterThan(0);
      for (const f of ['Caveat', 'Dancing Script', 'Homemade Apple']) expect(h, `${p} ${f}`).not.toMatch(new RegExp(`@font-face[^}]*${f}`));
    }
  });
});
