import { useEffect, useId, useRef, useState } from 'preact/hooks';
import Dropzone from './tool/Dropzone';
import { EngineError, getLimits, inspectSize, processImage } from './tool/engine';
import { formatCap, formatDims, formatSize, normalizeHex } from './tool/format';
import { SNIFF_BYTES, sniffImage } from './tool/sniff';
import { btnPrimary, btnSecondary, hintCls, inputCls, labelCls, panelCls } from './tool/ui';
import { compose, type Fit } from './social/compose';
import { decodeSize, type Focus } from './social/layout';
import { presetsFor, type PlatformId } from '../data/socialPresets';

/** A message written for the user. Anything else that goes wrong is replaced by a generic one so raw browser errors never reach the page. */
class PickError extends Error {}

interface Props { platform: PlatformId }
interface Out { url: string; blob: Blob; width: number; height: number; fit: Fit; lowered: boolean; enlarged: boolean }

const FOCI: Array<[Focus, string]> = [['center', 'Centre'], ['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']];

/** Fit one picture to a platform's image size in the browser. The file is never sent anywhere. */
export default function SocialTool({ platform }: Props) {
  const presets = presetsFor(platform);
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const fileRef = useRef<File | null>(null);
  const serial = useRef(0);
  const [hasFile, setHasFile] = useState(false);
  const [presetId, setPresetId] = useState(presets[0].id);
  const preset = presets.find((p) => p.id === presetId) ?? presets[0];
  const [fit, setFit] = useState<Fit>('crop');
  const [focus, setFocus] = useState<Focus>('center');
  const [pad, setPad] = useState<'white' | 'black' | 'custom'>('white');
  const [hex, setHex] = useState('#ffffff');
  const [maxKb, setMaxKb] = useState(preset.maxKb ? String(preset.maxKb) : '');
  const [out, setOut] = useState<Out | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cap = getLimits().maxFileBytes;
  const bg = pad === 'white' ? '#ffffff' : pad === 'black' ? '#000000' : normalizeHex(hex) ?? '#ffffff';
  const capKb = maxKb.trim() === '' ? null : Number(maxKb);
  const capInvalid = capKb !== null && !(/^\d{1,6}$/.test(maxKb.trim()) && capKb > 0);

  const choosePreset = (id: string) => {
    setPresetId(id);
    const next = presets.find((p) => p.id === id);
    setMaxKb(next?.maxKb ? String(next.maxKb) : '');
  };

  const pick = async (file: File, extra = 0) => {
    const mine = ++serial.current;
    setError(null);
    try {
      if (file.size > cap) throw new PickError(`This file is larger than ${formatCap(cap)}. Choose a smaller image.`);
      if (!sniffImage(new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer())).kind) throw new PickError('This is not a JPEG, PNG or WebP image. Choose one of those formats.');
      const size = await inspectSize(file);
      const big = presets.reduce((m, p) => ({ w: Math.max(m.w, p.width), h: Math.max(m.h, p.height) }), { w: 0, h: 0 });
      const d = decodeSize(size.width, size.height, big.w, big.h);
      // The browser applies the EXIF orientation while decoding, so the picture is turned once and matches the system viewer.
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image', ...(d ? { resizeWidth: d.width, resizeHeight: d.height, resizeQuality: 'high' as const } : {}) });
      if (mine !== serial.current) { bmp.close(); return; }
      bitmapRef.current?.close();
      bitmapRef.current = bmp;
      fileRef.current = file;
      setHasFile(true);
      if (extra > 0) setError('Only the first file was used.');
    } catch (e) {
      if (mine === serial.current) setError(e instanceof EngineError || e instanceof PickError ? e.message : 'This image could not be read. It may be damaged, or too large for this device.');
    }
  };

  useEffect(() => {
    const el = inputRef.current;
    const f = el?.files?.[0];
    if (el && f) { void pick(f); el.value = ''; }
    const guard = (e: DragEvent) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); };
    window.addEventListener('dragover', guard);
    window.addEventListener('drop', guard);
    return () => { window.removeEventListener('dragover', guard); window.removeEventListener('drop', guard); };
  }, []);

  // The result is made again whenever the picture or a setting changes. `run` ignores a result that arrives after a newer request started.
  const run = useRef(0);
  useEffect(() => {
    const bmp = bitmapRef.current;
    if (!hasFile || !bmp || capInvalid) return;
    const mine = ++run.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const canvasEl = compose(bmp, preset.width, preset.height, fit, focus, bg);
        let blob = await new Promise<Blob | null>((res) => canvasEl.toBlob(res, 'image/jpeg', 0.92));
        if (!blob || blob.type !== 'image/jpeg') throw new EngineError('encode_failed', 'This browser could not save the picture. Try another browser.');
        let lowered = false;
        if (capKb !== null && blob.size > capKb * 1000) {
          const r = await processImage(blob, { format: 'jpeg', strategy: 'quality-first', lockAspect: true, fit: 'contain', background: 'white', width: preset.width, height: preset.height, maxKb: capKb });
          blob = r.blob;
          lowered = true;
        }
        if (mine !== run.current) return;
        const need = Math.max(preset.width / bmp.width, preset.height / bmp.height);
        const enlarged = (fit === 'crop' ? need : Math.min(preset.width / bmp.width, preset.height / bmp.height)) > 1;
        const url = URL.createObjectURL(blob);
        setOut((old) => { if (old) URL.revokeObjectURL(old.url); return { url, blob, width: preset.width, height: preset.height, fit, lowered, enlarged }; });
        setError(null);
      } catch (e) {
        if (mine === run.current) setError(e instanceof EngineError ? e.message : 'The picture could not be made. Try a smaller picture or another browser.');
      } finally {
        if (mine === run.current) setBusy(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [hasFile, preset.id, fit, focus, bg, capKb, capInvalid]);

  useEffect(() => () => { run.current++; serial.current++; bitmapRef.current?.close(); }, []);

  const name = (fileRef.current?.name ?? 'image').replace(/\.[^.]+$/, '') || 'image';
  const radio = 'size-4 accent-teal-700';
  return (
    <section data-testid="tool" aria-label={`${platform === 'youtube' ? 'YouTube' : platform === 'linkedin' ? 'LinkedIn' : 'Instagram'} image resizer`} className={`${panelCls} lg:p-8`}>
      <h2 className="sr-only">Fit your image to a size</h2>
      <div role="status" aria-live="polite" data-testid="status" className="sr-only">{out ? `Ready, ${formatDims(out.width, out.height)}.` : busy ? 'Working.' : ''}</div>
      <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start lg:gap-x-8 lg:space-y-0">
        <div className="space-y-5">
          <Dropzone inputRef={inputRef} hasFile={hasFile} capText={cap ? `Up to ${formatCap(cap)}.` : null} onPick={(f, extra) => { void pick(f, extra); }} />
          {error && <div role="alert" data-testid="error" className="rounded-lg border border-red-700 bg-red-50 p-3 text-red-950">{error}</div>}
          {out && (
            <div data-testid="social-result" data-width={out.width} data-height={out.height} data-fit={out.fit} className="space-y-3">
              <div className="flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
                <img data-testid="social-preview" src={out.url} width={out.width} height={out.height} alt={`Preview, ${formatDims(out.width, out.height)}`} className="block h-auto max-h-[70vh] w-auto max-w-full" />
              </div>
              <p className="text-sm text-slate-800" data-testid="social-info">{formatDims(out.width, out.height)}, JPEG, {formatSize(out.blob.size)}</p>
              {out.lowered && <p className="text-sm text-slate-800" data-testid="lowered-note">Quality was lowered to fit your size limit.</p>}
              {out.enlarged && <p role="note" className="rounded-lg border border-amber-600 bg-amber-50 p-3 text-sm text-amber-950" data-testid="enlarge-note">Your picture is smaller than this size, so it was enlarged and may look soft. A larger original gives a sharper result.</p>}
              <div className="flex flex-col gap-2 sm:flex-row">
                <a data-testid="download" role="button" href={out.url} download={`${name}-${preset.id}.jpg`} className={btnPrimary}>Download image</a>
                <a data-testid="resize-link" className={btnSecondary} href="/">Resize to a KB limit</a>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5 max-lg:mt-5 lg:sticky lg:top-4">
          <div>
            <label htmlFor={`${uid}-preset`} className={labelCls}>Size</label>
            <select id={`${uid}-preset`} data-testid="preset" className={inputCls} value={preset.id} onChange={(e) => choosePreset(e.currentTarget.value)}>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.label}, {formatDims(p.width, p.height)}</option>)}
            </select>
            <p className={hintCls}>{preset.note}</p>
            <p className={hintCls}>
              Source: <a data-testid="preset-source" className="font-medium text-teal-800 underline underline-offset-4" href={`/guides/social-image-sizes/#${preset.source.id}`}>{preset.source.name}</a>.
              {' '}<span data-testid="preset-checked">Last checked {preset.checkedOn}.</span>
            </p>
          </div>

          <fieldset className="min-w-0 space-y-2" data-testid="fit-picker">
            <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">If the picture has a different shape</legend>
            {([['crop', 'Crop to fill the frame'], ['pad', 'Fit whole picture, add colour bars'], ['blur', 'Fit whole picture, blurred background']] as Array<[Fit, string]>).map(([v, label]) => (
              <label key={v} className="flex min-h-11 items-center gap-2 text-base text-slate-900">
                <input type="radio" name={`${uid}-fit`} data-testid={`fit-${v}`} className={radio} checked={fit === v} onChange={() => setFit(v)} />{label}
              </label>
            ))}
          </fieldset>

          {fit === 'crop' && (
            <div>
              <label htmlFor={`${uid}-focus`} className={labelCls}>Keep this part of the picture</label>
              <select id={`${uid}-focus`} data-testid="focus" className={inputCls} value={focus} onChange={(e) => setFocus(e.currentTarget.value as Focus)}>
                {FOCI.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
          )}

          {fit === 'pad' && (
            <fieldset className="min-w-0 space-y-2" data-testid="pad-picker">
              <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Bar colour</legend>
              {([['white', 'White'], ['black', 'Black'], ['custom', 'Custom colour']] as Array<['white' | 'black' | 'custom', string]>).map(([v, label]) => (
                <label key={v} className="flex min-h-11 items-center gap-2 text-base text-slate-900">
                  <input type="radio" name={`${uid}-pad`} data-testid={`pad-${v}`} className={radio} checked={pad === v} onChange={() => setPad(v)} />{label}
                </label>
              ))}
              {pad === 'custom' && (
                <div>
                  <label htmlFor={`${uid}-hex`} className={labelCls}>Colour (hex, such as #ffcc00)</label>
                  <input id={`${uid}-hex`} data-testid="pad-hex" className={inputCls} value={hex} onInput={(e) => setHex(e.currentTarget.value)} aria-invalid={normalizeHex(hex) ? undefined : 'true'} />
                </div>
              )}
            </fieldset>
          )}

          <div>
            <label htmlFor={`${uid}-max`} className={labelCls}>Maximum file size, in KB (optional)</label>
            <input id={`${uid}-max`} data-testid="max-kb" type="text" inputMode="numeric" autoComplete="off" className={inputCls} value={maxKb} aria-invalid={capInvalid ? 'true' : undefined} onInput={(e) => setMaxKb(e.currentTarget.value)} />
            {capInvalid ? <p className="mt-1 text-sm font-medium text-red-800">Enter a whole number above zero, or leave it empty.</p> : <p className={hintCls}>Leave empty for no limit. If a result is larger, the quality is lowered to fit.</p>}
          </div>
          {hasFile && <button type="button" className={btnSecondary} data-testid="start-over" onClick={() => { run.current++; bitmapRef.current?.close(); bitmapRef.current = null; setHasFile(false); setOut((o) => { if (o) URL.revokeObjectURL(o.url); return null; }); setError(null); inputRef.current?.focus(); }}>Start over</button>}
        </div>
      </div>
      <p className="mt-5 text-sm text-slate-700">SizeTune fits your image in your browser. The site's code does not upload it, and SizeTune keeps no copy of it.</p>
    </section>
  );
}
