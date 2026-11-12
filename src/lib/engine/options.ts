/** Validation + defaults for ProcessOptions. Throws EngineError('invalid_options'). Pure. */
import { EngineError, type ProcessOptions } from './types';
import type { FullLimits } from './limits';

export type NormalizedOptions = ProcessOptions & Required<Pick<ProcessOptions, 'format' | 'strategy' | 'lockAspect' | 'fit' | 'background'>>;

const FORMATS = ['auto', 'jpeg', 'png', 'webp'];
const STRATEGIES = ['quality-first', 'dimensions-first'];
const FITS = ['contain', 'cover', 'stretch'];
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const MAX_KB = 100_000; // 100 MB: beyond any file we accept

/** Shared user message for outputs above maxOutputPixels / maxSide. */
export const outputTooLargeMessage = (l: FullLimits) =>
  `This browser can't safely create images this big; the maximum is ${Math.round((l.maxOutputPixels / 1e6) * 10) / 10} megapixels (${l.maxSide} px per side).`;

const invalid = (msg: string): never => { throw new EngineError('invalid_options', msg); };

function posNum(v: unknown, name: string, max: number) {
  if (v === undefined) return;
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > max) invalid(`${name} must be a positive number up to ${max}.`);
}
function posInt(v: unknown, name: string, max: number) {
  if (v === undefined) return;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > max) invalid(`${name} must be a whole number of pixels between 1 and ${max}.`);
}

export function normalizeOptions(input: ProcessOptions, limits: FullLimits): NormalizedOptions {
  if (!input || typeof input !== 'object') invalid('Options are missing.');
  const o: NormalizedOptions = {
    ...input,
    format: input.format ?? 'auto',
    strategy: input.strategy ?? 'quality-first',
    lockAspect: input.lockAspect ?? true,
    fit: input.fit ?? 'contain',
    // JPEG has no alpha: white (disclosed when it fills transparency). PNG/WebP/auto keep transparency unless told otherwise.
    background: input.background ?? (input.format === 'jpeg' ? 'white' : 'keep'),
  };
  if ((o as { allowPadding?: unknown }).allowPadding) invalid('Padding files to a minimum size is not supported.');
  if (!FORMATS.includes(o.format)) invalid('Unknown output format.');
  if (!STRATEGIES.includes(o.strategy)) invalid('Unknown strategy.');
  if (!FITS.includes(o.fit)) invalid('Unknown fit mode.');
  if (typeof o.lockAspect !== 'boolean') invalid('lockAspect must be true or false.');
  const bg = o.background as string;
  if (!(bg === 'white' || bg === 'black' || bg === 'keep' || HEX.test(bg))) invalid('Background must be white, black, keep or a #hex colour.');
  if (o.format === 'jpeg' && bg === 'keep') invalid('JPEG cannot keep transparency. Choose a background colour or PNG/WebP output.');
  posNum(o.maxKb, 'Maximum size', MAX_KB);
  posNum(o.minKb, 'Minimum size', MAX_KB);
  if (o.minKb !== undefined && o.maxKb !== undefined && o.minKb > o.maxKb) invalid('The minimum size is larger than the maximum size.');
  for (const k of ['width', 'height', 'maxWidth', 'maxHeight'] as const) posInt(o[k], k, limits.maxSide);
  if (o.width && o.height && o.width * o.height > limits.maxOutputPixels) invalid(outputTooLargeMessage(limits));
  if (o.quality !== undefined && (typeof o.quality !== 'number' || !Number.isFinite(o.quality) || o.quality < 1 || o.quality > 100)) invalid('Quality must be between 1 and 100.');
  if (o.quality !== undefined) o.quality = Math.round(o.quality);
  if (o.crop !== undefined) {
    const c = o.crop;
    if (!c || ![c.x, c.y, c.width, c.height].every((v) => typeof v === 'number' && Number.isFinite(v)) || c.width < 1 || c.height < 1 || c.x < 0 || c.y < 0) invalid('The crop area is not valid.');
  }
  if (o.stripIcc !== undefined && typeof o.stripIcc !== 'boolean') invalid('stripIcc must be true or false.');
  if (o.allowEnlarge !== undefined && typeof o.allowEnlarge !== 'boolean') invalid('allowEnlarge must be true or false.');
  return o;
}

export const hasSizeTarget = (o: ProcessOptions) => o.maxKb !== undefined || o.minKb !== undefined;
