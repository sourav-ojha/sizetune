import { useEffect, useRef, useState } from 'preact/hooks';
import Dropzone from './tool/Dropzone';
import ImageTool from './ImageTool';
import { EngineError, getLimits, inspectSize, MAX_CANVAS_PIXELS } from './tool/engine';
import { formatCap, formatDims } from './tool/format';
import { SNIFF_BYTES, sniffImage } from './tool/sniff';
import { btnPrimary, btnSecondary, btnToggleOff, btnToggleOn, fieldsetCls, hintCls, inputCls, labelCls, legendCls, panelCls } from './tool/ui';
import { GAP_RANGE_PCT, MAX_IMAGES, OUTPUT_WIDTH_RANGE, layoutJoin, moveItem, type JoinMode } from '../lib/join-layout';

class PickError extends Error {}
interface Pic { id: number; bitmap: ImageBitmap; name: string }

const BACKGROUNDS = [['#ffffff', 'White'], ['#111827', 'Black'], ['#e5e7eb', 'Light grey']] as const;
/** Largest total size of the files added together, so a few big photos cannot exhaust a phone's memory. A starting value, to be confirmed on real phones. */
const MAX_TOTAL_BYTES = 60 * 1024 * 1024;

/** Joins several pictures into one: a row, a column or a grid, with spacing, a background and an output width, then sends the result to the KB resizer on this page. */
export default function JoinTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const totalBytes = useRef(0);
  const [pics, setPics] = useState<Pic[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [mode, setMode] = useState<JoinMode>('row');
  const [columns, setColumns] = useState('2');
  const [gap, setGap] = useState('2');
  const [bg, setBg] = useState<string>('#ffffff');
  const [outW, setOutW] = useState('1200');
  const [capKb, setCapKb] = useState('200');
  const [status, setStatus] = useState('');
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [resize, setResize] = useState<{ file: File; key: number; kb: number } | null>(null);
  const picsRef = useRef<Pic[]>([]);
  picsRef.current = pics;
  const cap = getLimits().maxFileBytes;

  const load = async (file: File): Promise<Pic> => {
    if (file.size > cap) throw new PickError(`${file.name}: larger than ${formatCap(cap)}.`);
    const kind = sniffImage(new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer())).kind;
    if (!kind) throw new PickError(`${file.name}: not a JPEG, PNG or WebP image.`);
    const size = await inspectSize(file);
    if (size.width * size.height > MAX_CANVAS_PIXELS) throw new PickError(`${file.name}: ${formatDims(size.width, size.height)} is more than this page can handle. Shrink it on the home page first.`);
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { id: nextId.current++, bitmap, name: file.name };
  };
  const addFiles = async (files: File[]) => {
    const notes: string[] = [];
    const added: Pic[] = [];
    for (const f of files) {
      if (picsRef.current.length + added.length >= MAX_IMAGES) { notes.push(`Only ${MAX_IMAGES} pictures can be joined at once, so the rest were left out.`); break; }
      if (totalBytes.current + f.size > MAX_TOTAL_BYTES) { notes.push(`${f.name}: left out, the pictures together would be more than ${formatCap(MAX_TOTAL_BYTES)}.`); continue; }
      try { added.push(await load(f)); totalBytes.current += f.size; }
      catch (e) { notes.push(e instanceof PickError || e instanceof EngineError ? e.message : `${f.name}: could not be read. It may be damaged.`); }
    }
    if (added.length) { setPics((p) => [...p, ...added]); setResize(null); setStatus(`${added.length} picture${added.length === 1 ? '' : 's'} added.`); }
    setMessages(notes);
  };
  useEffect(() => {
    const el = inputRef.current;
    const list = el?.files ? Array.from(el.files) : [];
    if (el && list.length) { void addFiles(list); el.value = ''; } // files chosen before the island hydrated would otherwise be invisible
    const guard = (e: DragEvent) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); };
    window.addEventListener('dragover', guard);
    window.addEventListener('drop', guard);
    return () => { window.removeEventListener('dragover', guard); window.removeEventListener('drop', guard); for (const p of picsRef.current) p.bitmap.close(); };
  }, []);

  const L = pics.length >= 2 ? layoutJoin({ sizes: pics.map((p) => ({ w: p.bitmap.width, h: p.bitmap.height })), mode, outputWidth: Number(outW), gapPct: Number(gap), columns: Number(columns) }) : null;
  const tooBig = L ? L.canvasW * L.canvasH > MAX_CANVAS_PIXELS : false;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !L) return;
    if (tooBig) { setSizeError(`At this width the joined picture would be ${formatDims(L.canvasW, L.canvasH)}, more than this page can handle. Choose a smaller output width.`); return; }
    setSizeError(null);
    c.width = L.canvasW; c.height = L.canvasH;
    const ctx = c.getContext('2d');
    if (!ctx) { setSizeError('This browser cannot draw images on a canvas.'); return; }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = 'high';
    pics.forEach((p, i) => ctx.drawImage(p.bitmap, L.boxes[i].x, L.boxes[i].y, L.boxes[i].w, L.boxes[i].h));
  }, [pics, mode, columns, gap, bg, outW]);

  const remove = (id: number) => { setPics((all) => { all.find((p) => p.id === id)?.bitmap.close(); return all.filter((p) => p.id !== id); }); setResize(null); };
  const move = (i: number, dir: -1 | 1) => { setPics((all) => moveItem(all, i, dir)); setResize(null); };

  const make = () => {
    const c = canvasRef.current;
    const kb = Math.floor(Number(capKb));
    if (!c || !L || tooBig) return;
    if (!Number.isFinite(kb) || kb < 1) { setSizeError('Enter the size limit as a whole number of KB, 1 or more.'); return; }
    c.toBlob((blob) => {
      if (!blob) { setSizeError('This browser could not prepare the picture.'); return; }
      setSizeError(null);
      setResize((r) => ({ file: new File([blob], 'joined.jpg', { type: 'image/jpeg' }), key: (r?.key ?? 0) + 1, kb }));
      setStatus(`The joined picture is loaded in the resizer below with a ${kb} KB limit.`);
    }, 'image/jpeg', 0.92);
  };
  useEffect(() => { if (resize) resizeRef.current?.scrollIntoView({ block: 'start' }); }, [resize?.key]);

  const modeBtn = (m: JoinMode, label: string) => <button type="button" data-testid={`mode-${m}`} aria-pressed={mode === m} className={mode === m ? btnToggleOn : btnToggleOff} onClick={() => setMode(m)}>{label}</button>;

  return (
    <div className="space-y-8">
      <section data-testid="tool" aria-label="Image joiner" className={`${panelCls} lg:p-8`}>
        <h2 className="sr-only">Join pictures into one</h2>
        <div role="status" aria-live="polite" data-testid="status" className="sr-only">{status}</div>
        <div className="space-y-6">
          <Dropzone
            inputRef={inputRef} hasFile={pics.length > 0} capText={`Up to ${MAX_IMAGES} pictures, ${formatCap(cap)} each.`}
            onPick={(f) => { void addFiles([f]); }} onPickMany={(fs) => { void addFiles(fs); }}
          />
          {messages.length > 0 && (
            <ul role="alert" data-testid="messages" className="space-y-1 rounded-lg border border-amber-500 bg-amber-50 p-3 text-amber-950">
              {messages.map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}

          {pics.length > 0 && (
            <ol data-testid="pic-list" className="space-y-2" aria-label="Pictures, in the order they will be joined">
              {pics.map((p, i) => (
                <li key={p.id} data-testid="pic" className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-slate-900"><span className="font-semibold">{i + 1}.</span> {p.name} <span className="text-slate-600">({formatDims(p.bitmap.width, p.bitmap.height)})</span></span>
                  <button type="button" className={btnSecondary} data-testid="move-up" disabled={i === 0} aria-label={`Move ${p.name} earlier`} onClick={() => move(i, -1)}>Earlier</button>
                  <button type="button" className={btnSecondary} data-testid="move-down" disabled={i === pics.length - 1} aria-label={`Move ${p.name} later`} onClick={() => move(i, 1)}>Later</button>
                  <button type="button" className={btnSecondary} data-testid="remove" aria-label={`Remove ${p.name}`} onClick={() => remove(p.id)}>Remove</button>
                </li>
              ))}
            </ol>
          )}
          {pics.length === 1 && <p className={hintCls} data-testid="join-hint">Add at least one more picture to join them.</p>}

          {L && (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
              <div className="order-2 space-y-4 lg:order-1">
                <div className="flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <canvas ref={canvasRef} data-testid="join-preview" role="img" data-boxes={JSON.stringify(L.boxes)} aria-label={`Preview of the joined picture, ${formatDims(L.canvasW, L.canvasH)}`} className="block h-auto max-h-[70vh] w-auto max-w-full" />
                </div>
                {sizeError && <div role="alert" data-testid="size-error" className="rounded-lg border border-red-700 bg-red-50 p-3 text-red-950">{sizeError}</div>}
                <button type="button" data-testid="make" className={btnPrimary} disabled={tooBig} onClick={make}>Make the image at this size limit</button>
              </div>
              <div className="order-1 space-y-4 lg:order-2">
                <fieldset className={fieldsetCls}>
                  <legend className={legendCls}>Layout</legend>
                  <div className="flex flex-wrap gap-2">
                    {modeBtn('row', 'Side by side')}
                    {modeBtn('column', 'One under another')}
                    {modeBtn('grid', 'Grid')}
                  </div>
                </fieldset>
                {mode === 'grid' && (
                  <fieldset className={fieldsetCls}>
                    <legend className={legendCls}>Grid templates</legend>
                    <div className="flex flex-wrap gap-2">
                      {['2', '3', '4'].map((c) => <button key={c} type="button" data-testid={`tpl-${c}`} aria-pressed={columns === c} className={columns === c ? btnToggleOn : btnToggleOff} onClick={() => setColumns(c)}>{c} columns</button>)}
                    </div>
                    <p className={hintCls}>Each picture sits in a square cell at its own shape. Rows are added as needed.</p>
                  </fieldset>
                )}
                <div>
                  <label htmlFor="gap" className={labelCls}>Space between pictures: {gap}%</label>
                  <input id="gap" data-testid="gap" type="range" min={GAP_RANGE_PCT[0]} max={GAP_RANGE_PCT[1]} step={1} className="mt-1 w-full accent-teal-700" value={gap} onInput={(e) => setGap((e.target as HTMLInputElement).value)} />
                </div>
                <div>
                  <label htmlFor="bg" className={labelCls}>Background colour</label>
                  <select id="bg" data-testid="bg" className={inputCls} value={bg} onChange={(e) => setBg((e.target as HTMLSelectElement).value)}>
                    {BACKGROUNDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="out-w" className={labelCls}>Output width (px)</label>
                  <input id="out-w" data-testid="out-w" type="number" inputMode="numeric" min={OUTPUT_WIDTH_RANGE[0]} max={OUTPUT_WIDTH_RANGE[1]} step={1} className={inputCls} value={outW} onInput={(e) => setOutW((e.target as HTMLInputElement).value)} />
                  <p className={hintCls}>From {OUTPUT_WIDTH_RANGE[0]} to {OUTPUT_WIDTH_RANGE[1].toLocaleString('en-US')}.</p>
                </div>
                <div>
                  <label htmlFor="cap-kb" className={labelCls}>Size limit (KB)</label>
                  <input id="cap-kb" data-testid="cap-kb" type="number" inputMode="numeric" min={1} step={1} className={inputCls} value={capKb} onInput={(e) => setCapKb((e.target as HTMLInputElement).value)} />
                  <p className={hintCls}>The resizer below lowers the quality, then the pixel size, to fit. If it cannot, it says so.</p>
                </div>
              </div>
            </div>
          )}
          {pics.length === 0 && <p className={hintCls} data-testid="join-empty">Add two or more pictures to join them.</p>}
        </div>
        <p className="mt-5 text-sm text-slate-700">SizeTune joins the pictures in your browser. The site's code does not upload them, and SizeTune keeps no copy.</p>
      </section>

      {resize && (
        <div ref={resizeRef} data-testid="resize-area" className="space-y-4" aria-labelledby="resize-h">
          <h2 id="resize-h" className="text-2xl font-semibold text-slate-950">Resize to {resize.kb} KB</h2>
          <p className={hintCls}>Your joined picture is already loaded. Change the limit if you need to, then download the result.</p>
          <ImageTool key={resize.key} initialFile={resize.file} defaultMaxKb={resize.kb} label="Resize the joined picture" />
        </div>
      )}
    </div>
  );
}
