import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { useSyncExternalStore } from 'preact/compat';
import type { OutputFormat, ProcessOptions } from '../lib/engine/types';
import { AdvancedBlock, DimensionFields, MinimumField, StrategyField } from './tool/Advanced';
import BatchPanel from './tool/BatchPanel';
import { BatchRunner, buildBatchZip } from './tool/batch';
import Compare from './tool/Compare';
import Dropzone from './tool/Dropzone';
import FormatPicker from './tool/FormatPicker';
import ProgressBar from './tool/Progress';
import ResultPanel from './tool/ResultPanel';
import SizePicker from './tool/SizePicker';
import { getLimits, processImage } from './tool/engine';
import { formatCap, formatDims, formatSize } from './tool/format';
import { ensureVisible, useForm, useScrollAnchor, useWebpSupport } from './tool/hooks';
import { buildOptions, type FormState } from './tool/options';
import { targetFromSearch } from './tool/query';
import { statusText, useIntake } from './tool/useIntake';
import { useToolSession } from './tool/useSession';
import { btnPrimary, btnSecondary, panelCls } from './tool/ui';

export interface ImageToolProps {
  /** Maximum size (KB) preselected when the tool opens. */
  defaultMaxKb?: number;
  /** Output format preselected when the tool opens (the converter pages use 'jpeg'). The user can still change it. */
  defaultFormat?: OutputFormat;
  /** Open with "No limit" selected, so the file is converted at the default quality (85 out of 100). A KB limit can still be chosen. */
  defaultNoLimit?: boolean;
  /** Accessible name and hidden heading of the tool region (default: the resizer wording). */
  label?: string;
}

const ADVANCED_FIELDS = ['minKb', 'width', 'height', 'maxWidth', 'maxHeight'] as const;

