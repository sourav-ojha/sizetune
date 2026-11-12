export interface WorkerRequest { file: Blob; targetBytes: number }
export type WorkerResponse =
  | { ok: true; blob: Blob; quality: number; scale: number; fits: boolean; attempts: number; mode: 'worker' }
  | { ok: false; error: string };
