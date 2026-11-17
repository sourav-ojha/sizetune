import { useEffect, useId, useRef, useState } from 'preact/hooks';
import Dropzone from './tool/Dropzone';
import { EngineError, getLimits, inspectSize } from './tool/engine';
import { formatCap, formatDims, formatSize, normalizeHex } from './tool/format';
import { SNIFF_BYTES, sniffImage } from './tool/sniff';
import { btnPrimary, btnSecondary, hintCls, inputCls, labelCls, panelCls } from './tool/ui';
import { buildIco } from './icons/ico';
import { buildManifest, type ManifestIcon } from './icons/manifest';
import { renderIcon, type SquareFit } from './icons/render';
import { buildSnippet } from './icons/snippet';
import { decodeSize } from './social/layout';
import { ICON_MODES, filesFor, type IconMode } from '../data/iconSets';
import { makeZip, type ZipFile } from '../lib/zip';

/** A message written for the user. Anything else that goes wrong is replaced by a generic one so raw browser errors never reach the page. */
class PickError extends Error {}

interface Made { file: string; kind: 'png' | 'ico' | 'manifest' | 'text'; label: string; data: Uint8Array; url: string; size: number }

const toBytes = async (c: HTMLCanvasElement): Promise<Uint8Array> => {
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
  if (!blob || blob.type !== 'image/png') throw new PickError('This browser could not save PNG files.');
  return new Uint8Array(await blob.arrayBuffer());
};
const MIME: Record<Made['kind'], string> = { png: 'image/png', ico: 'image/x-icon', manifest: 'application/manifest+json', text: 'text/plain' };

