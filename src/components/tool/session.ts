import type { ProcessImage, ProcessOptions, ProcessResult } from '../../lib/engine/types';
import { errorCodeOf, INTERRUPTED, toToolError, type ErrorContext, type ToolError } from './errors';
import type { Thumb } from './thumb';
import { suggestFilename } from './format';
import { sniffImage, SNIFF_BYTES, type Sniff } from './sniff';

export type Phase = 'empty' | 'ready' | 'processing' | 'done';
export type Stage = 'reading' | 'decoding' | 'encoding';
export interface Progress { stage: Stage; attempt?: number; total?: number }

export interface ResultView {
  data: ProcessResult;
  /** blob: URL of the encoded result; revoked by the session. */
  url: string;
  filename: string;
  /** Options the run was made with (to show target basis). */
  options: ProcessOptions;
}

export interface SessionState {
  phase: Phase;
  file: File | null;
  /** blob: URL of the preview / "before" image: the file itself for small images, else a reduced-size thumbnail (null: no preview). Revoked by the session. */
  previewUrl: string | null;
  /** blob: URL of the untouched original file (only used for "keep your original"; never decoded by the UI). */
  originalUrl: string | null;
  /** The file header says it contains EXIF location (GPS) data. */
  gps: boolean;
  /** Why there is no preview image: 'too-large' (above the preview decode limit) or 'failed' (the reduced decode failed, file may be incomplete). */
  previewNote: 'too-large' | 'failed' | null;
  sniff: Sniff | null;
  /** Real transparency: false when the header rules it out, null until the preview has been scanned, then true/false. */
  alpha: boolean | null;
  /** Source pixel size after EXIF orientation, from the file header (never from a decode). */
  natural: { width: number; height: number } | null;
  progress: Progress | null;
  result: ResultView | null;
  error: ToolError | null;
  notice: string | null;
  /** Monotonic counter bumped on every file change/reset; lets the UI key state to a file. */
  fileSerial: number;
}

export interface SessionDeps {
  process: ProcessImage;
  createObjectURL: (b: Blob) => string;
  revokeObjectURL: (u: string) => void;
  maxFileBytes?: number;
  maxPixels?: number;
  readHead?: (f: Blob) => Promise<Uint8Array>;
  /** Header-only inspection (no decode): display size after EXIF orientation, EXIF GPS flag. Throws EngineError (limits, unsupported, corrupt). */
  inspect?: (f: Blob) => Promise<{ width: number; height: number; hasGps?: boolean }>;
  /** Reduced-size preview + alpha probe. Without it the file itself is the preview. */
  makeThumbnail?: (f: Blob, w: number, h: number, alphaPossible: boolean) => Promise<Thumb>;
}

const EMPTY: SessionState = {
  phase: 'empty', file: null, previewUrl: null, originalUrl: null, gps: false, previewNote: null, sniff: null, alpha: null, natural: null, progress: null, result: null, error: null, notice: null, fileSerial: 0,
};

const defaultReadHead = async (f: Blob): Promise<Uint8Array> => new Uint8Array(await f.slice(0, SNIFF_BYTES).arrayBuffer());

/**
 * Framework-free controller for one tool instance. Owns: the selected file, every object URL, the in-flight run and its AbortController.
 * Invariants: results of superseded runs are dropped (run id); every URL created is revoked on replace/reset/dispose; nothing is persisted or logged.
 */
export class ToolSession {
  private state: SessionState = EMPTY;
  private listeners = new Set<() => void>();
  private runId = 0;
  private fileToken = 0;
  private abort: AbortController | null = null;

  constructor(private deps: SessionDeps) {}

  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = (): SessionState => this.state;

