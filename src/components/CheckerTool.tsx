import { useEffect, useId, useRef, useState } from 'preact/hooks';
import Dropzone from './tool/Dropzone';
import { EngineError, getLimits, inspectSize } from './tool/engine';
import { formatCap, formatDims, formatSize } from './tool/format';
import type { SniffKind } from './tool/sniff';
import { btnSecondary, hintCls, inputCls, labelCls, panelCls } from './tool/ui';
import { readDpi, type Dpi } from './check/dpi';
import { evaluate, parseRules, resizerHref, type RuleField, type RuleInput, type Status } from './check/rules';
import { realType } from './check/type';

const HEAD_BYTES = 256 * 1024;
const EXT_KIND: Record<string, SniffKind> = { jpg: 'jpeg', jpeg: 'jpeg', jpe: 'jpeg', jfif: 'jpeg', png: 'png', webp: 'webp' };
const KINDS: Array<[SniffKind, string]> = [['jpeg', 'JPEG'], ['png', 'PNG'], ['webp', 'WebP']];
const FIELDS: Array<[RuleField, string]> = [
  ['minKb', 'Minimum size (KB)'], ['maxKb', 'Maximum size (KB)'],
  ['minW', 'Minimum width (px)'], ['maxW', 'Maximum width (px)'],
  ['minH', 'Minimum height (px)'], ['maxH', 'Maximum height (px)'],
];
const STATUS_TEXT: Record<Status, string> = { pass: 'Pass', fail: 'Fail', borderline: 'Borderline' };
const STATUS_CLS: Record<Status, string> = { pass: 'border-emerald-700 bg-emerald-50 text-emerald-950', fail: 'border-red-700 bg-red-50 text-red-950', borderline: 'border-amber-600 bg-amber-50 text-amber-950' };

interface Info {
  name: string; bytes: number; label: string; kind: SniffKind | null;
  width: number | null; height: number | null; dims: string; dpi: Dpi | null; mismatch: string | null;
}

