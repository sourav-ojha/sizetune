import { useState } from 'preact/hooks';
import { UNITS, convert, formatAmount, parseAmount, resizerHref, type Unit } from '../lib/sizeconv';
import { errCls, hintCls, inputCls, labelCls, panelCls } from './tool/ui';

const NAMES: Record<Unit, string> = { B: 'bytes (B)', KB: 'kilobytes (KB)', MB: 'megabytes (MB)', GB: 'gigabytes (GB)' };

/** Converts between bytes, KB, MB and GB, showing the 1,000 and 1,024 conventions side by side. Everything runs in the browser. */
export default function SizeConverter() {
  const [text, setText] = useState('2');
  const [from, setFrom] = useState<Unit>('MB');
  const [to, setTo] = useState<Unit>('KB');
  const parsed = parseAmount(text);
  const result = parsed.ok ? convert(parsed.value, from, to) : null;
  const error = parsed.ok ? (result && !result.ok ? 'That size is too large to convert exactly. Try a number under about 9 petabytes.' : '')
    : parsed.reason === 'invalid' ? 'Enter a number such as 2, 1.5 or 1,500. Negative numbers and letters are not accepted.' : '';
  const good = result && result.ok ? result : null;
  const href = good ? resizerHref(good.decimal.bytes) : null;
  const select = (id: string, label: string, value: Unit, set: (u: Unit) => void) => (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      <select id={id} data-testid={id} className={inputCls} value={value} onChange={(e) => set((e.target as HTMLSelectElement).value as Unit)}>
        {UNITS.map((u) => <option key={u} value={u}>{NAMES[u]}</option>)}
      </select>
    </div>
  );
  return (
    <section data-testid="tool" aria-label="KB and MB size converter" className={`${panelCls} space-y-6 lg:p-8`}>
      <h2 className="sr-only">Convert a file size</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="amount" className={labelCls}>Size</label>
          <input id="amount" data-testid="amount" type="text" inputMode="decimal" autoComplete="off" className={inputCls} value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} aria-invalid={error && parsed.ok === false ? true : undefined} aria-describedby={error ? 'amount-err' : undefined} />
        </div>
        {select('from', 'From', from, setFrom)}
        {select('to', 'To', to, setTo)}
      </div>
      <div role="status" aria-live="polite" data-testid="out">
        {error && <p id="amount-err" className={errCls} data-testid="error">{error}</p>}
        {good && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-300 bg-slate-50 p-4" data-testid="decimal">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">1 KB = 1,000 bytes</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950" data-testid="decimal-value">{formatAmount(good.decimal.value)} {to}</p>
              <p className={hintCls}>{formatAmount(good.decimal.bytes)} bytes in all. Used by disk makers and in the metric system.</p>
            </div>
            <div className="rounded-xl border border-slate-300 bg-slate-50 p-4" data-testid="binary">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">1 KB = 1,024 bytes</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950" data-testid="binary-value">{formatAmount(good.binary.value)} {to}</p>
              <p className={hintCls}>{formatAmount(good.binary.bytes)} bytes in all. Used by Windows, most upload forms and image tools.</p>
            </div>
          </div>
        )}
      </div>
      {href && (
        <p data-testid="resizer-link-wrap" className="text-base text-slate-800">
          Need a picture under this size? <a data-testid="resizer-link" href={href} className="font-medium text-teal-800 underline underline-offset-2">Resize an image to {formatAmount(Number(href.slice(6)))} KB</a>
        </p>
      )}
    </section>
  );
}
