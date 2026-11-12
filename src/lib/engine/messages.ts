/**
 * User-facing strings (English). Every non-ok status gets a plain explanation with real numbers.
 * Display KB = 1024 bytes, one decimal. Non-ok messages also give exact bytes so a boundary case can never read as a contradiction.
 */
import type { ResultStatus } from './types';
import type { OutcomeReason } from './search';

export const formatKb = (bytes: number) => (bytes < 1024 ? `${bytes} bytes` : `${(Math.round((bytes / 1024) * 10) / 10).toFixed(1)} KB`);
const exact = (bytes: number) => `${bytes.toLocaleString('en-US')} bytes`;
const sizeExact = (bytes: number) => (bytes < 1024 ? exact(bytes) : `${formatKb(bytes)} (${exact(bytes)})`);
const num = (n: number) => String(Math.round(n * 100) / 100);
const px = (w: number, h: number) => `${w}×${h} px`;
export const formatLabel = (mime: string) => (mime === 'image/png' ? 'PNG' : mime === 'image/webp' ? 'WebP' : 'JPEG');

export interface MessageInput {
  status: ResultStatus;
  reason: OutcomeReason;
  mime: string;
  lossless: boolean;
  fixed: boolean;
  allowEnlarge: boolean;
  minKb?: number;
  maxKb?: number;
  lo: number;
  hi: number;
  maxEncodes: number;
  best: { bytes: number; width: number; height: number; quality: number | null; enlarged: boolean; scale: number };
  gapAbove?: { bytes: number };
  maxProbe?: { bytes: number; width: number; height: number };
}

export function buildMessage(m: MessageInput): string {
  const b = m.best;
  const fmt = formatLabel(m.mime);
  const desc = m.lossless ? `${fmt} (lossless), ${px(b.width, b.height)}` : `Quality ${b.quality}%, ${px(b.width, b.height)}`;
  const limit = m.minKb !== undefined && m.maxKb !== undefined ? `within ${num(m.minKb)}–${num(m.maxKb)} KB` : m.maxKb !== undefined ? `under the ${num(m.maxKb)} KB limit` : m.minKb !== undefined ? `above the ${num(m.minKb)} KB minimum` : '';
  const maxText = m.maxKb !== undefined ? `your ${num(m.maxKb)} KB limit (${exact(m.hi)})` : '';
  const minText = m.minKb !== undefined ? `the ${num(m.minKb)} KB minimum (${exact(m.lo)})` : '';
  switch (m.status) {
    case 'ok': {
      if (m.reason === 'no_target') return `${formatKb(b.bytes)}. ${desc}.`;
      const shrunk = m.lossless && b.scale < 1 ? ` ${fmt} is lossless, so the size was reached by reducing the pixel dimensions only.` : '';
      return `${formatKb(b.bytes)} – ${limit}. ${desc}.${shrunk}`;
    }
    case 'raised':
      if (b.enlarged) return `Your minimum is ${num(m.minKb!)} KB. We enlarged the image to ${px(b.width, b.height)} to reach ${formatKb(b.bytes)}. Enlarging adds pixels, not detail.`;
      if (b.scale < 0.999) return `Your minimum is ${num(m.minKb!)} KB. We raised ${fmt} quality to ${b.quality}% and reduced the image to ${px(b.width, b.height)} to land at ${formatKb(b.bytes)} inside your range. The picture keeps its look; the file just stores more detail.`;
      return `Your minimum is ${num(m.minKb!)} KB. We raised ${fmt} quality to ${b.quality}% to reach ${formatKb(b.bytes)}. The picture looks the same; the file just stores more detail.`;
    case 'below_min': {
      if (m.reason === 'window_gap' && m.gapAbove) {
        return `No setting lands between ${num(m.minKb!)} and ${num(m.maxKb!)} KB for this image: the closest results are ${sizeExact(b.bytes)} and ${sizeExact(m.gapAbove.bytes)}. Try a slightly wider range.`;
      }
      if (m.reason === 'budget_exhausted') return `Could not reach ${minText} within ${m.maxEncodes} attempts; the closest result is ${sizeExact(b.bytes)}.`;
      const hint = m.fixed
        ? ' Check whether the portal really requires these exact dimensions; larger dimensions would give a bigger file.'
        : m.allowEnlarge ? ' Use a larger original image.' : ' Use a larger original image, or allow enlarging the image.';
      if (m.lossless) return `${fmt} is lossless, so its size depends only on the pixels: at ${px(b.width, b.height)} this image is ${sizeExact(b.bytes)}, below ${minText}.${hint}`;
      const p = m.maxProbe ?? b;
      return `At ${px(p.width, p.height)} this image is at most ${sizeExact(p.bytes)} even at maximum quality, so ${minText} cannot be met at these dimensions.${hint}`;
    }
    case 'above_max':
      if (m.reason === 'budget_exhausted') return `Could not get under ${maxText} within ${m.maxEncodes} attempts; the smallest result is ${sizeExact(b.bytes)}.`;
      return `Cannot go below ${sizeExact(b.bytes)} for this image (smallest result: ${px(b.width, b.height)}${b.quality !== null ? ` at quality ${b.quality}%` : ''}), which is above ${maxText}. Increase the limit or use a simpler image.`;
    case 'above_max_fixed':
      if (m.lossless) return `${fmt} is lossless, so at ${px(b.width, b.height)} it cannot be smaller than ${sizeExact(b.bytes)}, which is above ${maxText}. Choose JPEG, or smaller dimensions.`;
      if (m.reason === 'budget_exhausted') return `Could not get under ${maxText} at ${px(b.width, b.height)} within ${m.maxEncodes} attempts; the smallest result is ${sizeExact(b.bytes)}.`;
      return `At ${px(b.width, b.height)} the smallest ${fmt} is ${sizeExact(b.bytes)}${b.quality !== null ? ` (quality ${b.quality}%)` : ''}, which is above ${maxText}. Allow smaller dimensions or a higher limit.`;
  }
}

/** Disclosure notes (must be shown with the result). */
export const NOTES = {
  flattened: (bg: string) => `Transparent areas were filled with ${bg === '#ffffff' ? 'white' : bg === '#000000' ? 'black' : `the colour ${bg}`}.`,
  lowQuality: (q: number) => `Quality had to go down to ${q}% to fit, so the image may look blocky.`,
  reduced: (w: number, h: number, sw: number, sh: number) => `This large photo was opened at reduced size (${px(w, h)} of the original ${px(sw, sh)}) to stay within browser memory limits, so the result can have less detail than the original.`,
  webpFallback: (fmt: string) => `WebP can't be saved in this browser, so the result is ${fmt}.`,
  animated: 'Only the first frame of the animated image was used.',
  kbConflict: (minKb: number) => `Your minimum and maximum are too close to satisfy both ways of counting KB (1 KB = 1000 or 1024 bytes), so the minimum was treated as ${num(minKb)} × 1000 bytes.`,
  orientationUnknown: 'This browser did not apply the photo’s rotation setting, so the result may appear sideways.',
  iccKept: 'The colour profile could not be removed safely in this browser, so it was kept.',
  alphaMaybeMissed: 'Very small transparent areas in very large images may be filled with the background colour.',
  pngTryJpeg: 'PNG is lossless, so only the pixel dimensions could shrink. JPEG would keep more pixels at this size.',
  upscaled: 'The requested dimensions are larger than the original, so the image was enlarged (no extra detail).',
} as const;

/** Privacy copy supported by tests (re-encode path only): EXIF Make/Model/GPS are not copied into the new file. */
export const PRIVACY_NOTE = 'Camera and location details (EXIF/GPS) are not copied into the new file.';
