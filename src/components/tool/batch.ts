import { EngineError, type ProcessImage, type ProcessOptions, type ProcessResult } from './engine';
import { formatKb } from './format';
import { makeZip, uniqueNames } from '../../lib/zip';

/**
 * Batch limits. PROPOSED, NOT YET CONFIRMED on real devices (FEATURE-005 AC-10 needs an iPhone and a low-RAM Android):
 * ten files and 60 MB in total are deliberately conservative. Change them here once the device test says what is safe.
 */
export const BATCH_MAX_FILES = 10;
export const BATCH_MAX_TOTAL_BYTES = 60 * 1024 * 1024;

export type RowStatus = 'queued' | 'processing' | 'reached' | 'not-reached' | 'failed' | 'cancelled';

export interface Row {
  id: number;
  name: string;
  size: number;
  status: RowStatus;
  /** Plain explanation for a failure or a missed target (the engine's user-safe message). */
  message?: string;
  bytes?: number;
  width?: number;
  height?: number;
  mime?: string;
  blob?: Blob;
  url?: string;
}

export interface BatchSnapshot { rows: Row[]; running: boolean }

export interface BatchDeps {
  process: ProcessImage;
  createObjectURL: (b: Blob) => string;
  revokeObjectURL: (u: string) => void;
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** The saved file's name: the original name with the extension of what was really produced. */
export function outputName(name: string, mime: string): string {
  const ext = EXT[mime];
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return ext ? `${base}.${ext}` : name;
}

const mb = (n: number) => `${Math.round(n / (1024 * 1024))} MB`;

/**
 * Framework-free queue for a batch. One file is processed at a time through the existing engine, so memory use stays that of a single file.
 * Owns every object URL it creates and revokes them on reset and dispose. Nothing is persisted or sent anywhere.
 */
export class BatchRunner {
  private snap: BatchSnapshot = { rows: [], running: false };
  private listeners = new Set<() => void>();
  private abort: AbortController | null = null;
  private nextId = 1;
  private run = 0;
  private files = new Map<number, File>(); // kept apart from the rows so the UI state never holds File objects it does not need

  constructor(private deps: BatchDeps) {}

  subscribe = (l: () => void): (() => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getSnapshot = (): BatchSnapshot => this.snap;
  private set(patch: Partial<BatchSnapshot>) { this.snap = { ...this.snap, ...patch }; for (const l of [...this.listeners]) l(); }
  private patchRow(id: number, patch: Partial<Row>) { this.set({ rows: this.snap.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }); }

  /** Adds files while the file and size caps allow. Files over the caps are left out, never queued. */
  add(files: File[]): { added: number; message: string | null } {
    if (this.snap.running) return { added: 0, message: 'Wait until the batch finishes, or cancel it, before adding more files.' };
    let total = this.snap.rows.reduce((n, r) => n + r.size, 0);
    const accepted: File[] = [];
    for (const f of files) {
      if (this.snap.rows.length + accepted.length >= BATCH_MAX_FILES || total + f.size > BATCH_MAX_TOTAL_BYTES) break;
      accepted.push(f);
      total += f.size;
    }
    const added = accepted.map((f): Row => { const id = this.nextId++; this.files.set(id, f); return { id, name: f.name, size: f.size, status: 'queued' }; });
    this.set({ rows: [...this.snap.rows, ...added] });
    const left = files.length - accepted.length;
    return { added: accepted.length, message: left > 0 ? `Only ${accepted.length} of ${files.length} files were added. A batch holds at most ${BATCH_MAX_FILES} files and ${mb(BATCH_MAX_TOTAL_BYTES)} in total, so the other ${left} were left out.` : null };
  }

  private clearResults() {
    for (const r of this.snap.rows) if (r.url) this.deps.revokeObjectURL(r.url);
    this.set({ rows: this.snap.rows.map(({ id, name, size }): Row => ({ id, name, size, status: 'queued' })) });
  }

  /** Processes every queued row, one after another, with the same options. Calling it again re-processes all rows with new options. */
  start(options: ProcessOptions): void {
    if (this.snap.running || !this.snap.rows.length) return;
    if (this.snap.rows.some((r) => r.status !== 'queued')) this.clearResults();
    const mine = ++this.run;
    this.abort = new AbortController();
    const signal = this.abort.signal;
    this.set({ running: true });
    void (async () => {
      for (const row of this.snap.rows) {
        if (mine !== this.run) return;
        if (signal.aborted) { this.patchRow(row.id, { status: 'cancelled' }); continue; }
        this.patchRow(row.id, { status: 'processing' });
        const file = this.files.get(row.id)!;
        try {
          const r: ProcessResult = await this.deps.process(file, options, { signal });
          if (mine !== this.run) return;
          const reached = r.status === 'ok' || r.status === 'raised';
          this.patchRow(row.id, { status: reached ? 'reached' : 'not-reached', message: reached ? undefined : r.message, bytes: r.bytes, width: r.width, height: r.height, mime: r.mime, blob: r.blob, url: this.deps.createObjectURL(r.blob) });
        } catch (e) {
          if (mine !== this.run) return;
          if (e instanceof EngineError && e.code === 'cancelled') this.patchRow(row.id, { status: 'cancelled' });
          else this.patchRow(row.id, { status: 'failed', message: e instanceof EngineError ? e.message : 'This image could not be processed.' });
        }
      }
      if (mine === this.run) { this.abort = null; this.set({ running: false }); }
    })();
  }

  /** Stops the running file and marks the rest cancelled. Finished files stay available. */
  cancel(): void {
    this.abort?.abort();
  }

  reset(): void {
    this.run++;
    this.abort?.abort();
    this.abort = null;
    for (const r of this.snap.rows) if (r.url) this.deps.revokeObjectURL(r.url);
    this.files.clear();
    this.set({ rows: [], running: false });
  }

  dispose(): void {
    this.reset();
    this.listeners.clear();
  }
}

const statusLine = (r: Row, out?: string): string => {
  switch (r.status) {
    case 'reached': return `${r.name} -> ${out}: reached the target, ${formatKb(r.bytes ?? 0)} (${r.width} x ${r.height} px)`;
    case 'not-reached': return `${r.name}: target not reached, best result ${formatKb(r.bytes ?? 0)}, not included in this ZIP${r.message ? `. ${r.message}` : ''}`;
    case 'failed': return `${r.name}: failed. ${r.message ?? ''}`.trim();
    case 'cancelled': return `${r.name}: cancelled`;
    default: return `${r.name}: ${r.status}`;
  }
};

/** One ZIP of every file that reached its target, plus a plain-text report with a status for every file in the batch. */
export async function buildBatchZip(rows: Row[]): Promise<Uint8Array> {
  const done = rows.filter((r) => r.status === 'reached' && r.blob);
  const names = uniqueNames(done.map((r) => outputName(r.name, r.mime ?? '')));
  const outNames = new Map(done.map((r, i) => [r.id, names[i]]));
  const files = await Promise.all(done.map(async (r, i) => ({ name: names[i], data: new Uint8Array(await r.blob!.arrayBuffer()) })));
  const lines = ['SizeTune batch report', '', ...rows.map((r) => statusLine(r, outNames.get(r.id))), ''];
  files.push({ name: 'SizeTune-report.txt', data: new TextEncoder().encode(lines.join('\n')) });
  return makeZip(files);
}
