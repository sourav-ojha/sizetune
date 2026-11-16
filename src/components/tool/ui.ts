/** Shared Tailwind class strings (no inline styles anywhere: CSP forbids them). */
export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';
const btn = `inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2 text-base font-semibold ${focusRing} disabled:cursor-not-allowed disabled:opacity-50`;
export const btnPrimary = `${btn} bg-teal-700 text-white shadow-pop hover:bg-teal-800 disabled:shadow-none`;
export const btnSecondary = `${btn} border border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50`;
export const btnToggleOn = `${btn} border border-teal-700 bg-teal-700 text-white shadow-pop`;
export const btnToggleOff = `${btn} border border-slate-300 bg-white text-slate-900 hover:border-teal-700 hover:bg-teal-50`;
export const inputCls = `min-h-11 w-full rounded-xl border border-slate-500 bg-white px-3.5 py-2 text-base text-slate-900 placeholder:text-slate-500 aria-[invalid=true]:border-red-700 ${focusRing}`;
export const labelCls = 'block text-sm font-medium text-slate-900';
export const hintCls = 'mt-1 text-sm text-slate-600';
export const errCls = 'mt-1 text-sm font-medium text-red-800';
export const fieldsetCls = 'min-w-0 space-y-3';
export const legendCls = 'mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600';
export const panelCls = 'rounded-3xl border border-slate-200 bg-white p-4 shadow-card sm:p-7';
