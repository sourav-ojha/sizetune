/**
 * SizeTune engine contract (authoritative; agents may EXTEND but must not break these shapes without telling the lead).
 * Everything runs in the browser. Nothing here performs network I/O.
 */

/** KB basis: user-entered KB are converted to a byte WINDOW [min*1024, max*1000] so a result satisfies both the 1000 and 1024 readings. */
export type OutputFormat = 'auto' | 'jpeg' | 'png' | 'webp';
export type Strategy = 'quality-first' | 'dimensions-first';
/** How to reconcile requested width+height with the source aspect ratio. */
export type FitMode = 'contain' | 'cover' | 'stretch';
/** Background used when flattening transparency (JPEG output). 'keep' = preserve alpha (requires png/webp output). */
export type Background = 'white' | 'black' | 'keep' | `#${string}`;

export interface CropRect { x: number; y: number; width: number; height: number } // source pixels, AFTER EXIF orientation

export interface ProcessOptions {
  /** Maximum output size in KB. */
  maxKb?: number;
  /** Optional minimum output size in KB (reached only by legitimate means: higher JPEG/WebP quality or more pixels when allowed). */
  minKb?: number;
  format: OutputFormat;                  // 'auto' = keep input format if encodable, else JPEG
  strategy: Strategy;                    // quality-first: keep pixels, lower quality first; dimensions-first: shrink pixels first
  /** Exact output size (px). With lockAspect and only one given, the other is derived. */
  width?: number;
  height?: number;
  /** Upper bounds (px); never upscales beyond source unless width/height explicitly request it. */
  maxWidth?: number;
  maxHeight?: number;
  lockAspect: boolean;                   // default true in UI
  fit: FitMode;                          // used when both width and height are given and lockAspect=false is not wanted
  /** Fixed quality 1–100 for lossy formats when there is no size target. */
  quality?: number;
  background: Background;
  crop?: CropRect;
  /** Strip the 472-byte sRGB ICC profile some encoders add (default false). */
  stripIcc?: boolean;
  /** Reserved, MUST stay false/undefined in v1: padding is never default (see QA/PRODUCT_READINESS §2). */
  allowPadding?: false;
  /** [engine ext] Allow MORE pixels than the source (upscaling) to reach minKb. Only used when dimensions are free. Default false. */
  allowEnlarge?: boolean;
}

export type ResultStatus =
  | 'ok'                // lo <= bytes <= hi (or no size target and encode succeeded)
  | 'raised'            // reached minimum by raising quality / pixels legitimately
  | 'below_min'         // cannot reach the requested minimum honestly
  | 'above_max'         // cannot get under the maximum at the allowed dimensions (best effort returned)
  | 'above_max_fixed';  // same but dimensions were fixed by the user

export interface SourceInfo { bytes: number; width: number; height: number; mime: string; hasAlpha: boolean; orientationApplied: boolean }

export interface ProcessResult {
  status: ResultStatus;
  blob: Blob;                 // ACTUAL encoded bytes; blob.size is the only truth about size
  mime: string;               // verified by magic bytes, not assumed from the request
  width: number;
  height: number;
  bytes: number;              // === blob.size
  quality: number | null;     // 1–100 for lossy, null for PNG
  attempts: number;           // encodes performed
  window: { minBytes: number | null; maxBytes: number | null };
  source: SourceInfo;
  /** Human-readable disclosures that MUST be shown with the result (e.g. "Transparent areas were filled with white"). */
  notes: string[];
  /** One-sentence plain explanation for non-ok statuses and raised results. */
  message: string;
  /** [engine ext] Where the work ran. */
  mode?: 'worker' | 'main-thread';
  /** [engine ext] True when the ORIGINAL file's byte size already lies inside the window (UI may offer "keep original"; note: the original keeps its EXIF/GPS). */
  originalFits?: boolean;
  /** [engine ext] Elapsed processing time in ms (decode + all encodes). */
  elapsedMs?: number;
}

export type EngineErrorCode =
  | 'unsupported_type'   // not JPEG/PNG/WebP by magic bytes (incl. SVG, HEIC, GIF)
  | 'corrupt'            // decode failed
  | 'too_large_bytes'    // file bigger than the byte cap
  | 'too_many_pixels'    // header says more pixels than the cap
  | 'timeout'
  | 'cancelled'
  | 'out_of_memory'
  | 'encode_unsupported' // requested format cannot be encoded here (e.g. WebP in Safari) and no fallback was allowed
  | 'invalid_options'
  | 'worker_failed';     // [engine ext] the worker script failed to load or crashed (not an image problem)

export class EngineError extends Error {
  constructor(public code: EngineErrorCode, message: string) { super(message); this.name = 'EngineError'; }
}

export interface ProcessHooks {
  signal?: AbortSignal;                                  // cancellation; must reject with EngineError('cancelled') and release resources
  onProgress?: (p: { stage: 'reading' | 'decoding' | 'encoding'; attempt?: number; total?: number }) => void;
}

/** Engine limits (configurable constants in src/lib/engine/limits.ts). */
export interface EngineLimits { maxFileBytes: number; maxPixels: number; maxWorkingPixels: number; timeoutMs: number; maxEncodes: number }

export type ProcessImage = (file: File | Blob, opts: ProcessOptions, hooks?: ProcessHooks) => Promise<ProcessResult>;
