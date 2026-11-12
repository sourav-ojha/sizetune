import { useEffect, useRef } from 'preact/hooks';
import type { Progress as P } from './session';
import { btnSecondary } from './ui';

export function progressText(p: P | null): string {
  if (!p) return 'Starting…';
  if (p.stage === 'reading') return 'Reading the image…';
  if (p.stage === 'decoding') return 'Decoding the image…';
  return p.attempt && p.total ? `Finding the best size… step ${p.attempt} of ${p.total}` : 'Finding the best size…';
}

export default function ProgressBar({ progress, onCancel }: { progress: P | null; onCancel: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  useEffect(() => {
    // The Resize button just unmounted, so keyboard focus would be lost on <body>: put it on Cancel (same place in the tab order).
    cancelRef.current?.focus({ preventScroll: true });
    // Escape cancels from anywhere while a run is in progress (however it was started), not only when Cancel has focus.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) cancel.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const determinate = progress?.stage === 'encoding' && progress.attempt != null && progress.total != null && progress.total > 0;
  return (
    <div data-testid="progress" className="space-y-2 rounded-xl border border-slate-300 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-900" data-testid="progress-text">{progressText(progress)}</p>
      <progress
        className="h-3 w-full accent-indigo-800"
        aria-label="Processing progress"
        max={determinate ? progress!.total : undefined}
        value={determinate ? progress!.attempt : undefined}
      />
      <button ref={cancelRef} type="button" data-testid="cancel" aria-keyshortcuts="Escape" className={btnSecondary} onClick={onCancel}>Cancel<span className="sr-only"> (or press Escape)</span></button>
    </div>
  );
}
