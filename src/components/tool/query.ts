/** Size target handed over from another SizeTune page, e.g. the checker's "/?max=50&min=20". Only plain positive numbers are accepted. */
const OK = /^\d{1,6}(\.\d{1,2})?$/;

export function targetFromSearch(search: string): { maxKb?: string; minKb?: string } {
  const q = new URLSearchParams(search);
  const out: { maxKb?: string; minKb?: string } = {};
  const max = q.get('max');
  const min = q.get('min');
  if (max && OK.test(max) && Number(max) > 0) out.maxKb = max;
  if (min && OK.test(min) && Number(min) > 0) out.minKb = min;
  return out;
}
