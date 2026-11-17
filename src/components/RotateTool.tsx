import { useEffect, useRef, useState } from 'preact/hooks';
import Dropzone from './tool/Dropzone';
import { EngineError, getLimits, inspectSize, MAX_CANVAS_PIXELS } from './tool/engine';
import { formatCap, formatDims } from './tool/format';
import { SNIFF_BYTES, sniffImage, type SniffKind } from './tool/sniff';
import { btnPrimary, btnSecondary, panelCls } from './tool/ui';
import { IDENTITY, flipDisplay, matrixFor, outputSize, rotateDisplay, type Op } from './rotate/transform';

const MIME: Record<SniffKind, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const EXT: Record<SniffKind, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' };

interface Loaded { bitmap: ImageBitmap; kind: SniffKind; name: string }

/** Rotate and flip one image on a canvas, entirely in the browser. The file is never sent anywhere. */
export default function RotateTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const serial = useRef(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [op, setOp] = useState<Op>(IDENTITY);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const cap = getLimits().maxFileBytes;

  const pick = async (file: File, extra = 0) => {
    const mine = ++serial.current;
    setError(null);
    try {
      if (file.size > cap) throw new Error(`This file is larger than ${formatCap(cap)}. Choose a smaller image.`);
      const kind = sniffImage(new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer())).kind;
      if (!kind) throw new Error('This is not a JPEG, PNG or WebP image. Choose one of those formats.');
      const size = await inspectSize(file);
      if (size.width * size.height > MAX_CANVAS_PIXELS) throw new Error(`This picture has ${formatDims(size.width, size.height)}, more than the ${MAX_CANVAS_PIXELS / 1_000_000} megapixels this page can turn safely on every device. Shrink it on the home page first, then rotate it.`);
      // The browser applies the EXIF orientation while decoding, so the preview matches the system viewer and is not turned twice.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      if (mine !== serial.current) { bitmap.close(); return; }
      setLoaded((old) => { old?.bitmap.close(); return { bitmap, kind, name: file.name }; });
      setOp(IDENTITY);
      setStatus(`Image ready, ${formatDims(bitmap.width, bitmap.height)}.${extra > 0 ? ' Only the first file was used.' : ''}`);
    } catch (e) {
      if (mine !== serial.current) return;
      setError(e instanceof EngineError || e instanceof Error ? e.message : 'This image could not be read.');
    }
  };

  // A file chosen before the island hydrated would otherwise be invisible.
  useEffect(() => {
    const el = inputRef.current;
    const f = el?.files?.[0];
    if (el && f) { void pick(f); el.value = ''; }
    const guard = (e: DragEvent) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); };
    window.addEventListener('dragover', guard);
    window.addEventListener('drop', guard);
    return () => { window.removeEventListener('dragover', guard); window.removeEventListener('drop', guard); };
  }, []);

  useEffect(() => () => { serial.current++; }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !loaded) return;
    const { bitmap } = loaded;
    const out = outputSize(bitmap.width, bitmap.height, op.turns);
    c.width = out.width;
    c.height = out.height;
    const ctx = c.getContext('2d');
    if (!ctx) { setError('This browser cannot draw images on a canvas.'); return; }
    ctx.setTransform(...matrixFor(op, bitmap.width, bitmap.height));
    ctx.drawImage(bitmap, 0, 0);
  }, [loaded, op]);

  const change = (next: Op, said: string) => {
    setOp(next);
    if (loaded) { const o = outputSize(loaded.bitmap.width, loaded.bitmap.height, next.turns); setStatus(`${said} Now ${formatDims(o.width, o.height)}.`); }
  };

  const download = () => {
    const c = canvasRef.current;
    if (!c || !loaded) return;
    const mime = MIME[loaded.kind];
    c.toBlob((blob) => {
      if (!blob || blob.type !== mime) { setError(`This browser cannot save ${EXT[loaded.kind].toUpperCase()} files. Try another browser, or start with a JPEG or PNG.`); return; }
      const base = loaded.name.replace(/\.[^.]+$/, '') || 'image';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${base}-rotated.${EXT[loaded.kind]}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }, mime, loaded.kind === 'png' ? undefined : 0.95);
  };

  const o = loaded ? outputSize(loaded.bitmap.width, loaded.bitmap.height, op.turns) : null;
  return (
    <section data-testid="tool" aria-label="Image rotator" className={`${panelCls} lg:p-8`}>
      <h2 className="sr-only">Rotate or flip your image</h2>
      <div role="status" aria-live="polite" data-testid="status" className="sr-only">{status}</div>
      <div className="space-y-5">
        <Dropzone inputRef={inputRef} hasFile={!!loaded} capText={cap ? `Up to ${formatCap(cap)}.` : null} onPick={(f, extra) => { void pick(f, extra); }} />
        {error && <div role="alert" data-testid="error" className="rounded-lg border border-red-700 bg-red-50 p-3 text-red-950">{error}</div>}
        {loaded && o && (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Rotate and flip">
              <button type="button" data-testid="rotate-ccw" className={btnSecondary} onClick={() => change(rotateDisplay(op, 'ccw'), 'Turned 90 degrees to the left.')}>Rotate left</button>
              <button type="button" data-testid="rotate-cw" className={btnSecondary} onClick={() => change(rotateDisplay(op, 'cw'), 'Turned 90 degrees to the right.')}>Rotate right</button>
              <button type="button" data-testid="flip-h" className={btnSecondary} onClick={() => change(flipDisplay(op, 'h'), 'Flipped left to right.')}>Flip horizontally</button>
              <button type="button" data-testid="flip-v" className={btnSecondary} onClick={() => change(flipDisplay(op, 'v'), 'Flipped top to bottom.')}>Flip vertically</button>
              <button type="button" data-testid="reset" className={btnSecondary} onClick={() => change(IDENTITY, 'Back to the original.')}>Reset</button>
            </div>
            <div className="flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
              <canvas
                ref={canvasRef}
                data-testid="rotate-preview"
                data-width={o.width}
                data-height={o.height}
                role="img"
                aria-label={`Preview of your image, ${formatDims(o.width, o.height)}`}
                className="block h-auto max-h-[70vh] w-auto max-w-full"
              />
            </div>
            <p className="text-sm text-slate-700" data-testid="rotate-note">
              {loaded.kind === 'png' ? 'PNG keeps every pixel, so nothing is lost.' : `${loaded.kind === 'jpeg' ? 'JPEG' : 'WebP'} is saved again at high quality, which can cost a little detail.`}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" data-testid="download" className={btnPrimary} onClick={download}>Download image</button>
              <a data-testid="resize-link" className={btnSecondary} href="/">Resize to a KB limit</a>
            </div>
          </>
        )}
      </div>
      <p className="mt-5 text-sm text-slate-700">SizeTune turns your image in your browser. The site's code does not upload it, and SizeTune keeps no copy of it.</p>
    </section>
  );
}
