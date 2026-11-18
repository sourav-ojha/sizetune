import { useState } from 'preact/hooks';
import { ageBetween, daysBetween, detectUnit, parseYmd, partsToTimestamp, timestampToParts, type Ymd } from '../lib/datecalc';
import { errCls, hintCls, inputCls, labelCls, panelCls } from './tool/ui';

/** Fixed list so the server-rendered markup and the browser agree. 'device' resolves to this device's own zone at calculation time. */
const ZONES: Array<[value: string, label: string]> = [
  ['UTC', 'UTC'], ['device', 'This device'], ['Asia/Kolkata', 'India (Asia/Kolkata)'], ['Asia/Dubai', 'Dubai'], ['Asia/Singapore', 'Singapore'],
  ['Asia/Tokyo', 'Tokyo'], ['Australia/Sydney', 'Sydney'], ['Pacific/Auckland', 'Auckland'], ['Europe/London', 'London'], ['Europe/Paris', 'Paris / Berlin'],
  ['Europe/Moscow', 'Moscow'], ['Africa/Cairo', 'Cairo'], ['Africa/Johannesburg', 'Johannesburg'], ['America/Sao_Paulo', 'São Paulo'],
  ['America/New_York', 'New York'], ['America/Chicago', 'Chicago'], ['America/Denver', 'Denver'], ['America/Los_Angeles', 'Los Angeles'],
];

const zoneName = (v: string): string => (v === 'device' ? Intl.DateTimeFormat().resolvedOptions().timeZone : v);

function todayYmd(): Ymd {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
}
const plural = (n: number, w: string) => `${n.toLocaleString('en-US')} ${w}${n === 1 ? '' : 's'}`;

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: preact.ComponentChildren }) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      {children}
      {hint && <p className={hintCls}>{hint}</p>}
    </div>
  );
}

function AgeCalculator() {
  const [dob, setDob] = useState('');
  const [asOf, setAsOf] = useState('');
  const birth = parseYmd(dob);
  const ref = asOf ? parseYmd(asOf) : todayYmd();
  const age = birth && ref ? ageBetween(birth, ref) : null;
  const error = dob && !birth ? 'Enter the date of birth as a real date.' : asOf && !ref ? 'Enter the as-of date as a real date.' : birth && ref && !age ? 'The date of birth is after the as-of date.' : '';
  const text = age ? `${plural(age.years, 'year')}, ${plural(age.months, 'month')}, ${plural(age.days, 'day')}` : '';
  const total = birth && ref && age ? daysBetween(birth, ref) : 0;
  return (
    <section aria-labelledby="age-h" className="space-y-4" data-testid="age-section">
      <h2 id="age-h" className="text-xl font-semibold text-slate-950">Age calculator</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="age-dob" label="Date of birth">
          <input id="age-dob" data-testid="age-dob" type="date" className={inputCls} value={dob} onInput={(e) => setDob((e.target as HTMLInputElement).value)} aria-invalid={dob && !birth ? true : undefined} />
        </Field>
        <Field id="age-asof" label="Age on (optional)" hint="Leave empty to use today.">
          <input id="age-asof" data-testid="age-asof" type="date" className={inputCls} value={asOf} onInput={(e) => setAsOf((e.target as HTMLInputElement).value)} />
        </Field>
      </div>
      <div role="status" aria-live="polite" data-testid="age-out">
        {error && <p className={errCls} data-testid="age-error">{error}</p>}
        {age && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-lg font-semibold text-slate-950" data-testid="age-result">{text}</p>
            <p className={hintCls} data-testid="age-total">{plural(total, 'day')} in all</p>
          </div>
        )}
      </div>
    </section>
  );
}

