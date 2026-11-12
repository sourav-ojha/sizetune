/**
 * Worker client + facade.
 * - Latest request wins: starting a new job cancels the running one (rejects 'cancelled', worker terminated) -> no stale results.
 * - AbortSignal -> reject 'cancelled' immediately and terminate the worker (bitmaps die with it).
 * - Timeout -> reject 'timeout' and terminate.
 * - Worker lifecycle is deterministic: terminated after any failure/cancel/timeout, after a job whose source exceeded
 *   `reuseMaxSourcePixels`, and after `idleMs` without work; otherwise reused for the next job.
 * - Main-thread fallback is used ONLY when feature detection says the worker path is unavailable.
 */
import { EngineError, type ProcessHooks, type ProcessOptions, type ProcessResult } from './types';
import { resolveLimits, type FullLimits } from './limits';
import { cancelled, timedOut } from './context';
import type { FromWorker, ToWorker } from './protocol';
import { supportsWorkerEngine } from './support';
import { runPipeline } from './pipeline';
import { createCanvasEnv } from './canvas-env';

export interface WorkerLike {
  postMessage(m: ToWorker): void;
  terminate(): void;
  onmessage: ((e: MessageEvent<FromWorker>) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  onmessageerror: ((e: MessageEvent) => void) | null;
}

export interface WorkerClientOptions {
  createWorker: () => WorkerLike;
  limits?: Partial<FullLimits>;
  /** Terminate an idle worker after this many ms (default 15 s). */
  idleMs?: number;
  /** Do not reuse a worker after a job whose source had more pixels than this (default 4 MP): frees allocator memory. */
  reuseMaxSourcePixels?: number;
  /** Extra time on top of limits.timeoutMs before the client kills the worker (default 2 s; the worker times out itself first). */
  graceMs?: number;
}

export interface EngineClient {
  process(file: Blob, opts: ProcessOptions, hooks?: ProcessHooks): Promise<ProcessResult>;
  /** Cancel the running job, if any. */
  cancel(): void;
  /** Cancel and terminate everything. */
  dispose(): void;
  /** Number of live workers (0 or 1). For tests and diagnostics. */
  readonly liveWorkers: number;
}

interface Job { fail(e: EngineError): void }

export function createWorkerClient(o: WorkerClientOptions): EngineClient {
  const limits = resolveLimits(o.limits);
  const idleMs = o.idleMs ?? 15_000;
  const reuseMax = o.reuseMaxSourcePixels ?? 4_000_000;
  const grace = o.graceMs ?? 2_000;
  let worker: WorkerLike | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let current: Job | null = null;
  let seq = 0;

  const kill = () => {
    clearTimeout(idleTimer);
    if (worker) {
      worker.onmessage = worker.onerror = worker.onmessageerror = null;
      worker.terminate();
      worker = null;
    }
  };

  function process(file: Blob, opts: ProcessOptions, hooks: ProcessHooks = {}): Promise<ProcessResult> {
    current?.fail(new EngineError('cancelled', 'Replaced by a newer request.'));
    if (hooks.signal?.aborted) return Promise.reject(cancelled());
    const id = ++seq;
    clearTimeout(idleTimer);
    return new Promise<ProcessResult>((resolve, reject) => {
      let done = false;
      let w: WorkerLike;
      try {
        w = worker ??= o.createWorker();
      } catch {
        reject(new EngineError('worker_failed', 'The image worker could not be started.'));
        return;
      }
      const cleanup = () => {
        clearTimeout(timer);
        hooks.signal?.removeEventListener('abort', onAbort);
        if (current === job) current = null;
      };
      const job: Job = {
        fail(e) {
          if (done) return;
          done = true;
          cleanup();
          kill(); // deterministic release of decoded bitmaps/canvases
          reject(e);
        },
      };
      const succeed = (r: ProcessResult) => {
        if (done) return;
        done = true;
        cleanup();
        if (r.source.width * r.source.height > reuseMax) kill();
        else idleTimer = setTimeout(kill, idleMs);
        resolve(r);
      };
      const onAbort = () => {
        try { w.postMessage({ type: 'cancel', id }); } catch { /* worker may be gone */ }
        job.fail(cancelled());
      };
      const timer = setTimeout(() => job.fail(timedOut()), limits.timeoutMs + grace);
      hooks.signal?.addEventListener('abort', onAbort, { once: true });
      w.onmessage = (e) => {
        const m = e.data;
        if (!m || m.id !== id || done) return;
        if (m.type === 'progress') hooks.onProgress?.(m.p);
        else if (m.type === 'result') succeed(m.result);
        else if (m.type === 'error') job.fail(new EngineError(m.code, m.message));
      };
      w.onerror = (e) => { e?.preventDefault?.(); job.fail(new EngineError('worker_failed', 'The image worker failed to load or crashed.')); };
      w.onmessageerror = () => job.fail(new EngineError('worker_failed', 'The image worker sent an unreadable message.'));
      current = job;
      try {
        w.postMessage({ type: 'process', id, file, opts, limits: o.limits });
      } catch {
        job.fail(new EngineError('worker_failed', 'The image could not be sent to the worker.'));
      }
    });
  }

  return {
    process,
    cancel() { current?.fail(cancelled()); },
    dispose() { current?.fail(cancelled()); kill(); },
    get liveWorkers() { return worker ? 1 : 0; },
  };
}

/** Main-thread runner (fallback only). Same pipeline, DOM canvas, yields between encodes, same timeout + cancellation. Latest wins. */
export function createMainThreadClient(o: { limits?: Partial<FullLimits> } = {}): EngineClient {
  let current: AbortController | null = null;
  return {
    async process(file, opts, hooks = {}) {
      current?.abort();
      const ac = new AbortController();
      current = ac;
      const onAbort = () => ac.abort();
      if (hooks.signal?.aborted) ac.abort();
      hooks.signal?.addEventListener('abort', onAbort, { once: true });
      try {
        return await runPipeline(file, opts, createCanvasEnv('dom'), { signal: ac.signal, onProgress: hooks.onProgress }, { limits: o.limits, mode: 'main-thread' });
      } finally {
        hooks.signal?.removeEventListener('abort', onAbort);
        if (current === ac) current = null;
      }
    },
    cancel() { current?.abort(); },
    dispose() { current?.abort(); },
    liveWorkers: 0,
  };
}

export interface EngineOptions extends Omit<WorkerClientOptions, 'createWorker'> {
  createWorker: () => WorkerLike;
  /** Override feature detection (tests). */
  supportsWorker?: () => boolean;
}

/** Picks the worker client when supported, else the main-thread client. Decided once, by feature detection. */
export function createEngine(o: EngineOptions): EngineClient & { readonly mode: 'worker' | 'main-thread' } {
  const useWorker = (o.supportsWorker ?? supportsWorkerEngine)();
  const c = useWorker ? createWorkerClient(o) : createMainThreadClient({ limits: o.limits });
  return {
    process: c.process,
    cancel: c.cancel,
    dispose: c.dispose,
    get liveWorkers() { return c.liveWorkers; },
    mode: useWorker ? 'worker' : 'main-thread',
  };
}
