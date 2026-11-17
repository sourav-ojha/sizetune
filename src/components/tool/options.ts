import type { Background, CropRect, FitMode, OutputFormat, ProcessOptions, Strategy } from '../../lib/engine/types';
import { normalizeHex } from './format';
import { toPixels, unitLabel, type Unit } from './units';

export const PRESETS_KB = [10, 20, 30, 50, 100, 200] as const;
export const MAX_KB_LIMIT = 50_000;
export const MAX_DIM_LIMIT = 16_384; // = engine limits.maxSide

export type BgChoice = 'white' | 'black' | 'custom';

/** Raw form state: numbers are kept as strings so half-typed input is never rewritten under the user. */
export interface FormState {
  maxKb: string;            // used unless noLimit
  noLimit: boolean;         // explicit "no size limit" (then a fixed quality is used)
  minKb: string;
  format: OutputFormat;
  strategy: Strategy;
  width: string;
  height: string;
  maxWidth: string;
  maxHeight: string;
  lockAspect: boolean;
  fit: FitMode;
  allowEnlarge: boolean;    // engine extension: more pixels than the source to reach a minimum (free dimensions only)
  quality: number;          // 1-100, only used when there is no size target
  bg: BgChoice;
  bgCustom: string;         // #rrggbb
  unit: Unit;               // unit of width, height, maxWidth and maxHeight (FEATURE-013)
  dpi: string;              // blank = no DPI tag (px only); required for cm, mm and inch
}

/** Engine options plus the UI-only DPI tag (written after encoding by tool/dpi.ts; the engine never sees it). */
export type ToolOptions = ProcessOptions & { dpi?: number };

export type FieldName = 'maxKb' | 'minKb' | 'width' | 'height' | 'maxWidth' | 'maxHeight' | 'bgCustom' | 'quality' | 'dpi';
export type FieldErrors = Partial<Record<FieldName, string>>;

export interface BuildContext {
  crop?: CropRect | null;
}

export type BuildResult = { ok: true; options: ToolOptions } | { ok: false; errors: FieldErrors };

export function defaultForm(over: Partial<FormState> = {}): FormState {
  return {
    maxKb: '50', noLimit: false, minKb: '', format: 'auto', strategy: 'quality-first',
    width: '', height: '', maxWidth: '', maxHeight: '',
    lockAspect: true, fit: 'contain', allowEnlarge: false, quality: 85, bg: 'white', bgCustom: '#ffffff', unit: 'px', dpi: '',
    ...over,
  };
}

type Parsed = { kind: 'empty' } | { kind: 'ok'; value: number } | { kind: 'bad' };

/**
 * Lenient numeric parsing for typed values: accepts thousands separators ("1,000", "1 000") and a trailing unit
 * ("20 KB", "300px"); anything else is "bad" (never guessed, e.g. "1,5" or "1e3").
 */
export function parseNumber(raw: string, unit: 'kb' | 'px' | null = null): Parsed {
  let s = raw.trim();
  if (s === '') return { kind: 'empty' };
  const unitRe = unit === 'kb' ? /\s*(kb|kib|k)$/i : unit === 'px' ? /\s*(px|pixels?)$/i : null;
  if (unitRe) s = s.replace(unitRe, '').trim();
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^\d{1,3}( \d{3})+(\.\d+)?$/.test(s)) s = s.replace(/ /g, '');
  if (!/^\d*\.?\d+$/.test(s)) return { kind: 'bad' };
  const n = Number(s);
  return Number.isFinite(n) ? { kind: 'ok', value: n } : { kind: 'bad' };
}

function kbField(raw: string, name: 'maxKb' | 'minKb', errors: FieldErrors, requiredMsg?: string): number | undefined {
  const p = parseNumber(raw, 'kb');
  if (p.kind === 'empty') { if (requiredMsg) errors[name] = requiredMsg; return undefined; }
  if (p.kind === 'bad' || p.value < 1 || p.value > MAX_KB_LIMIT) {
    errors[name] = `Enter a size between 1 and ${MAX_KB_LIMIT.toLocaleString('en-US')} KB, for example 20 or “20 KB”.`;
    return undefined;
  }
  return p.value;
}

