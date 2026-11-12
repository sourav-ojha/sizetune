import { useEffect, useState } from 'preact/hooks';
import { useSyncExternalStore } from 'preact/compat';
import { getLimits, processImage } from './engine';
import { ToolSession, type SessionState } from './session';

/** One session per mounted tool. Unmount aborts any run and revokes every object URL. */
export function useToolSession(): { session: ToolSession; state: SessionState } {
  const [session] = useState(
    () => new ToolSession({
      process: processImage,
      createObjectURL: (b) => URL.createObjectURL(b),
      revokeObjectURL: (u) => URL.revokeObjectURL(u),
      maxFileBytes: getLimits().maxFileBytes,
    }),
  );
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  useEffect(() => () => session.dispose(), [session]);
  return { session, state };
}
