/** Module worker entry. One job at a time; the client terminates this worker on cancel/timeout/error. */
import { EngineError } from './types';
import { runPipeline } from './pipeline';
import { createCanvasEnv } from './canvas-env';
import type { FromWorker, ToWorker } from './protocol';

interface Scope { onmessage: ((e: MessageEvent<ToWorker>) => void) | null; postMessage(m: FromWorker): void }
const scope = self as unknown as Scope;
const jobs = new Map<number, AbortController>();

scope.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'cancel') { jobs.get(m.id)?.abort(); return; }
  if (m.type !== 'process') return;
  const ac = new AbortController();
  jobs.set(m.id, ac);
  try {
    const result = await runPipeline(m.file, m.opts, createCanvasEnv('offscreen'), {
      signal: ac.signal,
      onProgress: (p) => scope.postMessage({ type: 'progress', id: m.id, p }),
    }, { limits: m.limits, mode: 'worker' });
    scope.postMessage({ type: 'result', id: m.id, result });
  } catch (err) {
    const ee = err instanceof EngineError ? err : new EngineError('worker_failed', 'Something went wrong while processing the image.');
    scope.postMessage({ type: 'error', id: m.id, code: ee.code, message: ee.message });
  } finally {
    jobs.delete(m.id);
  }
};
