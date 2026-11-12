/**
 * KB -> byte window. Portals count KB as 1000 or 1024 bytes; the window [min*1024, max*1000] satisfies both readings.
 * If that window is empty (min*1024 > max*1000, e.g. "10–10 KB"), the minimum falls back to min*1000 and `conflict` is set
 * so the caller can disclose it.
 */
export interface ByteWindow { lo: number; hi: number; conflict: boolean }

export function byteWindow(minKb?: number, maxKb?: number): ByteWindow {
  const hi = maxKb === undefined ? Infinity : Math.floor(maxKb * 1000);
  let lo = minKb === undefined ? 0 : Math.ceil(minKb * 1024);
  let conflict = false;
  if (lo > hi) {
    lo = Math.ceil((minKb as number) * 1000);
    conflict = true;
  }
  return { lo, hi, conflict };
}

export const inWindow = (bytes: number, w: { lo: number; hi: number }) => bytes >= w.lo && bytes <= w.hi;
