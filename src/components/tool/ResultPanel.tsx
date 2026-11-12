import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { ResultStatus } from '../../lib/engine/types';
import { describeWindow, formatChange, formatDims, formatInt, formatSize } from './format';
import type { ResultView } from './session';
import { btnPrimary, btnSecondary } from './ui';

const FORMAT_NAME: Record<string, string> = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP' };

const isSuccess = (s: ResultStatus): boolean => s === 'ok' || s === 'raised';

const HEADING: Record<ResultStatus, string> = {
  ok: 'Your image is ready',
  raised: 'Your image is ready (raised to meet your minimum)',
  below_min: 'Minimum size not reached',
  above_max: 'Still larger than your maximum',
  above_max_fixed: 'Still larger than your maximum (size was fixed)',
};

const HINT: Partial<Record<ResultStatus, string>> = {
  below_min: 'SizeTune does not pad files with filler to reach a minimum. This is the largest honest result for the settings you chose. You can lower the minimum, allow more pixels, or use a larger or more detailed image.',
  above_max: 'This is the smallest result SizeTune could make with the allowed settings. You can raise the maximum, allow smaller dimensions, or try “Dimensions first”.',
  above_max_fixed: 'You fixed the output size, so SizeTune did not shrink the pixels further. Raise the maximum, or clear the width and height so they can shrink.',
};

interface Props {
  view: ResultView;
  originalName: string;
  /** The user's original file (blob URL + name), offered for download when the result is larger than it. */
  original?: { url: string; name: string } | null;
  /** Extra preview content (before/after compare or signature-on-white). */
  preview: ComponentChildren;
  onReset: () => void;
  /** Offered for non-success results when the output is not JPEG. */
  onTryJpeg?: () => void;
  resetLabel?: string;
  /** Tool-specific replacements for the generic explanation of non-success statuses. */
  hints?: Partial<Record<ResultStatus, string>>;
  /** Focus the heading when this panel appears. */
  autoFocus?: boolean;
}

