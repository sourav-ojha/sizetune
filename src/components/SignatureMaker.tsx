import { useEffect, useRef, useState } from 'preact/hooks';
import '@fontsource/caveat/latin-400.css';
import '@fontsource/dancing-script/latin-400.css';
import '@fontsource/homemade-apple/latin-400.css';
import SignatureTool from './SignatureTool';
import { ensureFont, renderDrawn, renderTyped, repaint, toBlob } from './signature/render';
import { btnPrimary, btnSecondary, btnToggleOff, btnToggleOn, errCls, fieldsetCls, hintCls, inputCls, labelCls, legendCls, panelCls } from './tool/ui';
import { DRAW_H, DRAW_W, FONTS, INKS, undoStroke, type FontId, type InkId, type Pt, type Stroke } from '../lib/signature-maker';

type Mode = 'draw' | 'type';
const MAX_TYPED = 40;

/** Draw or type a signature, download it as a transparent PNG or a white JPG, or hand it to the KB resizer on this page. Nothing leaves the browser. */
export default function SignatureMaker() {
  const [mode, setMode] = useState<Mode>('draw');
  const [ink, setInk] = useState<InkId>('black');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [text, setText] = useState('');
  const [font, setFont] = useState<FontId>('caveat');
  const [fontReady, setFontReady] = useState(0); // bumps when a font finishes loading so the typed preview repaints
  const [message, setMessage] = useState('');
  const [resize, setResize] = useState<{ file: File; key: number } | null>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const live = useRef<Stroke | null>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const color = INKS.find((i) => i.id === ink)!.value;
  const typed = text.slice(0, MAX_TYPED);

  // Repaint the drawing area whenever the strokes or the ink change.
  useEffect(() => { if (drawRef.current) repaint(drawRef.current, strokes, color); }, [strokes, color, mode]);

  // Typed preview: wait for the font, then draw. A stale font load must not paint over a newer choice.
  useEffect(() => {
    let alive = true;
    void ensureFont(font).then(() => { if (alive) setFontReady((n) => n + 1); });
    return () => { alive = false; };
  }, [font]);
  useEffect(() => {
    const cv = previewRef.current;
    if (!cv) return;
    const out = renderTyped(typed, font, color, null, 90);
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!out) { cv.width = 600; cv.height = 140; return; }
    cv.width = out.width; cv.height = out.height;
    cv.getContext('2d')?.drawImage(out, 0, 0);
  }, [typed, font, color, fontReady, mode]);

  const point = (e: PointerEvent): Pt => {
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    return { x: ((e.clientX - r.left) * DRAW_W) / r.width, y: ((e.clientY - r.top) * DRAW_H) / r.height };
  };
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    live.current = [point(e)];
    if (drawRef.current) repaint(drawRef.current, [...strokes, live.current], color);
    setMessage('');
  };
  const move = (e: PointerEvent) => {
    if (!live.current) return;
    live.current.push(point(e));
    if (drawRef.current) repaint(drawRef.current, [...strokes, live.current], color);
  };
  const up = () => {
    const s = live.current;
    live.current = null;
    if (s) setStrokes((all) => [...all, s]);
  };

  const hasContent = mode === 'draw' ? strokes.length > 0 : typed.trim() !== '';
  const build = async (background: string | null) => {
    if (mode === 'type') { await ensureFont(font); return renderTyped(typed, font, color, background); }
    return renderDrawn(strokes, color, background);
  };
  const download = async (kind: 'png' | 'jpg') => {
    const cv = await build(kind === 'jpg' ? '#ffffff' : null);
    const blob = cv && (await toBlob(cv, kind === 'jpg' ? 'image/jpeg' : 'image/png'));
    if (!blob) { setMessage('There is nothing to save yet. Draw or type a signature first.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `signature.${kind}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setMessage(`Saved signature.${kind}.`);
  };
  const toResizer = async () => {
    const cv = await build('#ffffff');
    const blob = cv && (await toBlob(cv, 'image/jpeg'));
    if (!blob) { setMessage('There is nothing to resize yet. Draw or type a signature first.'); return; }
    setResize((r) => ({ file: new File([blob], 'signature.jpg', { type: 'image/jpeg' }), key: (r?.key ?? 0) + 1 }));
    setMessage('Your signature is loaded in the resizer below.');
  };
  useEffect(() => { if (resize) resizeRef.current?.scrollIntoView({ block: 'start' }); }, [resize?.key]);

  return (
    <div className="space-y-8">
      <section data-testid="tool" aria-label="Signature maker" className={`${panelCls} space-y-6 lg:p-8`}>
        <fieldset className={fieldsetCls}>
          <legend className={legendCls}>How to make it</legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" data-testid="mode-draw" aria-pressed={mode === 'draw'} className={mode === 'draw' ? btnToggleOn : btnToggleOff} onClick={() => setMode('draw')}>Draw</button>
            <button type="button" data-testid="mode-type" aria-pressed={mode === 'type'} className={mode === 'type' ? btnToggleOn : btnToggleOff} onClick={() => setMode('type')}>Type</button>
          </div>
        </fieldset>

        {mode === 'draw' ? (
          <div className="space-y-3">
            <canvas
              ref={drawRef} data-testid="draw-canvas" data-strokes={strokes.length} width={DRAW_W} height={DRAW_H} role="img"
              aria-label="Signature drawing area. Draw with a mouse, pen or finger. If you cannot draw, choose Type instead."
              className="aspect-[3/1] w-full touch-none cursor-crosshair rounded-2xl border-2 border-dashed border-slate-400 bg-white"
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            />
            <div className="flex flex-wrap gap-3">
              <button type="button" data-testid="undo" className={btnSecondary} disabled={strokes.length === 0} onClick={() => setStrokes(undoStroke)}>Undo last stroke</button>
              <button type="button" data-testid="clear" className={btnSecondary} disabled={strokes.length === 0} onClick={() => setStrokes([])}>Clear</button>
            </div>
            <p className={hintCls}>Sign inside the box. The saved image is cropped to your ink.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="sig-text" className={labelCls}>Your name</label>
              <input id="sig-text" data-testid="sig-text" type="text" maxLength={MAX_TYPED} autoComplete="off" className={inputCls} value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} />
              <p className={hintCls}>Up to {MAX_TYPED} characters. The handwriting fonts cover Latin letters (A to Z with accents).</p>
            </div>
            <fieldset className={fieldsetCls}>
              <legend className={legendCls}>Handwriting style</legend>
              <div className="flex flex-wrap gap-2">
                {FONTS.map((f) => (
                  <button key={f.id} type="button" data-testid={`font-${f.id}`} aria-pressed={font === f.id} className={font === f.id ? btnToggleOn : btnToggleOff} onClick={() => setFont(f.id)}>{f.label}</button>
                ))}
              </div>
            </fieldset>
            <div className="flex min-h-40 items-center justify-center overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4">
              <canvas ref={previewRef} data-testid="type-preview" role="img" aria-label={typed.trim() ? `Preview of the signature ${typed}` : 'Signature preview. Type your name to see it.'} className="max-h-40 max-w-full" />
            </div>
          </div>
        )}

        <fieldset className={fieldsetCls}>
          <legend className={legendCls}>Ink</legend>
          <div className="flex flex-wrap gap-2">
            {INKS.map((i) => (
              <button key={i.id} type="button" data-testid={`ink-${i.id}`} aria-pressed={ink === i.id} className={ink === i.id ? btnToggleOn : btnToggleOff} onClick={() => setInk(i.id)}>{i.label}</button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-3">
          <button type="button" data-testid="save-png" className={btnPrimary} disabled={!hasContent} onClick={() => void download('png')}>Download PNG (transparent)</button>
          <button type="button" data-testid="save-jpg" className={btnSecondary} disabled={!hasContent} onClick={() => void download('jpg')}>Download JPG (white)</button>
          <button type="button" data-testid="to-resizer" className={btnSecondary} disabled={!hasContent} onClick={() => void toResizer()}>Resize to KB</button>
        </div>
        <p role="status" aria-live="polite" className={message.startsWith('There is') ? errCls : hintCls} data-testid="maker-status">{message}</p>
      </section>

      {resize && (
        <div ref={resizeRef} data-testid="resize-area" className="space-y-4" aria-labelledby="resize-h">
          <h2 id="resize-h" className="text-2xl font-semibold text-slate-950">Resize to a size in KB</h2>
          <p className={hintCls}>Your signature is already loaded. Choose a limit and download the result.</p>
          <SignatureTool key={resize.key} initialFile={resize.file} />
        </div>
      )}
    </div>
  );
}
