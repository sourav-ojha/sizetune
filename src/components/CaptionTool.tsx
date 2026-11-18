import { useEffect, useRef, useState } from 'preact/hooks';
import Dropzone from './tool/Dropzone';
import ImageTool from './ImageTool';
import { EngineError, getLimits, inspectSize, MAX_CANVAS_PIXELS } from './tool/engine';
import { formatCap, formatDims } from './tool/format';
import { SNIFF_BYTES, sniffImage } from './tool/sniff';
import { btnPrimary, btnSecondary, btnToggleOff, btnToggleOn, fieldsetCls, hintCls, inputCls, labelCls, legendCls, panelCls } from './tool/ui';
import { DATE_STYLES, STRIP_RANGE, TEXT_RANGE, captionLines, fitFont, formatDate, layoutCaption, type DateStyleId, type Placement } from '../lib/caption';

const TEXT_COLORS = [['#111827', 'Black'], ['#ffffff', 'White'], ['#1e3a8a', 'Navy'], ['#b91c1c', 'Red']] as const;
const STRIP_COLORS = [['#ffffff', 'White'], ['#111827', 'Black'], ['#e5e7eb', 'Light grey'], ['#fde68a', 'Yellow']] as const;
const FONT = 'system-ui, "Segoe UI", Arial, sans-serif';

class PickError extends Error {}
interface Loaded { bitmap: ImageBitmap; name: string }

const contrast = (hex: string) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 140 ? '#111827' : '#ffffff'; };