export default function ResultPanel({ view, originalName, original, preview, onReset, onTryJpeg, resetLabel = 'Process another image', autoFocus = true, hints }: Props) {
  const { data, options } = view;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (autoFocus) headingRef.current?.focus(); }, [autoFocus, view.url]);
  const ok = isSuccess(data.status);
  const plainOk = data.status === 'ok'; // the engine's one-liner for plain success just repeats the numbers below
  const { minBytes, maxBytes } = data.window;
  const over = maxBytes != null && data.bytes > maxBytes ? data.bytes - maxBytes : 0;
  const under = minBytes != null && data.bytes < minBytes ? minBytes - data.bytes : 0;
  const larger = data.bytes > data.source.bytes;
  const keepOriginal = larger && data.originalFits === true && !!original;
  const good = ok && !larger;
  const frame = good ? 'border-emerald-700 bg-emerald-50 text-emerald-950' : 'border-amber-700 bg-amber-50 text-amber-950';
  const fmt = FORMAT_NAME[data.mime] ?? data.mime;
  const basis = describeWindow(data.window, options.minKb, options.maxKb);
  const typedW = options.width, typedH = options.height;
  const notes = [...data.notes];
  if (typedW && typedH && (data.width !== typedW || data.height !== typedH)) {
    notes.push(`${options.lockAspect ? 'Aspect lock kept the shape' : 'The size was adjusted'}: the result is ${formatDims(data.width, data.height)}, not the ${formatDims(typedW, typedH)} you typed.`);
  }
  const dlLabel = !ok ? 'Download anyway' : larger ? 'Download the larger result anyway' : 'Download';
  const hint = hints?.[data.status] ?? HINT[data.status];
  // Lossless PNG can only reach a small size by shrinking the pixels; for a picture without transparency JPEG usually keeps more detail.
  const pngShrunk = ok && data.mime === 'image/png' && !data.source.hasAlpha && data.width < data.source.width;
  const offerJpeg = data.mime !== 'image/jpeg' && (!ok || pngShrunk);
  return (
    <section
      data-testid="result"
      data-status={data.status}
      aria-labelledby="sizetune-result-heading"
      className={`space-y-4 rounded-xl border-2 p-4 sm:p-5 ${frame}`}
    >
      <h3 id="sizetune-result-heading" ref={headingRef} tabIndex={-1} className="text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-800" data-testid="result-heading">
        <span aria-hidden="true">{good ? '✓ ' : '⚠ '}</span>{larger && ok ? 'The result is larger than your original' : HEADING[data.status]}
      </h3>

      {data.message && !plainOk && <p data-testid="result-message">{data.message}</p>}
      {hint && <p data-testid="result-hint">{hint}</p>}
      {larger && (
        <p data-testid="larger-note">
          Your original ({formatSize(data.source.bytes)}) is already smaller than this result ({formatSize(data.bytes)}). Re-saving can make a small or already-compressed file bigger.{' '}
          {data.originalFits === true
            ? 'Your original already fits your limit, so you can simply keep it. Note that the original still contains any camera or location details.'
            : data.originalFits === false ? 'Your original does not fit your limit either, so neither file meets it.' : ''}
        </p>
      )}

      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold">Original</dt>
          <dd data-testid="original-info">{formatDims(data.source.width, data.source.height)}, {formatSize(data.source.bytes)}</dd>
        </div>
        <div>
          <dt className="font-semibold">Result ({fmt}{data.quality != null ? `, quality ${data.quality}` : ''})</dt>
          <dd>
            {formatDims(data.width, data.height)},{' '}
            <strong data-testid="result-size" data-bytes={data.bytes} data-status={data.status}>{formatSize(data.bytes)}</strong>
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Change</dt>
          <dd data-testid="result-change">{formatChange(data.source.bytes, data.bytes)}</dd>
        </div>
        {basis && (
          <div>
            <dt className="font-semibold">Target</dt>
            <dd data-testid="result-target">
              {basis}.{' '}
              {over > 0 && <span data-testid="result-gap">Over by {formatInt(over)} bytes.</span>}
              {under > 0 && <span data-testid="result-gap">Under by {formatInt(under)} bytes.</span>}
              {over === 0 && under === 0 && <span data-testid="result-gap">Within the target.</span>}
            </dd>
          </div>
        )}
      </dl>

      {notes.length > 0 && (
        <div data-testid="result-notes">
          <h4 className="text-sm font-semibold">Please note</h4>
          <ul className="ml-5 list-disc text-sm">
            {notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}

      {preview}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {keepOriginal && original && (
          <a data-testid="keep-original" href={original.url} download={original.name} className={btnPrimary}>
            Keep your original instead<span className="sr-only">: {original.name}</span>
          </a>
        )}
        <a
          data-testid={ok ? 'download' : 'download-anyway'}
          href={view.url}
          download={view.filename}
          className={good ? btnPrimary : btnSecondary}
        >
          {dlLabel}<span className="sr-only">: {view.filename}</span>
        </a>
        {offerJpeg && onTryJpeg && (
          <button type="button" data-testid="try-jpeg" className={btnSecondary} onClick={onTryJpeg}>
            Try JPEG instead
          </button>
        )}
        <button type="button" data-testid="reset" className={btnSecondary} onClick={onReset}>{resetLabel}</button>
      </div>
      {pngShrunk && <p className="text-sm" data-testid="png-tip">PNG keeps every pixel exactly, so it had to shrink the picture to reach this size. For a photograph, JPEG usually keeps more detail at the same size.</p>}
      {!ok && <p className="text-sm" data-testid="not-success-note">This file does not meet your target. Download it only if you can still use it.</p>}
      <p className="text-xs" data-testid="kb-basis">KB figures on this page use 1 KB = 1,024 bytes; the exact byte counts are always shown.</p>
      <p className="text-sm">Saved as <span data-testid="download-name">{view.filename}</span> from “{originalName}”.</p>
    </section>
  );
}