/** One picture in, a set of favicon or app icons out, all in the browser. The file is never sent anywhere. */
export default function IconTool() {
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const serial = useRef(0);
  const run = useRef(0);
  const urls = useRef<string[]>([]);
  const [src, setSrc] = useState<{ w: number; h: number } | null>(null);
  const [rev, setRev] = useState(0);
  const [mode, setMode] = useState<IconMode>('favicon');
  const [fit, setFit] = useState<SquareFit>('pad');
  const [hex, setHex] = useState('#ffffff');
  const [appName, setAppName] = useState('My app');
  const [made, setMade] = useState<Made[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cap = getLimits().maxFileBytes;
  const bg = normalizeHex(hex) ?? '#ffffff';
  const nonSquare = !!src && Math.abs(src.w - src.h) > 1;
  const small = !!src && Math.min(src.w, src.h) < 512;

  const revokeAll = () => { for (const u of urls.current) URL.revokeObjectURL(u); urls.current = []; };

  const pick = async (file: File, extra = 0) => {
    const mine = ++serial.current;
    setError(null);
    try {
      if (file.size > cap) throw new PickError(`This file is larger than ${formatCap(cap)}. Choose a smaller image.`);
      if (!sniffImage(new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer())).kind) throw new PickError('This is not a JPEG, PNG or WebP image. SVG is not supported yet.');
      const size = await inspectSize(file);
      const d = decodeSize(size.width, size.height, 1024, 1024);
      let bmp = await createImageBitmap(file, { imageOrientation: 'from-image', ...(d ? { resizeWidth: d.width, resizeHeight: d.height, resizeQuality: 'high' as const } : {}) });
      if (d && Math.abs(bmp.width / bmp.height - size.width / size.height) > 0.02 * (size.width / size.height)) { bmp.close(); bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
      if (mine !== serial.current) { bmp.close(); return; }
      bitmapRef.current?.close();
      bitmapRef.current = bmp;
      setSrc({ w: size.width, h: size.height });
      setRev((n) => n + 1);
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

  // The set is made again whenever the picture or a setting changes; a result that arrives after a newer request started is dropped.
  useEffect(() => {
    const bmp = bitmapRef.current;
    if (!src || !bmp) return;
    const mine = ++run.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const out: Made[] = [];
        const icons: ManifestIcon[] = [];
        const add = (m: Omit<Made, 'url'>) => { const u = URL.createObjectURL(new Blob([m.data as BlobPart], { type: MIME[m.kind] })); out.push({ ...m, url: u }); };
        for (const f of filesFor(mode)) {
          if (f.kind === 'manifest') continue;
          const o = { fit, opaque: !!f.opaque, maskable: !!f.maskable, background: bg };
          if (f.kind === 'ico') {
            const sizes = f.ico ?? [f.size];
            const images = await Promise.all(sizes.map(async (s) => ({ size: s, data: await toBytes(renderIcon(bmp, s, o)) })));
            add({ file: f.file, kind: 'ico', label: `${sizes.join(', ')} px`, data: buildIco(images), size: f.size });
          } else {
            const data = await toBytes(renderIcon(bmp, f.size, o));
            add({ file: f.file, kind: 'png', label: `${f.size} × ${f.size} px`, data, size: f.size });
            if (mode === 'app' && ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'].includes(f.file)) icons.push({ src: f.file, sizes: `${f.size}x${f.size}`, type: 'image/png', ...(f.maskable ? { purpose: 'maskable' } : {}) });
          }
        }
        if (mode === 'app') add({ file: 'site.webmanifest', kind: 'manifest', label: 'manifest', data: new TextEncoder().encode(buildManifest({ name: appName, backgroundColor: bg, icons })), size: 0 });
        if (mine !== run.current) { for (const m of out) URL.revokeObjectURL(m.url); return; }
        revokeAll();
        urls.current = out.map((m) => m.url);
        setMade(out);
        setError(null);
      } catch (e) {
        if (mine === run.current) setError(e instanceof PickError ? e.message : 'The icons could not be made. Try a smaller picture or another browser.');
      } finally {
        if (mine === run.current) setBusy(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [src, rev, mode, fit, bg, appName]);

  useEffect(() => () => { run.current++; serial.current++; bitmapRef.current?.close(); revokeAll(); }, []);

  const save = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const downloadZip = () => {
    if (busy || !made.length) return;
    try {
      const files: ZipFile[] = made.map((m) => ({ name: m.file, data: m.data }));
      files.push({ name: 'HOW-TO-ADD.txt', data: new TextEncoder().encode(`Add these lines inside the <head> of your pages, and upload the files to your site's root folder:\n\n${buildSnippet(mode)}\n`) });
      save(new Blob([makeZip(files) as BlobPart], { type: 'application/zip' }), `${mode === 'favicon' ? 'favicon' : 'app-icons'}.zip`);
    } catch {
      setError('The ZIP could not be made. Use the download links on each file instead.');
    }
  };

  const radio = 'size-4 accent-teal-700';
  return (
    <section data-testid="tool" aria-label="Favicon and app icon generator" className={`${panelCls} lg:p-8`}>
      <h2 className="sr-only">Make your icons</h2>
      <div role="status" aria-live="polite" data-testid="status" className="sr-only">{made.length ? `${made.length} files ready.` : busy ? 'Working.' : ''}</div>
      <div className="space-y-5">
        <Dropzone inputRef={inputRef} hasFile={!!src} capText={cap ? `Up to ${formatCap(cap)}.` : null} onPick={(f, extra) => { void pick(f, extra); }} />
        {error && <div role="alert" data-testid="error" className="rounded-lg border border-red-700 bg-red-50 p-3 text-red-950">{error}</div>}

        <fieldset className="min-w-0 space-y-2" data-testid="mode-picker">
          <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">What do you need?</legend>
          {ICON_MODES.map((m) => (
            <label key={m.id} className="flex min-h-11 items-start gap-2 text-base text-slate-900">
              <input type="radio" name={`${uid}-mode`} data-testid={`mode-${m.id}`} className={`${radio} mt-1.5`} checked={mode === m.id} onChange={() => setMode(m.id)} />
              <span><strong>{m.label}</strong><span className="block text-sm text-slate-700">{m.blurb}</span></span>
            </label>
          ))}
        </fieldset>

        {src && (nonSquare || small) && (
          <div role="note" data-testid="icon-warning" className="space-y-3 rounded-lg border border-amber-600 bg-amber-50 p-3 text-amber-950">
            {nonSquare && <p>Your picture is {formatDims(src.w, src.h)}, not square. Icons are square, so choose how to fit it:</p>}
            {small && <p>{nonSquare ? 'It is also' : `Your picture is ${formatDims(src.w, src.h)}, which is`} smaller than 512 px, so the larger icons will be enlarged and may look soft. A bigger original gives a sharper set.</p>}
            {nonSquare && (
              <div role="radiogroup" aria-label="Fit to a square" className="space-y-1">
                <label className="flex min-h-11 items-center gap-2"><input type="radio" name={`${uid}-fit`} data-testid="fix-pad" className={radio} checked={fit === 'pad'} onChange={() => setFit('pad')} />Pad: keep the whole picture, with empty space around it</label>
                <label className="flex min-h-11 items-center gap-2"><input type="radio" name={`${uid}-fit`} data-testid="fix-crop" className={radio} checked={fit === 'crop'} onChange={() => setFit('crop')} />Crop: fill the square and cut off the sides</label>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-bg`} className={labelCls}>Background colour (hex)</label>
            <input id={`${uid}-bg`} data-testid="icon-bg" className={inputCls} value={hex} onInput={(e) => setHex(e.currentTarget.value)} aria-invalid={normalizeHex(hex) ? undefined : 'true'} />
            <p className={hintCls}>{normalizeHex(hex) ? 'Used where an icon must be opaque, such as the store icon and the maskable icon.' : 'Enter a colour such as #ffcc00. White is used until it is valid.'}</p>
          </div>
          {mode === 'app' && (
            <div>
              <label htmlFor={`${uid}-name`} className={labelCls}>App name (for the manifest)</label>
              <input id={`${uid}-name`} data-testid="app-name" className={inputCls} value={appName} maxLength={60} onInput={(e) => setAppName(e.currentTarget.value)} />
            </div>
          )}
        </div>

        {made.length > 0 && (
          <div data-testid="icon-result" data-mode={mode} data-count={made.length} className="space-y-4">
            <ul className="grid gap-3 sm:grid-cols-2" aria-label="Files in this set">
              {made.map((m) => (
                <li key={m.file} data-testid={`icon-file-${m.file}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  {m.kind === 'png' ? <img data-testid={`icon-preview-${m.file}`} src={m.url} alt="" className="size-16 shrink-0 rounded border border-slate-200 bg-[repeating-conic-gradient(#e2e8f0_0_25%,#fff_0_50%)] bg-[length:12px_12px] object-contain" /> : <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">{m.kind === 'ico' ? 'ICO' : 'JSON'}</span>}
                  <span className="min-w-0 text-sm text-slate-800"><span className="block break-all font-semibold">{m.file}</span>{m.label}, {formatSize(m.data.length)}
                    <a data-testid={`download-file-${m.file}`} className="mt-1 block font-medium text-teal-800 underline underline-offset-4" href={m.url} download={m.file}>Download {m.file}</a>
                  </span>
                </li>
              ))}
            </ul>
            <div>
              <p className={labelCls}>Add this to your site</p>
              <pre data-testid="snippet" className="mt-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">{buildSnippet(mode)}</pre>
            </div>
            <button type="button" data-testid="download-zip" className={btnPrimary} aria-disabled={busy ? 'true' : undefined} onClick={downloadZip}>Download all (ZIP)</button>
          </div>
        )}
        {src && <button type="button" data-testid="start-over" className={btnSecondary} onClick={() => { run.current++; serial.current++; setBusy(false); bitmapRef.current?.close(); bitmapRef.current = null; revokeAll(); setMade([]); setSrc(null); setError(null); inputRef.current?.focus(); }}>Start over</button>}
      </div>
      <p className="mt-5 text-sm text-slate-700">SizeTune makes your icons in your browser. The site's code does not upload your picture, and SizeTune keeps no copy of it.</p>
    </section>
  );
}
