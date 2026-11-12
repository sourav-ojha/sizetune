import { useCallback, useEffect, useRef } from 'react';
import type { SessionState, ToolSession } from './session';
import { formatSize } from './format';

/** File picking: native input (also for a pick made before hydration), drag-and-drop via Dropzone's onPick. */
export function useIntake(session: ToolSession) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = inputRef.current;
    const f = el?.files?.[0];
    if (el && f) { void session.selectFile(f); el.value = ''; } // a file chosen before React hydrated would otherwise be invisible
  }, [session]);
  const onPick = useCallback(
    (file: File, extra: number) => { void session.selectFile(file, extra > 0 ? 'Only the first file was used. SizeTune handles one image at a time.' : null); },
    [session],
  );
  return { inputRef, onPick };
}

/** Plain-language status for the polite live region. Never contains file names. */
export function statusText(s: SessionState): string {
  if (s.phase === 'processing') return 'Processing your image.';
  if (s.phase === 'checking') return 'Checking the file.';
  if (s.result) {
    const d = s.result.data;
    if (d.status === 'ok' || d.status === 'raised') return `Finished. The result is ${formatSize(d.bytes)}.`;
    return `Finished, but your size target was not met. The result is ${formatSize(d.bytes)}. ${d.message}`;
  }
  if (s.error?.message) return '';
  if (s.file) return 'Image ready. Choose your settings, then resize.';
  return '';
}
