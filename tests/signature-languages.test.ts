import { describe, it, expect } from 'vitest';
import { LANGUAGES, ALL_FONTS, FONTS, fontsFor, languageById, foreignChars, sampleFor } from '../src/lib/signature-maker';

describe('languages (FR-1)', () => {
  it('lists Hindi, Marathi and Tamil first after English, in that order, with a script each', () => {
    expect(LANGUAGES.map((l) => l.id)).toEqual(['en', 'hi', 'mr', 'ta']);
    expect(LANGUAGES.map((l) => l.script)).toEqual(['latin', 'devanagari', 'devanagari', 'tamil']);
  });
  it('every language has at least one font, and every font it names exists once', () => {
    expect(new Set(ALL_FONTS.map((f) => f.id)).size).toBe(ALL_FONTS.length);
    for (const l of LANGUAGES) {
      expect(l.fonts.length, l.id).toBeGreaterThan(0);
      for (const id of l.fonts) expect(ALL_FONTS.some((f) => f.id === id), `${l.id} ${id}`).toBe(true);
    }
  });
  it('English keeps exactly the three Latin fonts the maker already had', () => {
    expect(fontsFor('en').map((f) => f.id)).toEqual(FONTS.map((f) => f.id));
  });
  it('Hindi and Marathi share a Devanagari font and Tamil has its own', () => {
    expect(fontsFor('hi').map((f) => f.id)).toEqual(['kalam']);
    expect(fontsFor('mr').map((f) => f.id)).toEqual(['kalam']);
    expect(fontsFor('ta').map((f) => f.id)).toEqual(['kavivanar']);
  });
  it('an unknown language falls back to English instead of throwing', () => {
    expect(languageById('xx').id).toBe('en');
    expect(fontsFor('xx')).toHaveLength(FONTS.length);
  });
});

describe('foreignChars: mixed scripts (edge case)', () => {
  it('accepts a name in its own script, with spaces, digits, dots and joiners', () => {
    expect(foreignChars('रवि कुमार', 'devanagari')).toEqual([]);
    expect(foreignChars('रवि. कु 2', 'devanagari')).toEqual([]);
    expect(foreignChars('क्‍ष', 'devanagari')).toEqual([]); // zero-width joiner inside a conjunct
    expect(foreignChars('रवि ॥', 'devanagari')).toEqual([]); // danda
    expect(foreignChars('சுரேஷ் குமார்', 'tamil')).toEqual([]);
    expect(foreignChars('Anna Marie-José', 'latin')).toEqual([]);
  });
  it('lists letters from another script once each, in order', () => {
    expect(foreignChars('Ravi रवि', 'devanagari')).toEqual(['R', 'a', 'v', 'i']);
    expect(foreignChars('रवி கு', 'devanagari')).toEqual(['ி', 'க', 'ு']); // Tamil marks inside a Devanagari name
    expect(foreignChars('Ravi', 'tamil')).toEqual(['R', 'a', 'v', 'i']);
    expect(foreignChars('रवि', 'latin')).toEqual(['र', 'व', 'ि']);
  });
  it('is empty for empty text', () => {
    expect(foreignChars('', 'tamil')).toEqual([]);
  });
});

describe('sampleFor: a sample in the script, used to load the right font file', () => {
  it('is in the language’s own script', () => {
    expect(sampleFor('hi')).toMatch(/[ऀ-ॿ]/);
    expect(sampleFor('mr')).toMatch(/[ऀ-ॿ]/);
    expect(sampleFor('ta')).toMatch(/[஀-௿]/);
    expect(sampleFor('en')).toMatch(/[A-Za-z]/);
  });
});
