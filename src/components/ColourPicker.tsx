import { useEffect, useRef, useState } from 'preact/hooks';
import Dropzone from './tool/Dropzone';
import { EngineError, getLimits, inspectSize, MAX_CANVAS_PIXELS } from './tool/engine';
import { formatCap, formatDims } from './tool/format';
import { SNIFF_BYTES, sniffImage } from './tool/sniff';
import { btnSecondary, focusRing, hintCls, inputCls, labelCls, panelCls } from './tool/ui';
import { canvasPoint, moveByKey, pixelAt, pushRecent, toHex, toHslText, toRgbText, type Point, type Rgba } from '../lib/colour';

class PickError extends Error {}

/** A square of one colour, drawn on a canvas because inline styles are not allowed by the site's content policy. */
function Swatch({ colour, size, label }: { colour: Rgba; size: number; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = `rgba(${colour.r}, ${colour.g}, ${colour.b}, ${colour.a / 255})`;
    ctx.fillRect(0, 0, size, size);
  }, [colour.r, colour.g, colour.b, colour.a, size]);
  return <canvas ref={ref} width={size} height={size} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="block size-full rounded-lg border border-slate-400" />;
}

const VALUES: ReadonlyArray<readonly [key: 'hex' | 'rgb' | 'hsl', label: string, text: (p: Rgba) => string]> = [
  ['hex', 'HEX', toHex], ['rgb', 'RGB', toRgbText], ['hsl', 'HSL', toHslText],
];