  private set(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  private revoke(u: string | null | undefined): void { if (u) this.deps.revokeObjectURL(u); }

  /** Revokes the preview/original URLs of the current file (each once, they may be the same URL). */
  private dropFileUrls(): void {
    const { previewUrl, originalUrl } = this.state;
    this.revoke(originalUrl);
    if (previewUrl && previewUrl !== originalUrl) this.revoke(previewUrl);
  }

  private stopRun(): void {
    this.runId++;
    this.abort?.abort();
    this.abort = null;
  }

  private dropResult(): void {
    this.revoke(this.state.result?.url);
  }

  /**
   * Select a file (or null to clear). The new file is validated BEFORE anything is reset: a wrong-type or oversized pick
   * leaves the current file/result untouched and only reports the error. Accepting a file cancels any run and drops the previous result.
   */
  async selectFile(file: File | null, notice: string | null = null): Promise<void> {
    const token = ++this.fileToken;
    if (file) {
      const ctx: ErrorContext = { maxFileBytes: this.deps.maxFileBytes, maxPixels: this.deps.maxPixels };
      const reject = (e: unknown, extra: ErrorContext = {}) => this.set({ error: toToolError(e, { ...ctx, ...extra }), notice: null });
      const code = (c: 'too_large_bytes' | 'corrupt' | 'unsupported_type' | 'too_many_pixels') => ({ name: 'EngineError', code: c });
      // 1. cheap checks that need no decode and create no object URL
      if (this.deps.maxFileBytes && file.size > this.deps.maxFileBytes) return reject(code('too_large_bytes'));
      let head: Uint8Array;
      try { head = await (this.deps.readHead ?? defaultReadHead)(file); } catch { if (token === this.fileToken) reject(code('corrupt')); return; }
      if (token !== this.fileToken) return; // a newer selection won
      const sniff = sniffImage(head);
      if (!sniff.kind) return reject(code('unsupported_type'));
      let size: { width: number; height: number; hasGps?: boolean } | null = null;
      if (this.deps.inspect) {
        try { size = await this.deps.inspect(file); } catch (e) {
          if (token === this.fileToken) { const d = e as { width?: number; height?: number }; reject(e, { width: d.width, height: d.height }); }
          return;
        }
        if (token !== this.fileToken) return;
        if (this.deps.maxPixels && size.width * size.height > this.deps.maxPixels) return reject(code('too_many_pixels'), { width: size.width, height: size.height });
      }
      // 2. reduced preview (only now, after the file passed the header checks)
      const alphaPossible = sniff.hasAlpha !== false;
      let thumb: Thumb = { kind: 'original', alpha: alphaPossible ? null : false };
      if (this.deps.makeThumbnail && size) {
        try { thumb = await this.deps.makeThumbnail(file, size.width, size.height, alphaPossible); } catch { thumb = { kind: 'none', alpha: alphaPossible ? null : false, reason: 'failed' }; }
        if (token !== this.fileToken) return;
      }
      // 3. accept: replace everything
      this.stopRun();
      this.dropResult();
      this.dropFileUrls();
      const originalUrl = this.deps.createObjectURL(file);
      const previewUrl = thumb.kind === 'original' ? originalUrl : thumb.kind === 'thumb' ? this.deps.createObjectURL(thumb.blob) : null;
      this.set({
        ...EMPTY, fileSerial: this.state.fileSerial + 1, notice, phase: 'ready', file, sniff,
        alpha: sniff.hasAlpha === false ? false : thumb.alpha, gps: size?.hasGps === true, previewNote: thumb.kind === 'none' ? thumb.reason : null, natural: size ? { width: size.width, height: size.height } : null, previewUrl, originalUrl,
      });
      return;
    }
    this.stopRun();
    this.dropResult();
    this.dropFileUrls();
    this.set({ ...EMPTY, fileSerial: this.state.fileSerial + 1, notice });
  }

  /** Runs the engine. Ignored unless a file is ready. A newer run/cancel/reset makes this one's result be dropped. */
  async run(options: ProcessOptions): Promise<void> {
    const { file, phase } = this.state;
    if (!file || phase === 'empty') return;
    this.stopRun();
    this.dropResult();
    const my = this.runId;
    const ctrl = new AbortController();
    this.abort = ctrl;
    this.set({ phase: 'processing', result: null, error: null, notice: null, progress: { stage: 'reading' } });
    try {
      const data = await this.deps.process(file, options, {
        signal: ctrl.signal,
        onProgress: (p) => { if (my === this.runId) this.set({ progress: { stage: p.stage, attempt: p.attempt, total: p.total } }); },
      });
      if (my !== this.runId) return;
      this.abort = null;
      const url = this.deps.createObjectURL(data.blob);
      this.set({
        phase: 'done', progress: null,
        result: { data, url, options, filename: suggestFilename(file.name, data.mime) },
      });
    } catch (e) {
      if (my !== this.runId) return;
      this.abort = null;
      let err = toToolError(e, { maxFileBytes: this.deps.maxFileBytes, requestedFormat: options.format, width: this.state.natural?.width, height: this.state.natural?.height });
      // 'cancelled' is only silent when WE aborted (Cancel / settings change / new file all bump runId, handled above)
      if (errorCodeOf(e) === 'cancelled' && !ctrl.signal.aborted) err = INTERRUPTED;
      this.set({ phase: 'ready', progress: null, error: err.code === 'cancelled' ? null : err });
    }
  }

  /** User pressed Cancel: stop the engine, keep the file. Silent. */
  cancel(): void {
    if (this.state.phase !== 'processing') return;
    this.stopRun();
    this.set({ phase: 'ready', progress: null, error: null });
  }

  /** Drop the result (e.g. settings changed) and go back to ready. */
  clearResult(): void {
    if (this.state.phase === 'processing') {
      this.stopRun();
      this.set({ phase: 'ready', progress: null, notice: 'Settings changed, so the run was cancelled. Press the button to run again.' });
    } else if (this.state.result) {
      this.dropResult();
      this.set({ result: null, phase: 'ready', progress: null });
    }
  }

  dismissError(): void { if (this.state.error) this.set({ error: null }); }
  dismissNotice(): void { if (this.state.notice) this.set({ notice: null }); }

  /** Back to the empty state ("process another image"). */
  reset(): void { void this.selectFile(null); }

  /** Unmount: abort, revoke everything, forget the file. Safe to call repeatedly. */
  dispose(): void {
    this.stopRun();
    this.fileToken++;
    this.dropResult();
    this.dropFileUrls();
    this.state = { ...EMPTY, fileSerial: this.state.fileSerial + 1 };
    this.listeners.forEach((l) => l());
  }
}
