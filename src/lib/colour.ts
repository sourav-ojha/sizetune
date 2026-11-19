// Colour maths for the colour picker (FEATURE-029). Pure functions: no network, no storage, no DOM.

export interface Rgba { r: number; g: number; b: number; a: number }
export interface Hsl { h: number; s: number; l: number }
export interface Point { x: number; y: number }
export interface RectLike { left: number; top: number; width: number; height: number }

/** How many recently picked colours are kept. */
export const MAX_RECENT = 8;

const hex2 = (n: number): string => n.toString(16).toUpperCase().padStart(2, '0');
const alphaText = (a: number): string => String(Math.round((a / 255) * 100) / 100);

/** `#RRGGBB`, or `#RRGGBBAA` when the pixel is not fully opaque. */
export function toHex(p: Rgba): string {
  return `#${hex2(p.r)}${hex2(p.g)}${hex2(p.b)}${p.a === 255 ? '' : hex2(p.a)}`;
}

export function toRgbText(p: Rgba): string {
  return p.a === 255 ? `rgb(${p.r}, ${p.g}, ${p.b})` : `rgba(${p.r}, ${p.g}, ${p.b}, ${alphaText(p.a)})`;
}

/** Hue in degrees, saturation and lightness in whole percent. */
export function rgbToHsl(p: Rgba): Hsl {
  const r = p.r / 255, g = p.g / 255, b = p.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0, l: Math.round(l * 100) };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  return { h: (h + 360) % 360, s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function toHslText(p: Rgba): string {
  const { h, s, l } = rgbToHsl(p);
  return p.a === 255 ? `hsl(${h}, ${s}%, ${l}%)` : `hsla(${h}, ${s}%, ${l}%, ${alphaText(p.a)})`;
}

/** The pixel at x, y in RGBA data that is `width` pixels wide. */
export function pixelAt(data: Uint8ClampedArray, width: number, x: number, y: number): Rgba {
  const i = (y * width + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}

/**
 * The picture pixel under a pointer. `rect` is the canvas as shown (CSS pixels); `width` and `height` are the picture's own pixels, which
 * differ from the shown size on a scaled or high-density display. Points on or beyond an edge are clamped inside. Null for an unmeasured canvas.
 */
export function canvasPoint(rect: RectLike, clientX: number, clientY: number, width: number, height: number): Point | null {
  if (rect.width <= 0 || rect.height <= 0 || width <= 0 || height <= 0) return null;
  const x = Math.floor(((clientX - rect.left) / rect.width) * width);
  const y = Math.floor(((clientY - rect.top) / rect.height) * height);
  return { x: Math.min(width - 1, Math.max(0, x)), y: Math.min(height - 1, Math.max(0, y)) };
}

const ARROWS: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };

/** Moves the picking point by one pixel (ten with Shift) for an arrow key, inside the picture. Null for any other key. */
export function moveByKey(at: Point, key: string, shift: boolean, width: number, height: number): Point | null {
  const step = ARROWS[key];
  if (!step) return null;
  const n = shift ? 10 : 1;
  return { x: Math.min(width - 1, Math.max(0, at.x + step.x * n)), y: Math.min(height - 1, Math.max(0, at.y + step.y * n)) };
}

const same = (a: Rgba, b: Rgba): boolean => a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;

/** A new list with `p` first, any earlier copy of it removed, and at most MAX_RECENT entries. */
export function pushRecent(list: readonly Rgba[], p: Rgba): Rgba[] {
  return [p, ...list.filter((q) => !same(q, p))].slice(0, MAX_RECENT);
}
