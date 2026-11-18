// Pure helpers for the signature maker (FEATURE-020): stroke bookkeeping and curve smoothing. No DOM here, so they are unit tested.

export interface Pt { x: number; y: number }
export type Stroke = Pt[];
export type PathCmd = ['M', number, number] | ['L', number, number] | ['Q', number, number, number, number];

/** Logical size of the drawing area. The canvas is shown scaled to the page width. */
export const DRAW_W = 900;
export const DRAW_H = 300;
/** Pen width in drawing-area units. */
export const LINE = 6;
/** Space kept around the ink when the signature is exported. */
export const EXPORT_PAD = 16;

export const FONTS = [
  { id: 'caveat', label: 'Caveat', family: 'Caveat' },
  { id: 'dancing', label: 'Dancing Script', family: 'Dancing Script' },
  { id: 'apple', label: 'Homemade Apple', family: 'Homemade Apple' },
] as const;
export type FontId = (typeof FONTS)[number]['id'];

/** Fonts for the Indian scripts, kept apart from FONTS so the other tools that use FONTS stay as they were. */
export const INDIC_FONTS = [
  { id: 'kalam', label: 'Kalam', family: 'Kalam' },
  { id: 'kavivanar', label: 'Kavivanar', family: 'Kavivanar' },
] as const;
export const ALL_FONTS = [...FONTS, ...INDIC_FONTS] as const;
export type AnyFontId = (typeof ALL_FONTS)[number]['id'];

export type ScriptId = 'latin' | 'devanagari' | 'tamil';
export interface Language { id: string; label: string; script: ScriptId; fonts: readonly AnyFontId[]; /** A short sample in the script: loads the right font file and fills the name box's hint. */ sample: string }
/** English first for the existing tool, then Hindi, Marathi and Tamil. Marathi is written in Devanagari, like Hindi. */
export const LANGUAGES: readonly Language[] = [
  { id: 'en', label: 'English (Latin letters)', script: 'latin', fonts: FONTS.map((f) => f.id), sample: 'Abc' },
  { id: 'hi', label: 'Hindi (हिन्दी)', script: 'devanagari', fonts: ['kalam'], sample: 'रवि कुमार' },
  { id: 'mr', label: 'Marathi (मराठी)', script: 'devanagari', fonts: ['kalam'], sample: 'सुनीता पाटील' },
  { id: 'ta', label: 'Tamil (தமிழ்)', script: 'tamil', fonts: ['kavivanar'], sample: 'சுரேஷ் குமார்' },
];
export const languageById = (id: string): Language => LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];
export const fontsFor = (id: string) => languageById(id).fonts.map((f) => ALL_FONTS.find((a) => a.id === f)!);
export const sampleFor = (id: string): string => languageById(id).sample;

// What each script's font can draw, as Unicode ranges: the script's own block, plus the marks every script shares.
const SHARED = '\\s0-9\\u200c\\u200d.,\\-\'’“”"()/&:;!?';
const OWN: Record<ScriptId, string> = {
  latin: 'A-Za-z\\u00c0-\\u024f',
  devanagari: '\\u0900-\\u097f\\ua8e0-\\ua8ff',
  tamil: '\\u0b80-\\u0bff',
};
const ALLOWED: Record<ScriptId, RegExp> = Object.fromEntries((Object.keys(OWN) as ScriptId[]).map((k) => [k, new RegExp(`^[${OWN[k]}${SHARED}]$`, 'u')])) as Record<ScriptId, RegExp>;
/** Characters of `text` that the chosen script's font cannot draw (letters of another script, symbols), each once, in order of first use. */
export function foreignChars(text: string, script: ScriptId): string[] {
  const seen = new Set<string>();
  for (const ch of text) if (!ALLOWED[script].test(ch)) seen.add(ch);
  return [...seen];
}

export const INKS = [
  { id: 'black', label: 'Black', value: '#111827' },
  { id: 'blue', label: 'Blue', value: '#1e40af' },
] as const;
export type InkId = (typeof INKS)[number]['id'];

export interface Box { x: number; y: number; w: number; h: number }

/** The box around all drawn points, grown by `pad` on every side but never starting before the origin. Null when nothing is drawn. */
export function strokeBounds(strokes: Stroke[], pad: number): Box | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) for (const p of s) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (minX === Infinity) return null;
  const x = Math.max(0, minX - pad), y = Math.max(0, minY - pad);
  return { x, y, w: Math.max(1, maxX + pad - x), h: Math.max(1, maxY + pad - y) };
}

/** Everything but the last stroke. The input is not changed. */
export function undoStroke(strokes: Stroke[]): Stroke[] {
  return strokes.slice(0, -1);
}

/** A single tap: a zero-length line, which a round pen draws as a dot. */
export function dot(p: Pt): PathCmd[] {
  return [['M', p.x, p.y], ['L', p.x, p.y]].map((c) => c as PathCmd);
}

/** Path commands for a stroke: quadratic curves through the midpoints of the sampled points, which removes the corners of a mouse or finger path. */
export function smoothPath(points: Stroke): PathCmd[] {
  if (points.length === 0) return [];
  if (points.length === 1) return dot(points[0]);
  const out: PathCmd[] = [['M', points[0].x, points[0].y]];
  if (points.length === 2) { out.push(['L', points[1].x, points[1].y]); return out; }
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2, my = (points[i].y + points[i + 1].y) / 2;
    out.push(['Q', points[i].x, points[i].y, mx, my]);
  }
  const last = points[points.length - 1];
  out.push(['L', last.x, last.y]);
  return out;
}
