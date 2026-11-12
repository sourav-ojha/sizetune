import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { canEncodeWebp } from './engine';
import { defaultForm, type FormState } from './options';

export function useForm(initial: Partial<FormState>): [FormState, (patch: Partial<FormState>) => void] {
  const [form, setForm] = useState<FormState>(() => defaultForm(initial));
  const update = useCallback((patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch })), []);
  return [form, update];
}

/** null = unknown (server render / probing): UI treats it as "maybe", never blocks. */
export function useWebpSupport(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void canEncodeWebp().then((v) => { if (alive) setOk(v); });
    return () => { alive = false; };
  }, []);
  return ok;
}

/** Scrolls an element into view only when it is not (partly) visible. Never moves a page that already shows it. */
export function ensureVisible(el: Element | null | undefined, block: ScrollLogicalPosition = 'nearest'): void {
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) el.scrollIntoView({ block });
}

/**
 * Keeps the tool where it is on screen when its content changes height (Safari has no scroll anchoring, so the page can jump mid-article).
 * Call hold() right before a state change; the element's viewport offset is restored after layout.
 */
export function useScrollAnchor() {
  const ref = useRef<HTMLElement | null>(null);
  const hold = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const fix = () => { const d = el.getBoundingClientRect().top - top; if (Math.abs(d) > 1) window.scrollBy(0, d); };
    requestAnimationFrame(() => { fix(); requestAnimationFrame(fix); });
  }, []);
  return { ref, hold };
}
