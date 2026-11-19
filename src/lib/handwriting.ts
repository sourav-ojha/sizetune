// Text to handwriting (FEATURE-038): line wrapping, pages and paper maths. Pure functions; the canvas drawing is in the island.

/** Page size in pixels: A4 at 150 dots per inch. */
export const PAGE_W = 1240;
export const PAGE_H = 1754;
/** Most characters accepted, and most pages made. */
export const MAX_CHARS = 5000;
export const MAX_PAGES = 10;

export type SizeId = 'small' | 'medium' | 'large';
export const SIZES: ReadonlyArray<{ id: SizeId; label: string; fontPx: number }> = [
  { id: 'small', label: 'Small', fontPx: 32 },
  { id: 'medium', label: 'Medium', fontPx: 40 },
  { id: 'large', label: 'Large', fontPx: 54 },
];
export const sizeFor = (id: SizeId): number => SIZES.find((s) => s.id === id)!.fontPx;

export type PaperId = 'plain' | 'ruled' | 'grid';
export const PAPERS: ReadonlyArray<{ id: PaperId; label: string }> = [
  { id: 'plain', label: 'Plain' },
  { id: 'ruled', label: 'Ruled' },
  { id: 'grid', label: 'Squared' },
];

export interface Geometry { fontPx: number; lineH: number; left: number; right: number; top: number; bottomMin: number; textW: number; perPage: number }

/** Where text goes on a page for a font size: margins, line height and how many lines fit. */
export function pageGeometry(fontPx: number): Geometry {
  const lineH = Math.round(fontPx * 1.5);
  const left = 150, right = 90, top = 150, bottomMin = 110;
  const perPage = Math.floor((PAGE_H - top - bottomMin) / lineH);
  return { fontPx, lineH, left, right, top, bottomMin, textW: PAGE_W - left - right, perPage };
}

/** Distance of the ruled line below the top of its text line (the baseline sits a little above it). */
const RULE_GAP = 0.22;
/** Y position of each ruled line on a page. */
export function ruleYs(g: Geometry): number[] {
  return Array.from({ length: g.perPage }, (_, i) => baselineY(g, i));
}
/** Y position of the baseline of text line `i` on a page (the same spot the ruled line is drawn at). */
export const baselineY = (g: Geometry, i: number): number => Math.round(g.top + (i + 1) * g.lineH - g.lineH * RULE_GAP);

/**
 * Breaks text into lines no wider than `maxWidth` as measured by `measure`. Keeps the author's line breaks, breaks at spaces,
 * and splits a single word that is wider than a line (by whole characters, so a pair like an emoji stays together).
 */
export function wrapText(text: string, measure: (s: string) => number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\r\n?/g, '\n').split('\n')) {
    const words = para.split(/ +/).filter((w) => w !== '');
    if (words.length === 0) { out.push(''); continue; }
    let line = '';
    const flush = () => { if (line !== '') out.push(line); line = ''; };
    for (const word of words) {
      const tryLine = line === '' ? word : `${line} ${word}`;
      if (measure(tryLine) <= maxWidth) { line = tryLine; continue; }
      flush();
      if (measure(word) <= maxWidth) { line = word; continue; }
      let piece = '';
      for (const ch of word) { // for..of walks code points, so surrogate pairs stay whole
        if (piece !== '' && measure(piece + ch) > maxWidth) { out.push(piece); piece = ch; } else piece += ch;
      }
      line = piece;
    }
    flush();
  }
  return out.length ? out : [''];
}

/** Splits lines into pages of `perPage` lines, at most MAX_PAGES. A page never starts with a blank line. */
export function paginate(lines: string[], perPage: number): { pages: string[][]; truncated: boolean } {
  const pages: string[][] = [];
  let cur: string[] = [];
  let truncated = false;
  for (const l of lines) {
    if (cur.length === perPage) { pages.push(cur); cur = []; }
    if (cur.length === 0 && l === '' && pages.length > 0) continue;
    if (pages.length === MAX_PAGES) { truncated = true; break; }
    cur.push(l);
  }
  if (!truncated && (cur.length > 0 || pages.length === 0)) pages.push(cur.length ? cur : ['']);
  else if (truncated && cur.length > 0 && pages.length < MAX_PAGES) pages.push(cur);
  return { pages: pages.slice(0, MAX_PAGES), truncated };
}

// The Unicode ranges the shipped handwriting fonts (latin subsets) draw. Anything else is drawn in a plain fallback font.
const COVERED = /^[ -~ -ÿıŒœʻʼˆ˚˜ -⁯⁴€™↑↓−∕﻿�]$/u;
/** Characters of `text` the handwriting fonts cannot draw, each listed once in order of first use. Line breaks and tabs do not count. */
export function unsupportedChars(text: string): string[] {
  const seen = new Set<string>();
  for (const ch of text) {
    if (ch === '\n' || ch === '\r' || ch === '\t') continue;
    if (!COVERED.test(ch)) seen.add(ch);
  }
  return [...seen];
}
