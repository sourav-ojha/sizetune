import { useEffect, useRef, useState } from 'preact/hooks';
import Dropzone from './tool/Dropzone';
import { EngineError, getLimits, inspectSize, MAX_CANVAS_PIXELS } from './tool/engine';
import { formatCap, formatDims } from './tool/format';
import { SNIFF_BYTES, sniffImage } from './tool/sniff';
import { btnPrimary, btnSecondary, btnToggleOff, btnToggleOn, fieldsetCls, hintCls, inputCls, labelCls, legendCls, panelCls } from './tool/ui';
import { RATIO_PRESETS, parseRatio, thinPath, MAX_RADIUS_PCT, ratioPad, type Pt } from '../lib/crop-geometry';
import { renderFreehand, renderRatio, renderShape, saveBlob, type PadColor } from './crop/render';

type Mode = 'free' | 'shape' | 'ratio';
class PickError extends Error {}
interface Loaded { bitmap: ImageBitmap; name: string }

const DISPLAY_MAX = 900; // the freehand drawing canvas is at most this wide; the path is scaled back to the picture's pixels
const PAD_COLORS: ReadonlyArray<readonly [PadColor, string]> = [['transparent', 'Transparent'], ['#ffffff', 'White'], ['#111827', 'Black']];
const CHECKER = 'bg-[conic-gradient(#e2e8f0_25%,#ffffff_0_50%,#e2e8f0_0_75%,#ffffff_0)] bg-[length:16px_16px]';

