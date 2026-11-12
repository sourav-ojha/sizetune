/// <reference lib="webworker" />
import { compressToTarget } from './compress';

import type { WorkerRequest, WorkerResponse } from './types';

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  try {
    const bmp = await createImageBitmap(e.data.file);
    const encode = async (scale: number, quality: number) => {
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#fff'; // JPEG has no alpha: flatten transparency onto white
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      return canvas.convertToBlob({ type: 'image/jpeg', quality });
    };
    const r = await compressToTarget(encode, e.data.targetBytes);
    bmp.close();
    (self as unknown as Worker).postMessage({ ok: true, mode: 'worker', ...r } satisfies WorkerResponse);
  } catch (err) {
    (self as unknown as Worker).postMessage({ ok: false, error: String(err) } satisfies WorkerResponse);
  }
};
