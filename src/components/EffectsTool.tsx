import { useEffect, useRef, useState } from 'preact/hooks';
import Dropzone from './tool/Dropzone';
import ImageTool from './ImageTool';
import { EngineError, getLimits, inspectSize, MAX_CANVAS_PIXELS } from './tool/engine';
import { formatCap, formatDims } from './tool/format';
import { SNIFF_BYTES, sniffImage } from './tool/sniff';
import { btnPrimary, btnSecondary, btnToggleOff, btnToggleOn, fieldsetCls, hintCls, inputCls, labelCls, legendCls, panelCls } from './tool/ui';
import { BORDER_MAX_PX, LOGO_SIZE_RANGE_PCT, blackAndWhite, borderedSize, grayscale, logoBox, pixelArt, type LogoPosition, type Pixels } from '../lib/effects';

class PickError extends Error {}
interface Pic { id: number; bitmap: ImageBitmap; name: string }
type Effect = 'none' | 'gray' | 'bw' | 'pixel';
type Slot = 'photo' | 'logo';

const BORDER_COLORS = [['#ffffff', 'White'], ['#111827', 'Black'], ['#9ca3af', 'Grey'], ['#0f766e', 'Teal'], ['#b91c1c', 'Red'], ['#1d4ed8', 'Blue']] as const;
const POSITIONS: ReadonlyArray<readonly [LogoPosition, string]> = [['br', 'Bottom right'], ['bl', 'Bottom left'], ['tr', 'Top right'], ['tl', 'Top left'], ['center', 'Centre']];
const PALETTES = [['256', 'Full colour'], ['16', '16 shades per colour'], ['8', '8 shades per colour'], ['4', '4 shades per colour']] as const;

