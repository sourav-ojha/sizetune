/** Messages between the engine client and compress.worker.ts. */
import type { EngineErrorCode, ProcessHooks, ProcessOptions, ProcessResult } from './types';
import type { FullLimits } from './limits';

type Progress = Parameters<NonNullable<ProcessHooks['onProgress']>>[0];

export type ToWorker =
  | { type: 'process'; id: number; file: Blob; opts: ProcessOptions; limits?: Partial<FullLimits> }
  | { type: 'cancel'; id: number };

export type FromWorker =
  | { type: 'progress'; id: number; p: Progress }
  | { type: 'result'; id: number; result: ProcessResult }
  | { type: 'error'; id: number; code: EngineErrorCode; message: string };
