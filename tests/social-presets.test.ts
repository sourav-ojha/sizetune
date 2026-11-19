import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { PLATFORMS, PRESETS, presetsFor } from '../src/data/socialPresets';
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

describe('FEATURE-032: YouTube banner and Instagram no-crop', () => {
  const byId = (id: string) => PRESETS.find((p) => p.id === id);
  it('the YouTube banner uses the size and the 6 MB cap YouTube Help states', () => {
    const b = byId('yt-banner');
    expect(b).toMatchObject({ platform: 'youtube', width: 2560, height: 1440, maxKb: 6000, source: { id: 'yt-branding' } });
    expect(b!.note).toMatch(/2048 by 1152/); // the minimum
    expect(b!.note).toMatch(/1235 by 338/); // the safe area for text and logos
    expect(SOURCES['yt-branding'].url).toBe('https://support.google.com/youtube/answer/10456525');
    expect(b!.width / b!.height).toBeCloseTo(16 / 9, 5);
  });
  it('Instagram no-crop keeps the whole picture: it starts in colour-bars mode, on a size from the same source', () => {
    const n = byId('ig-feed-nocrop');
    expect(n).toMatchObject({ platform: 'instagram', width: 1080, height: 1080, fit: 'pad', source: { id: 'ig-photo' } });
  });
  it('no other preset forces a fit, so the person’s choice is kept when they change size', () => {
    expect(PRESETS.filter((p) => p.fit).map((p) => p.id)).toEqual(['ig-feed-nocrop']);
  });
  it('there is no WhatsApp preset: no official page states a size', () => {
    expect(JSON.stringify(PRESETS).toLowerCase()).not.toContain('whatsapp');
  });
});
