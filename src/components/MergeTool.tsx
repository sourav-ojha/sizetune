import { useEffect, useRef, useState } from 'preact/hooks';
import Dropzone from './tool/Dropzone';
import ImageTool from './ImageTool';
import { EngineError, getLimits, inspectSize, MAX_CANVAS_PIXELS } from './tool/engine';
import { formatCap, formatDims } from './tool/format';
import { SNIFF_BYTES, sniffImage } from './tool/sniff';
import { btnPrimary, btnToggleOff, btnToggleOn, fieldsetCls, hintCls, inputCls, labelCls, legendCls, panelCls } from './tool/ui';
import { OUTPUT_WIDTH_RANGE, layoutMerge, type MergeLayout } from '../lib/merge';

class PickError extends Error {}
interface Pic { bitmap: ImageBitmap; name: string }
type Slot = 'photo' | 'signature';

/** Puts a photo and a signature on one canvas, stacked or side by side, then sends the result to the KB resizer on this page. */
export default function MergeTool() {
  const photoInput = useRef<HTMLInputElement>(null);
  const sigInput = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const serial = useRef({ photo: 0, signature: 0 });
  const resizeRef = useRef<HTMLDivElement>(null);
  const [pics, setPics] = useState<Record<Slot, Pic | null>>({ photo: null, signature: null });
  const [errors, setErrors] = useState<Record<Slot, string | null>>({ photo: null, signature: null });
  const [layout, setLayout] = useState<MergeLayout>('stacked');
  const [outW, setOutW] = useState('600');
  const [capKb, setCapKb] = useState('100');
  const [status, setStatus] = useState('');
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [resize, setResize] = useState<{ file: File; key: number; kb: number } | null>(null);
  const cap = getLimits().maxFileBytes;

  const pick = async (slot: Slot, file: File, extra = 0) => {
    const mine = ++serial.current[slot];
    setErrors((e) => ({ ...e, [slot]: null }));
    try {
      if (file.size > cap) throw new PickError(`This file is larger than ${formatCap(cap)}. Choose a smaller picture.`);
      const kind = sniffImage(new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer())).kind;
      if (!kind) throw new PickError('This is not a JPEG, PNG or WebP image. Choose one of those formats.');
      const size = await inspectSize(file);
      if (size.width * size.height > MAX_CANVAS_PIXELS) throw new PickError(`This picture has ${formatDims(size.width, size.height)}, more than the ${MAX_CANVAS_PIXELS / 1_000_000} megapixels this page can handle on every device. Shrink it on the home page first.`);
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      if (mine !== serial.current[slot]) { bitmap.close(); return; }
      setPics((p) => { p[slot]?.bitmap.close(); return { ...p, [slot]: { bitmap, name: file.name } }; });
      setResize(null);
      setStatus(`${slot === 'photo' ? 'Photo' : 'Signature'} ready, ${formatDims(bitmap.width, bitmap.height)}.${extra > 0 ? ' Only the first file was used.' : ''}`);
    } catch (e) {
      if (mine !== serial.current[slot]) return;
      setErrors((x) => ({ ...x, [slot]: e instanceof EngineError || e instanceof PickError ? e.message : 'This picture could not be read. It may be damaged, or too large for this device.' }));
    }
  };
  useEffect(() => {
    for (const [slot, ref] of [['photo', photoInput], ['signature', sigInput]] as const) {
      const el = ref.current, f = el?.files?.[0];
      if (el && f) { void pick(slot, f); el.value = ''; } // a file chosen before the island hydrated would otherwise be invisible
    }
    const guard = (e: DragEvent) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); };
    window.addEventListener('dragover', guard);
    window.addEventListener('drop', guard);
    return () => { window.removeEventListener('dragover', guard); window.removeEventListener('drop', guard); };
  }, []);
  useEffect(() => () => { serial.current.photo++; serial.current.signature++; }, []);

  const both = pics.photo && pics.signature ? { photo: pics.photo, signature: pics.signature } : null;
  const L = both ? layoutMerge({ photo: { w: both.photo.bitmap.width, h: both.photo.bitmap.height }, signature: { w: both.signature.bitmap.width, h: both.signature.bitmap.height }, layout, outputWidth: Number(outW) }) : null;
  const tooBig = L ? L.canvasW * L.canvasH > MAX_CANVAS_PIXELS : false;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !both || !L) return;
    if (tooBig) { setSizeError(`At this width the merged picture would be ${formatDims(L.canvasW, L.canvasH)}, more than this page can handle. Choose a smaller output width.`); return; }
    setSizeError(null);
    c.width = L.canvasW; c.height = L.canvasH;
    const ctx = c.getContext('2d');
    if (!ctx) { setSizeError('This browser cannot draw images on a canvas.'); return; }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(both.photo.bitmap, L.photo.x, L.photo.y, L.photo.w, L.photo.h);
    ctx.drawImage(both.signature.bitmap, L.signature.x, L.signature.y, L.signature.w, L.signature.h);
  }, [pics, layout, outW]);

  const make = () => {
    const c = canvasRef.current;
    const kb = Math.floor(Number(capKb));
    if (!c || !both || tooBig) return;
    if (!Number.isFinite(kb) || kb < 1) { setSizeError('Enter the size limit as a whole number of KB, 1 or more.'); return; }
    c.toBlob((blob) => {
      if (!blob) { setSizeError('This browser could not prepare the picture.'); return; }
      setSizeError(null);
      setResize((r) => ({ file: new File([blob], 'photo-and-signature.jpg', { type: 'image/jpeg' }), key: (r?.key ?? 0) + 1, kb }));
      setStatus(`The merged picture is loaded in the resizer below with a ${kb} KB limit.`);
    }, 'image/jpeg', 0.92);
  };
  useEffect(() => { if (resize) resizeRef.current?.scrollIntoView({ block: 'start' }); }, [resize?.key]);

  const slot = (s: Slot, label: string, inputRef: typeof photoInput) => (
    <div data-testid={`slot-${s}`} className="space-y-2">
      <h3 className="text-base font-semibold text-slate-950">{label}</h3>
      <Dropzone inputRef={inputRef} hasFile={!!pics[s]} capText={cap ? `Up to ${formatCap(cap)}.` : null} onPick={(f, extra) => { void pick(s, f, extra); }} />
      {pics[s] && <p className={hintCls} data-testid={`${s}-info`}>{formatDims(pics[s]!.bitmap.width, pics[s]!.bitmap.height)}</p>}
      {errors[s] && <div role="alert" data-testid={`${s}-error`} className="rounded-lg border border-red-700 bg-red-50 p-3 text-red-950">{errors[s]}</div>}
    </div>
  );

  return (
    <div className="space-y-8">
      <section data-testid="tool" aria-label="Photo and signature merger" className={`${panelCls} lg:p-8`}>
        <h2 className="sr-only">Merge a photo and a signature</h2>
        <div role="status" aria-live="polite" data-testid="status" className="sr-only">{status}</div>
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {slot('photo', 'Photo', photoInput)}
            {slot('signature', 'Signature', sigInput)}
          </div>

          {both && L && (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
              <div className="order-2 space-y-4 lg:order-1">
                <div className="flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <canvas
                    ref={canvasRef} data-testid="merge-preview" role="img"
                    data-photo-box={JSON.stringify(L.photo)} data-signature-box={JSON.stringify(L.signature)}
                    aria-label={`Preview of the photo and signature on one picture, ${formatDims(L.canvasW, L.canvasH)}`}
                    className="block h-auto max-h-[70vh] w-auto max-w-full"
                  />
                </div>
                {sizeError && <div role="alert" data-testid="size-error" className="rounded-lg border border-red-700 bg-red-50 p-3 text-red-950">{sizeError}</div>}
                <button type="button" data-testid="make" className={btnPrimary} disabled={tooBig} onClick={make}>Make the image at this size limit</button>
              </div>
              <div className="order-1 space-y-4 lg:order-2">
                <fieldset className={fieldsetCls}>
                  <legend className={legendCls}>Layout</legend>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" data-testid="layout-stacked" aria-pressed={layout === 'stacked'} className={layout === 'stacked' ? btnToggleOn : btnToggleOff} onClick={() => setLayout('stacked')}>Photo above signature</button>
                    <button type="button" data-testid="layout-side" aria-pressed={layout === 'side'} className={layout === 'side' ? btnToggleOn : btnToggleOff} onClick={() => setLayout('side')}>Side by side</button>
                  </div>
                </fieldset>
                <div>
                  <label htmlFor="out-w" className={labelCls}>Output width (px)</label>
                  <input id="out-w" data-testid="out-w" type="number" inputMode="numeric" min={OUTPUT_WIDTH_RANGE[0]} max={OUTPUT_WIDTH_RANGE[1]} step={1} className={inputCls} value={outW} onInput={(e) => setOutW((e.target as HTMLInputElement).value)} />
                  <p className={hintCls}>From {OUTPUT_WIDTH_RANGE[0]} to {OUTPUT_WIDTH_RANGE[1].toLocaleString('en-US')}. Both pictures keep their shape.</p>
                </div>
                <div>
                  <label htmlFor="cap-kb" className={labelCls}>Size limit (KB)</label>
                  <input id="cap-kb" data-testid="cap-kb" type="number" inputMode="numeric" min={1} step={1} className={inputCls} value={capKb} onInput={(e) => setCapKb((e.target as HTMLInputElement).value)} />
                  <p className={hintCls}>The resizer below lowers the quality, then the pixel size, to fit. If it cannot, it says so.</p>
                </div>
              </div>
            </div>
          )}
          {!both && <p className={hintCls} data-testid="merge-hint">Add both a photo and a signature to see them together.</p>}
        </div>
        <p className="mt-5 text-sm text-slate-700">SizeTune merges the pictures in your browser. The site's code does not upload them, and SizeTune keeps no copy.</p>
      </section>

      {resize && (
        <div ref={resizeRef} data-testid="resize-area" className="space-y-4" aria-labelledby="resize-h">
          <h2 id="resize-h" className="text-2xl font-semibold text-slate-950">Resize to {resize.kb} KB</h2>
          <p className={hintCls}>Your merged picture is already loaded. Change the limit if you need to, then download the result.</p>
          <ImageTool key={resize.key} initialFile={resize.file} defaultMaxKb={resize.kb} label="Resize the merged picture" />
        </div>
      )}
    </div>
  );
}
