import { useEffect, useRef, useState } from 'preact/hooks';
import Dropzone from './tool/Dropzone';
import ImageTool from './ImageTool';
import { EngineError, getLimits, MAX_CANVAS_PIXELS } from './tool/engine';
import { formatCap, formatDims } from './tool/format';
import { SNIFF_BYTES } from './tool/sniff';
import { hintCls } from './tool/ui';
import { detectKind } from '../lib/avif';

class PickError extends Error {}
const LARGE_BYTES = 8 * 1024 * 1024;
const NO_AVIF = 'This browser could not open the AVIF picture. Either the file is damaged, or this browser cannot read AVIF. Try the file in a current Chrome, Edge, Firefox or Safari (16 or newer), or ask the sender for a JPG or PNG.';

/** Decodes an AVIF with the browser's own decoder and re-encodes it losslessly as PNG, the form the converter below reads. */
async function avifToPng(file: File): Promise<{ png: File; w: number; h: number }> {
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { throw new PickError(NO_AVIF); }
  try {
    if (bitmap.width * bitmap.height > MAX_CANVAS_PIXELS) throw new PickError(`This picture has ${formatDims(bitmap.width, bitmap.height)}, more than the ${MAX_CANVAS_PIXELS / 1_000_000} megapixels this page can handle on every device. Shrink it first.`);
    const c = document.createElement('canvas');
    c.width = bitmap.width; c.height = bitmap.height;
    const ctx = c.getContext('2d');
    if (!ctx) throw new PickError('This browser cannot draw images on a canvas.');
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
    if (!blob) throw new PickError('This browser could not convert the picture.');
    return { png: new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'picture'}.png`, { type: 'image/png' }), w: bitmap.width, h: bitmap.height };
  } finally { bitmap.close(); }
}

/** Opens AVIF and JFIF pictures and converts them to JPG or PNG with the converter on this page. Nothing leaves the browser. */
export default function AvifTool() {
  const input = useRef<HTMLInputElement>(null);
  const serial = useRef(0);
  const [loaded, setLoaded] = useState<{ file: File; key: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const cap = getLimits().maxFileBytes;

  const choose = async (file: File, extra = 0) => {
    const mine = ++serial.current;
    setError(null); setNotes([]); setBusy(true);
    try {
      if (file.size > cap) throw new PickError(`This file is larger than ${formatCap(cap)}. Choose a smaller picture.`);
      const kind = detectKind(new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer()));
      const more: string[] = [];
      if (extra > 0) more.push('Only the first file was used.');
      if (file.size > LARGE_BYTES) more.push(`This file is ${(file.size / 1048576).toFixed(1)} MB, so opening it may take a few seconds.`);
      let ready: File;
      if (kind === 'avif' || kind === 'avif-animated') {
        const { png, w, h } = await avifToPng(file);
        ready = png;
        if (kind === 'avif-animated') more.push('This AVIF is animated. Only its first frame is converted.');
        setStatus(`AVIF opened, ${formatDims(w, h)}.`);
      } else if (kind === 'jpeg' || kind === 'png' || kind === 'webp') {
        ready = file;
        setStatus('Picture ready.');
      } else if (kind === 'heic') {
        throw new PickError('This is a HEIC picture, which this page cannot open yet. Choose an AVIF, JFIF, JPG, PNG or WebP file.');
      } else {
        throw new PickError('This is not an AVIF, JFIF, JPG, PNG or WebP picture. Choose one of those.');
      }
      if (mine !== serial.current) return;
      setNotes(more);
      setLoaded((old) => ({ file: ready, key: (old?.key ?? 0) + 1 }));
    } catch (e) {
      if (mine !== serial.current) return;
      setLoaded(null);
      setError(e instanceof EngineError || e instanceof PickError ? e.message : NO_AVIF);
    } finally { if (mine === serial.current) setBusy(false); }
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

  return (
    <div className="space-y-6">
      <section data-testid="tool" aria-label="AVIF and JFIF to JPG converter" className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-card sm:p-7 lg:p-8">
        <h2 className="sr-only">Open an AVIF or JFIF picture</h2>
        <div role="status" aria-live="polite" data-testid="status" className="sr-only">{status}</div>
        <Dropzone
          inputRef={input}
          hasFile={!!loaded}
          capText={cap ? `Up to ${formatCap(cap)}.` : null}
          accept="image/avif,.avif,image/jpeg,.jfif,.jpg,.jpeg,.jpe,image/png,image/webp"
          supportedText="Supported: AVIF, JFIF (JPEG), PNG and WebP."
          disabled={busy}
          onPick={(f, extra) => { void choose(f, extra); }}
        />
        {busy && <p className={hintCls} data-testid="busy">Opening the picture…</p>}
        {error && <div role="alert" data-testid="error" className="rounded-lg border border-red-700 bg-red-50 p-3 text-red-950">{error}</div>}
        {notes.map((n) => <p key={n} data-testid="note" className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-amber-950">{n}</p>)}
      </section>
      {loaded && (
        <ImageTool key={loaded.key} initialFile={loaded.file} defaultFormat="jpeg" defaultNoLimit label="AVIF and JFIF to JPG converter" />
      )}
    </div>
  );
}