/** Reads the colour of a pixel the person clicks, shows HEX, RGB and HSL, and copies them. Everything runs in the browser. */
export default function ColourPicker() {
  const input = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixels = useRef<ImageData | null>(null);
  const serial = useRef(0);
  const fields = useRef<Record<string, HTMLInputElement | null>>({});
  const [pic, setPic] = useState<{ bitmap: ImageBitmap; name: string; key: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState<Point | null>(null);
  const [colour, setColour] = useState<Rgba | null>(null);
  const [recent, setRecent] = useState<Rgba[]>([]);
  const [status, setStatus] = useState('');
  const [manual, setManual] = useState<string | null>(null);
  const cap = getLimits().maxFileBytes;

  const choose = async (file: File, extra = 0) => {
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
      setPic((old) => { old?.bitmap.close(); return { bitmap, name: file.name, key: mine }; });
      setAt(null); setColour(null); setManual(null);
      setStatus(`Picture ready, ${formatDims(bitmap.width, bitmap.height)}.${extra > 0 ? ' Only the first file was used.' : ''} Click a spot to read its colour.`);
    } catch (e) {
      if (mine !== serial.current) return;
      setError(e instanceof EngineError || e instanceof PickError ? e.message : 'This picture could not be read. It may be damaged, or too large for this device.');
    }
  };
  useEffect(() => {
    const el = input.current, f = el?.files?.[0];
    if (el && f) { void choose(f); el.value = ''; } // a file chosen before the island hydrated would otherwise be invisible
    const guard = (e: DragEvent) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); };
    window.addEventListener('dragover', guard);
    window.addEventListener('drop', guard);
    return () => { window.removeEventListener('dragover', guard); window.removeEventListener('drop', guard); };
  }, []);
  useEffect(() => () => { serial.current++; }, []);

  // Draw the picture at its own pixel size and keep a copy of its pixels to read from, so the marker drawn on top never changes a reading.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !pic) return;
    c.width = pic.bitmap.width; c.height = pic.bitmap.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) { setError('This browser cannot read the colours of a picture.'); return; }
    ctx.drawImage(pic.bitmap, 0, 0);
    pixels.current = ctx.getImageData(0, 0, c.width, c.height);
  }, [pic]);

  // The marker: a ring in two colours so it shows on both light and dark parts.
  useEffect(() => {
    const c = canvasRef.current, data = pixels.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !data || !pic) return;
    ctx.putImageData(data, 0, 0);
    if (!at) return;
    const r = Math.max(6, Math.round(Math.max(c.width, c.height) / 80));
    ctx.lineWidth = Math.max(2, r / 3);
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(at.x + 0.5, at.y + 0.5, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = Math.max(1, r / 6);
    ctx.strokeStyle = '#111827';
    ctx.beginPath(); ctx.arc(at.x + 0.5, at.y + 0.5, r, 0, Math.PI * 2); ctx.stroke();
  }, [at, pic]);

  const pickAt = (p: Point) => {
    const data = pixels.current;
    if (!data) return;
    const found = pixelAt(data.data, data.width, p.x, p.y);
    setAt(p); setColour(found); setManual(null);
    setRecent((list) => pushRecent(list, found));
    setStatus(`Picked ${toHex(found)} at ${p.x}, ${p.y}.`);
  };
  const onPointer = (e: PointerEvent) => {
    const c = canvasRef.current;
    if (!c) return;
    const p = canvasPoint(c.getBoundingClientRect(), e.clientX, e.clientY, c.width, c.height);
    if (p) pickAt(p);
  };
  const onKey = (e: KeyboardEvent) => {
    const c = canvasRef.current;
    if (!c) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickAt(at ?? { x: Math.floor(c.width / 2), y: Math.floor(c.height / 2) }); return; }
    const next = moveByKey(at ?? { x: Math.floor(c.width / 2), y: Math.floor(c.height / 2) }, e.key, e.shiftKey, c.width, c.height);
    if (next) { e.preventDefault(); pickAt(next); }
  };

  const copy = (key: string, label: string) => {
    const el = fields.current[key];
    if (!el) return;
    el.focus(); el.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    if (ok) { setManual(null); setStatus(`${label} copied.`); }
    else { setManual(key); setStatus(`This browser blocked copying. The ${label} value is selected: press Ctrl+C, or Cmd+C on a Mac.`); }
  };

  return (
    <section data-testid="tool" aria-label="Colour picker from an image" className={`${panelCls} space-y-6 lg:p-8`}>
      <h2 className="sr-only">Pick a colour from an image</h2>
      <div role="status" aria-live="polite" data-testid="status" className="sr-only">{status}</div>
      <Dropzone inputRef={input} hasFile={!!pic} capText={cap ? `Up to ${formatCap(cap)}.` : null} onPick={(f, extra) => { void choose(f, extra); }} />
      {error && <div role="alert" data-testid="error" className="rounded-lg border border-red-700 bg-red-50 p-3 text-red-950">{error}</div>}

      {pic && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <div className="space-y-2">
            <div className="flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
              <canvas
                ref={canvasRef}
                data-testid="picker-canvas"
                data-at={at ? `${at.x},${at.y}` : 'none'}
                tabIndex={0}
                role="application"
                aria-label={`Your picture, ${formatDims(pic.bitmap.width, pic.bitmap.height)}. Click a spot, or use the arrow keys and Enter, to read its colour.`}
                className={`block h-auto max-h-[70vh] w-auto max-w-full cursor-crosshair touch-none rounded ${focusRing}`}
                onPointerDown={onPointer}
                onPointerMove={(e) => { if (e.buttons === 1) onPointer(e); }}
                onKeyDown={onKey}
              />
            </div>
            <p className={hintCls}>Click or drag on the picture. With the keyboard, focus the picture, then use the arrow keys (Shift moves ten pixels).</p>
          </div>

          <div className="space-y-4">
            {!colour && <p className="text-slate-700" data-testid="hint">No colour picked yet.</p>}
            {colour && (
              <div className="space-y-3" data-testid="values">
                <div className="size-16" data-testid="swatch"><Swatch colour={colour} size={64} label={`Picked colour ${toHex(colour)}`} /></div>
                {at && <p className={hintCls} data-testid="position">Pixel {at.x}, {at.y}{colour.a < 255 ? `, ${Math.round((colour.a / 255) * 100)}% opaque` : ''}</p>}
                {VALUES.map(([key, label, text]) => (
                  <div key={key}>
                    <label htmlFor={`val-${key}`} className={labelCls}>{label}</label>
                    <div className="flex gap-2">
                      <input id={`val-${key}`} data-testid={`value-${key}`} ref={(el) => { fields.current[key] = el; }} readOnly className={inputCls} value={text(colour)} />
                      <button type="button" data-testid={`copy-${key}`} className={`${btnSecondary} shrink-0`} onClick={() => copy(key, label)}>Copy<span className="sr-only"> {label}</span></button>
                    </div>
                  </div>
                ))}
                {manual && <p role="alert" data-testid="copy-manual" className="text-sm font-medium text-slate-900">Copying was blocked by this browser. The text is selected: press Ctrl+C (Cmd+C on a Mac) to copy it.</p>}
              </div>
            )}
            {recent.length > 0 && (
              <div data-testid="recent">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Recent colours</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {recent.map((p) => (
                    <li key={toHex(p)}>
                      <button type="button" data-testid="recent-item" data-hex={toHex(p)} className={`size-10 rounded-lg ${focusRing}`} aria-label={`Show ${toHex(p)}`} onClick={() => { setColour(p); setManual(null); setStatus(`Showing ${toHex(p)}.`); }}>
                        <Swatch colour={p} size={40} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      <p className="text-sm text-slate-700">SizeTune reads your picture in your browser. The site's code does not upload it, and SizeTune keeps no copy.</p>
    </section>
  );
}
