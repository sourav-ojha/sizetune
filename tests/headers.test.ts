import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('public/_headers (ST-004)', () => {
  const text = fs.readFileSync('public/_headers', 'utf8');
  const rule = text.split(/\n(?=\S)/).find((b) => b.startsWith('/_astro/*.js')) ?? '';
  it('the worker script gets a CSP that blocks outbound requests including dynamic import()', () => {
    expect(rule).toContain("default-src 'none'");
    expect(rule).toContain("script-src 'self'");
    expect(rule).toContain("connect-src 'none'");
  });
});
