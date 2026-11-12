import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { btnToggleOff, btnToggleOn } from './ui';

interface Props { beforeUrl: string; afterUrl: string; beforeLabel?: string; afterLabel?: string }

/**
 * Before/after comparison. The result is clipped with a CSS variable set from JS (no inline styles: CSP).
 * Works by pointer (range input) and keyboard (arrow keys on the range, or the three buttons).
 */
export default function Compare({ beforeUrl, afterUrl, beforeLabel = 'Original', afterLabel = 'Result' }: Props) {
  const id = useId();
  const [pos, setPos] = useState(50); // % of the width showing the ORIGINAL (left part)
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.style.setProperty('--cmp', `${pos}%`); }, [pos]);
  const text = pos <= 0 ? `Showing only the ${afterLabel.toLowerCase()}` : pos >= 100 ? `Showing only the ${beforeLabel.toLowerCase()}` : `${beforeLabel} on the left, ${afterLabel.toLowerCase()} on the right (split at ${pos}%)`;
  return (
    <div data-testid="compare" className="space-y-2">
      <div ref={box} className="relative mx-auto w-fit max-w-full overflow-hidden rounded-lg border border-slate-300 bg-slate-100">
        <img src={beforeUrl} alt={`${beforeLabel} image`} data-testid="compare-before" className="block max-h-[70vh] max-w-full select-none" draggable={false} />
        <img
          src={afterUrl}
          alt={`${afterLabel} image`}
          data-testid="compare-after"
          className="absolute inset-0 size-full select-none object-contain [clip-path:inset(0_0_0_var(--cmp))]"
          draggable={false}
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-[var(--cmp)] w-0.5 bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.6)]" />
        <span aria-hidden="true" className="pointer-events-none absolute left-2 top-2 rounded bg-slate-900/80 px-2 py-0.5 text-xs font-medium text-white">{beforeLabel}</span>
        <span aria-hidden="true" className="pointer-events-none absolute right-2 top-2 rounded bg-slate-900/80 px-2 py-0.5 text-xs font-medium text-white">{afterLabel}</span>
      </div>
      <label htmlFor={`${id}-r`} className="sr-only">Comparison slider: {beforeLabel.toLowerCase()} on the left, {afterLabel.toLowerCase()} on the right</label>
      <input
        id={`${id}-r`}
        data-testid="compare-slider"
        type="range"
        min={0}
        max={100}
        step={1}
        value={pos}
        aria-valuetext={text}
        className="h-11 w-full accent-indigo-800"
        onChange={(e) => setPos(Number(e.currentTarget.value))}
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick comparison views">
        <button type="button" data-testid="compare-show-before" aria-pressed={pos >= 100} className={pos >= 100 ? btnToggleOn : btnToggleOff} onClick={() => setPos(100)}>Show {beforeLabel.toLowerCase()}</button>
        <button type="button" data-testid="compare-show-split" aria-pressed={pos > 0 && pos < 100} className={pos > 0 && pos < 100 ? btnToggleOn : btnToggleOff} onClick={() => setPos(50)}>Split view</button>
        <button type="button" data-testid="compare-show-after" aria-pressed={pos <= 0} className={pos <= 0 ? btnToggleOn : btnToggleOff} onClick={() => setPos(0)}>Show {afterLabel.toLowerCase()}</button>
      </div>
    </div>
  );
}
