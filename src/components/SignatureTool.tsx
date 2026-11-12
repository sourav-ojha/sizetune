import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { OutputFormat } from '../lib/engine/types';
import { AdvancedBlock, DimensionFields, MinimumField, StrategyField } from './tool/Advanced';
import CropEditor from './tool/CropEditor';
import Dropzone from './tool/Dropzone';
import FormatPicker from './tool/FormatPicker';
import ProgressBar from './tool/Progress';
import ResultPanel from './tool/ResultPanel';
import SizePicker from './tool/SizePicker';
import { aspectOf, fullRect, isFullRect, padRect, setRectField, type Rect, type RectField } from './tool/crop';
import { getLimits } from './tool/engine';
import { formatCap, formatDims, formatSize } from './tool/format';
import { ensureVisible, useForm, useScrollAnchor, useWebpSupport } from './tool/hooks';
import { buildOptions, parseNumber, type FormState } from './tool/options';
import { findInkBounds, scaleRect } from './tool/trim';
import { statusText, useIntake } from './tool/useIntake';
import { useToolSession } from './tool/useSession';
import { btnPrimary, btnSecondary, hintCls, inputCls, labelCls, legendCls, panelCls } from './tool/ui';

export interface SignatureToolProps {
  defaultMaxKb?: number;
  /** Optional preset output size. Nothing is prefilled unless the page asks for it. */
  defaultWidthPx?: number;
  defaultHeightPx?: number;
}

const ADVANCED_FIELDS = ['minKb'] as const;
const CROP_FIELDS: Array<[RectField, string]> = [['x', 'Left (px)'], ['y', 'Top (px)'], ['width', 'Crop width (px)'], ['height', 'Crop height (px)']];

const SIGNATURE_HINTS = {
  below_min: 'A small, simple signature holds very little data, and SizeTune will not pad a file with filler to reach a minimum. Crop less tightly, scan at a larger size, choose a larger output width and height, or lower the minimum.',
} as const;

