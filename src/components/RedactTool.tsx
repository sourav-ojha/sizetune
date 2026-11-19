import { useEffect, useRef, useState } from 'preact/hooks';
import Dropzone from './tool/Dropzone';
import ImageTool from './ImageTool';
import { EngineError, getLimits, inspectSize, MAX_CANVAS_PIXELS } from './tool/engine';
import { formatCap, formatDims } from './tool/format';
import { SNIFF_BYTES, sniffImage } from './tool/sniff';
import { btnPrimary, btnSecondary, btnToggleOff, btnToggleOn, fieldsetCls, hintCls, inputCls, labelCls, legendCls, panelCls } from './tool/ui';
import { blackout, boxBlur, levelToBlock, pixelate, rectMask, strokeMask, type Mask, type Pixels, type Pt, type Rect, type Rgb } from '../lib/redact';

class PickError extends Error {}
interface Loaded { bitmap: ImageBitmap; name: string }
type Tool = 'rect' | 'brush';
type Effect = 'pixelate' | 'blur' | 'blackout';
type Region = { tool: 'rect'; rect: Rect; effect: Effect; level: number; fill: Rgb } | { tool: 'brush'; pts: Pt[]; radius: number; effect: Effect; level: number; fill: Rgb };

const FILLS: ReadonlyArray<readonly [string, string, Rgb]> = [['black', 'Black', [0, 0, 0]], ['white', 'White', [255, 255, 255]]];
const OVERLAY_MAX = 900; // the outline overlay is at most this wide; pointer positions are converted to picture pixels

function maskFor(r: Region, w: number, h: number): Mask { return r.tool === 'rect' ? rectMask(w, h, r.rect) : strokeMask(w, h, r.pts, r.radius); }
function apply(px: Pixels, r: Region): void {
  const m = maskFor(r, px.width, px.height);
  if (r.effect === 'blackout') blackout(px, m, r.fill);
  else if (r.effect === 'pixelate') pixelate(px, m, levelToBlock(r.level, px.width, px.height));
  else boxBlur(px, m, Math.max(2, Math.round(levelToBlock(r.level, px.width, px.height) / 2)));
}

