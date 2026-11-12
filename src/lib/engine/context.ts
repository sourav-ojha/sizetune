/** Cancellation + deadline for one job. Every await on browser work goes through `race` so abort/timeout return promptly. */
import { EngineError } from './types';

export const cancelled = () => new EngineError('cancelled', 'Processing was cancelled.');
export const timedOut = () => new EngineError('timeout', 'Processing took too long. Try a smaller image.');

export class RunContext {
  readonly deadline: number;
  constructor(private readonly signal: AbortSignal | undefined, timeoutMs: number, private readonly now: () => number = () => Date.now()) {
    this.deadline = now() + timeoutMs;
  }

  check(): void {
    if (this.signal?.aborted) throw cancelled();
    if (this.now() > this.deadline) throw timedOut();
  }

  /**
   * Await `p`, rejecting early on abort or deadline. If `p` resolves after we gave up, `onLate` receives the value
   * (used to close a late ImageBitmap so nothing leaks).
   */
  race<T>(p: Promise<T>, onLate?: (v: T) => void): Promise<T> {
    try { this.check(); } catch (e) { p.then((v) => onLate?.(v), () => {}); return Promise.reject(e); }
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const cleanup = () => { clearTimeout(timer); this.signal?.removeEventListener('abort', onAbort); };
      const finish = (fn: () => void) => { if (settled) return; settled = true; cleanup(); fn(); };
      const onAbort = () => finish(() => reject(cancelled()));
      const timer = setTimeout(() => finish(() => reject(timedOut())), Math.max(0, this.deadline - this.now()));
      this.signal?.addEventListener('abort', onAbort, { once: true });
      p.then(
        (v) => { if (settled) onLate?.(v); else finish(() => resolve(v)); },
        (e) => finish(() => reject(e)),
      );
    });
  }
}
