/** TEST-ONLY fake of the engine contract (never imported by production code). Lets tests control timing, results and errors. */
import { EngineError, type ProcessHooks, type ProcessImage, type ProcessOptions, type ProcessResult } from '../../src/lib/engine/types';

export interface FakeCall { file: Blob; opts: ProcessOptions; hooks?: ProcessHooks; resolve: (r: ProcessResult) => void; reject: (e: unknown) => void }

export function makeResult(over: Partial<ProcessResult> = {}): ProcessResult {
  const blob = over.blob ?? new Blob([new Uint8Array(over.bytes ?? 1234)], { type: over.mime ?? 'image/jpeg' });
  return {
    status: 'ok', blob, mime: 'image/jpeg', width: 300, height: 200, bytes: blob.size, quality: 80, attempts: 5,
    window: { minBytes: null, maxBytes: 20000 },
    source: { bytes: 100000, width: 600, height: 400, mime: 'image/png', hasAlpha: false, orientationApplied: false },
    notes: [], message: '', ...over,
  };
}

/** A manual fake: each process() call is parked until the test settles it. Abort rejects with EngineError('cancelled'). */
export function manualEngine() {
  const calls: FakeCall[] = [];
  const process: ProcessImage = (file, opts, hooks) =>
    new Promise<ProcessResult>((resolve, reject) => {
      const call: FakeCall = { file, opts, hooks, resolve, reject };
      calls.push(call);
      hooks?.signal?.addEventListener('abort', () => reject(new EngineError('cancelled', 'cancelled')));
    });
  return { calls, process };
}

export const PNG_HEAD = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
export const pngFile = (name = 'photo.png'): File => new File([PNG_HEAD], name, { type: 'image/png' });
