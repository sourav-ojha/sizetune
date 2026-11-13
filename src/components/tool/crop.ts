/** Crop-box maths. All rectangles are in SOURCE pixels (after EXIF orientation), integers, inside `bounds`. */

export interface Rect { x: number; y: number; width: number; height: number }
export interface Size { width: number; height: number }
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type RectField = 'x' | 'y' | 'width' | 'height';

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), Math.max(lo, hi));

export const fullRect = (b: Size): Rect => ({ x: 0, y: 0, width: b.width, height: b.height });
export const aspectOf = (r: Size): number => r.width / r.height;

/** Integer rect inside bounds with at least minSize on each side. */
export function clampRect(r: Rect, b: Size, minSize = 1): Rect {
  const min = Math.min(minSize, b.width, b.height);
  const width = clamp(Math.round(r.width), min, b.width);
  const height = clamp(Math.round(r.height), min, b.height);
  const x = clamp(Math.round(r.x), 0, b.width - width);
  const y = clamp(Math.round(r.y), 0, b.height - height);
  return { x, y, width, height };
}

/** Converts a displayed (CSS px) distance into source pixels. */
export function displayToSource(deltaCss: number, sourceSize: number, displayedCss: number): number {
  return displayedCss > 0 ? (deltaCss * sourceSize) / displayedCss : 0;
}

export function moveRect(r: Rect, dx: number, dy: number, b: Size): Rect {
  return clampRect({ ...r, x: r.x + dx, y: r.y + dy }, b);
}

export interface ResizeOpts { aspect?: number | null; minSize?: number }

export function resizeRect(r: Rect, handle: Handle, dx: number, dy: number, b: Size, opts: ResizeOpts = {}): Rect {
  const min = Math.min(opts.minSize ?? 1, b.width, b.height);
  let left = r.x, top = r.y, right = r.x + r.width, bottom = r.y + r.height;
  const w = handle.includes('w'), e = handle.includes('e'), n = handle.includes('n'), s = handle.includes('s');
  if (w) left = clamp(left + dx, 0, right - min);
  if (e) right = clamp(right + dx, left + min, b.width);
  if (n) top = clamp(top + dy, 0, bottom - min);
  if (s) bottom = clamp(bottom + dy, top + min, b.height);
  let out: Rect = { x: left, y: top, width: right - left, height: bottom - top };
  const aspect = opts.aspect;
  if (aspect && aspect > 0) {
    const isCorner = handle.length === 2;
    if (isCorner) {
      const ax = w ? right : left; // fixed (anchor) corner
      const ay = n ? bottom : top;
      const availW = w ? ax : b.width - ax;
      const availH = n ? ay : b.height - ay;
      const maxW = Math.min(availW, availH * aspect);
      const minW = Math.max(min, min * aspect);
      let nw = Math.max(out.width, out.height * aspect);
      nw = Math.min(Math.max(nw, minW), maxW);
      const nh = nw / aspect;
      out = { x: w ? ax - nw : ax, y: n ? ay - nh : ay, width: nw, height: nh };
    } else if (e || w) {
      const cy = r.y + r.height / 2;
      const maxH = 2 * Math.min(cy, b.height - cy);
      const anchorX = e ? left : right;
      const availW = e ? b.width - anchorX : anchorX;
      let nh = Math.min(out.width / aspect, maxH, availW / aspect);
      nh = Math.max(nh, Math.min(min, maxH));
      const nw = nh * aspect;
      out = { x: e ? anchorX : anchorX - nw, y: cy - nh / 2, width: nw, height: nh };
    } else {
      const cx = r.x + r.width / 2;
      const maxW = 2 * Math.min(cx, b.width - cx);
      const anchorY = s ? top : bottom;
      const availH = s ? b.height - anchorY : anchorY;
      let nw = Math.min(out.height * aspect, maxW, availH * aspect);
      nw = Math.max(nw, Math.min(min, maxW));
      const nh = nw / aspect;
      out = { x: cx - nw / 2, y: s ? anchorY : anchorY - nh, width: nw, height: nh };
    }
  }
  return clampRect(out, b, min);
}

export type NudgeKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

