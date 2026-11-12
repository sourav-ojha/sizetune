import { useCallback, useEffect, useState } from 'react';
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
