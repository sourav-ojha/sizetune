import '@fontsource/caveat/latin-400.css';
import '@fontsource/dancing-script/latin-400.css';
import '@fontsource/homemade-apple/latin-400.css';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import ImageTool from './ImageTool';
import { blobOf, drawPage, ensureFont, layoutText } from './handwriting/render';
import { btnPrimary, btnSecondary, btnToggleOff, btnToggleOn, errCls, fieldsetCls, hintCls, inputCls, labelCls, legendCls, panelCls } from './tool/ui';
import { MAX_CHARS, MAX_PAGES, PAPERS, SIZES, sizeFor, unsupportedChars, type PaperId, type SizeId } from '../lib/handwriting';
import { FONTS, INKS, type FontId, type InkId } from '../lib/signature-maker';
import { makeZip } from '../lib/zip';

const SAMPLE = 'Dear friend,\n\nI hope you are well. This note was typed, and the tool wrote it out by hand on a sheet of paper.';

/** Writes typed text out in a handwriting font on plain, ruled or squared paper, one image per page. Everything runs in the browser. */
export default function HandwritingTool() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(SAMPLE);
  const [font, setFont] = useState<FontId>('caveat');
  const [ink, setInk] = useState<InkId>('blue');
  const [paper, setPaper] = useState<PaperId>('ruled');
  const [size, setSize] = useState<SizeId>('medium');
  const [page, setPage] = useState(0);
  const [fontReady, setFontReady] = useState(0);
  const [message, setMessage] = useState('');
  const [resize, setResize] = useState<{ file: File; key: number } | null>(null);
  const color = INKS.find((i) => i.id === ink)!.value;
  const fontPx = sizeFor(size);
  const clean = text.slice(0, MAX_CHARS);

  useEffect(() => {
    let alive = true;
    void ensureFont(font).then(() => { if (alive) setFontReady((n) => n + 1); });
    return () => { alive = false; };
  }, [font]);

  const layout = useMemo(() => layoutText(clean, font, fontPx), [clean, font, fontPx, fontReady]);
  const current = Math.min(page, layout.pages.length - 1);
  const missing = useMemo(() => unsupportedChars(clean), [clean]);
  const empty = clean.trim() === '';

  useEffect(() => {
    const c = canvasRef.current;
    if (c) drawPage(c, layout.pages[current] ?? [''], { font, fontPx, ink: color, paper });
  }, [layout, current, font, fontPx, color, paper, fontReady]);
  useEffect(() => { if (page > layout.pages.length - 1) setPage(Math.max(0, layout.pages.length - 1)); }, [layout.pages.length]);

  const pageBlob = async (i: number, type: 'image/png' | 'image/jpeg') => {
    await ensureFont(font);
    const cv = document.createElement('canvas');
    drawPage(cv, layout.pages[i] ?? [''], { font, fontPx, ink: color, paper });
    return blobOf(cv, type);
  };
  const save = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const download = async (kind: 'png' | 'jpg') => {
    if (empty) { setMessage('There is nothing to save yet. Type some text first.'); return; }
    const blob = await pageBlob(current, kind === 'png' ? 'image/png' : 'image/jpeg');
    if (!blob) { setMessage('This browser could not save the picture.'); return; }
    save(blob, `handwriting-page-${current + 1}.${kind}`);
    setMessage(`Saved handwriting-page-${current + 1}.${kind}.`);
  };
  const downloadAll = async () => {
    if (empty) { setMessage('There is nothing to save yet. Type some text first.'); return; }
    const files: Array<{ name: string; data: Uint8Array }> = [];
    for (let i = 0; i < layout.pages.length; i++) {
      const blob = await pageBlob(i, 'image/png');
      if (!blob) { setMessage('This browser could not save the pictures.'); return; }
      files.push({ name: `handwriting-page-${String(i + 1).padStart(2, '0')}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    save(new Blob([makeZip(files) as BlobPart], { type: 'application/zip' }), 'handwriting-pages.zip');
    setMessage(`Saved ${files.length} pages in handwriting-pages.zip.`);
  };
  const toResizer = async () => {
    if (empty) { setMessage('There is nothing to resize yet. Type some text first.'); return; }
    const blob = await pageBlob(current, 'image/jpeg');
    if (!blob) { setMessage('This browser could not prepare the picture.'); return; }
    setResize((r) => ({ file: new File([blob], `handwriting-page-${current + 1}.jpg`, { type: 'image/jpeg' }), key: (r?.key ?? 0) + 1 }));
    setMessage(`Page ${current + 1} is loaded in the resizer below.`);
  };
  useEffect(() => { if (resize) resizeRef.current?.scrollIntoView({ block: 'start' }); }, [resize?.key]);

  const choice = <T extends string>(legend: string, id: string, items: ReadonlyArray<{ id: T; label: string }>, value: T, set: (v: T) => void) => (
    <fieldset className={fieldsetCls}>
      <legend className={legendCls}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => <button key={it.id} type="button" data-testid={`${id}-${it.id}`} aria-pressed={value === it.id} className={value === it.id ? btnToggleOn : btnToggleOff} onClick={() => { setPage(0); set(it.id); }}>{it.label}</button>)}
      </div>
    </fieldset>
  );

  return (
    <div className="space-y-8">
      <section data-testid="tool" aria-label="Text to handwriting" className={`${panelCls} lg:p-8`}>
        <h2 className="sr-only">Turn text into handwriting</h2>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="space-y-5">
            <div>
              <label htmlFor="hw-text" className={labelCls}>Your text</label>
              <textarea id="hw-text" data-testid="hw-text" rows={8} maxLength={MAX_CHARS} className={`${inputCls} resize-y font-sans`} value={text} onInput={(e) => { setPage(0); setText((e.target as HTMLTextAreaElement).value); }} />
              <p className={hintCls} data-testid="hw-count">{clean.length.toLocaleString('en-US')} of {MAX_CHARS.toLocaleString('en-US')} characters. The fonts cover Latin letters (A to Z with accents).</p>
            </div>
            {choice('Handwriting', 'font', FONTS, font, setFont)}
            {choice('Ink', 'ink', INKS, ink, setInk)}
            {choice('Paper', 'paper', PAPERS, paper, setPaper)}
            {choice('Writing size', 'size', SIZES, size, setSize)}
          </div>

          <div className="min-w-0 space-y-4">
            <div className="flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
              <canvas ref={canvasRef} data-testid="hw-preview" data-pages={layout.pages.length} data-page={current + 1} data-lines={(layout.pages[current] ?? []).length} data-font={font} role="img" aria-label={`Page ${current + 1} of ${layout.pages.length} of your text in handwriting`} className="block h-auto max-h-[75vh] w-auto max-w-full border border-slate-300 bg-white" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" data-testid="hw-prev" className={btnSecondary} disabled={current === 0} onClick={() => setPage(current - 1)}>Previous page</button>
              <p className="text-base font-medium text-slate-900" data-testid="hw-page-label" aria-live="polite">Page {current + 1} of {layout.pages.length}</p>
              <button type="button" data-testid="hw-next" className={btnSecondary} disabled={current >= layout.pages.length - 1} onClick={() => setPage(current + 1)}>Next page</button>
            </div>
            {layout.truncated && <p role="status" data-testid="hw-truncated" className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-amber-950">Only the first {MAX_PAGES} pages are made. Shorten the text or choose a smaller writing size to fit the rest.</p>}
            {missing.length > 0 && <p role="status" data-testid="hw-missing" className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-amber-950">These characters are not in the handwriting fonts and are drawn in a plain fallback font: {missing.slice(0, 12).join(' ')}{missing.length > 12 ? ' …' : ''}</p>}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button type="button" data-testid="save-png" className={btnPrimary} disabled={empty} onClick={() => void download('png')}>Download page (PNG)</button>
              <button type="button" data-testid="save-jpg" className={btnSecondary} disabled={empty} onClick={() => void download('jpg')}>Download page (JPG)</button>
              {layout.pages.length > 1 && <button type="button" data-testid="save-zip" className={btnSecondary} disabled={empty} onClick={() => void downloadAll()}>Download all pages (ZIP)</button>}
              <button type="button" data-testid="to-resizer" className={btnSecondary} disabled={empty} onClick={() => void toResizer()}>Resize this page to KB</button>
            </div>
            <p role="status" aria-live="polite" data-testid="hw-status" className={message.startsWith('There is') || message.startsWith('This browser') ? errCls : hintCls}>{message}</p>
          </div>
        </div>
        <p className="mt-5 text-sm text-slate-700">SizeTune writes your text in your browser. The site's code does not upload it, and SizeTune keeps no copy.</p>
      </section>

      {resize && (
        <div ref={resizeRef} data-testid="resize-area" className="space-y-4" aria-labelledby="resize-h">
          <h2 id="resize-h" className="text-2xl font-semibold text-slate-950">Resize this page to a size in KB</h2>
          <p className={hintCls}>Your page is already loaded. Choose a limit and download the result.</p>
          <ImageTool key={resize.key} initialFile={resize.file} defaultFormat="jpeg" defaultNoLimit={false} label="Resize the handwriting page" />
        </div>
      )}
    </div>
  );
}