/** Adds a name and date to a photo, on a strip under it or on the photo itself, then saves a JPG or sends it to the KB resizer on this page. */
export default function CaptionTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const serial = useRef(0);
  const resizeRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [style, setStyle] = useState<DateStyleId>('dmy-slash');
  const [placement, setPlacement] = useState<Placement>('below');
  const [lines, setLines] = useState<'one' | 'two'>('one');
  const [textPct, setTextPct] = useState('6');
  const [stripPct, setStripPct] = useState('14');
  const [textColor, setTextColor] = useState('#111827');
  const [stripColor, setStripColor] = useState('#ffffff');
  const [resize, setResize] = useState<{ file: File; key: number } | null>(null);
  const cap = getLimits().maxFileBytes;

  const pick = async (file: File, extra = 0) => {
    const mine = ++serial.current;
    setError(null);
    try {
      if (file.size > cap) throw new PickError(`This file is larger than ${formatCap(cap)}. Choose a smaller photo.`);
      const kind = sniffImage(new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer())).kind;
      if (!kind) throw new PickError('This is not a JPEG, PNG or WebP image. Choose one of those formats.');
      const size = await inspectSize(file);
      if (size.width * size.height > MAX_CANVAS_PIXELS) throw new PickError(`This photo has ${formatDims(size.width, size.height)}, more than the ${MAX_CANVAS_PIXELS / 1_000_000} megapixels this page can handle on every device. Shrink it on the home page first, then add the caption.`);
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); // the browser applies the EXIF turn, so the caption goes on the upright side
      if (mine !== serial.current) { bitmap.close(); return; }
      setLoaded((old) => { old?.bitmap.close(); return { bitmap, name: file.name }; });
      setResize(null);
      setStatus(`Photo ready, ${formatDims(bitmap.width, bitmap.height)}.${extra > 0 ? ' Only the first file was used.' : ''}`);
    } catch (e) {
      if (mine !== serial.current) return;
      setError(e instanceof EngineError || e instanceof PickError ? e.message : 'This photo could not be read. It may be damaged, or too large for this device. Try a smaller photo.');
    }
  };
  useEffect(() => {
    const el = inputRef.current;
    const f = el?.files?.[0];
    if (el && f) { void pick(f); el.value = ''; } // a file chosen before the island hydrated would otherwise be invisible
    const guard = (e: DragEvent) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); };
    window.addEventListener('dragover', guard);
    window.addEventListener('drop', guard);
    return () => { window.removeEventListener('dragover', guard); window.removeEventListener('drop', guard); };
  }, []);
  useEffect(() => () => { serial.current++; }, []);

  const dateText = formatDate(date, style);
  const text = captionLines(name, dateText, lines);

  // Draw the photo and the caption. Runs on every change, so the preview is always live.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !loaded) return;
    const { bitmap } = loaded;
    const L = layoutCaption({ photoW: bitmap.width, photoH: bitmap.height, placement, stripPct: Number(stripPct), textPct: Number(textPct), lines: text.length || 1 });
    if (L.canvasW * L.canvasH > MAX_CANVAS_PIXELS) { setError(`With the caption the picture would be ${formatDims(L.canvasW, L.canvasH)}, more than this page can handle. Use a smaller strip, or shrink the photo first.`); return; }
    setError((e) => (e && e.startsWith('With the caption') ? null : e));
    c.width = L.canvasW; c.height = L.canvasH;
    const ctx = c.getContext('2d');
    if (!ctx) { setError('This browser cannot draw images on a canvas.'); return; }
    ctx.drawImage(bitmap, 0, 0);
    if (placement === 'below') { ctx.fillStyle = stripColor; ctx.fillRect(0, L.stripY, L.canvasW, L.stripH); }
    if (text.length === 0) return;
    const pad = Math.round(L.canvasW * 0.03);
    const rowH = L.stripH / text.length;
    // one size for all lines: small enough for the widest line and for the row height
    let px = Math.min(L.fontPx, Math.floor(rowH * 0.8));
    for (const t of text) px = Math.min(px, fitFont((p) => { ctx.font = `700 ${p}px ${FONT}`; return ctx.measureText(t).width; }, L.canvasW - pad * 2, px, 6));
    ctx.font = `700 ${px}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    text.forEach((t, i) => {
      const y = L.stripY + rowH * (i + 0.5);
      if (placement === 'over') { ctx.lineWidth = Math.max(2, px / 6); ctx.strokeStyle = contrast(textColor); ctx.strokeText(t, L.canvasW / 2, y); }
      ctx.fillStyle = textColor;
      ctx.fillText(t, L.canvasW / 2, y);
    });
  }, [loaded, name, dateText, placement, lines, textPct, stripPct, textColor, stripColor]);

  const toJpeg = () => new Promise<Blob | null>((resolve) => canvasRef.current ? canvasRef.current.toBlob((b) => resolve(b), 'image/jpeg', 0.92) : resolve(null));
  const download = async () => {
    const blob = await toJpeg();
    if (!blob) { setError('This browser could not save the picture.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${(loaded?.name ?? 'photo').replace(/\.[^.]+$/, '') || 'photo'}-caption.jpg`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const toResizer = async () => {
    const blob = await toJpeg();
    if (!blob) { setError('This browser could not prepare the picture.'); return; }
    setResize((r) => ({ file: new File([blob], 'photo-caption.jpg', { type: 'image/jpeg' }), key: (r?.key ?? 0) + 1 }));
    setStatus('Your captioned photo is loaded in the resizer below.');
  };
  useEffect(() => { if (resize) resizeRef.current?.scrollIntoView({ block: 'start' }); }, [resize?.key]);

  const num = (id: string, label: string, v: string, set: (s: string) => void, range: [number, number], hint: string) => (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      <input id={id} data-testid={id} type="number" inputMode="numeric" min={range[0]} max={range[1]} step={1} className={inputCls} value={v} onInput={(e) => set((e.target as HTMLInputElement).value)} />
      <p className={hintCls}>{hint}</p>
    </div>
  );
  const sel = (id: string, label: string, v: string, set: (s: string) => void, opts: ReadonlyArray<readonly [string, string]>) => (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      <select id={id} data-testid={id} className={inputCls} value={v} onChange={(e) => set((e.target as HTMLSelectElement).value)}>
        {opts.map(([value, l]) => <option key={value} value={value}>{l}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-8">
      <section data-testid="tool" aria-label="Photo caption tool" className={`${panelCls} lg:p-8`}>
        <h2 className="sr-only">Add a name and date to your photo</h2>
        <div role="status" aria-live="polite" data-testid="status" className="sr-only">{status}</div>
        <div className="space-y-5">
          <Dropzone inputRef={inputRef} hasFile={!!loaded} capText={cap ? `Up to ${formatCap(cap)}.` : null} onPick={(f, extra) => { void pick(f, extra); }} />
          {error && <div role="alert" data-testid="error" className="rounded-lg border border-red-700 bg-red-50 p-3 text-red-950">{error}</div>}
          {loaded && (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
              <div className="order-2 space-y-4 lg:order-1">
                <div className="flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <canvas ref={canvasRef} data-testid="caption-preview" role="img" aria-label="Preview of your photo with the caption" className="block h-auto max-h-[70vh] w-auto max-w-full" />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" data-testid="download" className={btnPrimary} onClick={() => void download()}>Download JPG</button>
                  <button type="button" data-testid="to-resizer" className={btnSecondary} onClick={() => void toResizer()}>Resize to KB</button>
                </div>
              </div>
              <div className="order-1 space-y-4 lg:order-2">
                <div>
                  <label htmlFor="cap-name" className={labelCls}>Name</label>
                  <input id="cap-name" data-testid="cap-name" type="text" maxLength={80} autoComplete="off" className={inputCls} value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
                </div>
                {style === 'typed' ? (
                  <div>
                    <label htmlFor="cap-date-text" className={labelCls}>Date, as you want it to read</label>
                    <input id="cap-date-text" data-testid="cap-date-text" type="text" maxLength={40} autoComplete="off" className={inputCls} value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="cap-date" className={labelCls}>Date</label>
                    <input id="cap-date" data-testid="cap-date" type="date" className={inputCls} value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} />
                  </div>
                )}
                {sel('cap-style', 'Date style', style, (v) => { setStyle(v as DateStyleId); setDate(''); }, DATE_STYLES.map((s) => [s.id, s.label] as const))}
                <fieldset className={fieldsetCls}>
                  <legend className={legendCls}>Where the caption goes</legend>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" data-testid="place-below" aria-pressed={placement === 'below'} className={placement === 'below' ? btnToggleOn : btnToggleOff} onClick={() => setPlacement('below')}>Strip below the photo</button>
                    <button type="button" data-testid="place-over" aria-pressed={placement === 'over'} className={placement === 'over' ? btnToggleOn : btnToggleOff} onClick={() => setPlacement('over')}>Text on the photo</button>
                  </div>
                </fieldset>
                {sel('cap-lines', 'Layout', lines, (v) => setLines(v as 'one' | 'two'), [['one', 'Name and date on one line'], ['two', 'Name above the date']])}
                {num('cap-text-pct', 'Text size (% of photo height)', textPct, setTextPct, TEXT_RANGE, `From ${TEXT_RANGE[0]} to ${TEXT_RANGE[1]}. Long text shrinks to fit.`)}
                {num('cap-strip-pct', 'Strip height (% of photo height)', stripPct, setStripPct, STRIP_RANGE, `From ${STRIP_RANGE[0]} to ${STRIP_RANGE[1]}.`)}
                {sel('cap-color', 'Text colour', textColor, setTextColor, TEXT_COLORS)}
                {placement === 'below' && sel('cap-strip-color', 'Strip colour', stripColor, setStripColor, STRIP_COLORS)}
                <p className={hintCls}>Check the size and layout your form asks for. SizeTune has no exam layouts, so adjust the strip to match.</p>
              </div>
            </div>
          )}
        </div>
        <p className="mt-5 text-sm text-slate-700">SizeTune adds the caption in your browser. The site's code does not upload your photo, and SizeTune keeps no copy of it.</p>
      </section>

      {resize && (
        <div ref={resizeRef} data-testid="resize-area" className="space-y-4" aria-labelledby="resize-h">
          <h2 id="resize-h" className="text-2xl font-semibold text-slate-950">Resize to a size in KB</h2>
          <p className={hintCls}>Your captioned photo is already loaded. Choose a limit and download the result.</p>
          <ImageTool key={resize.key} initialFile={resize.file} label="Resize the captioned photo" />
        </div>
      )}
    </div>
  );
}
