import { useEffect, useRef, useState } from 'react';
import type { WorkerResponse } from '../lib/types';
import { compressToTarget } from '../lib/compress';

type Mode = 'worker' | 'main-thread';
type State =
  | { s: 'idle' }
  | { s: 'working' }
  | { s: 'done'; url: string; size: number; fits: boolean; quality: number; scale: number; mode: Mode }
  | { s: 'error'; msg: string };

const fmt = (b: number) => (b / 1024).toFixed(1) + ' KB';
const MAX_PIXELS = 64_000_000; // refuse absurd inputs before allocating canvases
const TIMEOUT_MS = 60_000;
const supportsWorker = () => typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined';

async function checkSize(file: File) {
  const bmp = await createImageBitmap(file); // throws for undecodable files
  const px = bmp.width * bmp.height;
  bmp.close();
  if (px > MAX_PIXELS) throw new Error('This image is too large to process in the browser. Try a smaller photo.');
}

/** Used only when the browser has no OffscreenCanvas/Worker (feature detection, not error recovery). */
async function compressOnMainThread(file: File, targetBytes: number) {
  const bmp = await createImageBitmap(file);
  try {
  const encode = (scale: number, quality: number) =>
    new Promise<Blob>((resolve, reject) => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * scale));
      c.height = Math.max(1, Math.round(bmp.height * scale));
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality);
    });
  const r = await compressToTarget(encode, targetBytes);
  return { ...r, mode: 'main-thread' as const };
  } finally {
    bmp.close();
  }
}

/** Type allow-list by magic bytes (the `accept` attribute is only a hint). Rejects SVG/HEIC/other. */
async function sniff(file: File): Promise<boolean> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const webp = String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';
  return jpeg || png || webp;
}

function compressInWorker(file: File, targetBytes: number, hold: { w: Worker | null }): Promise<Extract<WorkerResponse, { ok: true }>> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('../lib/compress.worker.ts', import.meta.url), { type: 'module' });
    hold.w = w;
    const timer = setTimeout(() => { w.terminate(); reject(new Error('Processing took too long. Try a smaller image.')); }, TIMEOUT_MS);
    const done = () => { clearTimeout(timer); w.terminate(); };
    w.onmessage = (e: MessageEvent<WorkerResponse>) => { done(); e.data.ok ? resolve(e.data) : reject(new Error('This image could not be processed.')); };
    w.onmessageerror = () => { done(); reject(new Error('Worker message error')); };
    w.onerror = (e) => { done(); reject(new Error(e.message || 'Worker error')); };
    w.postMessage({ file, targetBytes });
  });
}

export default function ImageCompressor({ defaultTargetKb = 50 }: { defaultTargetKb?: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [targetKb, setTargetKb] = useState(defaultTargetKb);
  const [state, setState] = useState<State>({ s: 'idle' });
  const lastUrl = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runId = useRef(0); // ignore results of superseded runs
  const worker = useRef<{ w: Worker | null }>({ w: null });
  const cancel = () => { runId.current++; worker.current.w?.terminate(); worker.current.w = null; };

  // A file chosen before hydration (slow phones) would otherwise be invisible to React state.
  useEffect(() => { const f = inputRef.current?.files?.[0]; if (f) setFile(f); }, []);

  useEffect(() => {
    if (!file) return setPreview(null);
    const u = URL.createObjectURL(file); // local blob URL: file stays in the browser
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => () => { cancel(); if (lastUrl.current) URL.revokeObjectURL(lastUrl.current); }, []);

  const targetValid = Number.isFinite(targetKb) && targetKb >= 5 && targetKb <= 5000;

  async function run() {
    if (!file || !targetValid) return;
    const my = ++runId.current;
    setState({ s: 'working' });
    try {
      if (!(await sniff(file))) throw new Error('Please choose a JPEG, PNG or WebP image.');
      if (my !== runId.current) return;
      await checkSize(file);
      if (my !== runId.current) return; // cancelled before a worker exists
      const target = Math.round(targetKb * 1024);
      const r = supportsWorker() ? await compressInWorker(file, target, worker.current) : await compressOnMainThread(file, target);
      if (my !== runId.current) return; // user picked another file or left: drop stale result
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
      const url = URL.createObjectURL(r.blob);
      lastUrl.current = url;
      setState({ s: 'done', url, size: r.blob.size, fits: r.fits, quality: r.quality, scale: r.scale, mode: r.mode });
    } catch (e) {
      if (my !== runId.current) return;
      setState({ s: 'error', msg: e instanceof Error && /^Please choose|too large|too long/.test(e.message) ? e.message : 'Could not process this image.' });
    }
  }

  return (
    <div data-testid="tool" className="rounded-xl border border-slate-300 p-4 sm:p-6 space-y-4">
      <label className="block">
        <span className="font-medium">Choose an image</span>
        <input ref={inputRef} data-testid="file" type="file" accept="image/jpeg,image/png,image/webp"
          className="mt-1 block w-full text-sm"
          onChange={(e) => { cancel(); if (lastUrl.current) { URL.revokeObjectURL(lastUrl.current); lastUrl.current = null; } setFile(e.target.files?.[0] ?? null); setState({ s: 'idle' }); }} />
      </label>
      <label className="block">
        <span className="font-medium">Target size (KB, 5–5000)</span>
        <input data-testid="target" type="number" min={5} max={5000} value={Number.isNaN(targetKb) ? '' : targetKb}
          onChange={(e) => { setTargetKb(e.target.value === '' ? NaN : Number(e.target.value)); setState((s) => (s.s === 'done' || s.s === 'error' ? { s: 'idle' } : s)); }}
          className="mt-1 w-32 rounded border border-slate-300 px-2 py-1" />
      </label>
      {preview && <img data-testid="preview" src={preview} alt="Preview of the selected image" className="max-h-48 rounded" />}
      <button data-testid="run" onClick={run} disabled={!file || !targetValid || state.s === 'working'}
        className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">
        {state.s === 'working' ? 'Working…' : 'Compress'}
      </button>
      <div aria-live="polite" data-testid="status">
        {state.s === 'done' && (
          <p>
            Result: <strong data-testid="result-size" data-bytes={state.size} data-mode={state.mode}>{fmt(state.size)}</strong>
            {state.fits ? ' — fits your target.' : ' — could not reach your target; this is the smallest result.'}{' '}
            <a data-testid="download" href={state.url} download="sizetune-compressed.jpg" className="underline">Download</a>
          </p>
        )}
        {state.s === 'error' && <p role="alert">{state.msg}</p>}
      </div>
      <p className="text-sm text-slate-600">Our code processes your image in your browser and does not upload it to our servers. This page loads no ads or third-party scripts.</p>
    </div>
  );
}
