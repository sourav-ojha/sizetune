import type { EngineErrorCode } from '../../lib/engine/types';
import { formatCap } from './format';

export type ToolErrorAction = 'use-jpeg' | 'retry';
export interface ToolError {
  code: EngineErrorCode | 'unknown';
  message: string;
  /** Optional one-click remedy the UI can offer. */
  action?: ToolErrorAction;
}

const KNOWN: readonly string[] = [
  'unsupported_type', 'corrupt', 'too_large_bytes', 'too_many_pixels', 'timeout',
  'cancelled', 'out_of_memory', 'encode_unsupported', 'invalid_options', 'worker_failed', 'encode_failed',
];

/** Duck-typed so it also works if an error crossed a worker boundary (class identity lost). */
export function errorCodeOf(e: unknown): EngineErrorCode | 'unknown' {
  if (e && typeof e === 'object') {
    const o = e as { name?: unknown; code?: unknown };
    if (o.name === 'EngineError' && typeof o.code === 'string' && KNOWN.includes(o.code)) return o.code as EngineErrorCode;
  }
  if (e && typeof e === 'object' && (e as { name?: unknown }).name === 'AbortError') return 'cancelled';
  return 'unknown';
}

export interface ErrorContext {
  maxFileBytes?: number;
  requestedFormat?: string;
  /** Source dimensions from the file header, when known. */
  width?: number;
  height?: number;
  maxPixels?: number;
}

/** Above this many source pixels a failure is more likely about size than bad luck, so we do not push endless retries. */
export const LARGE_SOURCE_PIXELS = 12_000_000;
const isLarge = (ctx: ErrorContext): boolean => !!ctx.width && !!ctx.height && ctx.width * ctx.height > LARGE_SOURCE_PIXELS;

/** The engine reported 'cancelled' but the user did not ask for it (worker lost, superseded internally): never swallow that silently. */
export const INTERRUPTED: ToolError = { code: 'unknown', message: 'The run was interrupted before it finished, so there is no result. Please try again.', action: 'retry' };

/** Friendly, privacy-safe copy per engine error code. 'cancelled' is silent (message is empty). */
export function toToolError(e: unknown, ctx: ErrorContext = {}): ToolError {
  const code = errorCodeOf(e);
  switch (code) {
    case 'unsupported_type':
      return { code, message: 'This file is not a JPEG, PNG or WebP image. SVG, GIF, HEIC and other formats are not supported.' };
    case 'corrupt':
      return { code, message: 'This image file looks incomplete or damaged (for example a download that did not finish). Try saving or exporting it again.' };
    case 'too_large_bytes':
      return { code, message: `This file is too large to process in the browser${ctx.maxFileBytes ? ` (the limit is ${formatCap(ctx.maxFileBytes)})` : ''}. Choose a smaller file.` };
    case 'too_many_pixels':
    {
      const mp = ctx.width && ctx.height ? ` (${ctx.width.toLocaleString('en-US')} × ${ctx.height.toLocaleString('en-US')} px, about ${Math.round((ctx.width * ctx.height) / 1_000_000)} megapixels${ctx.maxPixels ? `; the limit is ${Math.round(ctx.maxPixels / 1_000_000)} megapixels` : ''})` : '';
      return { code, message: `This image has too many pixels to process safely in a browser${mp}. Make it smaller first, for example with your phone’s editor, then try again.` };
    }
    case 'timeout':
      return { code, message: 'Processing took too long and was stopped. Try a smaller image or a larger size limit.' };
    case 'cancelled':
      return { code, message: '' };
    case 'out_of_memory':
      return { code, message: 'Your browser ran out of memory on this image. Close other tabs or choose a smaller image.' };
    case 'encode_unsupported': {
      const fmt = ctx.requestedFormat === 'webp' ? 'WebP' : 'that format';
      return { code, message: `This browser cannot save ${fmt}. JPEG works everywhere.`, action: 'use-jpeg' };
    }
    case 'invalid_options': {
      const detail = e instanceof Error && e.message ? ` (${e.message})` : '';
      return { code, message: `Some settings cannot be used together${detail}. Check the size, dimensions and format options.` };
    }
    case 'encode_failed':
      if (isLarge(ctx)) return { code, message: 'The browser could not save this large image. Try a smaller image (for example a lower-resolution copy) instead of retrying the same one.' };
      return { code, message: 'The browser could not save the image this time. Please try again.', action: 'retry' };
    case 'worker_failed':
      if (isLarge(ctx)) return { code, message: 'The image processor stopped while working on this very large image. Try a smaller image (for example a lower-resolution copy) instead of retrying the same one.' };
      return { code, message: 'The image processor could not start or stopped unexpectedly. This is not a problem with your image. Please try again, or reload the page if it keeps happening.', action: 'retry' };
    default:
      return { code: 'unknown', message: 'Something went wrong while processing this image. This site did not upload it. Try again or choose another image.' };
  }
}

export const isSilent = (err: ToolError): boolean => err.code === 'cancelled';
