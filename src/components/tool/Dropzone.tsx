import type { RefObject, TargetedEvent, TargetedDragEvent } from 'preact';
import { useId, useState } from 'preact/hooks';
import { btnPrimary, focusRing } from './ui';

interface Props {
  inputRef: RefObject<HTMLInputElement | null>;
  hasFile: boolean;
  /** e.g. "Up to 25 MB." (omitted when unknown) */
  capText: string | null;
  disabled?: boolean;
  onPick: (file: File, extraCount: number) => void;
}

/** Native file input inside a label-button (keyboard + touch friendly) plus a drag-and-drop target. The input is SSR'd so a pre-hydration pick is not lost. */
export default function Dropzone({ inputRef, hasFile, capText, disabled, onPick }: Props) {
  const hintId = useId();
  const [over, setOver] = useState(false);

  const onChange = (e: TargetedEvent<HTMLInputElement, Event>) => {
    const files = e.currentTarget.files;
    const first = files?.[0];
    if (first) onPick(first, (files?.length ?? 1) - 1);
    e.currentTarget.value = ''; // lets the same file be chosen again
  };
  const onDrop = (e: TargetedDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    const files = e.dataTransfer?.files;
    if (disabled || !files || files.length === 0) return;
    onPick(files[0], files.length - 1);
  };
  const onDragOver = (e: TargetedDragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault(); // required to allow a drop
    e.dataTransfer.dropEffect = 'copy';
    setOver(true);
  };
  const onDragLeave = (e: TargetedDragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
  };

  return (
    <div
      data-testid="dropzone"
      data-over={over ? 'true' : 'false'}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-2xl border-2 border-dashed text-center transition-colors ${hasFile ? 'p-4 sm:p-5' : 'px-4 py-10 sm:py-14'} ${over ? 'border-teal-700 bg-teal-50' : 'border-slate-300 bg-slate-50/70 hover:border-teal-600 hover:bg-teal-50/60'}`}
    >
      {!hasFile && (
        <span aria-hidden="true" className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-teal-100 text-teal-800">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V5m0 0-4 4m4-4 4 4" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
        </span>
      )}
      {!hasFile && <p className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Drag and drop an image here</p>}
      {!hasFile && <p className="my-1.5 text-sm text-slate-600">or</p>}
      <label className={`${btnPrimary} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal-700 ${disabled ? 'opacity-50' : ''}`}>
        <span>{hasFile ? 'Choose a different image' : 'Choose image'}</span>
        <input
          ref={inputRef}
          data-testid="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={`sr-only ${focusRing}`}
          aria-describedby={hintId}
          disabled={disabled}
          onChange={onChange}
        />
      </label>
      <p id={hintId} className="mt-4 text-sm text-slate-600">
        Supported: JPEG, PNG and WebP.{capText ? ` ${capText}` : ''} Your image stays in this browser; nothing is uploaded.
      </p>
    </div>
  );
}
