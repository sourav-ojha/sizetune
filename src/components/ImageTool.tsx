import { useCallback, useEffect, useRef } from 'react';
import { AdvancedBlock, DimensionFields, MinimumField, StrategyField } from './tool/Advanced';
import Compare from './tool/Compare';
import Dropzone from './tool/Dropzone';
import FormatPicker from './tool/FormatPicker';
import ProgressBar from './tool/Progress';
import ResultPanel from './tool/ResultPanel';
import SizePicker from './tool/SizePicker';
import { getLimits } from './tool/engine';
import { formatCap, formatDims, formatSize } from './tool/format';
import { useForm, useWebpSupport } from './tool/hooks';
import { probeAlpha } from './tool/alpha';
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
  const { inputRef, onPick } = useIntake(session);
  const runRef = useRef<HTMLButtonElement>(null);
  const cap = getLimits().maxFileBytes;

  const built = buildOptions(form);
  const errors = built.ok ? {} : built.errors;
  const hasAlpha = state.result?.data.source.hasAlpha ?? state.alpha;
  const busy = state.phase === 'processing' || state.phase === 'checking';
  const advancedError = ADVANCED_FIELDS.some((k) => errors[k]);

  /** Any settings change invalidates the shown result/error (it no longer describes the current settings). */
  const update = useCallback((patch: Partial<FormState>) => {
    setForm(patch);
    session.clearResult();
    session.dismissError();
  }, [session, setForm]);

  const run = (override?: Partial<FormState>) => {
    const b = buildOptions(override ? { ...form, ...override } : form);
    if (b.ok) void session.run(b.options);
  };

  const wasProcessing = useRef(false);
  useEffect(() => {
    // after Cancel the Cancel button disappears: keep keyboard focus on a live control
    if (wasProcessing.current && state.phase === 'ready' && !state.error) runRef.current?.focus();
    wasProcessing.current = state.phase === 'processing';
  }, [state.phase, state.error]);

  const reset = () => { session.reset(); inputRef.current?.focus(); };
  const useJpeg = () => {
    setForm({ format: 'jpeg' });
    session.dismissError();
    if (hasAlpha === true) session.clearResult(); // the colour choice must be seen before anything is flattened
    else run({ format: 'jpeg' });
  };

  return (
    <section data-testid="tool" aria-label="Image resizer" className={`space-y-5 ${panelCls}`}>
      <h2 className="sr-only">Resize your image</h2>
      <div role="status" aria-live="polite" data-testid="status" className="sr-only">{statusText(state)}</div>

      <Dropzone inputRef={inputRef} hasFile={!!state.file} capText={cap ? `Up to ${formatCap(cap)}.` : null} onPick={onPick} />

      {state.notice && <p className="text-sm text-slate-800" data-testid="notice">{state.notice}</p>}
      {state.error && !state.file && (
        <div role="alert" data-testid="error" className="rounded-lg border border-red-700 bg-red-50 p-3 text-red-950">{state.error.message}</div>
      )}

      {state.file && state.previewUrl && (
        <div className="flex items-center gap-4" data-testid="file-card">
          <img
            data-testid="preview"
            src={state.previewUrl}
            alt="Preview of the selected image"
            className="max-h-32 max-w-[40%] rounded-lg border border-slate-300 object-contain"
            onLoad={(e) => {
              const img = e.currentTarget;
              session.setNatural(state.previewUrl!, img.naturalWidth, img.naturalHeight);
              if (state.sniff?.hasAlpha !== false) session.setAlpha(state.previewUrl!, probeAlpha(img));
            }}
          />
          <p className="min-w-0 text-sm text-slate-800" data-testid="file-info">
            <span className="block truncate font-medium">{state.file.name}</span>
            {state.natural ? `${formatDims(state.natural.width, state.natural.height)}, ` : ''}{formatSize(state.file.size)}
          </p>
        </div>
      )}

      <SizePicker form={form} errors={errors} update={update} />
      <FormatPicker form={form} errors={errors} update={update} formats={['auto', 'jpeg', 'png', 'webp']} webp={webp} hasAlpha={hasAlpha} />

      <AdvancedBlock forceOpen={advancedError}>
        <MinimumField form={form} errors={errors} update={update} />
        <DimensionFields form={form} errors={errors} update={update} basis={state.natural} showMax />
        <StrategyField form={form} update={update} />
      </AdvancedBlock>

      {state.phase === 'processing' ? (
        <ProgressBar progress={state.progress} onCancel={() => session.cancel()} />
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
          {state.error.action === 'use-jpeg' && <button type="button" data-testid="use-jpeg" className={btnSecondary} onClick={useJpeg}>Use JPEG instead</button>}
        </div>
      )}

      {state.result && state.previewUrl && (
        <ResultPanel
          view={state.result}
          originalName={state.file?.name ?? 'your image'}
          preview={<Compare beforeUrl={state.previewUrl} afterUrl={state.result.url} />}
          onReset={reset}
          onTryJpeg={() => { setForm({ format: 'jpeg' }); session.clearResult(); }}
        />
      )}

      <p className="text-sm text-slate-700">
        SizeTune processes your image in your browser. It is not uploaded, and this page keeps nothing after you leave it.
      </p>
    </section>
  );
}