function pxField(raw: string, name: 'width' | 'height' | 'maxWidth' | 'maxHeight', errors: FieldErrors): number | undefined {
  const p = parseNumber(raw, 'px');
  if (p.kind === 'empty') return undefined;
  if (p.kind === 'bad' || !Number.isInteger(p.value) || p.value < 1 || p.value > MAX_DIM_LIMIT) {
    errors[name] = `Enter a whole number of pixels between 1 and ${MAX_DIM_LIMIT.toLocaleString('en-US')}, for example 600 or “600 px”.`;
    return undefined;
  }
  return p.value;
}

const MAX_DPI_INPUT = 10_000;

function dpiField(raw: string, required: boolean, errors: FieldErrors): number | undefined {
  const p = parseNumber(raw);
  if (p.kind === 'empty') { if (required) errors.dpi = 'Enter the DPI to convert the size to pixels, for example 300.'; return undefined; }
  if (p.kind === 'bad' || !Number.isInteger(p.value) || p.value < 1 || p.value > MAX_DPI_INPUT) {
    errors.dpi = `Enter a whole number of dots per inch between 1 and ${MAX_DPI_INPUT.toLocaleString('en-US')}, for example 300.`;
    return undefined;
  }
  return p.value;
}

/** A width or height typed in px (whole pixels) or in a print unit (decimals allowed), as pixels. */
function lengthField(raw: string, name: 'width' | 'height' | 'maxWidth' | 'maxHeight', unit: Unit, dpi: number | undefined, errors: FieldErrors): number | undefined {
  if (unit === 'px') return pxField(raw, name, errors);
  const p = parseNumber(raw.replace(/\s*(cm|mm|inch|inches|in)$/i, ''));
  if (p.kind === 'empty') return undefined;
  if (p.kind === 'bad' || p.value <= 0) { errors[name] = `Enter a length in ${unitLabel(unit)}, for example 3.5.`; return undefined; }
  if (dpi == null) return undefined; // the DPI field carries the error
  const px = toPixels(p.value, unit, dpi);
  if (px > MAX_DIM_LIMIT) { errors[name] = `That is more than ${MAX_DIM_LIMIT.toLocaleString('en-US')} pixels at ${dpi} DPI. Enter a smaller length or a lower DPI.`; return undefined; }
  return px;
}

/** Colour used to fill transparency when the output is JPEG. */
export function backgroundFor(f: Pick<FormState, 'bg' | 'bgCustom'>): Background | null {
  if (f.bg === 'white' || f.bg === 'black') return f.bg;
  const hex = normalizeHex(f.bgCustom);
  return hex ? (hex as Background) : null;
}

/**
 * Pure: turns the form into engine options or per-field errors. Never invents dimensions or sizes,
 * never sets padding, and only requests a flattening colour when the user chose JPEG.
 */
