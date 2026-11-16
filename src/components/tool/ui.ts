/** Shared Tailwind class strings (no inline styles anywhere: CSP forbids them). */
export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-800';
const btn = `inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-base font-medium ${focusRing} disabled:cursor-not-allowed disabled:opacity-50`;
export const btnPrimary = `${btn} bg-indigo-800 text-white hover:bg-indigo-900`;
export const btnSecondary = `${btn} border border-slate-500 bg-white text-slate-900 hover:bg-slate-100`;
export const btnToggleOn = `${btn} border border-indigo-800 bg-indigo-800 text-white`;
export const btnToggleOff = `${btn} border border-slate-500 bg-white text-slate-900 hover:bg-slate-100`;
export const inputCls = `min-h-11 w-full rounded-lg border border-slate-500 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-500 aria-[invalid=true]:border-red-700 ${focusRing}`;
export const labelCls = 'block text-sm font-medium text-slate-900';
export const hintCls = 'mt-1 text-sm text-slate-700';
export const errCls = 'mt-1 text-sm font-medium text-red-800';
export const fieldsetCls = 'min-w-0 space-y-2';
export const legendCls = 'mb-1 text-base font-semibold text-slate-900';
export const panelCls = 'rounded-xl border border-slate-300 bg-white p-4 sm:p-5';