export default function SignatureTool({ defaultMaxKb = 20, defaultWidthPx, defaultHeightPx }: SignatureToolProps) {
  const { session, state } = useToolSession();
  const [form, setForm] = useForm({
    maxKb: String(defaultMaxKb),
    format: 'jpeg',
    width: defaultWidthPx ? String(defaultWidthPx) : '',
    height: defaultHeightPx ? String(defaultHeightPx) : '',
  });
  const [userFormat, setUserFormat] = useState<OutputFormat | null>(null);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [lockCrop, setLockCrop] = useState(false);
  const [draft, setDraft] = useState<Partial<Record<RectField, string>>>({});
  const [trimMsg, setTrimMsg] = useState('');
  const webp = useWebpSupport();
  const anchor = useScrollAnchor();
  const { inputRef, onPick } = useIntake(session);
  const cropImg = useRef<HTMLImageElement>(null);
  const runRef = useRef<HTMLButtonElement>(null);
  const cap = getLimits().maxFileBytes;

  // New picture (natural is reset to null on every selection): the crop starts as the whole picture.
  useEffect(() => { setCrop(state.natural ? fullRect(state.natural) : null); setDraft({}); setTrimMsg(''); }, [state.natural]);

  const hasAlpha = state.result?.data.source.hasAlpha ?? state.alpha;
  const format: OutputFormat = userFormat ?? (hasAlpha === true ? 'png' : 'jpeg'); // JPEG unless the picture has transparency
  const effective: FormState = { ...form, format };
  const sendCrop = crop && state.natural && !isFullRect(crop, state.natural) ? crop : undefined;
  const built = buildOptions(effective, { crop: sendCrop });
  const errors = built.ok ? {} : built.errors;
  const busy = state.phase === 'processing';
  const basis = crop ? { width: crop.width, height: crop.height } : null;

  const update = useCallback((patch: Partial<FormState>) => {
    const { format: f, ...rest } = patch;
    if (f) setUserFormat(f);
    setForm(rest);
    anchor.hold();
    session.clearResult();
    session.dismissError();
  }, [session, setForm, anchor.hold]);

  const changeCrop = useCallback((r: Rect) => { setCrop(r); session.clearResult(); session.dismissError(); }, [session]);

  const wasProcessing = useRef(false);
  useEffect(() => {
    if (wasProcessing.current && state.phase === 'ready' && !state.error) runRef.current?.focus({ preventScroll: true });
    wasProcessing.current = state.phase === 'processing';
  }, [state.phase, state.error]);

  const run = (overrideFormat?: OutputFormat) => {
    const b = buildOptions(overrideFormat ? { ...effective, format: overrideFormat } : effective, { crop: sendCrop });
    if (b.ok) { anchor.hold(); void session.run(b.options); }
  };
  const reset = () => {
    anchor.hold();
    session.reset();
    inputRef.current?.focus({ preventScroll: true });
    // the tool just got much shorter: make sure the user is looking at it, not at whatever is now below it
    requestAnimationFrame(() => requestAnimationFrame(() => ensureVisible(inputRef.current?.closest('[data-testid=dropzone]'), 'center')));
  };
  const useJpeg = () => {
    setUserFormat('jpeg');
    session.dismissError();
    if (hasAlpha === true) session.clearResult();
    else run('jpeg');
  };

  const editField = (f: RectField, raw: string) => {
    if (!crop || !state.natural) return;
    setDraft((d) => ({ ...d, [f]: raw }));
    const pn = parseNumber(raw, 'px');
    if (pn.kind === 'ok' && Number.isInteger(pn.value)) {
      const next = setRectField(crop, f, pn.value, state.natural, lockCrop && (f === 'width' || f === 'height'));
      changeCrop(next);
      if (next[f] !== pn.value) setDraft((d) => ({ ...d, [f]: String(next[f]) })); // show the value that was actually applied
    }
  };

  const autoTrim = () => {
    const img = cropImg.current;
    const nat = state.natural;
    if (!img || !nat) return;
    try {
      const k = Math.min(1, 800 / Math.max(nat.width, nat.height));
      const cw = Math.max(1, Math.round(nat.width * k)), ch = Math.max(1, Math.round(nat.height * k));
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('no canvas');
      ctx.drawImage(img, 0, 0, cw, ch);
      const ink = findInkBounds(ctx.getImageData(0, 0, cw, ch).data, cw, ch);
      if (!ink) { setTrimMsg('No signature was found to trim. Drag the crop box by hand instead.'); return; }
      changeCrop(padRect(scaleRect(ink, nat.width / cw, nat.height / ch, nat), 0.03, nat));
      setDraft({});
      setTrimMsg('Cropped to the ink with a small margin. Adjust it if needed.');
    } catch {
      setTrimMsg('Automatic trimming is not available here. Drag the crop box by hand instead.');
    }
  };

  return (
    <section ref={anchor.ref} data-testid="tool" onKeyDown={(e) => { if (e.key === 'Escape' && state.phase === 'processing') { anchor.hold(); session.cancel(); } }} aria-label="Signature resizer" className={`space-y-5 ${panelCls}`}>
      <h2 className="sr-only">Resize your signature</h2>
      <div role="status" aria-live="polite" data-testid="status" className="sr-only">{statusText(state)}</div>

      <div data-testid="signature-guidance" className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900">
        <p className="font-semibold">For a clean signature</p>
        <ul className="ml-5 mt-1 list-disc space-y-0.5">
          <li>Sign with dark ink (black or dark blue) on plain white paper.</li>
          <li>Scan it, or photograph it straight on in even light, with no shadows.</li>
          <li>Crop tight around the signature and keep a small margin.</li>
          <li>Leave the output size blank unless your form states a pixel size.</li>
        </ul>
      </div>

      <Dropzone inputRef={inputRef} hasFile={!!state.file} capText={cap ? `Up to ${formatCap(cap)}.` : null} onPick={onPick} />
      {state.notice && <p className="text-sm text-slate-800" data-testid="notice">{state.notice}</p>}
      {state.error && !state.file && (
        <div role="alert" data-testid="error" className="rounded-lg border border-red-700 bg-red-50 p-3 text-red-950">{state.error.message}</div>
      )}

      {state.file && (
        <fieldset className="min-w-0 space-y-3" data-testid="crop-section">
          <legend className={legendCls}>Crop the signature</legend>
          <p className="text-sm text-slate-800" data-testid="file-info">
            <span className="font-medium">{state.file.name}</span>{' '}
            {state.natural ? `${formatDims(state.natural.width, state.natural.height)}, ` : ''}{formatSize(state.file.size)}
          </p>
          {state.previewUrl ? (
            <CropEditor
              src={state.previewUrl}
              natural={state.natural}
              rect={crop}
              lockAspect={lockCrop}
              imgRef={cropImg}
              onChange={(r) => { changeCrop(r); setDraft({}); }}
            />
          ) : (
            <p data-testid="no-preview" className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800">This picture is too large to show here. Use the number fields to crop it.</p>
          )}
          <p className={hintCls}>Drag the box or its handles. With the keyboard: focus the box, then arrow keys move it, Alt plus arrow keys resize it, and Shift makes bigger steps. Or type exact numbers below.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CROP_FIELDS.map(([f, label]) => (
              <div key={f}>
                <label htmlFor={`crop-${f}`} className={labelCls}>{label}</label>
                <input
                  id={`crop-${f}`}
                  data-testid={`crop-${f}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className={`${inputCls} mt-1`}
                  value={draft[f] ?? (crop ? String(crop[f]) : '')}
                  disabled={!crop}
                  onChange={(e) => editField(f, e.currentTarget.value)}
                  onBlur={() => setDraft((d) => { const { [f]: _gone, ...rest } = d; return rest; })}
                />
              </div>
            ))}
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm text-slate-900">
            <input type="checkbox" data-testid="lock-crop" className="size-5 accent-indigo-800" checked={lockCrop} onChange={(e) => setLockCrop(e.currentTarget.checked)} />
            <span>Keep the crop box’s shape when resizing it</span>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" data-testid="auto-trim" className={btnSecondary} onClick={autoTrim} disabled={!crop || !state.previewUrl}>Auto-trim whitespace</button>
            <button type="button" data-testid="crop-reset" className={btnSecondary} onClick={() => { if (state.natural) { changeCrop(fullRect(state.natural)); setDraft({}); setTrimMsg(''); } }} disabled={!crop}>Use the whole picture</button>
          </div>
          <p role="status" className={hintCls} data-testid="trim-status">{trimMsg}</p>
          {crop && <p className="text-sm text-slate-800" data-testid="crop-summary">Crop: {formatDims(crop.width, crop.height)} (shape {aspectOf(crop).toFixed(2)} : 1)</p>}
        </fieldset>
      )}

      <DimensionFields form={effective} errors={errors} update={update} basis={basis} showMax={false} legend="Output size in pixels (optional)" />
      <SizePicker form={effective} errors={errors} update={update} showQuality />
      <FormatPicker
        form={effective}
        errors={errors}
        update={update}
        formats={['jpeg', 'png']}
        webp={webp}
        hasAlpha={hasAlpha}
        intro="JPEG is the usual choice for a signature upload. If your scan has transparent areas, PNG is preselected so they are not filled without asking."
      />
      <AdvancedBlock forceOpen={ADVANCED_FIELDS.some((k) => errors[k])}>
        <MinimumField form={effective} errors={errors} update={update} />
        <StrategyField form={effective} update={update} />
      </AdvancedBlock>

      {state.phase === 'processing' ? (
        <ProgressBar progress={state.progress} onCancel={() => { anchor.hold(); session.cancel(); }} />
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button ref={runRef} type="button" data-testid="run" className={btnPrimary} disabled={!state.file || busy || !built.ok} onClick={() => run()}>
            Resize signature
          </button>
          {state.file && <button type="button" data-testid="start-over" className={btnSecondary} onClick={reset}>Start over</button>}
        </div>
      )}
      {state.file && !built.ok && <p className="text-sm font-medium text-red-800" data-testid="form-invalid">Fix the highlighted settings to continue.</p>}

      {state.error && state.file && (
        <div role="alert" data-testid="error" className="space-y-2 rounded-lg border border-red-700 bg-red-50 p-3 text-red-950">
          <p>{state.error.message}</p>
          {state.error.action === 'retry' && <button type="button" data-testid="retry" className={btnSecondary} onClick={() => run()}>Try again</button>}
          {state.error.action === 'use-jpeg' && <button type="button" data-testid="use-jpeg" className={btnSecondary} onClick={useJpeg}>Use JPEG instead</button>}
        </div>
      )}

      {state.result && (
        <ResultPanel
          view={state.result}
          originalName={state.file?.name ?? 'your signature'}
          hints={SIGNATURE_HINTS}
          resetLabel="Process another signature"
          onReset={reset}
          onTryJpeg={() => { setUserFormat('jpeg'); session.clearResult(); }}
          original={state.originalUrl ? { url: state.originalUrl, name: state.file?.name ?? 'original' } : null}
          gps={state.gps}
          preview={(
            <div data-testid="signature-preview" className="rounded-lg border border-slate-300 bg-white p-3">
              <p className="mb-2 text-sm text-slate-800">Preview on white paper, at its real pixel size (reduced only if it does not fit the screen).</p>
              <img src={state.result.url} alt="Your resized signature on a white background" className="mx-auto block max-w-full bg-white" data-testid="signature-result-image" />
            </div>
          )}
        />
      )}

      <p className="text-sm text-slate-700">
        SizeTune processes your signature in your browser. It is not uploaded, and this page keeps nothing after you leave it.
      </p>
    </section>
  );
}
