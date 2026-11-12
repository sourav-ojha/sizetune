/** Pure planning: output format/background and the reduced decode size. */
import { EngineError, type Background, type OutputFormat } from './types';
import type { ImageMime } from './sniff';
import type { Geometry } from './dims';
import type { FullLimits } from './limits';
import { NOTES, formatLabel } from './messages';

export interface FormatPlan {
  mime: ImageMime;
  /** CSS colour to paint under the image before drawing, or null to keep transparency. */
  fill: string | null;
  notes: string[];
}

export const bgColour = (bg: Background): string | null => (bg === 'keep' ? null : bg === 'white' ? '#ffffff' : bg === 'black' ? '#000000' : bg.toLowerCase());

export function resolveFormat(format: OutputFormat, input: ImageMime, hasAlpha: boolean, background: Background, canWebp: boolean): FormatPlan {
  const notes: string[] = [];
  const colour = bgColour(background);
  const lossyFlatten = (): FormatPlan => {
    const fill = colour ?? '#ffffff';
    if (hasAlpha) {
      if (!colour) throw new EngineError('invalid_options', 'JPEG cannot keep transparency. Choose a background colour or PNG/WebP output.');
      notes.push(NOTES.flattened(fill));
    }
    return { mime: 'image/jpeg', fill, notes };
  };
  const alphaCapable = (mime: ImageMime): FormatPlan => {
    // An explicit background colour with PNG/WebP output flattens (disclosed); 'keep' preserves alpha.
    if (hasAlpha && colour) notes.push(NOTES.flattened(colour));
    return { mime, fill: hasAlpha ? colour : null, notes };
  };
  switch (format) {
    case 'jpeg': return lossyFlatten();
    case 'png': return alphaCapable('image/png');
    case 'webp':
      if (!canWebp) throw new EngineError('encode_unsupported', 'WebP images cannot be saved in this browser. Choose JPEG or PNG.');
      return alphaCapable('image/webp');
    case 'auto': {
      if (input === 'image/jpeg') return { mime: 'image/jpeg', fill: '#ffffff', notes };
      if (input === 'image/png') return { mime: 'image/png', fill: null, notes };
      if (canWebp) return { mime: 'image/webp', fill: null, notes };
      // WebP input, WebP encode unsupported: keep alpha via PNG, else JPEG. Disclosed.
      const mime: ImageMime = hasAlpha ? 'image/png' : 'image/jpeg';
      notes.push(NOTES.webpFallback(formatLabel(mime)));
      return { mime, fill: hasAlpha ? null : '#ffffff', notes };
    }
  }
}

export interface DecodePlan { width: number; height: number; reduced: boolean }

/**
 * Decide the decode size. Sources at or below `maxWorkingPixels` decode at full size. Larger sources decode at a reduced
 * size chosen from the goal: free dims -> enough pixels for the size target (capped at `workingCapPixels`, more if a large
 * minimum needs it); fixed dims -> enough to render the requested output without upscaling.
 */
export function planDecode(srcW: number, srcH: number, g: Geometry, lo: number, hi: number, limits: FullLimits): DecodePlan {
  const P = srcW * srcH;
  if (P <= limits.maxWorkingPixels) return { width: srcW, height: srcH, reduced: false };
  let d: number;
  let capTotal = limits.maxWorkingPixels;
  if (g.fixed) {
    d = Math.max(g.baseWidth / g.src.width, g.baseHeight / g.src.height);
    capTotal = Math.max(limits.maxWorkingPixels, g.baseWidth * g.baseHeight);
  } else {
    let budget = limits.workingCapPixels;
    if (Number.isFinite(hi)) budget = Math.min(limits.workingCapPixels, Math.max(2_000_000, 67 * hi));
    if (lo > 0) budget = Math.min(limits.maxWorkingPixels, Math.max(budget, 5 * lo));
    const want = Math.min(g.baseWidth * g.baseHeight, budget);
    d = Math.sqrt(want / (g.src.width * g.src.height));
  }
  d = Math.min(1, d, Math.sqrt(capTotal / P));
  if (d > 0.98) return { width: srcW, height: srcH, reduced: false };
  return { width: Math.max(1, Math.round(srcW * d)), height: Math.max(1, Math.round(srcH * d)), reduced: true };
}