/** Reads a picture's real type, size and pixels from its bytes and checks them against rules the user types in. Nothing is uploaded. */
export default function CheckerTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const serial = useRef(0);
  const uid = useId();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<RuleInput>({ minKb: '', maxKb: '', minW: '', maxW: '', minH: '', maxH: '' });
  const [types, setTypes] = useState<SniffKind[]>([]);
  const cap = getLimits().maxFileBytes;

  const pick = async (file: File, extra = 0) => {
    const mine = ++serial.current;
    setError(null);
    try {
      const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
      const rt = realType(head);
      let width: number | null = null;
      let height: number | null = null;
      let dims = 'Not available for this file type.';
      if (rt.kind) {
        try { const s = await inspectSize(file); width = s.width; height = s.height; dims = formatDims(s.width, s.height); }
        catch (e) { dims = e instanceof EngineError ? e.message : 'The pixel size could not be read.'; }
      }
      const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
      const named = EXT_KIND[ext];
      const mismatch = ext && ((named && named !== rt.kind) || (!named && ['gif', 'bmp', 'pdf', 'heic', 'avif', 'tif', 'tiff', 'svg'].includes(ext) && ext !== rt.label.toLowerCase()))
        ? `The name ends in .${ext}, but the contents are ${rt.label === 'Unknown' ? 'not a format SizeTune recognises' : rt.label}. A portal that checks the contents may reject it.`
        : null;
      if (mine !== serial.current) return;
      setInfo({ name: file.name, bytes: file.size, label: rt.label, kind: rt.kind, width, height, dims, dpi: rt.kind ? readDpi(head) : null, mismatch: extra > 0 ? `${mismatch ?? ''} Only the first file was checked.`.trim() : mismatch });
    } catch {
      if (mine === serial.current) setError('This file could not be read.');
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

  const parsed = parseRules(raw, types);
  const errors = parsed.ok ? {} : parsed.errors;
  const results = info && info.kind && info.width !== null && info.height !== null && parsed.ok
    ? evaluate({ kind: info.kind, bytes: info.bytes, width: info.width, height: info.height }, parsed.rules)
    : [];
  const notPassing = results.some((r) => r.status !== 'pass');

  return (
    <section data-testid="tool" aria-label="Image checker" className={`${panelCls} lg:p-8`}>
      <h2 className="sr-only">Check your image</h2>
      <div role="status" aria-live="polite" data-testid="status" className="sr-only">{info ? 'Image checked.' : ''}</div>
      <div className="space-y-6">
        <Dropzone inputRef={inputRef} hasFile={!!info} capText={cap ? `Up to ${formatCap(cap)}.` : null} onPick={(f, extra) => { void pick(f, extra); }} />
        {error && <div role="alert" data-testid="error" className="rounded-lg border border-red-700 bg-red-50 p-3 text-red-950">{error}</div>}

        {info && (
          <div data-testid="check-result" className="space-y-6">
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
              <dt className="font-semibold text-slate-900">File</dt><dd className="min-w-0 break-words" data-testid="file-name">{info.name}</dd>
              <dt className="font-semibold text-slate-900">Real type</dt><dd data-testid="real-type">{info.label}</dd>
              <dt className="font-semibold text-slate-900">Size</dt><dd data-testid="file-size">{formatSize(info.bytes)}</dd>
              <dt className="font-semibold text-slate-900">Pixels</dt><dd data-testid="file-dims">{info.dims}</dd>
              <dt className="font-semibold text-slate-900">Resolution</dt>
              <dd data-testid="file-dpi">
                {info.dpi ? `${info.dpi.x} × ${info.dpi.y} dpi (from the file header)` : info.kind ? 'Not present in the file header (JPEG JFIF or PNG pHYs). EXIF resolution is not read.' : 'Not available for this file type.'}
              </dd>
            </dl>
            {info.mismatch && <p role="note" data-testid="type-mismatch" className="rounded-lg border border-amber-600 bg-amber-50 p-3 text-amber-950">{info.mismatch}</p>}
            {!info.kind && <p data-testid="unsupported-note" className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-slate-800">SizeTune can check JPEG, PNG and WebP pictures. This file is a different type, so it has no pixel size here and the rules below are not applied.</p>}
          </div>
        )}

        <div className="space-y-4">
          <fieldset className="space-y-3" data-testid="rules">
            <legend className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-600">Your form's rules (optional)</legend>
            <p className={hintCls}>Type the limits your form states. Leave a box empty to skip that rule.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map(([f, label]) => (
                <div key={f}>
                  <label htmlFor={`${uid}-${f}`} className={labelCls}>{label}</label>
                  <input id={`${uid}-${f}`} data-testid={`rule-${f}`} type="text" inputMode="numeric" autoComplete="off" className={inputCls} value={raw[f]} aria-invalid={errors[f] ? 'true' : undefined} aria-describedby={errors[f] ? `${uid}-${f}-err` : undefined} onInput={(e) => setRaw({ ...raw, [f]: e.currentTarget.value })} />
                  {errors[f] && <p id={`${uid}-${f}-err`} className="mt-1 text-sm font-medium text-red-800">{errors[f]}</p>}
                </div>
              ))}
            </div>
            <div role="group" aria-label="Accepted file types" className="flex flex-wrap gap-x-5 gap-y-1">
              <span className={labelCls}>Accepted types:</span>
              {KINDS.map(([k, label]) => (
                <label key={k} className="inline-flex min-h-11 items-center gap-2 text-base text-slate-900">
                  <input type="checkbox" data-testid={`rule-type-${k}`} className="size-5 accent-teal-700" checked={types.includes(k)} onChange={(e) => setTypes(e.currentTarget.checked ? [...types, k] : types.filter((t) => t !== k))} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {results.length > 0 && (
            <ul className="space-y-2" data-testid="rule-results" aria-label="Rule results">
              {results.map((r) => (
                <li key={r.id} data-testid={`rule-row-${r.id}`} data-status={r.status} className={`rounded-lg border p-3 ${STATUS_CLS[r.status]}`}>
                  <p><strong>{STATUS_TEXT[r.status]}:</strong> {r.label}. Yours is {r.measured}; the rule is {r.expected}.</p>
                  {r.note && <p className="mt-1 text-sm">{r.note}</p>}
                </li>
              ))}
            </ul>
          )}
          {results.length > 0 && !notPassing && <p data-testid="all-pass" className="font-medium text-emerald-900">Every rule you entered passes.</p>}
          {notPassing && parsed.ok && (
            <p><a data-testid="fix-link" className={btnSecondary} href={resizerHref(parsed.rules)}>Fix it in the resizer</a></p>
          )}
          {info && <p className="text-sm text-slate-700" data-testid="hidden-rules-note">A portal can have rules this page cannot see, such as a colour mode or a different way of counting kilobytes. Passing here does not guarantee that a portal accepts the file.</p>}
        </div>
      </div>
      <p className="mt-5 text-sm text-slate-700">SizeTune reads your file in your browser. The site's code does not upload it, and SizeTune keeps no copy of it.</p>
    </section>
  );
}
