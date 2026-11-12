import type { Rect } from './crop';

export interface TrimOptions {
  /** How much darker than the paper a pixel must be to count as ink (0-255 luminance). */
  contrast?: number;
  /** Rows/columns with fewer ink pixels than this are treated as dust, not signature. */
  minInkPerLine?: number;
}

/**
 * Finds the bounding box of "ink" (pixels clearly darker than the paper) in RGBA data.
 * Paper level = the 90th percentile luminance after compositing on white, so transparent backgrounds work too.
 * Returns null when no ink is found. Coordinates are in the pixel grid of the data passed in.
 */
export function findInkBounds(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, opts: TrimOptions = {}): Rect | null {
  const contrast = opts.contrast ?? 40;
  const minInk = opts.minInkPerLine ?? 2;
  const n = w * h;
  if (n === 0 || rgba.length < n * 4) return null;
  const lum = new Uint8Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const a = rgba[i * 4 + 3] / 255;
    const l = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    const v = Math.round(l * a + 255 * (1 - a));
    lum[i] = v;
    hist[v]++;
  }
  let acc = 0, paper = 255;
  const target = n * 0.9;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= target) { paper = v; break; } }
  const cutoff = paper - contrast;
  if (cutoff <= 0) return null;
  const rows = new Uint32Array(h), cols = new Uint32Array(w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (lum[y * w + x] < cutoff) { rows[y]++; cols[x]++; }
  const first = (arr: Uint32Array) => arr.findIndex((c) => c >= minInk);
  const last = (arr: Uint32Array) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] >= minInk) return i; return -1; };
  const top = first(rows), bottom = last(rows), left = first(cols), right = last(cols);
  if (top < 0 || left < 0 || bottom < top || right < left) return null;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** Scales a rect found on a downscaled copy back to source pixels. */
export function scaleRect(r: Rect, sx: number, sy: number, bounds: { width: number; height: number }): Rect {
  const x = Math.max(0, Math.floor(r.x * sx));
  const y = Math.max(0, Math.floor(r.y * sy));
  const right = Math.min(bounds.width, Math.ceil((r.x + r.width) * sx));
  const bottom = Math.min(bounds.height, Math.ceil((r.y + r.height) * sy));
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}
