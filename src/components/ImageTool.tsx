import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { OutputFormat } from '../lib/engine/types';
import { AdvancedBlock, DimensionFields, MinimumField, StrategyField } from './tool/Advanced';
import Compare from './tool/Compare';
import Dropzone from './tool/Dropzone';
import FormatPicker from './tool/FormatPicker';
import ProgressBar from './tool/Progress';
import ResultPanel from './tool/ResultPanel';
import SizePicker from './tool/SizePicker';
import { getLimits } from './tool/engine';
import { formatCap, formatDims, formatSize } from './tool/format';
import { ensureVisible, useForm, useScrollAnchor, useWebpSupport } from './tool/hooks';
import { buildOptions, type FormState } from './tool/options';
import { statusText, useIntake } from './tool/useIntake';
import { useToolSession } from './tool/useSession';
import { btnPrimary, btnSecondary, panelCls } from './tool/ui';

export interface ImageToolProps {
  /** Maximum size (KB) preselected when the tool opens. */
  defaultMaxKb?: number;
}

const ADVANCED_FIELDS = ['minKb', 'width', 'height', 'maxWidth', 'maxHeight'] as const;

export default function ImageTool({ defaultMaxKb = 50 }: ImageToolProps) {
  const { session, state } = useToolSession();
  const [form, setForm] = useForm({ maxKb: String(defaultMaxKb) });
  const webp = useWebpSupport();
  const anchor = useScrollAnchor();
  const { inputRef, onPick } = useIntake(session);
  const runRef = useRef<HTMLButtonElement>(null);
  const cap = getLimits().maxFileBytes;

  const [userFormat, setUserFormat] = useState<OutputFormat | null>(null);
  // An opaque PNG with a size limit is preselected as JPEG (visible note, one click to undo); transparent PNGs keep Auto.
  const autoJpeg = userFormat === null && state.sniff?.kind === 'png' && state.alpha === false && !form.noLimit;
  const format: OutputFormat = userFormat ?? (autoJpeg ? 'jpeg' : 'auto');
  const effective: FormState = { ...form, format };
  const built = buildOptions(effective);
  const errors = built.ok ? {} : built.errors;
  const hasAlpha = state.result?.data.source.hasAlpha ?? state.alpha;
  const busy = state.phase === 'processing';
  const advancedError = ADVANCED_FIELDS.some((k) => errors[k]);

  /** Any settings change invalidates the shown result/error (it no longer describes the current settings). */
  const update = useCallback((patch: Partial<FormState>) => {
    const { format: f, ...rest } = patch;
    if (f) setUserFormat(f);
    setForm(rest);
    anchor.hold();
    session.clearResult();
    session.dismissError();
  }, [session, setForm, anchor.hold]);

  const run = (override?: Partial<FormState>) => {
    const b = buildOptions({ ...effective, ...override });
    if (b.ok) { anchor.hold(); void session.run(b.options); }
  };

  // Escape cancels a run from anywhere. Attached once at mount and checked against the live session state at key time,
  // so it works from the very first moment of a run (no wait for a render or an effect).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && session.getSnapshot().phase === 'processing') { anchor.hold(); session.cancel(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [session, anchor.hold]);

  const wasProcessing = useRef(false);
  useEffect(() => {
    // after Cancel the Cancel button disappears: keep keyboard focus on a live control
    if (wasProcessing.current && state.phase === 'ready') {
      // Cancel just unmounted. After a failed run focus the remedy ("Try again" / "Use JPEG instead") if there is one, else Resize.
      const remedy = state.error ? anchor.ref.current?.querySelector<HTMLElement>('[data-testid=retry],[data-testid=use-jpeg]') : null;
      (remedy ?? runRef.current)?.focus({ preventScroll: true });
    }
    wasProcessing.current = state.phase === 'processing';
  }, [state.phase, state.error]);

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
    if (hasAlpha === true) session.clearResult(); // the colour choice must be seen before anything is flattened
    else run({ format: 'jpeg' });
  };

  return (
    <section ref={anchor.ref} data-testid="tool" aria-label="Image resizer" className={`space-y-5 ${panelCls}`}>
      <h2 className="sr-only">Resize your image</h2>
      <div role="status" aria-live="polite" data-testid="status" className="sr-only">{statusText(state)}</div>

      <Dropzone inputRef={inputRef} hasFile={!!state.file} capText={cap ? `Up to ${formatCap(cap)}.` : null} onPick={onPick} />

      {state.notice && <p className="text-sm text-slate-800" data-testid="notice">{state.notice}</p>}
      {state.error && !state.file && (
        <div role="alert" data-testid="error" className="rounded-lg border border-red-700 bg-red-50 p-3 text-red-950">{state.error.message}</div>
      )}

      {state.file && (
        <div className="flex items-center gap-4" data-testid="file-card">
          {state.previewUrl ? (
            <img
              data-testid="preview"
              src={state.previewUrl}
              alt="Preview of the selected image"
              className="max-h-32 max-w-[40%] rounded-lg border border-slate-300 object-contain"
            />
          ) : (
            <p data-testid="no-preview" className="max-w-[40%] rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs text-slate-700">{state.previewNote === 'failed' ? 'The preview could not be created; the file may be incomplete or damaged. You can still try Resize.' : 'No preview for a very large image; it is still processed normally.'}</p>
          )}
          <p className="min-w-0 text-sm text-slate-800" data-testid="file-info">
            <span className="block truncate font-medium">{state.file.name}</span>
            {state.natural ? `${formatDims(state.natural.width, state.natural.height)}, ` : ''}{formatSize(state.file.size)}
          </p>
        </div>
      )}

      <SizePicker form={effective} errors={errors} update={update} />
      <FormatPicker form={effective} errors={errors} update={update} formats={['auto', 'jpeg', 'png', 'webp']} webp={webp} hasAlpha={hasAlpha} defaultNote={autoJpeg ? 'Your PNG will be saved as a JPEG: smaller files keep more detail. Choose PNG to keep the format.' : undefined} />

      <AdvancedBlock forceOpen={advancedError}>
        <MinimumField form={effective} errors={errors} update={update} />
        <DimensionFields form={effective} errors={errors} update={update} basis={state.natural} showMax />
        <StrategyField form={effective} update={update} />
      </AdvancedBlock>

      {state.phase === 'processing' ? (
        <ProgressBar progress={state.progress} onCancel={() => { anchor.hold(); session.cancel(); }} />
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button ref={runRef} type="button" data-testid="run" className={btnPrimary} disabled={!state.file || busy || !built.ok} onClick={() => run()}>
            Resize image
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
          originalName={state.file?.name ?? 'your image'}
          preview={state.previewUrl
            ? <Compare beforeUrl={state.previewUrl} afterUrl={state.result.url} />
            : <img src={state.result.url} alt="Result image" data-testid="result-image" className="mx-auto block max-h-[70vh] max-w-full rounded-lg border border-slate-300" />}
          onReset={reset}
          onTryJpeg={() => { setUserFormat('jpeg'); session.clearResult(); }}
          original={state.originalUrl ? { url: state.originalUrl, name: state.file?.name ?? 'original' } : null}
          gps={state.gps}
        />
      )}

      <div className="text-sm text-slate-700">
        <p>
          SizeTune processes your image in your browser. The site's code does not upload it, and SizeTune keeps no copy of it; your browser releases it when you close the tab. By using the tool you agree to the terms of use.
        </p>
        <p className="mt-1 flex flex-wrap gap-x-5">
          {[['/terms/', 'Terms of use'], ['/privacy/', 'Privacy policy']].map(([href, label]) => (
            <a key={href} href={href} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center font-medium text-teal-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
              {label}<span className="sr-only"> (opens in a new tab)</span>
            </a>
          ))}
        </p>
      </div>
    </section>
  );
}
