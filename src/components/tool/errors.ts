import type { EngineErrorCode } from '../../lib/engine/types';
import { formatCap } from './format';

export type ToolErrorAction = 'use-jpeg';
export interface ToolError {
  code: EngineErrorCode | 'unknown';
  message: string;
  /** Optional one-click remedy the UI can offer. */
  action?: ToolErrorAction;
}

const KNOWN: readonly string[] = [
  'unsupported_type', 'corrupt', 'too_large_bytes', 'too_many_pixels', 'timeout',
  'cancelled', 'out_of_memory', 'encode_unsupported', 'invalid_options',
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

export interface ErrorContext { maxFileBytes?: number; requestedFormat?: string }

/** Friendly, privacy-safe copy per engine error code. 'cancelled' is silent (message is empty). */
export function toToolError(e: unknown, ctx: ErrorContext = {}): ToolError {
  const code = errorCodeOf(e);
  switch (code) {
    case 'unsupported_type':
      return { code, message: 'This file is not a JPEG, PNG or WebP image. SVG, GIF, HEIC and other formats are not supported.' };
    case 'corrupt':
      return { code, message: 'This image could not be read. It may be damaged or incomplete. Try saving or exporting it again.' };
    case 'too_large_bytes':
      return { code, message: `This file is too large to process in the browser${ctx.maxFileBytes ? ` (the limit is ${formatCap(ctx.maxFileBytes)})` : ''}. Choose a smaller file.` };
    case 'too_many_pixels':
      return { code, message: 'This image has too many pixels to process safely in a browser. Make it smaller first, for example with your phone’s editor, then try again.' };
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
    default:
      return { code: 'unknown', message: 'Something went wrong while processing this image. Nothing was uploaded. Try again or choose another image.' };
  }
}

export const isSilent = (err: ToolError): boolean => err.code === 'cancelled';
