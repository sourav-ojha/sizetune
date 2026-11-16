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
      className={`rounded-xl border-2 border-dashed p-4 text-center sm:p-6 ${over ? 'border-indigo-800 bg-indigo-50' : 'border-slate-500 bg-slate-50'}`}
    >
      {!hasFile && <p className="text-base font-medium text-slate-900">Drag and drop an image here</p>}
      {!hasFile && <p className="my-1 text-sm text-slate-700">or</p>}
      <label className={`${btnPrimary} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-800 ${disabled ? 'opacity-50' : ''}`}>
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
      <p id={hintId} className="mt-3 text-sm text-slate-700">
        Supported: JPEG, PNG and WebP.{capText ? ` ${capText}` : ''} Your image stays in this browser; nothing is uploaded.
      </p>
    </div>
  );
}