/** Adds an effect, a border and a logo to a photo, then saves it or sends it to the KB resizer on this page. Everything runs in the browser. */
export default function EffectsTool() {
  const photoInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const serial = useRef({ photo: 0, logo: 0 });
  const effected = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);
  const [photo, setPhoto] = useState<Pic | null>(null);
  const [logo, setLogo] = useState<Pic | null>(null);
  const [errors, setErrors] = useState<Record<Slot, string | null>>({ photo: null, logo: null });
  const [effect, setEffect] = useState<Effect>('none');
  const [threshold, setThreshold] = useState('128');
  const [chunk, setChunk] = useState('10');
  const [palette, setPalette] = useState('16');
  const [border, setBorder] = useState('0');
  const [borderColor, setBorderColor] = useState('#ffffff');
  const [position, setPosition] = useState<LogoPosition>('br');
  const [logoSize, setLogoSize] = useState('20');
  const [capKb, setCapKb] = useState('200');
  const [status, setStatus] = useState('');
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [resize, setResize] = useState<{ file: File; key: number; kb: number } | null>(null);
  const [info, setInfo] = useState<{ w: number; h: number; logo: string } | null>(null);
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
      const pic = { id: nextId.current++, bitmap, name: file.name };
      if (slot === 'photo') setPhoto((old) => { old?.bitmap.close(); return pic; });
      else setLogo((old) => { old?.bitmap.close(); return pic; });
      setResize(null);
      setStatus(`${slot === 'photo' ? 'Photo' : 'Logo'} ready, ${formatDims(bitmap.width, bitmap.height)}.${extra > 0 ? ' Only the first file was used.' : ''}`);
    } catch (e) {
      if (mine !== serial.current[slot]) return;
      setErrors((x) => ({ ...x, [slot]: e instanceof EngineError || e instanceof PickError ? e.message : 'This picture could not be read. It may be damaged, or too large for this device.' }));
    }
  };
  useEffect(() => {
    for (const [slot, ref] of [['photo', photoInput], ['logo', logoInput]] as const) {
      const el = ref.current, f = el?.files?.[0];
      if (el && f) { void pick(slot, f); el.value = ''; } // a file chosen before the island hydrated would otherwise be invisible
    }
    const guard = (e: DragEvent) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); };
    window.addEventListener('dragover', guard);
    window.addEventListener('drop', guard);
    return () => { window.removeEventListener('dragover', guard); window.removeEventListener('drop', guard); };
  }, []);
  useEffect(() => () => { serial.current.photo++; serial.current.logo++; }, []);

  // The photo with its effect. Kept until the photo or an effect setting changes, so moving the border or logo does not redo it.
  const effectCanvas = (p: Pic): HTMLCanvasElement => {
    const key = `${p.id}|${effect}|${threshold}|${chunk}|${palette}`;
    if (effected.current?.key === key) return effected.current.canvas;
    const c = document.createElement('canvas');
    c.width = p.bitmap.width; c.height = p.bitmap.height;
    const ctx = c.getContext('2d', { willReadFrequently: effect !== 'none' })!;
    ctx.drawImage(p.bitmap, 0, 0);
    if (effect !== 'none') {
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const px: Pixels = { width: d.width, height: d.height, data: d.data };
      if (effect === 'gray') grayscale(px);
      else if (effect === 'bw') blackAndWhite(px, Number(threshold));
      else pixelArt(px, Math.max(2, Math.round((Number(chunk) * Math.max(c.width, c.height)) / 400)), Number(palette));
      ctx.putImageData(d, 0, 0);
    }
    effected.current = { key, canvas: c };
    return c;
  };

  const B = photo ? borderedSize(photo.bitmap.width, photo.bitmap.height, Number(border)) : null;
  const tooBig = B ? B.w * B.h > MAX_CANVAS_PIXELS : false;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !photo || !B) return;
    if (tooBig) { setSizeError(`With this border the picture would be ${formatDims(B.w, B.h)}, more than this page can handle. Use a thinner border, or shrink the photo first.`); return; }
    setSizeError((e) => (e && e.startsWith('With this border') ? null : e));
    c.width = B.w; c.height = B.h;
    const ctx = c.getContext('2d');
    if (!ctx) { setSizeError('This browser cannot draw images on a canvas.'); return; }
    ctx.fillStyle = borderColor;
    ctx.fillRect(0, 0, B.w, B.h);
    ctx.drawImage(effectCanvas(photo), B.b, B.b);
    let logoInfo = 'none';
    if (logo) {
      const lb = logoBox({ canvas: { w: B.w, h: B.h }, logo: { w: logo.bitmap.width, h: logo.bitmap.height }, position, sizePct: Number(logoSize), marginPct: 2 });
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(logo.bitmap, lb.x, lb.y, lb.w, lb.h);
      logoInfo = JSON.stringify(lb);
    }
    setInfo({ w: B.w, h: B.h, logo: logoInfo });
  }, [photo, logo, effect, threshold, chunk, palette, border, borderColor, position, logoSize]);

  const toBlob = (kind: 'png' | 'jpg') => new Promise<Blob | null>((resolve) => {
    const c = canvasRef.current;
    if (!c || tooBig) { resolve(null); return; }
    if (kind === 'png') { c.toBlob((b) => resolve(b), 'image/png'); return; }
    // a JPG has no transparency: a logo with transparent parts goes onto the picture, which is already opaque, so it can be saved as is
    c.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
  });
  const download = async (kind: 'png' | 'jpg') => {
    const blob = await toBlob(kind);
    if (!blob) { setSizeError('This browser could not save the picture.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${(photo?.name ?? 'photo').replace(/\.[^.]+$/, '') || 'photo'}-edited.${kind}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const toResizer = async () => {
    const kb = Math.floor(Number(capKb));
    if (!Number.isFinite(kb) || kb < 1) { setSizeError('Enter the size limit as a whole number of KB, 1 or more.'); return; }
    const blob = await toBlob('jpg');
    if (!blob) { setSizeError('This browser could not prepare the picture.'); return; }
    setSizeError(null);
    setResize((r) => ({ file: new File([blob], 'photo-edited.jpg', { type: 'image/jpeg' }), key: (r?.key ?? 0) + 1, kb }));
    setStatus(`The edited photo is loaded in the resizer below with a ${kb} KB limit.`);
  };
  useEffect(() => { if (resize) resizeRef.current?.scrollIntoView({ block: 'start' }); }, [resize?.key]);

  const effBtn = (e: Effect, label: string) => <button type="button" data-testid={`effect-${e}`} aria-pressed={effect === e} className={effect === e ? btnToggleOn : btnToggleOff} onClick={() => setEffect(e)}>{label}</button>;
  const slider = (id: string, label: string, v: string, set: (s: string) => void, min: number, max: number) => (
    <div>
      <label htmlFor={id} className={labelCls}>{label}: {v}</label>
      <input id={id} data-testid={id} type="range" min={min} max={max} step={1} className="mt-1 w-full accent-teal-700" value={v} onInput={(e) => set((e.target as HTMLInputElement).value)} />
    </div>
  );
  const slot = (s: Slot, label: string, inputRef: typeof photoInput, pic: Pic | null) => (
    <div data-testid={`slot-${s}`} className="space-y-2">
      <h3 className="text-base font-semibold text-slate-950">{label}</h3>
      <Dropzone inputRef={inputRef} hasFile={!!pic} capText={cap ? `Up to ${formatCap(cap)}.` : null} onPick={(f, extra) => { void pick(s, f, extra); }} />
      {pic && <p className={hintCls} data-testid={`${s}-info`}>{formatDims(pic.bitmap.width, pic.bitmap.height)}</p>}
      {s === 'logo' && pic && <button type="button" data-testid="remove-logo" className={btnSecondary} onClick={() => { setLogo((old) => { old?.bitmap.close(); return null; }); setResize(null); }}>Remove the logo</button>}
      {errors[s] && <div role="alert" data-testid={`${s}-error`} className="rounded-lg border border-red-700 bg-red-50 p-3 text-red-950">{errors[s]}</div>}
    </div>
  );

  return (
    <div className="space-y-8">
      <section data-testid="tool" aria-label="Photo effects, border and logo" className={`${panelCls} lg:p-8`}>
        <h2 className="sr-only">Add effects, a border and a logo to a photo</h2>
        <div role="status" aria-live="polite" data-testid="status" className="sr-only">{status}</div>
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {slot('photo', 'Photo', photoInput, photo)}
            {slot('logo', 'Logo (optional)', logoInput, logo)}
          </div>

          {photo && B && (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
              <div className="order-2 space-y-4 lg:order-1">
                <div className="flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <canvas ref={canvasRef} data-testid="edit-preview" data-logo-box={info?.logo ?? 'none'} role="img" aria-label={`Preview of your photo, ${formatDims(B.w, B.h)}`} className="block h-auto max-h-[70vh] w-auto max-w-full" />
                </div>
                {sizeError && <div role="alert" data-testid="size-error" className="rounded-lg border border-red-700 bg-red-50 p-3 text-red-950">{sizeError}</div>}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" data-testid="save-png" className={btnPrimary} disabled={tooBig} onClick={() => void download('png')}>Download PNG</button>
                  <button type="button" data-testid="save-jpg" className={btnSecondary} disabled={tooBig} onClick={() => void download('jpg')}>Download JPG</button>
                </div>
              </div>

              <div className="order-1 space-y-4 lg:order-2">
                <fieldset className={fieldsetCls}>
                  <legend className={legendCls}>Effect</legend>
                  <div className="flex flex-wrap gap-2">{effBtn('none', 'None')}{effBtn('gray', 'Grayscale')}{effBtn('bw', 'Black and white')}{effBtn('pixel', 'Pixel art')}</div>
                </fieldset>
                {effect === 'bw' && slider('threshold', 'Black and white cut-off', threshold, setThreshold, 1, 254)}
                {effect === 'pixel' && (
                  <>
                    {slider('chunk', 'Pixel size', chunk, setChunk, 2, 40)}
                    <div>
                      <label htmlFor="palette" className={labelCls}>Colours</label>
                      <select id="palette" data-testid="palette" className={inputCls} value={palette} onChange={(e) => setPalette((e.target as HTMLSelectElement).value)}>
                        {PALETTES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label htmlFor="border" className={labelCls}>Border width (px)</label>
                  <input id="border" data-testid="border" type="number" inputMode="numeric" min={0} max={BORDER_MAX_PX} step={1} className={inputCls} value={border} onInput={(e) => setBorder((e.target as HTMLInputElement).value)} />
                  <p className={hintCls}>From 0 to {BORDER_MAX_PX}. The picture grows by this much on every side.</p>
                </div>
                <div>
                  <label htmlFor="border-color" className={labelCls}>Border colour</label>
                  <select id="border-color" data-testid="border-color" className={inputCls} value={borderColor} onChange={(e) => setBorderColor((e.target as HTMLSelectElement).value)}>
                    {BORDER_COLORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                {logo && (
                  <>
                    <div>
                      <label htmlFor="position" className={labelCls}>Logo position</label>
                      <select id="position" data-testid="position" className={inputCls} value={position} onChange={(e) => setPosition((e.target as HTMLSelectElement).value as LogoPosition)}>
                        {POSITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    {slider('logo-size', 'Logo width (% of the picture)', logoSize, setLogoSize, LOGO_SIZE_RANGE_PCT[0], LOGO_SIZE_RANGE_PCT[1])}
                  </>
                )}
                <div>
                  <label htmlFor="cap-kb" className={labelCls}>Size limit (KB), optional</label>
                  <input id="cap-kb" data-testid="cap-kb" type="number" inputMode="numeric" min={1} step={1} className={inputCls} value={capKb} onInput={(e) => setCapKb((e.target as HTMLInputElement).value)} />
                  <button type="button" data-testid="to-resizer" className={`${btnSecondary} mt-2 w-full`} disabled={tooBig} onClick={() => void toResizer()}>Resize to KB</button>
                </div>
              </div>
            </div>
          )}
        </div>
        <p className="mt-5 text-sm text-slate-700">SizeTune edits your pictures in your browser. The site's code does not upload them, and SizeTune keeps no copy.</p>
      </section>

      {resize && (
        <div ref={resizeRef} data-testid="resize-area" className="space-y-4" aria-labelledby="resize-h">
          <h2 id="resize-h" className="text-2xl font-semibold text-slate-950">Resize to {resize.kb} KB</h2>
          <p className={hintCls}>Your edited photo is already loaded. Change the limit if you need to, then download the result.</p>
          <ImageTool key={resize.key} initialFile={resize.file} defaultMaxKb={resize.kb} label="Resize the edited photo" />
        </div>
      )}
    </div>
  );
}