/** Crop a photo along a path you draw, to a square with rounded corners, or to an aspect ratio by cropping or padding. Runs in the browser. */
export default function CropShapesTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const resultRef = useRef<HTMLCanvasElement>(null);
  const serial = useRef(0);
  const live = useRef<Pt[] | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState<Mode>('free');
  const [path, setPath] = useState<Pt[]>([]); // in display pixels
  const [square, setSquare] = useState(true);
  const [radius, setRadius] = useState('15');
  const [preset, setPreset] = useState('1:1');
  const [custom, setCustom] = useState('5:7');
  const [method, setMethod] = useState<'crop' | 'pad'>('crop');
  const [fx, setFx] = useState('50');
  const [fy, setFy] = useState('50');
  const [pad, setPad] = useState<PadColor>('transparent');
  const [hasResult, setHasResult] = useState(false);
  const [note, setNote] = useState('');
  const cap = getLimits().maxFileBytes;

  const pick = async (file: File, extra = 0) => {
    const mine = ++serial.current;
    setError(null);
    try {
      if (file.size > cap) throw new PickError(`This file is larger than ${formatCap(cap)}. Choose a smaller picture.`);
      const kind = sniffImage(new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer())).kind;
      if (!kind) throw new PickError('This is not a JPEG, PNG or WebP image. Choose one of those formats.');
      const size = await inspectSize(file);
      if (size.width * size.height > MAX_CANVAS_PIXELS) throw new PickError(`This picture has ${formatDims(size.width, size.height)}, more than the ${MAX_CANVAS_PIXELS / 1_000_000} megapixels this page can handle on every device. Shrink it on the home page first.`);
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      if (mine !== serial.current) { bitmap.close(); return; }
      setLoaded((old) => { old?.bitmap.close(); return { bitmap, name: file.name }; });
      setPath([]);
      setStatus(`Picture ready, ${formatDims(bitmap.width, bitmap.height)}.${extra > 0 ? ' Only the first file was used.' : ''}`);
    } catch (e) {
      if (mine !== serial.current) return;
      setError(e instanceof EngineError || e instanceof PickError ? e.message : 'This picture could not be read. It may be damaged, or too large for this device.');
    }
  };
  useEffect(() => {
    const el = inputRef.current, f = el?.files?.[0];
    if (el && f) { void pick(f); el.value = ''; } // a file chosen before the island hydrated would otherwise be invisible
    const guard = (e: DragEvent) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); };
    window.addEventListener('dragover', guard);
    window.addEventListener('drop', guard);
    return () => { window.removeEventListener('dragover', guard); window.removeEventListener('drop', guard); };
  }, []);
  useEffect(() => () => { serial.current++; }, []);

  const scale = loaded ? Math.min(1, DISPLAY_MAX / loaded.bitmap.width) : 1;
  const dw = loaded ? Math.round(loaded.bitmap.width * scale) : 0;
  const dh = loaded ? Math.round(loaded.bitmap.height * scale) : 0;

  // The drawing canvas: the picture with the path on top.
  const paintDraw = (pts: Pt[]) => {
    const c = drawRef.current;
    if (!c || !loaded) return;
    c.width = dw; c.height = dh;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(loaded.bitmap, 0, 0, dw, dh);
    if (pts.length < 2) return;
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#0f766e'; ctx.setLineDash([8, 6]); ctx.stroke(); ctx.setLineDash([]);
  };
  useEffect(() => { if (mode === 'free') paintDraw(path); }, [loaded, path, mode]);

  const point = (e: PointerEvent): Pt => {
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    return { x: Math.min(dw, Math.max(0, ((e.clientX - r.left) * dw) / r.width)), y: Math.min(dh, Math.max(0, ((e.clientY - r.top) * dh) / r.height)) };
  };
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    live.current = [point(e)];
    setPath([]);
  };
  const move = (e: PointerEvent) => {
    if (!live.current) return;
    live.current.push(point(e));
    paintDraw(live.current);
  };
  const up = () => {
    const p = live.current;
    live.current = null;
    if (p) setPath(thinPath(p, 2));
  };

  const ratio = parseRatio(preset === 'custom' ? custom : preset);

  // The result: recomputed whenever the picture, the mode or a setting changes.
  useEffect(() => {
    const out = resultRef.current;
    if (!out || !loaded) return;
    const { bitmap } = loaded;
    let cv: HTMLCanvasElement | null = null;
    let msg = '';
    if (mode === 'free') {
      const full = path.map((p) => ({ x: p.x / scale, y: p.y / scale }));
      cv = renderFreehand(bitmap, full);
      if (!cv) msg = path.length ? 'Draw a larger shape around the part to keep.' : 'Draw around the part of the picture to keep. Everything outside the line becomes transparent.';
    } else if (mode === 'shape') {
      cv = renderShape(bitmap, square, Number(radius));
    } else if (!ratio) {
      msg = 'Enter the ratio as two numbers, like 5:7.';
    } else {
      const p = ratioPad({ w: bitmap.width, h: bitmap.height }, ratio);
      if (method === 'pad' && p.canvas.w * p.canvas.h > MAX_CANVAS_PIXELS) msg = `With the padding the picture would be ${formatDims(p.canvas.w, p.canvas.h)}, more than this page can handle. Crop instead, or shrink the picture first.`;
      else cv = renderRatio(bitmap, ratio, method, Number(fx) / 100, Number(fy) / 100, pad);
    }
    setNote(msg);
    setHasResult(!!cv);
    if (!cv) { out.width = 1; out.height = 1; return; }
    out.width = cv.width; out.height = cv.height;
    out.getContext('2d')?.drawImage(cv, 0, 0);
  }, [loaded, mode, path, square, radius, preset, custom, method, fx, fy, pad]);

  const download = async (kind: 'png' | 'jpg') => {
    const c = resultRef.current;
    if (!c || !hasResult) return;
    const blob = await saveBlob(c, kind);
    if (!blob) { setError('This browser could not save the picture.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${(loaded?.name ?? 'picture').replace(/\.[^.]+$/, '') || 'picture'}-${mode === 'free' ? 'cutout' : mode === 'shape' ? 'shape' : 'ratio'}.${kind}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const slider = (id: string, label: string, v: string, set: (s: string) => void, min: number, max: number) => (
    <div>
      <label htmlFor={id} className={labelCls}>{label}: {v}%</label>
      <input id={id} data-testid={id} type="range" min={min} max={max} step={1} className="mt-1 w-full accent-teal-700" value={v} onInput={(e) => set((e.target as HTMLInputElement).value)} />
    </div>
  );
  const modeBtn = (m: Mode, label: string) => <button type="button" data-testid={`mode-${m}`} aria-pressed={mode === m} className={mode === m ? btnToggleOn : btnToggleOff} onClick={() => setMode(m)}>{label}</button>;

  return (
    <section data-testid="tool" aria-label="Crop shapes and aspect ratio" className={`${panelCls} lg:p-8`}>
      <h2 className="sr-only">Crop to a shape or an aspect ratio</h2>
      <div role="status" aria-live="polite" data-testid="status" className="sr-only">{status}</div>
      <div className="space-y-5">
        <Dropzone inputRef={inputRef} hasFile={!!loaded} capText={cap ? `Up to ${formatCap(cap)}.` : null} onPick={(f, extra) => { void pick(f, extra); }} />
        {error && <div role="alert" data-testid="error" className="rounded-lg border border-red-700 bg-red-50 p-3 text-red-950">{error}</div>}
        {loaded && (
          <div className="space-y-6">
            <fieldset className={fieldsetCls}>
              <legend className={legendCls}>What to do</legend>
              <div className="flex flex-wrap gap-2">
                {modeBtn('free', 'Draw a cut-out')}
                {modeBtn('shape', 'Square and rounded corners')}
                {modeBtn('ratio', 'Aspect ratio')}
              </div>
            </fieldset>

            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                {mode === 'free' && (
                  <>
                    <canvas
                      ref={drawRef} data-testid="draw-canvas" role="img"
                      aria-label="Your picture. Draw a line around the part to keep with a mouse, pen or finger. If you cannot draw, use the square or aspect ratio options instead."
                      className="block h-auto w-full max-w-full touch-none cursor-crosshair rounded-xl border border-slate-300"
                      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
                    />
                    <div className="flex gap-3">
                      <button type="button" data-testid="clear-path" className={btnSecondary} disabled={path.length === 0} onClick={() => setPath([])}>Start again</button>
                    </div>
                  </>
                )}
                {mode === 'shape' && (
                  <div className="space-y-4">
                    <label className="flex min-h-11 items-center gap-3 text-base text-slate-900">
                      <input type="checkbox" data-testid="square" className="size-5 accent-teal-700" checked={square} onChange={(e) => setSquare((e.target as HTMLInputElement).checked)} />
                      Crop to a centred square
                    </label>
                    {slider('radius', `Corner radius (up to ${MAX_RADIUS_PCT}%, which is a circle on a square)`, radius, setRadius, 0, MAX_RADIUS_PCT)}
                  </div>
                )}
                {mode === 'ratio' && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="ratio-preset" className={labelCls}>Aspect ratio</label>
                      <select id="ratio-preset" data-testid="ratio-preset" className={inputCls} value={preset} onChange={(e) => setPreset((e.target as HTMLSelectElement).value)}>
                        {RATIO_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                        <option value="custom">Other…</option>
                      </select>
                    </div>
                    {preset === 'custom' && (
                      <div>
                        <label htmlFor="ratio-custom" className={labelCls}>Width:Height</label>
                        <input id="ratio-custom" data-testid="ratio-custom" type="text" inputMode="decimal" autoComplete="off" className={inputCls} value={custom} onInput={(e) => setCustom((e.target as HTMLInputElement).value)} aria-invalid={ratio ? undefined : true} />
                      </div>
                    )}
                    <fieldset className={fieldsetCls}>
                      <legend className={legendCls}>How to get there</legend>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" data-testid="method-crop" aria-pressed={method === 'crop'} className={method === 'crop' ? btnToggleOn : btnToggleOff} onClick={() => setMethod('crop')}>Crop the edges</button>
                        <button type="button" data-testid="method-pad" aria-pressed={method === 'pad'} className={method === 'pad' ? btnToggleOn : btnToggleOff} onClick={() => setMethod('pad')}>Add a border</button>
                      </div>
                      <p className={hintCls}>{method === 'crop' ? 'Cuts away part of the picture. Slide the sliders to choose which part stays.' : 'Keeps the whole picture at its own size and adds space around it, so nothing is stretched or cut.'}</p>
                    </fieldset>
                    {method === 'crop' && (<>{slider('focus-x', 'Left to right', fx, setFx, 0, 100)}{slider('focus-y', 'Top to bottom', fy, setFy, 0, 100)}</>)}
                    {method === 'pad' && (
                      <div>
                        <label htmlFor="pad-color" className={labelCls}>Border colour</label>
                        <select id="pad-color" data-testid="pad-color" className={inputCls} value={pad} onChange={(e) => setPad((e.target as HTMLSelectElement).value as PadColor)}>
                          {PAD_COLORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-950">Result</h3>
                <div className={`flex min-h-40 items-center justify-center overflow-auto rounded-xl border border-slate-200 p-3 ${CHECKER}`}>
                  <canvas ref={resultRef} data-testid="result-canvas" data-has-result={hasResult ? 'true' : 'false'} role="img" aria-label="Preview of the result" className={hasResult ? 'block h-auto max-h-[60vh] w-auto max-w-full' : 'hidden'} />
                  {!hasResult && <p className="rounded bg-white/90 px-3 py-2 text-sm text-slate-800" data-testid="result-note">{note}</p>}
                </div>
                {hasResult && <p className={hintCls} data-testid="result-info">{resultRef.current ? formatDims(resultRef.current.width, resultRef.current.height) : ''}</p>}
                {hasResult && note && <p className={hintCls}>{note}</p>}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" data-testid="save-png" className={btnPrimary} disabled={!hasResult} onClick={() => void download('png')}>Download PNG</button>
                  <button type="button" data-testid="save-jpg" className={btnSecondary} disabled={!hasResult} onClick={() => void download('jpg')}>Download JPG (white behind transparent parts)</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <p className="mt-5 text-sm text-slate-700">SizeTune crops your picture in your browser. The site's code does not upload it, and SizeTune keeps no copy of it. To bring the result under a size limit, use the <a href="/" className="font-medium text-teal-800 underline underline-offset-4">KB resizer</a>.</p>
    </section>
  );
}