function DaysBetween() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const da = parseYmd(a), db = parseYmd(b);
  const n = da && db ? daysBetween(da, db) : null;
  const error = (a && !da) || (b && !db) ? 'Enter both dates as real dates.' : '';
  const text = n === null ? '' : `${plural(Math.abs(n), 'day')}`;
  return (
    <section aria-labelledby="days-h" className="space-y-4" data-testid="days-section">
      <h2 id="days-h" className="text-xl font-semibold text-slate-950">Days between two dates</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="days-a" label="From">
          <input id="days-a" data-testid="days-a" type="date" className={inputCls} value={a} onInput={(e) => setA((e.target as HTMLInputElement).value)} />
        </Field>
        <Field id="days-b" label="To">
          <input id="days-b" data-testid="days-b" type="date" className={inputCls} value={b} onInput={(e) => setB((e.target as HTMLInputElement).value)} />
        </Field>
      </div>
      <div role="status" aria-live="polite" data-testid="days-out">
        {error && <p className={errCls} data-testid="days-error">{error}</p>}
        {n !== null && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-lg font-semibold text-slate-950" data-testid="days-result">{text}</p>
            <p className={hintCls} data-testid="days-note">{n === 0 ? 'Same day.' : n > 0 ? 'The second date is later.' : 'The second date is earlier.'}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Timestamps() {
  const [zone, setZone] = useState('UTC');
  const [ts, setTs] = useState('');
  const [when, setWhen] = useState('');
  const tz = zoneName(zone);
  const raw = ts.trim();
  const num = raw === '' ? null : /^-?\d+$/.test(raw) ? Number(raw) : Number.NaN;
  const unit = num !== null && Number.isFinite(num) ? detectUnit(num) : 's';
  const shown = num !== null && Number.isFinite(num) ? timestampToParts(num, unit, tz) : null;
  const tsError = num !== null && shown === null ? 'Enter a whole-number timestamp that falls in a year from 0000 to 9999.' : '';
  const wallText = when.length === 16 ? `${when}:00` : when;
  const stamp = when ? partsToTimestamp(wallText, tz) : null;
  const whenError = when && stamp === null ? 'Enter a real date and time.' : '';
  return (
    <section aria-labelledby="ts-h" className="space-y-4" data-testid="ts-section">
      <h2 id="ts-h" className="text-xl font-semibold text-slate-950">Timestamp converter</h2>
      <Field id="ts-zone" label="Time zone">
        <select id="ts-zone" data-testid="ts-zone" className={inputCls} value={zone} onChange={(e) => setZone((e.target as HTMLSelectElement).value)}>
          {ZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <Field id="ts-in" label="Unix timestamp" hint="Seconds or milliseconds. A 13-digit number is read as milliseconds.">
            <input id="ts-in" data-testid="ts-in" type="text" inputMode="numeric" autoComplete="off" className={inputCls} value={ts} onInput={(e) => setTs((e.target as HTMLInputElement).value)} aria-invalid={Boolean(tsError) || undefined} aria-describedby={tsError ? 'ts-in-err' : undefined} />
          </Field>
          <div role="status" aria-live="polite" data-testid="ts-out">
            {tsError && <p id="ts-in-err" className={errCls} data-testid="ts-error">{tsError}</p>}
            {shown && (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-lg font-semibold text-slate-950" data-testid="ts-result">{shown}</p>
                <p className={hintCls} data-testid="ts-unit">{unit === 'ms' ? 'milliseconds' : 'seconds'}, {tz}</p>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-3">
          <Field id="when-in" label="Date and time" hint="In the time zone chosen above.">
            <input id="when-in" data-testid="when-in" type="datetime-local" step="1" className={inputCls} value={when} onInput={(e) => setWhen((e.target as HTMLInputElement).value)} aria-invalid={Boolean(whenError) || undefined} />
          </Field>
          <div role="status" aria-live="polite" data-testid="when-out">
            {whenError && <p className={errCls} data-testid="when-error">{whenError}</p>}
            {stamp !== null && (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-lg font-semibold text-slate-950" data-testid="when-result">{stamp}</p>
                <p className={hintCls}>seconds, or {stamp * 1000} milliseconds</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Age, days between dates and Unix timestamp conversion on one page. Everything runs in the browser; nothing is stored or sent. */
export default function DateTools() {
  return (
    <section data-testid="tool" aria-label="Date and time calculators" className={`${panelCls} space-y-10 lg:p-8`}>
      <AgeCalculator />
      <hr className="border-slate-200" />
      <DaysBetween />
      <hr className="border-slate-200" />
      <Timestamps />
    </section>
  );
}
