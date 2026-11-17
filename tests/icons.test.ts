import { describe, it, expect } from 'vitest';
import { unzipSync } from 'fflate';
import { readdirSync, readFileSync } from 'node:fs';
import { buildIco, readIcoDirectory } from '../src/components/icons/ico';
import { buildManifest } from '../src/components/icons/manifest';
import { buildSnippet } from '../src/components/icons/snippet';
import { ICON_MODES, filesFor } from '../src/data/iconSets';
import { crc32, makeZip, uniqueNames } from '../src/lib/zip';
import { safeBox } from '../src/components/icons/render';

const png = (n: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, n, n, n, n]);

describe('ICO builder (FEATURE-010 AC-1)', () => {
  it('writes a valid ICONDIR with PNG payloads at the right offsets', () => {
    const ico = buildIco([{ size: 16, data: png(1) }, { size: 32, data: png(2) }, { size: 48, data: png(3) }]);
    const dir = readIcoDirectory(ico);
    expect(dir.map((e) => [e.width, e.height])).toEqual([[16, 16], [32, 32], [48, 48]]);
    expect(ico[0]).toBe(0); expect(ico[2]).toBe(1); expect(ico[4]).toBe(3); // reserved 0, type 1 (icon), count 3
    for (const [i, e] of dir.entries()) expect(Array.from(ico.subarray(e.offset, e.offset + e.bytes))).toEqual(Array.from(png(i + 1)));
  });
  it('stores 256 as 0 in the one-byte width and height fields', () => {
    const dir = readIcoDirectory(buildIco([{ size: 256, data: png(9) }]));
    expect(dir[0]).toMatchObject({ width: 256, height: 256 });
  });
  it('rejects an empty set and sizes above 256', () => {
    expect(() => buildIco([])).toThrow();
    expect(() => buildIco([{ size: 512, data: png(1) }])).toThrow();
  });
});

describe('manifest and snippet (AC-2)', () => {
  const icons = [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }];
  it('is valid JSON with the fields browsers read', () => {
    const m = JSON.parse(buildManifest({ name: 'My App', backgroundColor: '#112233', icons }));
    expect(m).toMatchObject({ name: 'My App', short_name: 'My App', background_color: '#112233', theme_color: '#112233', display: 'standalone', start_url: '/' });
    expect(m.icons).toEqual(icons);
  });
  it('shortens a long name for short_name and escapes odd characters safely', () => {
    const m = JSON.parse(buildManifest({ name: 'A very long application name "quoted" <x>', backgroundColor: '#ffffff', icons }));
    expect(m.short_name.length).toBeLessThanOrEqual(12);
    expect(m.name).toContain('"quoted"');
  });
  it('snippet links the files that exist in the mode', () => {
    for (const mode of ICON_MODES) {
      const files = filesFor(mode.id).map((f) => f.file);
      const s = buildSnippet(mode.id);
      for (const m of s.matchAll(/(?:href)="\/([^"]+)"/g)) expect(files, `${mode.id}: ${m[1]}`).toContain(m[1]);
    }
  });
});

describe('size lists (FR-7, AC-3)', () => {
  it('two modes of ONE tool, every file has a source note and valid pixels', () => {
    expect(ICON_MODES.map((m) => m.id)).toEqual(['favicon', 'app']);
    for (const m of ICON_MODES) for (const f of filesFor(m.id)) {
      expect(f.file).toMatch(/\.(png|ico|webmanifest)$/);
      if (f.kind !== 'manifest') expect(f.size).toBeGreaterThan(0);
      expect(['official', 'convention']).toContain(f.source.type);
      expect(f.note.length).toBeGreaterThan(10);
    }
  });
  it('official-source files cite a source id; no URL in the data the tool bundle imports', () => {
    expect(readFileSync('src/data/iconSets.ts', 'utf8')).not.toMatch(/https?:\/\//);
  });
  it('there is a single icon tool page, not one page per mode', () => {
    const pages = readdirSync('src/pages').filter((f) => /favicon|app-icon/.test(f));
    expect(pages).toEqual(['favicon-generator.astro']);
  });
});

describe('ZIP (AC-2, FEATURE-005 AC-3)', () => {
  it('round-trips files and stores them without compression', () => {
    const z = makeZip([{ name: 'a.png', data: png(1) }, { name: 'b/c.txt', data: new TextEncoder().encode('hi') }]);
    const back = unzipSync(z);
    expect(Object.keys(back).sort()).toEqual(['a.png', 'b/c.txt']);
    expect(Array.from(back['a.png'])).toEqual(Array.from(png(1)));
    expect(new TextDecoder().decode(back['b/c.txt'])).toBe('hi');
  });
  it('makes duplicate names unique with a numeric suffix, keeping the extension', () => {
    expect(uniqueNames(['photo.jpg', 'photo.jpg', 'sig.png', 'photo.jpg'])).toEqual(['photo.jpg', 'photo-2.jpg', 'sig.png', 'photo-3.jpg']);
  });
  it('never hands out the same name twice, even when a suffixed name is already taken (review M1)', () => {
    expect(uniqueNames(['photo.jpg', 'photo.jpg', 'photo-2.jpg'])).toEqual(['photo.jpg', 'photo-2.jpg', 'photo-2-2.jpg']);
    const names = uniqueNames(['a.png', 'a-2.png', 'a.png', 'a.png', 'a-2.png']);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
  });
  it('computes the standard CRC-32 and writes a ZIP that an independent reader accepts, including empty and larger files', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    const big = new Uint8Array(200_000).map((_, i) => (i * 31) % 251);
    const z = makeZip([{ name: 'empty.txt', data: new Uint8Array(0) }, { name: 'big.bin', data: big }, { name: 'ünï.txt', data: new TextEncoder().encode('é') }]);
    const back = unzipSync(z);
    expect(back['empty.txt'].length).toBe(0);
    expect(Array.from(back['big.bin'].subarray(0, 1000))).toEqual(Array.from(big.subarray(0, 1000)));
    expect(back['big.bin'].length).toBe(200_000);
    expect(new TextDecoder().decode(back['ünï.txt'])).toBe('é');
  });
  it('strips path separators from names so a file cannot escape the archive folder', () => {
    expect(uniqueNames(['../../evil.png', 'a/b.png'])).toEqual(['evil.png', 'b.png']);
  });
});

describe('maskable safe area (review M4)', () => {
  it('keeps a square logo inside the central circle of radius 40% so a circular mask cannot clip its corners', () => {
    for (const size of [192, 512]) {
      const b = safeBox(size);
      const half = b.s / 2;
      const cornerFromCentre = Math.hypot(half, half);
      expect(cornerFromCentre / size).toBeLessThanOrEqual(0.4 + 0.005);
      expect(Math.abs(b.x * 2 + b.s - size)).toBeLessThanOrEqual(1); // centred to the pixel
    }
  });
});
