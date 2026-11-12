/** Browser abstraction used by the pipeline. The real implementation is canvas-env.ts; tests inject fakes. */
import type { Rect } from './dims';

export interface DecodedImage { readonly width: number; readonly height: number; close(): void }

export interface Env<I extends DecodedImage = DecodedImage> {
  /** Decode with EXIF orientation applied. `resizeWidth` decodes at reduced size (height follows the aspect ratio). */
  decode(blob: Blob, resizeWidth?: number): Promise<I>;
  /** Draw `src` (image pixels) into a w×h surface, optional background fill, then encode. Implementations reuse ONE canvas. */
  render(img: I, src: Rect, w: number, h: number, fill: string | null, mime: string, quality?: number): Promise<Blob>;
  /** Any pixel with alpha < 255, checked on a downscaled copy. */
  hasAlpha(img: I): Promise<boolean>;
  /** Feature detection: does an encode of `mime` really produce that format (checked by magic bytes)? */
  canEncode(mime: string): Promise<boolean>;
  /** Free canvases. Called in `finally`. */
  release(): void;
  /** Main-thread fallback: give the event loop a turn between encodes. */
  yieldToEventLoop?(): Promise<void>;
}
