import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { PLATFORMS, presetsFor } from '../src/data/socialPresets';
import { SOURCES } from '../src/data/socialSources';

const all = PLATFORMS.flatMap((p) => presetsFor(p.id));

describe('social presets (FEATURE-009 AC-5, FR-4)', () => {
  it('every preset has valid pixels, a platform help-page source and an ISO checked date', () => {
    expect(all.length).toBeGreaterThanOrEqual(8);
    for (const p of all) {
      expect(Number.isInteger(p.width) && Number.isInteger(p.height) && p.width > 0 && p.height > 0, p.id).toBe(true);
      expect(SOURCES[p.source.id]?.url, p.id).toMatch(/^https:\/\/(help\.instagram\.com|www\.linkedin\.com\/help|support\.google\.com)\//);
      expect(p.checkedOn, p.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.note.length, p.id).toBeGreaterThan(10);
    }
  });
  it('preset ids are unique, and a byte cap is only set where the platform publishes one', () => {
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    for (const p of all) if (p.maxKb !== undefined) expect(p.platform, p.id).toBe('youtube');
  });
});

describe('page count cap (AC-3)', () => {
  it('has no more than 5 social-resizer pages', () => {
    const pages = readdirSync('src/pages').filter((f) => /-(image-resizer|thumbnail-resizer)\.astro$/.test(f));
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pages.length).toBeLessThanOrEqual(5);
    expect(PLATFORMS.length).toBeLessThanOrEqual(5);
  });
});

describe('tool pages carry no third-party URL (privacy gate)', () => {
  it('the presets module, which the tool bundle imports, contains no http URL', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/data/socialPresets.ts', 'utf8')).not.toMatch(/https?:\/\//);
  });
});