export default function ImageTool({ defaultMaxKb = 50, defaultFormat, defaultNoLimit = false, label }: ImageToolProps) {
  const { session, state } = useToolSession();
  const [form, setForm] = useForm({ maxKb: String(defaultMaxKb), noLimit: defaultNoLimit });
  const webp = useWebpSupport();
  const anchor = useScrollAnchor();
  const { inputRef, onPick } = useIntake(session);
  // Several files at once go to a batch: one queue, one file at a time, one ZIP. A single file keeps using the single-file view above.
  const [batch] = useState(() => new BatchRunner({ process: processImage, createObjectURL: (b) => URL.createObjectURL(b), revokeObjectURL: (u) => URL.revokeObjectURL(u) }));
  const batchState = useSyncExternalStore(batch.subscribe, batch.getSnapshot, batch.getSnapshot);
  const [batchNote, setBatchNote] = useState<string | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const [ranKey, setRanKey] = useState<string | null>(null);
  const inBatch = batchState.rows.length > 0;
  useEffect(() => () => batch.dispose(), [batch]);
  const runRef = useRef<HTMLButtonElement>(null);
  const cap = getLimits().maxFileBytes;

  const [userFormat, setUserFormat] = useState<OutputFormat | null>(defaultFormat ?? null);
  // An opaque PNG with a size limit is preselected as JPEG (visible note, one click to undo); transparent PNGs keep Auto.
  const autoJpeg = userFormat === null && state.sniff?.kind === 'png' && state.alpha === false && !form.noLimit;
  const format: OutputFormat = userFormat ?? (autoJpeg ? 'jpeg' : 'auto');
  const effective: FormState = { ...form, format };
  const built = buildOptions(effective);
  const errors = built.ok ? {} : built.errors;
  const hasAlpha = state.result?.data.source.hasAlpha ?? state.alpha;
  const busy = state.phase === 'processing';
  const advancedError = ADVANCED_FIELDS.some((k) => errors[k]);
  // A size target handed over by another page (the file checker links to "/?max=50&min=20"). Applied after mount so the server HTML stays identical.
  const [linkedMin, setLinkedMin] = useState(false);
  useEffect(() => {
    const t = targetFromSearch(window.location.search);
    if (!t.maxKb && !t.minKb) return;
    setForm({ ...(t.maxKb ? { maxKb: t.maxKb, noLimit: false } : {}), ...(t.minKb ? { minKb: t.minKb } : {}) });
    if (t.minKb) setLinkedMin(true);
  }, []);

  // Auto-run: a run starts by itself when a file is accepted and whenever the settings change (typing is debounced).
  // `ranFor` remembers the file + settings a run was started for, so Cancel or a failed run never loops; the Resize button then offers a manual retry.
  const settingsKey = built.ok ? JSON.stringify(built.options) : null;
  const optsRef = useRef<ProcessOptions | null>(null);
  optsRef.current = built.ok ? built.options : null;
  const ranFor = useRef<string | null>(null);
  const lastSerial = useRef(-1);
  const [rev, setRev] = useState(0);
  const attempted = !!state.file && settingsKey !== null && ranFor.current === `${state.fileSerial}|${settingsKey}`;

  const startBatch = (opts: ProcessOptions | null, key: string | null) => { if (opts) { setRanKey(key); batch.start(opts); } };
  const onPickMany = (files: File[]) => {
    session.reset();
    const out = batch.add(files);
    setBatchNote(out.message);
    setZipError(null);
    if (out.added > 0) startBatch(optsRef.current, settingsKey);
  };
  const downloadZip = async () => {
    try {
      const zip = await buildBatchZip(batchState.rows);
      const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'sizetune-images.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setZipError(null);
    } catch {
      setZipError('The ZIP could not be made. Use the download link on each file instead.');
    }
  };

  /** Any settings change invalidates the shown result/error (it no longer describes the current settings). */
  const update = useCallback((patch: Partial<FormState>) => {
    const { format: f, ...rest } = patch;
    if (f) setUserFormat(f);
    setForm(rest);
    anchor.hold();
    session.clearResult(null); // the changed settings re-run by themselves, so no "run was cancelled" notice
    session.dismissError();
    ranFor.current = null;
    setRev((n) => n + 1);
  }, [session, setForm, anchor.hold]);

  const run = (override?: Partial<FormState>) => {
    const b = buildOptions({ ...effective, ...override });
    if (b.ok) { anchor.hold(); ranFor.current = `${state.fileSerial}|${JSON.stringify(b.options)}`; void session.run(b.options); }
  };

  useEffect(() => {
    if (!state.file || state.inspecting || settingsKey === null) return;
    const token = `${state.fileSerial}|${settingsKey}`;
    if (ranFor.current === token) return;
    const fresh = lastSerial.current !== state.fileSerial; // a new file starts at once; typed settings wait for a pause
    lastSerial.current = state.fileSerial;
    const t = setTimeout(() => { ranFor.current = token; anchor.hold(); if (optsRef.current) void session.run(optsRef.current, { keepNotice: true }); }, fresh ? 0 : 350);
    return () => clearTimeout(t);
  }, [state.file, state.fileSerial, state.inspecting, settingsKey, rev, session, anchor.hold]);

  // Escape cancels a run from anywhere. Attached once at mount and checked against the live session state at key time,
  // so it works from the very first moment of a run (no wait for a render or an effect).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && session.getSnapshot().phase === 'processing') { anchor.hold(); session.cancel(); }
      if (e.key === 'Escape' && !e.defaultPrevented && batch.getSnapshot().running) batch.cancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [session, batch, anchor.hold]);

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
    <section ref={anchor.ref} data-testid="tool" aria-label={label ?? 'Image resizer'} className={`${panelCls} lg:p-8`}>
      <h2 className="sr-only">{label ?? 'Resize your image'}</h2>
      <div role="status" aria-live="polite" data-testid="status" className="sr-only">{statusText(state, true)}</div>

      {/* One column on a phone, two from lg: picture and result on the left, settings on the right. DOM order is the reading and tab order. */}
      <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start lg:gap-x-8 lg:space-y-0">
        <div className="space-y-5">
          {inBatch && (
            <BatchPanel
              snapshot={batchState}
              note={batchNote}
              zipError={zipError}
              stale={!batchState.running && ranKey !== settingsKey}
              onCancel={() => batch.cancel()}
              onZip={() => { void downloadZip(); }}
              onRerun={() => startBatch(optsRef.current, settingsKey)}
              onStartOver={() => { batch.reset(); setBatchNote(null); setZipError(null); setRanKey(null); requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true })); }}
            />
          )}
          {!inBatch && <Dropzone inputRef={inputRef} hasFile={!!state.file} capText={cap ? `Up to ${formatCap(cap)}.` : null} supportedText="Supported: JPEG, PNG and WebP. Choose several files to process them together." onPick={onPick} onPickMany={onPickMany} />}

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
                <p data-testid="no-preview" className="max-w-[40%] rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs text-slate-700">{state.previewNote === 'failed' ? 'The preview could not be created; the file may be incomplete or damaged. SizeTune will still try to resize it.' : 'No preview for a very large image; it is still processed normally.'}</p>
              )}
              <p className="min-w-0 text-sm text-slate-800" data-testid="file-info">
                <span className="block truncate font-medium">{state.file.name}</span>
                {state.natural ? `${formatDims(state.natural.width, state.natural.height)}, ` : ''}{formatSize(state.file.size)}
                {!state.result && state.phase !== 'processing' && <span className="mt-1 block text-slate-700" data-testid="next-step">Resizing starts by itself. Change a setting and it resizes again.</span>}
              </p>
            </div>
          )}

          {state.phase === 'processing' && (
            <ProgressBar progress={state.progress} onCancel={() => { anchor.hold(); session.cancel(); }} />
          )}

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
        </div>

        <div className="space-y-5 max-lg:mt-5 lg:sticky lg:top-4">
          <SizePicker form={effective} errors={errors} update={update} sourceKind={state.sniff?.kind ?? null} />
          <FormatPicker form={effective} errors={errors} update={update} formats={['auto', 'jpeg', 'png', 'webp']} webp={webp} hasAlpha={hasAlpha} hasFile={!!state.file} defaultNote={autoJpeg ? 'Your PNG will be saved as a JPEG: smaller files keep more detail. Choose PNG to keep the format.' : undefined} />

          <AdvancedBlock forceOpen={advancedError || linkedMin}>
            <MinimumField form={effective} errors={errors} update={update} />
            <DimensionFields form={effective} errors={errors} update={update} basis={state.natural} showMax />
            <StrategyField form={effective} update={update} />
          </AdvancedBlock>

          {/* Resizing is automatic. These only appear when a run ended without a result (cancelled, failed) or there is a file to start over from. */}
          {state.file && state.phase !== 'processing' && (
            <div className="flex flex-col gap-2 sm:flex-row">
              {attempted && !state.result && built.ok && <button ref={runRef} type="button" data-testid="run" className={btnPrimary} disabled={busy || state.inspecting} onClick={() => run()}>Resize image</button>}
              <button type="button" data-testid="start-over" className={btnSecondary} onClick={reset}>Start over</button>
            </div>
          )}
          {state.file && !built.ok && <p className="text-sm font-medium text-red-800" data-testid="form-invalid">Fix the highlighted settings to continue.</p>}
        </div>
      </div>

      <div className="mt-5 text-sm text-slate-700">
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
