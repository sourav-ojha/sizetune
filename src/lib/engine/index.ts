// Public surface of the engine. See docs/engine/ENGINE.md.
export * from './types';
export { DEFAULT_LIMITS, resolveLimits, type FullLimits } from './limits';
export { byteWindow, type ByteWindow } from './window';
export { formatKb, formatLabel, NOTES, PRIVACY_NOTE } from './messages';
export { sniffType, type ImageMime } from './sniff';
export { readHeader, parseHeader, type HeaderInfo } from './header';
export { inspectFile, type FileInspection } from './inspect';
export { resolveGeometry, type Geometry } from './dims';
export { createObjectUrlSlot, outputFileName, type ObjectUrlSlot } from './urls';
export { supportsWorkerEngine, canEncode } from './support';
export { createEngine, createWorkerClient, createMainThreadClient, type EngineClient, type WorkerLike, type EngineOptions } from './client';
export { runPipeline } from './pipeline';

import type { ProcessImage } from './types';
import { createEngine, type WorkerLike } from './client';

/** The bundler (Vite) recognises this exact `new Worker(new URL(...), { type: 'module' })` pattern and emits the worker chunk. */
const createDefaultWorker = (): WorkerLike => new Worker(new URL('./compress.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;

let engine: ReturnType<typeof createEngine> | null = null;
const getEngine = () => (engine ??= createEngine({ createWorker: createDefaultWorker }));

/**
 * Process one image entirely in the browser. Latest call wins: starting a new call cancels the previous one
 * (its promise rejects with EngineError('cancelled')).
 */
export const processImage: ProcessImage = (file, opts, hooks) => getEngine().process(file, opts, hooks);
/** Cancel the running job of the default engine (no-op if idle). */
export const cancelProcessing = () => engine?.cancel();
/** Terminate the default engine's worker (e.g. on page hide). A later processImage starts a new one. */
export function disposeEngine() { engine?.dispose(); engine = null; }
/** Which path the default engine uses ('worker' | 'main-thread'), decided by feature detection. */
export const engineMode = () => getEngine().mode;