/** Hide parts of a picture with pixelation, blur or a solid fill, by drawing rectangles or painting with a brush. Everything happens in the browser. */
export default function RedactTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const serial = useRef(0);
  const base = useRef<Pixels | null>(null); // the picture as loaded
  const work = useRef<{ px: Pixels; applied: Region[] } | null>(null); // the picture with these regions applied, in order
  const drag = useRef<{ start: Pt; cur: Pt; pts: Pt[] } | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [tool, setTool] = useState<Tool>('rect');
  const [effect, setEffect] = useState<Effect>('pixelate');
  const [level, setLevel] = useState('10');
  const [brush, setBrush] = useState('4');
  const [fillId, setFillId] = useState('black');
  const [kb, setKb] = useState('200');
  const [resize, setResize] = useState<{ file: File; key: number; kb: number } | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
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
      const c = document.createElement('canvas');
      c.width = bitmap.width; c.height = bitmap.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new PickError('This browser cannot draw images on a canvas.');
      ctx.drawImage(bitmap, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      base.current = { width: d.width, height: d.height, data: d.data };
      work.current = null;
      setLoaded((old) => { old?.bitmap.close(); return { bitmap, name: file.name }; });
      setRegions([]); setResize(null);
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

  // Draw the picture with every region applied. A new region is applied on top of the last result; undo and clear start again from the original.
  useEffect(() => {
    const c = canvasRef.current, b = base.current;
    if (!c || !b || !loaded) return;
    let w = work.current;
    // Apply only the newest region on top of the cached result when the cache holds exactly the same earlier regions (compared by identity,
    // not by count). Anything else (undo, clear, a new picture) starts again from the original.
    const extendsCache = !!w && regions.length === w.applied.length + 1 && w.applied.every((r, i) => r === regions[i]);
    if (w && extendsCache) { apply(w.px, regions[regions.length - 1]); w.applied = regions.slice(); }
    else if (!w || w.applied.length !== regions.length || !w.applied.every((r, i) => r === regions[i])) {
      w = { px: { width: b.width, height: b.height, data: new Uint8ClampedArray(b.data) }, applied: [] };
      for (const r of regions) apply(w.px, r);
      w.applied = regions.slice();
    }
    work.current = w;
    c.width = b.width; c.height = b.height;
    c.getContext('2d')?.putImageData(new ImageData(w.px.data as Uint8ClampedArray<ArrayBuffer>, b.width, b.height), 0, 0);
  }, [loaded, regions]);

  const scale = loaded ? Math.min(1, OVERLAY_MAX / loaded.bitmap.width) : 1;
  const radiusPx = loaded ? Math.max(2, Math.round((Math.min(loaded.bitmap.width, loaded.bitmap.height) * Number(brush)) / 200)) : 0;

  const paintOverlay = () => {
    const o = overlayRef.current, d = drag.current;
    if (!o || !loaded) return;
    o.width = Math.round(loaded.bitmap.width * scale); o.height = Math.round(loaded.bitmap.height * scale);
    const ctx = o.getContext('2d');
    if (!ctx || !d) return;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (tool === 'rect') {
      const x = Math.min(d.start.x, d.cur.x) * scale, y = Math.min(d.start.y, d.cur.y) * scale, w = Math.abs(d.cur.x - d.start.x) * scale, h = Math.abs(d.cur.y - d.start.y) * scale;
      ctx.fillStyle = 'rgba(15,118,110,0.25)'; ctx.fillRect(x, y, w, h);
      ctx.lineWidth = 2; ctx.strokeStyle = '#0f766e'; ctx.setLineDash([8, 6]); ctx.strokeRect(x, y, w, h);
    } else if (d.pts.length) {
      ctx.beginPath(); d.pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * scale, p.y * scale) : ctx.lineTo(p.x * scale, p.y * scale)));
      if (d.pts.length === 1) ctx.lineTo(d.pts[0].x * scale + 0.01, d.pts[0].y * scale);
      ctx.lineWidth = radiusPx * 2 * scale; ctx.strokeStyle = 'rgba(15,118,110,0.4)'; ctx.stroke();
    }
  };
  useEffect(() => { paintOverlay(); }, [loaded]);

  const point = (e: PointerEvent): Pt => {
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect(), b = base.current!;
    return { x: Math.min(b.width, Math.max(0, ((e.clientX - r.left) * b.width) / r.width)), y: Math.min(b.height, Math.max(0, ((e.clientY - r.top) * b.height) / r.height)) };
  };
  const down = (e: PointerEvent) => {
    if (!base.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const p = point(e);
    drag.current = { start: p, cur: p, pts: [p] };
    paintOverlay();
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    d.cur = point(e); d.pts.push(d.cur);
    paintOverlay();
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    const o = overlayRef.current;
    o?.getContext('2d')?.clearRect(0, 0, o.width, o.height);
    if (!d) return;
    const fill = FILLS.find((f) => f[0] === fillId)![2], lv = Number(level);
    if (tool === 'rect') {
      const rect = { x: Math.min(d.start.x, d.cur.x), y: Math.min(d.start.y, d.cur.y), w: Math.abs(d.cur.x - d.start.x), h: Math.abs(d.cur.y - d.start.y) };
      if (rect.w >= 3 && rect.h >= 3) { setRegions((r) => [...r, { tool: 'rect', rect, effect, level: lv, fill }]); setResize(null); }
    } else if (d.pts.length) {
      setRegions((r) => [...r, { tool: 'brush', pts: d.pts, radius: radiusPx, effect, level: lv, fill }]);
      setResize(null);
    }
  };

  /** The browser took the pointer away (a call, a scroll, a gesture): drop the half-drawn area instead of hiding something nobody finished choosing. */
  const cancel = () => {
    drag.current = null;
    const o = overlayRef.current;
    o?.getContext('2d')?.clearRect(0, 0, o.width, o.height);
  };

  const toBlob = (kind: 'png' | 'jpg') => new Promise<Blob | null>((resolve) => canvasRef.current ? canvasRef.current.toBlob((b) => resolve(b), kind === 'jpg' ? 'image/jpeg' : 'image/png', kind === 'jpg' ? 0.95 : undefined) : resolve(null));
  const download = async (kind: 'png' | 'jpg') => {
    const blob = await toBlob(kind);
    if (!blob) { setError('This browser could not save the picture.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${(loaded?.name ?? 'picture').replace(/\.[^.]+$/, '') || 'picture'}-redacted.${kind}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const toResizer = async () => {
    const n = Math.floor(Number(kb));
    if (!Number.isFinite(n) || n < 1) { setSizeError('Enter the size limit as a whole number of KB, 1 or more.'); return; }
    const blob = await toBlob('jpg');
    if (!blob) { setSizeError('This browser could not prepare the picture.'); return; }
    setSizeError(null);
    setResize((r) => ({ file: new File([blob], 'redacted.jpg', { type: 'image/jpeg' }), key: (r?.key ?? 0) + 1, kb: n }));
    setStatus(`The picture is loaded in the resizer below with a ${n} KB limit.`);
  };
  useEffect(() => { if (resize) resizeRef.current?.scrollIntoView({ block: 'start' }); }, [resize?.key]);

  const toolBtn = (t: Tool, label: string) => <button type="button" data-testid={`tool-${t}`} aria-pressed={tool === t} className={tool === t ? btnToggleOn : btnToggleOff} onClick={() => setTool(t)}>{label}</button>;
  const effBtn = (e: Effect, label: string) => <button type="button" data-testid={`effect-${e}`} aria-pressed={effect === e} className={effect === e ? btnToggleOn : btnToggleOff} onClick={() => setEffect(e)}>{label}</button>;

  return (
    <div className="space-y-8">
      <section data-testid="tool" aria-label="Picture redaction tool" className={`${panelCls} lg:p-8`}>
        <h2 className="sr-only">Hide parts of a picture</h2>
        <div role="status" aria-live="polite" data-testid="status" className="sr-only">{status}</div>
        <div className="space-y-5">
          <Dropzone inputRef={inputRef} hasFile={!!loaded} capText={cap ? `Up to ${formatCap(cap)}.` : null} onPick={(f, extra) => { void pick(f, extra); }} />
          {error && <div role="alert" data-testid="error" className="rounded-lg border border-red-700 bg-red-50 p-3 text-red-950">{error}</div>}
          {loaded && (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
              <div className="order-2 space-y-4 lg:order-1">
                <div className="relative mx-auto w-fit max-w-full rounded-xl border border-slate-300 bg-slate-50">
                  <canvas ref={canvasRef} data-testid="redact-canvas" role="img" aria-label="Your picture with the hidden areas applied" className="block h-auto max-h-[75vh] w-auto max-w-full rounded-xl" />
                  <canvas
                    ref={overlayRef} data-testid="redact-overlay" aria-label="Drawing area. Drag over the part of the picture to hide. If you cannot drag, this tool needs a mouse, pen or finger."
                    className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
                    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" data-testid="undo" className={btnSecondary} disabled={regions.length === 0} onClick={() => setRegions((r) => r.slice(0, -1))}>Undo last area</button>
                  <button type="button" data-testid="clear" className={btnSecondary} disabled={regions.length === 0} onClick={() => setRegions([])}>Clear all</button>
                  <span className={hintCls} data-testid="count">{regions.length === 0 ? 'No areas hidden yet.' : `${regions.length} area${regions.length === 1 ? '' : 's'} hidden.`}</span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" data-testid="save-png" className={btnPrimary} onClick={() => void download('png')}>Download PNG</button>
                  <button type="button" data-testid="save-jpg" className={btnSecondary} onClick={() => void download('jpg')}>Download JPG</button>
                </div>
              </div>

              <div className="order-1 space-y-4 lg:order-2">
                <fieldset className={fieldsetCls}>
                  <legend className={legendCls}>Draw with</legend>
                  <div className="flex flex-wrap gap-2">{toolBtn('rect', 'Rectangle')}{toolBtn('brush', 'Brush')}</div>
                </fieldset>
                {tool === 'brush' && (
                  <div>
                    <label htmlFor="brush" className={labelCls}>Brush size: {brush}%</label>
                    <input id="brush" data-testid="brush" type="range" min={1} max={15} step={1} className="mt-1 w-full accent-teal-700" value={brush} onInput={(e) => setBrush((e.target as HTMLInputElement).value)} />
                  </div>
                )}
                <fieldset className={fieldsetCls}>
                  <legend className={legendCls}>What to do to the area</legend>
                  <div className="flex flex-wrap gap-2">{effBtn('pixelate', 'Pixelate')}{effBtn('blur', 'Blur')}{effBtn('blackout', 'Black out')}</div>
                </fieldset>
                {effect !== 'blackout' ? (
                  <div>
                    <label htmlFor="level" className={labelCls}>Strength: {level}</label>
                    <input id="level" data-testid="level" type="range" min={1} max={30} step={1} className="mt-1 w-full accent-teal-700" value={level} onInput={(e) => setLevel((e.target as HTMLInputElement).value)} />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="fill" className={labelCls}>Fill colour</label>
                    <select id="fill" data-testid="fill" className={inputCls} value={fillId} onChange={(e) => setFillId((e.target as HTMLSelectElement).value)}>
                      {FILLS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                )}
                <div className="rounded-xl border border-amber-500 bg-amber-50 p-3 text-sm text-amber-950" data-testid="redaction-warning">
                  <p className="font-semibold">This is not guaranteed secure redaction.</p>
                  <p className="mt-1">Black out replaces the area with a solid colour and is the strongest choice. Blur and pixelate can sometimes be partly reversed, so do not rely on them for anything sensitive. Check the saved picture before you share it.</p>
                </div>
                <div>
                  <label htmlFor="kb" className={labelCls}>Size limit (KB), optional</label>
                  <input id="kb" data-testid="kb" type="number" inputMode="numeric" min={1} step={1} className={inputCls} value={kb} onInput={(e) => setKb((e.target as HTMLInputElement).value)} />
                  <button type="button" data-testid="to-resizer" className={`${btnSecondary} mt-2 w-full`} onClick={() => void toResizer()}>Resize to KB</button>
                  {sizeError && <p role="alert" data-testid="size-error" className="mt-2 text-sm font-medium text-red-800">{sizeError}</p>}
                </div>
              </div>
            </div>
          )}
        </div>
        <p className="mt-5 text-sm text-slate-700">SizeTune hides the areas in your browser. The site's code does not upload your picture, and SizeTune keeps no copy of it. The saved picture is a new file without the original's hidden details such as location.</p>
      </section>

      {resize && (
        <div ref={resizeRef} data-testid="resize-area" className="space-y-4" aria-labelledby="resize-h">
          <h2 id="resize-h" className="text-2xl font-semibold text-slate-950">Resize to {resize.kb} KB</h2>
          <p className={hintCls}>Your picture is already loaded. Change the limit if you need to, then download the result.</p>
          <ImageTool key={resize.key} initialFile={resize.file} defaultMaxKb={resize.kb} label="Resize the redacted picture" />
        </div>
      )}
    </div>
  );
}
