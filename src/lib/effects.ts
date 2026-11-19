// Pixel effects, border size and logo placement for the photo effects tool (FEATURE-028). Pure functions on plain pixel buffers (no DOM), so they are unit tested.
import { pixelate, rectMask } from './redact';

export interface Pixels { width: number; height: number; data: Uint8ClampedArray }
export interface Box { x: number; y: number; w: number; h: number }

/** Grey shades: red, green and blue all set to the pixel's brightness (Rec. 601 weights). Transparency is left alone. */
export function grayscale(img: Pixels): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const y = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114); d[i] = d[i + 1] = d[i + 2] = y; }
}

/** Pure black and pure white only: a pixel brighter than `threshold` (0 to 255) becomes white, anything else black. */
export function blackAndWhite(img: Pixels, threshold: number): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const y = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; const v = y > threshold ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; }
}

/** Limits every channel to `levels` evenly spaced values, from 0 to 255 (2 gives 0 and 255; 256 changes nothing). */
export function posterize(img: Pixels, levels: number): void {
  const n = Math.round(levels);
  if (!(n >= 2) || n >= 256) return;
  const step = 255 / (n - 1), d = img.data;
  for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = Math.round(Math.round(d[i + c] / step) * step);
}

/** Chunky "pixel art": flat blocks over the whole picture, then a small palette. */
export function pixelArt(img: Pixels, block: number, levels: number): void {
  const b = Math.round(block);
  if (b > 1) {
    const full = rectMask(img.width, img.height, { x: 0, y: 0, w: img.width, h: img.height });
    pixelate(img, full, b);
  }
  posterize(img, levels);
}

/** Largest border, in pixels, that is offered. */
export const BORDER_MAX_PX = 500;

/** The picture plus a border of `px` pixels on every side. The border is a whole number between 0 and BORDER_MAX_PX. */
export function borderedSize(w: number, h: number, px: number): { w: number; h: number; b: number } {
  const b = Number.isFinite(px) ? Math.min(BORDER_MAX_PX, Math.max(0, Math.round(px))) : 0;
  return { w: w + 2 * b, h: h + 2 * b, b };
}

export type LogoPosition = 'tl' | 'tr' | 'bl' | 'br' | 'center';
/** Logo width as a percentage of the picture's width. */
export const LOGO_SIZE_RANGE_PCT: [number, number] = [5, 60];

/** Where the logo goes: its width is `sizePct` of the canvas width, at its own shape, `marginPct` of the shorter side away from the edge. Always inside the canvas. */
export function logoBox(i: { canvas: { w: number; h: number }; logo: { w: number; h: number }; position: LogoPosition; sizePct: number; marginPct: number }): Box {
  const pct = Math.min(LOGO_SIZE_RANGE_PCT[1], Math.max(LOGO_SIZE_RANGE_PCT[0], Number.isFinite(i.sizePct) ? i.sizePct : LOGO_SIZE_RANGE_PCT[0]));
  let w = Math.max(1, Math.round((i.canvas.w * pct) / 100)), h = Math.max(1, Math.round((w * i.logo.h) / i.logo.w));
  if (h > i.canvas.h) { h = i.canvas.h; w = Math.max(1, Math.min(i.canvas.w, Math.round((h * i.logo.w) / i.logo.h))); } // a very tall logo is limited by the height instead
  w = Math.min(w, i.canvas.w); h = Math.min(h, i.canvas.h);
  const m = Math.round((Math.min(i.canvas.w, i.canvas.h) * Math.min(25, Math.max(0, Number.isFinite(i.marginPct) ? i.marginPct : 0))) / 100);
  const right = Math.max(0, i.canvas.w - w - m), bottom = Math.max(0, i.canvas.h - h - m);
  const clampX = (x: number) => Math.max(0, Math.min(i.canvas.w - w, x)), clampY = (y: number) => Math.max(0, Math.min(i.canvas.h - h, y));
  switch (i.position) {
    case 'tl': return { x: clampX(m), y: clampY(m), w, h };
    case 'tr': return { x: clampX(right), y: clampY(m), w, h };
    case 'bl': return { x: clampX(m), y: clampY(bottom), w, h };
    case 'br': return { x: clampX(right), y: clampY(bottom), w, h };
    default: return { x: clampX(Math.round((i.canvas.w - w) / 2)), y: clampY(Math.round((i.canvas.h - h) / 2)), w, h };
  }
}