export function buildOptions(f: FormState, ctx: BuildContext = {}): BuildResult {
  const errors: FieldErrors = {};
  const maxKb = f.noLimit ? undefined : kbField(f.maxKb, 'maxKb', errors, 'Enter a maximum size in KB, or choose “No limit”.');
  const minKb = kbField(f.minKb, 'minKb', errors);
  if (maxKb != null && minKb != null && !errors.minKb) {
    if (minKb >= maxKb) errors.minKb = 'The minimum must be smaller than the maximum.';
    else if (minKb * 1024 > maxKb * 1000) {
      errors.minKb = `These are too close: ${minKb} KB counted as ${(minKb * 1024).toLocaleString('en-US')} bytes is above ${maxKb} KB counted as ${(maxKb * 1000).toLocaleString('en-US')} bytes. Widen the range.`;
    }
  }
  const dpi = dpiField(f.dpi, f.unit !== 'px', errors);
  const width = lengthField(f.width, 'width', f.unit, dpi, errors);
  const height = lengthField(f.height, 'height', f.unit, dpi, errors);
  const maxWidth = lengthField(f.maxWidth, 'maxWidth', f.unit, dpi, errors);
  const maxHeight = lengthField(f.maxHeight, 'maxHeight', f.unit, dpi, errors);
  if (width != null && maxWidth != null && width > maxWidth) errors.width = 'Width is larger than the maximum width.';
  if (height != null && maxHeight != null && height > maxHeight) errors.height = 'Height is larger than the maximum height.';

  let background: Background = 'keep';
  if (f.format === 'jpeg') {
    const bg = backgroundFor(f);
    if (!bg) errors.bgCustom = 'Enter a colour like #ffffff.';
    else background = bg;
  }

  const hasTarget = maxKb != null || minKb != null;
  if (!hasTarget && !(Number.isInteger(f.quality) && f.quality >= 1 && f.quality <= 100)) errors.quality = 'Quality must be between 1 and 100.';

  if (Object.keys(errors).length) return { ok: false, errors };

  const both = width != null && height != null;
  const options: ToolOptions = {
    format: f.format,
    strategy: f.strategy,
    lockAspect: f.lockAspect,
    fit: both ? (f.lockAspect ? f.fit : 'stretch') : 'contain', // with the aspect lock off both sizes are used exactly
    background,
  };
  if (maxKb != null) options.maxKb = maxKb;
  if (minKb != null) options.minKb = minKb;
  if (dpi != null) options.dpi = dpi;
  if (width != null) options.width = width;
  if (height != null) options.height = height;
  if (maxWidth != null) options.maxWidth = maxWidth;
  if (maxHeight != null) options.maxHeight = maxHeight;
  if (!hasTarget && f.format !== 'png') options.quality = f.quality;
  if (f.allowEnlarge && minKb != null && width == null && height == null) options.allowEnlarge = true;
  if (ctx.crop) options.crop = { x: ctx.crop.x, y: ctx.crop.y, width: ctx.crop.width, height: ctx.crop.height };
  return { ok: true, options };
}

/** Which preset (if any) matches the current max text exactly. */
export function activePreset(maxKb: string): number | null {
  const p = parseNumber(maxKb, 'kb');
  return p.kind === 'ok' && (PRESETS_KB as readonly number[]).includes(p.value) ? p.value : null;
}

/** When one output dimension is typed and aspect is locked, the other is shown (not sent) from this ratio. */
export function derivedDimension(typed: string, srcW: number, srcH: number, solve: 'width' | 'height'): number | null {
  const p = parseNumber(typed, 'px');
  if (p.kind !== 'ok' || !(srcW > 0) || !(srcH > 0)) return null;
  const v = solve === 'height' ? (p.value * srcH) / srcW : (p.value * srcW) / srcH;
  return Math.max(1, Math.round(v));
}

/** True when the file that will really be written is PNG (explicit PNG, or Auto on a PNG source): lossless, so no quality control applies. */
export function outputIsLossless(format: OutputFormat, sourceKind: 'jpeg' | 'png' | 'webp' | null | undefined): boolean {
  return format === 'png' || (format === 'auto' && sourceKind === 'png');
}

/** Format that will really be requested, for UI decisions about transparency. */
export function needsFlattenChoice(format: OutputFormat, hasAlpha: boolean | null): boolean {
  return format === 'jpeg' && hasAlpha === true;
}

/** A picked file whose transparency could not be checked (too large to scan): JPEG would fill any transparent area, so the fill colour must be offered. */
export function alphaUnchecked(hasFile: boolean, hasAlpha: boolean | null): boolean {
  return hasFile && hasAlpha === null;
}
