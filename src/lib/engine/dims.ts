/** Output geometry: which source rectangle is drawn into how many output pixels. Pure. */
import { EngineError, type CropRect, type FitMode } from './types';

export interface Rect { x: number; y: number; width: number; height: number }
export interface Geometry {
  /** Source rectangle in oriented source pixels. */
  src: Rect;
  /** Output size at scale 1 (before any size-target shrinking). */
  baseWidth: number;
  baseHeight: number;
  /** True when the user fixed the output dimensions (width and/or height). */
  fixed: boolean;
  /** True when the output has more pixels than the source rectangle on some side (only via explicit width/height). */
  upscaled: boolean;
}

export interface DimOptions {
  width?: number;
  height?: number;
  maxWidth?: number;
  maxHeight?: number;
  lockAspect: boolean;
  fit: FitMode;
  crop?: CropRect;
}

const r1 = (n: number) => Math.max(1, Math.round(n));

export function validateCrop(srcW: number, srcH: number, c: CropRect): Rect {
  const vals = [c.x, c.y, c.width, c.height];
  if (!vals.every((v) => typeof v === 'number' && Number.isFinite(v))) throw new EngineError('invalid_options', 'The crop area is not valid.');
  if (c.x < 0 || c.y < 0 || c.width < 1 || c.height < 1) throw new EngineError('invalid_options', 'The crop area is not valid.');
  // allow half a pixel of rounding slack from UI coordinate conversions
  if (c.x + c.width > srcW + 0.5 || c.y + c.height > srcH + 0.5) throw new EngineError('invalid_options', 'The crop area lies outside the image.');
  return { x: c.x, y: c.y, width: Math.min(c.width, srcW - c.x), height: Math.min(c.height, srcH - c.y) };
}

export function resolveGeometry(srcW: number, srcH: number, o: DimOptions): Geometry {
  let src: Rect = o.crop ? validateCrop(srcW, srcH, o.crop) : { x: 0, y: 0, width: srcW, height: srcH };
  const rw = src.width;
  const rh = src.height;
  let w: number;
  let h: number;
  let fixed = true;
  if (o.width && o.height) {
    if (!o.lockAspect || o.fit === 'stretch') {
      w = o.width; h = o.height;
    } else if (o.fit === 'cover') {
      w = o.width; h = o.height;
      const ta = w / h;
      if (rw / rh > ta) {
        const nw = rh * ta;
        src = { ...src, x: src.x + (rw - nw) / 2, width: nw };
      } else {
        const nh = rw / ta;
        src = { ...src, y: src.y + (rh - nh) / 2, height: nh };
      }
    } else {
      const k = Math.min(o.width / rw, o.height / rh);
      w = r1(rw * k); h = r1(rh * k);
    }
  } else if (o.width) {
    w = o.width; h = o.lockAspect ? r1((rh * o.width) / rw) : Math.round(rh);
  } else if (o.height) {
    h = o.height; w = o.lockAspect ? r1((rw * o.height) / rh) : Math.round(rw);
  } else {
    fixed = false;
    const k = Math.min(1, o.maxWidth ? o.maxWidth / rw : 1, o.maxHeight ? o.maxHeight / rh : 1);
    w = r1(rw * k); h = r1(rh * k);
  }
  if (fixed && (o.maxWidth || o.maxHeight)) {
    const k = Math.min(1, o.maxWidth ? o.maxWidth / w : 1, o.maxHeight ? o.maxHeight / h : 1);
    if (k < 1) { w = r1(w * k); h = r1(h * k); }
  }
  return { src, baseWidth: w, baseHeight: h, fixed, upscaled: w > Math.round(src.width) || h > Math.round(src.height) };
}
