import { describe, expect, it } from 'vitest';
import { describeWindow, extForMime, formatBytesExact, formatChange, formatDims, formatKb, formatSize, normalizeHex, suggestFilename } from '../../src/components/tool/format';

describe('size formatting', () => {
  it('uses KB = 1,024 bytes (as the engine does) with exact bytes', () => {
    expect(formatKb(18372)).toBe('17.9 KB');
    expect(formatKb(20000)).toBe('19.5 KB');
    expect(formatKb(112_345)).toBe('110 KB');
    expect(formatKb(1023)).toBe('1,023 bytes');
    expect(formatKb(1_520_000)).toBe('1.45 MB');
    expect(formatSize(18372)).toBe('17.9 KB (18,372 bytes)');
    expect(formatSize(500)).toBe('500 bytes');
    expect(formatBytesExact(20000)).toBe('20,000 bytes');
    expect(formatKb(-1)).toBe('–');
  });
  it('formats dimensions', () => expect(formatDims(1200, 800)).toBe('1,200 × 800 px'));
  it('reports honest change percentages', () => {
    expect(formatChange(100_000, 20_000)).toBe('80% smaller than the original');
    expect(formatChange(100_000, 100_000)).toBe('same size as the original');
    expect(formatChange(10_000, 15_000)).toBe('50% larger than the original');
    expect(formatChange(100_000, 99_999)).toBe('less than 1% smaller than the original');
    expect(formatChange(100_000, 100_001)).toBe('less than 1% larger than the original');
    expect(formatChange(0, 5)).toBe('');
  });
  it('describes the KB basis of the byte window', () => {
    expect(describeWindow({ minBytes: null, maxBytes: 20000 }, undefined, 20)).toBe('Aimed for under 20,000 bytes (maximum: 20 × 1,000 bytes)');
    expect(describeWindow({ minBytes: 10240, maxBytes: 20000 }, 10, 20)).toBe('Aimed for between 10,240 and 20,000 bytes (maximum: 20 × 1,000 bytes, minimum: 10 × 1,024 bytes)');
    expect(describeWindow({ minBytes: 10240, maxBytes: null }, 10)).toBe('Aimed for at least 10,240 bytes (minimum: 10 × 1,024 bytes)');
    expect(describeWindow({ minBytes: null, maxBytes: null })).toBe('');
  });
});

describe('filenames', () => {
  it('maps mime to extension', () => {
    expect(extForMime('image/jpeg')).toBe('jpg');
    expect(extForMime('image/webp')).toBe('webp');
    expect(extForMime('image/png')).toBe('png');
  });
  it('suggests a safe name with the new extension', () => {
    expect(suggestFilename('photo.png', 'image/jpeg')).toBe('photo-sizetune.jpg');
    expect(suggestFilename('my holiday.final.HEIC', 'image/webp')).toBe('my-holiday.final-sizetune.webp');
    expect(suggestFilename('C:\\fakepath\\sig.jpeg', 'image/png')).toBe('sig-sizetune.png');
    expect(suggestFilename('../../etc/passwd', 'image/jpeg')).toBe('passwd-sizetune.jpg');
    expect(suggestFilename('', 'image/jpeg')).toBe('image-sizetune.jpg');
    expect(suggestFilename('.png', 'image/jpeg')).toBe('png-sizetune.jpg');
    expect(suggestFilename('a<b>:c.png', 'image/png')).toBe('abc-sizetune.png');
    expect(suggestFilename('x'.repeat(200) + '.png', 'image/png').length).toBeLessThan(80);
  });
  it('normalizes hex colours', () => {
    expect(normalizeHex('#AABBCC')).toBe('#aabbcc');
    expect(normalizeHex('aabbcc')).toBe('#aabbcc');
    expect(normalizeHex('#abc')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
  });
});

import { formatCap } from '../../src/components/tool/format';
describe('formatCap', () => { it('shows the cap in MB', () => { expect(formatCap(25 * 1024 * 1024)).toBe('25 MB'); expect(formatCap(1.5 * 1024 * 1024)).toBe('1.5 MB'); }); });
