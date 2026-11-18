// Pure helpers for the photo caption tool (FEATURE-023): date text, caption lines and the layout of the strip. No DOM, so they are unit tested.

export type DateStyleId = 'dmy-slash' | 'dmy-dash' | 'mdy-slash' | 'd-mon-y' | 'iso' | 'typed';
export const DATE_STYLES: Array<{ id: DateStyleId; label: string }> = [
  { id: 'dmy-slash', label: 'Day/Month/Year, like 07/03/2024' },
  { id: 'dmy-dash', label: 'Day-Month-Year, like 07-03-2024' },
  { id: 'mdy-slash', label: 'Month/Day/Year, like 03/07/2024' },
  { id: 'd-mon-y', label: 'Day Mon Year, like 07 Mar 2024' },
  { id: 'iso', label: 'Year-Month-Day, like 2024-03-07' },
  { id: 'typed', label: 'Type it myself' },
];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The date as text. A picked date is `YYYY-MM-DD`; in the "typed" style the text is used as typed. Empty for an impossible date. */
export function formatDate(value: string, style: DateStyleId): string {
  if (style === 'typed') return value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return '';
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) return '';
  const dd = m[3], mm = m[2];
  switch (style) {
    case 'dmy-slash': return `${dd}/${mm}/${y}`;
    case 'dmy-dash': return `${dd}-${mm}-${y}`;
    case 'mdy-slash': return `${mm}/${dd}/${y}`;
    case 'd-mon-y': return `${dd} ${MON[mo - 1]} ${y}`;
    case 'iso': return `${m[1]}-${mm}-${dd}`;
  }
}

/** The caption as one line ("name   date") or two stacked lines. An empty field is left out. */
export function captionLines(name: string, date: string, lines: 'one' | 'two'): string[] {
  const parts = [name.trim(), date.trim()].filter((p) => p !== '');
  return lines === 'one' && parts.length > 1 ? [parts.join('   ')] : parts;
}

/** Allowed range of the strip height and of the text size, both as a percentage of the photo height. */
export const STRIP_RANGE: [number, number] = [5, 40];
export const TEXT_RANGE: [number, number] = [2, 15];

export type Placement = 'below' | 'over';
export interface LayoutIn { photoW: number; photoH: number; placement: Placement; stripPct: number; textPct: number; lines: number }
export interface Layout { canvasW: number; canvasH: number; stripY: number; stripH: number; fontPx: number }

const clamp = (v: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));

/** Canvas size, where the strip starts, its height and the font size wanted. "below" adds the strip under the photo; "over" draws it on the photo's bottom edge. */
export function layoutCaption(i: LayoutIn): Layout {
  const stripH = Math.round((i.photoH * clamp(i.stripPct, STRIP_RANGE)) / 100);
  const fontPx = Math.max(1, Math.round((i.photoH * clamp(i.textPct, TEXT_RANGE)) / 100));
  const canvasH = i.placement === 'below' ? i.photoH + stripH : i.photoH;
  return { canvasW: i.photoW, canvasH, stripY: canvasH - stripH, stripH, fontPx };
}

/** The wanted font size, reduced until `measure(px)` (the text width at that size) fits in `maxW`. Never below `min`. */
export function fitFont(measure: (px: number) => number, maxW: number, want: number, min = 8): number {
  const w = measure(want);
  if (w <= maxW) return want;
  return Math.max(min, Math.floor((want * maxW) / w));
}
