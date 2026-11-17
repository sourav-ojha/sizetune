import type { IconMode } from '../../data/iconSets';

/** The HTML to paste into a page's head. Only files the mode really produces are referenced. */
export function buildSnippet(mode: IconMode): string {
  if (mode === 'favicon') {
    return [
      '<link rel="icon" href="/favicon.ico" sizes="any">',
      '<link rel="icon" href="/favicon-96x96.png" type="image/png" sizes="96x96">',
    ].join('\n');
  }
  return [
    '<link rel="manifest" href="/site.webmanifest">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  ].join('\n');
}
