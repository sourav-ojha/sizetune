import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { detectKind } from '../src/lib/avif';

const fx = (n: string) => new Uint8Array(readFileSync(`tests/fixtures/${n}`));
/** An ISO box `ftyp` with the given major and compatible brands. */
const ftyp = (major: string, compat: string[] = []) => {
  const body = [major, '\0\0\0\0', ...compat].join('');
  const size = 8 + body.length;
  return Uint8Array.from([0, 0, (size >> 8) & 255, size & 255, ...'ftyp'.split('').map((c) => c.charCodeAt(0)), ...body.split('').map((c) => c.charCodeAt(0))]);
};

describe('detectKind', () => {
  it('recognises real files', () => {
    expect(detectKind(fx('two-tone-64x48.avif'))).toBe('avif');
    expect(detectKind(fx('animated-64x48.avif'))).toBe('avif-animated');
    expect(detectKind(fx('two-tone.jfif'))).toBe('jpeg'); // a JFIF file is a JPEG
    expect(detectKind(fx('tiny-1x1.png'))).toBe('png');
    expect(detectKind(fx('photo-800x600.webp'))).toBe('webp');
  });
  it('finds AVIF through the compatible brands, and animation through avis', () => {
    expect(detectKind(ftyp('mif1', ['miaf', 'avif']))).toBe('avif');
    expect(detectKind(ftyp('msf1', ['avif', 'avis']))).toBe('avif-animated');
  });
  it('does not call HEIC or other ISO media AVIF', () => {
    expect(detectKind(ftyp('heic', ['mif1', 'heic']))).toBe('heic');
    expect(detectKind(ftyp('mif1', ['heic']))).toBe('heic');
    expect(detectKind(ftyp('mp42', ['isom']))).toBe('other');
  });
  it('is safe on short, empty and truncated input', () => {
    expect(detectKind(new Uint8Array())).toBe('other');
    expect(detectKind(new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79]))).toBe('other');
    expect(detectKind(fx('two-tone-64x48.avif').slice(0, 10))).toBe('other');
    expect(detectKind(new Uint8Array([0, 0, 0, 4, ...'ftypavif'.split('').map((c) => c.charCodeAt(0))]))).toBe('avif'); // a box size too small to hold brands: the major brand still counts
  });
  it('ignores the file name: only the bytes decide', () => {
    expect(detectKind(new TextEncoder().encode('just some text, not a picture'))).toBe('other');
  });
});
