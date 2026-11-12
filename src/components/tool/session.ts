import type { ProcessImage, ProcessOptions, ProcessResult } from '../../lib/engine/types';
import { toToolError, type ErrorContext, type ToolError } from './errors';
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
  /** blob: URL of the original (preview + "before" image); revoked by the session. */
  previewUrl: string | null;
  sniff: Sniff | null;
  /** Real transparency: false when the header rules it out, null until the preview has been scanned, then true/false. */
  alpha: boolean | null;
  /** Source pixel size as the browser displays it (EXIF applied); reported by the preview <img>. */
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
  readHead?: (f: Blob) => Promise<Uint8Array>;
}

const EMPTY: SessionState = {
  phase: 'empty', file: null, previewUrl: null, sniff: null, alpha: null, natural: null, progress: null, result: null, error: null, notice: null, fileSerial: 0,
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
      const ctx: ErrorContext = { maxFileBytes: this.deps.maxFileBytes };
      const reject = (code: 'too_large_bytes' | 'corrupt' | 'unsupported_type') => this.set({ error: toToolError({ name: 'EngineError', code }, ctx), notice: null });
      if (this.deps.maxFileBytes && file.size > this.deps.maxFileBytes) return reject('too_large_bytes');
      let sniff: Sniff;
      try {
        sniff = sniffImage(await (this.deps.readHead ?? defaultReadHead)(file));
      } catch {
        if (token === this.fileToken) reject('corrupt');
        return;
      }
      if (token !== this.fileToken) return; // a newer selection won
      if (!sniff.kind) return reject('unsupported_type');
      this.stopRun();
      this.dropResult();
      this.revoke(this.state.previewUrl);
      this.set({ ...EMPTY, fileSerial: this.state.fileSerial + 1, notice, phase: 'ready', file, sniff, alpha: sniff.hasAlpha === false ? false : null, previewUrl: this.deps.createObjectURL(file) });
      return;
    }
    this.stopRun();
    this.dropResult();
    this.revoke(this.state.previewUrl);
    this.set({ ...EMPTY, fileSerial: this.state.fileSerial + 1, notice });
  }

  setNatural(url: string, width: number, height: number): void {
    if (url !== this.state.previewUrl || !(width > 0) || !(height > 0)) return;
    const n = this.state.natural;
    if (n && n.width === width && n.height === height) return;
    this.set({ natural: { width, height } });
  }

  /** Result of scanning the preview for real transparency (ignored for a stale preview). */
  setAlpha(url: string, value: boolean): void {
    if (url !== this.state.previewUrl || this.state.alpha === value) return;
    this.set({ alpha: value });
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
      const err = toToolError(e, { maxFileBytes: this.deps.maxFileBytes, requestedFormat: options.format });
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
    this.revoke(this.state.previewUrl);
    this.state = { ...EMPTY, fileSerial: this.state.fileSerial + 1 };
    this.listeners.forEach((l) => l());
  }
}
