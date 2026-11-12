import type { Ref } from 'preact';
import type { Progress as P } from './session';
import { btnSecondary } from './ui';

export function progressText(p: P | null): string {
  if (!p) return 'Starting…';
  if (p.stage === 'reading') return 'Reading the image…';
  if (p.stage === 'decoding') return 'Decoding the image…';
  return p.attempt && p.total ? `Finding the best size… step ${p.attempt} of ${p.total}` : 'Finding the best size…';
}

export default function ProgressBar({ progress, onCancel, cancelRef }: { progress: P | null; onCancel: () => void; cancelRef?: Ref<HTMLButtonElement> }) {
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
      <button ref={cancelRef} type="button" data-testid="cancel" className={btnSecondary} onClick={onCancel}>Cancel</button>
    </div>
  );
}
