import type { BatchSnapshot, Row } from './batch';
import { BATCH_MAX_FILES } from './batch';
import { formatDims, formatSize } from './format';
import { btnPrimary, btnSecondary } from './ui';

interface Props {
  snapshot: BatchSnapshot;
  note: string | null;
  zipError: string | null;
  /** The settings changed after the batch finished, so the results no longer describe them. */
  stale: boolean;
  onCancel: () => void;
  onZip: () => void;
  onRerun: () => void;
  onStartOver: () => void;
}

const LABEL: Record<Row['status'], string> = { queued: 'Waiting', processing: 'Processing', reached: 'Reached the target', 'not-reached': 'Target not reached', failed: 'Failed', cancelled: 'Cancelled' };
const TONE: Record<Row['status'], string> = {
  queued: 'border-slate-300 bg-white text-slate-900',
  processing: 'border-sky-700 bg-sky-50 text-sky-950',
  reached: 'border-emerald-700 bg-emerald-50 text-emerald-950',
  'not-reached': 'border-amber-600 bg-amber-50 text-amber-950',
  failed: 'border-red-700 bg-red-50 text-red-950',
  cancelled: 'border-slate-400 bg-slate-50 text-slate-800',
};

/** The list of files in a batch with a status for each, and the batch actions. Presentation only: the queue lives in BatchRunner. */
export default function BatchPanel({ snapshot, note, zipError, stale, onCancel, onZip, onRerun, onStartOver }: Props) {
  const { rows, running } = snapshot;
  const count = (s: Row['status']) => rows.filter((r) => r.status === s).length;
  const doneSoFar = rows.filter((r) => ['reached', 'not-reached', 'failed', 'cancelled'].includes(r.status)).length;
  const reached = count('reached');
  const summary = running
    ? `Processing file ${Math.min(doneSoFar + 1, rows.length)} of ${rows.length}.`
    : `Finished. ${reached} reached the target${count('not-reached') ? `, ${count('not-reached')} did not` : ''}${count('failed') ? `, ${count('failed')} failed` : ''}${count('cancelled') ? `, ${count('cancelled')} cancelled` : ''}.`;
  return (
    <div data-testid="batch-panel" className="space-y-4">
      <div role="status" aria-live="polite" data-testid="batch-status" className="text-base font-semibold text-slate-900">{summary}</div>
      {note && <p role="note" data-testid="batch-note" className="rounded-lg border border-amber-600 bg-amber-50 p-3 text-sm text-amber-950">{note}</p>}
      <ul className="space-y-2" aria-label="Files in this batch">
        {rows.map((r, i) => (
          <li key={r.id} data-testid="batch-row" data-status={r.status} data-name={r.name} className={`rounded-xl border p-3 ${TONE[r.status]}`}>
            <p className="break-all font-semibold">{r.name}</p>
            <p className="text-sm">
              <strong>{LABEL[r.status]}.</strong>
              {r.status === 'reached' && ` ${formatSize(r.bytes ?? 0)}, ${formatDims(r.width ?? 0, r.height ?? 0)}.`}
              {r.status === 'not-reached' && ` Best result ${formatSize(r.bytes ?? 0)}. ${r.message ?? ''}`}
              {r.status === 'failed' && ` ${r.message ?? ''}`}
            </p>
            {r.url && (r.status === 'reached' || r.status === 'not-reached') && (
              <a data-testid={`batch-download-${i}`} className="mt-1 inline-flex min-h-11 items-center font-medium underline underline-offset-4" href={r.url} download={r.name.replace(/\.[^.]+$/, '') + (r.mime === 'image/png' ? '.png' : r.mime === 'image/webp' ? '.webp' : '.jpg')}>
                {r.status === 'reached' ? 'Download this file' : 'Download anyway'}<span className="sr-only">: {r.name}</span>
              </a>
            )}
          </li>
        ))}
      </ul>
      {zipError && <p role="alert" className="text-sm font-medium text-red-800" data-testid="batch-zip-error">{zipError}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        {running && <button type="button" data-testid="batch-cancel" className={btnSecondary} onClick={onCancel}>Cancel</button>}
        {!running && reached > 0 && <button type="button" data-testid="download-zip" className={btnPrimary} onClick={onZip}>Download all (ZIP)</button>}
        {!running && stale && <button type="button" data-testid="batch-rerun" className={btnSecondary} onClick={onRerun}>Process again with the new settings</button>}
        <button type="button" data-testid="batch-start-over" className={btnSecondary} onClick={onStartOver}>Start over</button>
      </div>
      {!running && stale && <p className="text-sm text-slate-700">The settings changed after this batch finished. The results above use the earlier settings.</p>}
      <p className="text-sm text-slate-700">A batch holds up to {BATCH_MAX_FILES} files. The same settings apply to every file, and each file is processed in your browser, one at a time.</p>
    </div>
  );
}
