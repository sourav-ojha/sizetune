import { useCallback, useEffect, useRef } from 'preact/hooks';
import type { SessionState, ToolSession } from './session';
import { formatSize } from './format';

/** File picking: native input (also for a pick made before hydration), drag-and-drop via Dropzone's onPick. */
export function useIntake(session: ToolSession, onMany?: (files: File[]) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = inputRef.current;
    const list = el?.files ? Array.from(el.files) : [];
    if (el && list.length > 1 && onMany) { onMany(list); el.value = ''; } // several files chosen before the island hydrated form a batch
    else if (el && list[0]) { void session.selectFile(list[0]); el.value = ''; } // a file chosen before the island hydrated would otherwise be invisible
  }, [session]);
  // A file dropped slightly outside the drop zone must not make the browser navigate away to the file.
  useEffect(() => {
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types?.includes('Files');
    const guard = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    window.addEventListener('dragover', guard);
    window.addEventListener('drop', guard);
    return () => { window.removeEventListener('dragover', guard); window.removeEventListener('drop', guard); };
  }, []);
  const onPick = useCallback(
    (file: File, extra: number) => { void session.selectFile(file, extra > 0 ? 'Only the first file was used. SizeTune handles one image at a time.' : null); },
    [session],
  );
  return { inputRef, onPick };
}

/** Plain-language status for the polite live region. Never contains file names. */
/** `auto`: the tool resizes by itself when a file or a setting changes (so there is no "then resize" step to announce). */
export function statusText(s: SessionState, auto = false): string {
  if (s.phase === 'processing') return 'Processing your image.';
  if (s.inspecting) return 'Checking your image.';
  if (s.result) {
    const d = s.result.data;
    if (d.status === 'ok' || d.status === 'raised') {
      return d.bytes > d.source.bytes
        ? `Finished, but the result is larger than your original. The result is ${formatSize(d.bytes)}.`
        : `Finished. The result is ${formatSize(d.bytes)}.`;
    }
    return `Finished, but your size target was not met. The result is ${formatSize(d.bytes)}. ${d.message}`;
  }
  if (s.error?.message) return '';
  if (s.file) return auto ? 'Image ready.' : 'Image ready. Choose your settings, then resize.';
  return '';
}
