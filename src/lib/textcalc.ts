// Text counting, case conversion and filler text for the text workbench (FEATURE-017).
// Pure functions: no network, no storage. Segmentation uses Intl.Segmenter where the browser has it and falls back to simple rules.

export interface Counts { words: number; characters: number; charactersNoSpaces: number; sentences: number; paragraphs: number }

type SegmenterCtor = new (locale?: string, o?: { granularity: 'grapheme' | 'word' }) => { segment(s: string): Iterable<{ segment: string; isWordLike?: boolean }> };
const Seg: SegmenterCtor | undefined = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;

/** Scripts written without spaces between words: a whitespace-separated chunk can hold several words. */
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
const HAS_WORD_CHAR = /[\p{L}\p{N}]/u;

function countGraphemes(text: string): number {
  if (!Seg) return Array.from(text).length;
  let n = 0;
  for (const _ of new Seg(undefined, { granularity: 'grapheme' }).segment(text)) n++; // eslint-disable-line @typescript-eslint/no-unused-vars
  return n;
}

function countWords(text: string): number {
  let n = 0;
  for (const chunk of text.split(/\s+/)) {
    if (!HAS_WORD_CHAR.test(chunk)) continue; // punctuation on its own is not a word
    if (Seg && UNSPACED.test(chunk)) {
      let k = 0;
      for (const s of new Seg(undefined, { granularity: 'word' }).segment(chunk)) if (s.isWordLike) k++;
      n += Math.max(k, 1);
    } else n += 1;
  }
  return n;
}

/** Words, characters (as a reader sees them, so an emoji or a letter plus accent counts once), sentences and paragraphs. */
export function countText(text: string): Counts {
  if (text === '') return { words: 0, characters: 0, charactersNoSpaces: 0, sentences: 0, paragraphs: 0 };
  return {
    words: countWords(text),
    characters: countGraphemes(text),
    charactersNoSpaces: countGraphemes(text.replace(/\s+/gu, '')),
    sentences: (text.match(/[^.!?\s][^.!?]*[.!?]+(?=\s|$)|[^.!?\s][^.!?]*$/gu) ?? []).filter((s) => HAS_WORD_CHAR.test(s)).length,
    paragraphs: text.split(/\n\s*\n/u).filter((p) => HAS_WORD_CHAR.test(p)).length,
  };
}

export type CaseKind = 'upper' | 'lower' | 'title' | 'sentence';

const upFirst = (s: string): string => { const [c = '', ...rest] = Array.from(s); return c.toUpperCase() + rest.join(''); };

/** Converts case by the rule of the chosen option. Letters from any script that has case are handled; everything else is left as typed. */
export function convertCase(text: string, kind: CaseKind): string {
  switch (kind) {
    case 'upper': return text.toUpperCase();
    case 'lower': return text.toLowerCase();
    case 'title': return text.replace(/[\p{L}\p{M}][\p{L}\p{M}\p{N}'’]*/gu, (w) => upFirst(w.toLowerCase()));
    case 'sentence': return text.toLowerCase().replace(/(^|[.!?]\s+)(\p{L})/gu, (_m, lead: string, c: string) => lead + c.toUpperCase());
  }
}

export type FillerUnit = 'words' | 'sentences' | 'characters';
/** Upper limits keep the page responsive. A larger request is shortened to the limit. */
export const FILLER_MAX: Record<FillerUnit, number> = { words: 5000, sentences: 500, characters: 50_000 };

// Plain, neutral words. Fixed order, so the same request always gives the same text.
const WORDS = ('river stone window morning garden paper silver bridge harvest lantern meadow thunder copper ribbon valley orchard compass blanket mountain ' +
  'whisper candle harbor feather journey kettle pebble sunrise anchor basket cedar drift ember fable glacier hollow island jasper knot lagoon maple north ' +
  'oasis path quiet ridge shadow timber umber velvet willow yarn zephyr amber brook cliff dune echo field grove haze iris').split(' ');

const word = (i: number): string => WORDS[(i * 7 + (i >> 3)) % WORDS.length];

function sentence(k: number, startWord: number): { text: string; used: number } {
  const len = 8 + ((k * 5) % 7);
  const ws = Array.from({ length: len }, (_, j) => word(startWord + j));
  return { text: upFirst(ws.join(' ')) + '.', used: len };
}

/** Neutral filler text with exactly the requested number of words, sentences or characters. Invalid or non-positive requests give ''. */
export function generateFiller(unit: FillerUnit, amount: number): string {
  const n = Math.min(Math.floor(amount), FILLER_MAX[unit]);
  if (!Number.isFinite(n) || n < 1) return '';
  if (unit === 'words') {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(word(i));
    return out.join(' ');
  }
  const out: string[] = [];
  let used = 0, k = 0, chars = 0;
  while (unit === 'sentences' ? k < n : chars < n) {
    const s = sentence(k++, used);
    used += s.used;
    out.push(s.text);
    chars += s.text.length + 1;
  }
  if (unit === 'sentences') return out.join(' ');
  const joined = out.join(' ').slice(0, n);
  return joined.endsWith(' ') ? joined.slice(0, -1) + '.' : joined;
}
