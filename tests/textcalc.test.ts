import { describe, it, expect } from 'vitest';
import { countText, convertCase, generateFiller, FILLER_MAX } from '../src/lib/textcalc';

describe('countText (AC-1)', () => {
  it('matches a fixture: words, characters with and without spaces, sentences, paragraphs', () => {
    const text = 'The quick brown fox.  It jumped over the lazy dog!\n\nIsn\'t that well-known?';
    expect(countText(text)).toEqual({ words: 13, characters: 74, charactersNoSpaces: 60, sentences: 3, paragraphs: 2 });
  });
  it('is all zeros for empty or whitespace-only text', () => {
    const zero = { words: 0, characters: 0, charactersNoSpaces: 0, sentences: 0, paragraphs: 0 };
    expect(countText('')).toEqual(zero);
    expect(countText('  \n\t ').characters).toBe(5);
    expect(countText('  \n\t ').words).toBe(0);
  });
  it('counts a user-perceived character once (emoji, combining accents)', () => {
    expect(countText('é').characters).toBe(1);
    expect(countText('👍🏽').characters).toBe(1);
    expect(countText('a b').charactersNoSpaces).toBe(2);
  });
  it('counts words in scripts written without spaces (FR-6)', () => {
    expect(countText('今天天气很好').words).toBeGreaterThan(1);
    expect(countText('नमस्ते दुनिया').words).toBe(2);
  });
  it('does not count punctuation alone as a word', () => {
    expect(countText('well - - done').words).toBe(2);
  });
});

describe('convertCase (AC-2)', () => {
  it('upper and lower follow accented letters', () => {
    expect(convertCase('école Élan', 'upper')).toBe('ÉCOLE ÉLAN');
    expect(convertCase('ÉCOLE ÉLAN', 'lower')).toBe('école élan');
  });
  it('title case capitalises each word and keeps apostrophes inside a word', () => {
    expect(convertCase("dON'T stop élan vital", 'title')).toBe("Don't Stop Élan Vital");
  });
  it('sentence case capitalises the first letter after each sentence end only', () => {
    expect(convertCase('HELLO there. how ARE you? fine! école', 'sentence')).toBe('Hello there. How are you? Fine! École');
  });
  it('leaves digits, punctuation and line breaks alone', () => {
    expect(convertCase('a1\nb2', 'upper')).toBe('A1\nB2');
    expect(convertCase('', 'title')).toBe('');
  });
});

describe('generateFiller (AC-3)', () => {
  it('produces exactly the requested number of words', () => {
    for (const n of [1, 7, 100]) expect(countText(generateFiller('words', n)).words).toBe(n);
  });
  it('produces exactly the requested number of sentences', () => {
    for (const n of [1, 3, 12]) expect(countText(generateFiller('sentences', n)).sentences).toBe(n);
  });
  it('produces exactly the requested number of characters', () => {
    for (const n of [1, 40, 500]) expect([...generateFiller('characters', n)].length).toBe(n);
  });
  it('is the same every time for the same request', () => {
    expect(generateFiller('words', 30)).toBe(generateFiller('words', 30));
  });
  it('clamps absurd or invalid requests instead of freezing the page', () => {
    expect(countText(generateFiller('words', 10_000_000)).words).toBe(FILLER_MAX.words);
    expect(generateFiller('words', 0)).toBe('');
    expect(generateFiller('words', Number.NaN)).toBe('');
    expect(generateFiller('words', -4)).toBe('');
  });
  it('never contains the placeholder phrase the site checks forbid', () => {
    expect(generateFiller('characters', 5000).toLowerCase()).not.toContain('lorem ipsum');
  });
});