/** Arrow-key editing: move by `step`, or (mode 'resize') grow/shrink the right/bottom edge. */
export function nudgeRect(r: Rect, key: NudgeKey, step: number, b: Size, mode: 'move' | 'resize', aspect?: number | null): Rect {
  const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
  const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
  if (mode === 'move') return moveRect(r, dx, dy, b);
  if (aspect && aspect > 0) {
    // lock: horizontal keys drive width, vertical keys drive height; the other follows
    const grow = dx !== 0 ? dx : dy * aspect;
    return resizeRect(r, 'se', grow, grow / aspect, b, { aspect });
  }
  return resizeRect(r, 'se', dx, dy, b);
}

/** Numeric-input edit of one field; optionally keeps the aspect ratio when width/height change. */
export function setRectField(r: Rect, field: RectField, value: number, b: Size, lockAspect = false): Rect {
  if (!Number.isFinite(value)) return r;
  const v = Math.round(value);
  // Left/Top never fail because of the current width/height: the box shrinks to fit instead (so typing the four fields in any order works).
  if (field === 'x') { const x = clamp(v, 0, b.width - 1); return clampRect({ ...r, x, width: Math.min(r.width, b.width - x) }, b); }
  if (field === 'y') { const y = clamp(v, 0, b.height - 1); return clampRect({ ...r, y, height: Math.min(r.height, b.height - y) }, b); }
  const aspect = aspectOf(r);
  if (field === 'width') {
    let width = clamp(v, 1, b.width - r.x);
    let height = lockAspect ? Math.round(width / aspect) : r.height;
    if (lockAspect && r.y + height > b.height) { height = b.height - r.y; width = Math.max(1, Math.round(height * aspect)); }
    return clampRect({ ...r, width, height: Math.max(1, height) }, b);
  }
  let height = clamp(v, 1, b.height - r.y);
  let width = lockAspect ? Math.round(height * aspect) : r.width;
  if (lockAspect && r.x + width > b.width) { width = b.width - r.x; height = Math.max(1, Math.round(width / aspect)); }
  return clampRect({ ...r, width: Math.max(1, width), height }, b);
}

/** Percent geometry for CSS-variable positioning over the displayed image. */
export function rectToPercent(r: Rect, b: Size): { left: number; top: number; width: number; height: number } {
  return {
    left: (r.x / b.width) * 100,
    top: (r.y / b.height) * 100,
    width: (r.width / b.width) * 100,
    height: (r.height / b.height) * 100,
  };
}

/** Pointer position inside the displayed image (CSS px relative to its top-left) -> source pixel. */
export function pointToSource(cssX: number, cssY: number, displayed: Size, source: Size): { x: number; y: number } {
  return {
    x: clamp(Math.round(displayToSource(cssX, source.width, displayed.width)), 0, source.width),
    y: clamp(Math.round(displayToSource(cssY, source.height, displayed.height)), 0, source.height),
  };
}

/** True when the rect covers the whole source (no crop needs to be sent). */
export const isFullRect = (r: Rect, b: Size): boolean => r.x === 0 && r.y === 0 && r.width === b.width && r.height === b.height;

/** Grows a rect by a fraction of its size on every side, clamped to bounds (used after auto-trim). */
export function padRect(r: Rect, fraction: number, b: Size, minPx = 2): Rect {
  const px = Math.max(minPx, Math.round(Math.max(r.width, r.height) * fraction));
  const x = Math.max(0, r.x - px), y = Math.max(0, r.y - px);
  const right = Math.min(b.width, r.x + r.width + px), bottom = Math.min(b.height, r.y + r.height + px);
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Reshape a crop to width:height = ratio, keeping its centre where possible. The box keeps its area's scale (width first),
 * shrinks if the ratio would leave the picture, and is shifted back inside the bounds. Integer source pixels.
 */
export function fitAspect(r: Rect, ratio: number, b: Size): Rect {
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  // smallest box of this shape that still contains the current crop (never cut the signature), then shrink to fit the picture
  let w = Math.max(r.width, r.height * ratio), h = w / ratio;
  const k = Math.min(1, b.width / w, b.height / h);
  w *= k; h *= k;
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(w / ratio));
  if (h > b.height) { h = b.height; w = Math.max(1, Math.round(h * ratio)); }
  const x = Math.min(Math.max(0, Math.round(cx - w / 2)), b.width - w);
  const y = Math.min(Math.max(0, Math.round(cy - h / 2)), b.height - h);
  return { x, y, width: w, height: h };
}
