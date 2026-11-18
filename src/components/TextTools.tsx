import { useState } from 'preact/hooks';
import { countText, convertCase, generateFiller, FILLER_MAX, type CaseKind, type FillerUnit } from '../lib/textcalc';
import { btnPrimary, btnToggleOff, btnToggleOn, hintCls, inputCls, labelCls, legendCls, fieldsetCls, panelCls } from './tool/ui';

const fmt = (n: number) => n.toLocaleString('en-US');

const CASES: Array<[CaseKind, string]> = [['upper', 'UPPER CASE'], ['lower', 'lower case'], ['title', 'Title Case'], ['sentence', 'Sentence case']];
const UNITS: Array<[FillerUnit, string]> = [['words', 'Words'], ['sentences', 'Sentences'], ['characters', 'Characters']];

function Stat({ id, label, value }: { id: string; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-slate-950" data-testid={id}>{fmt(value)}</dd>
    </div>
  );
}

/** Counts, case conversion and filler text on one page. The text stays in the page: it is never stored or sent. */
export default function TextTools() {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<CaseKind>('title');
  const [unit, setUnit] = useState<FillerUnit>('words');
  const [amount, setAmount] = useState('100');
  const [filler, setFiller] = useState('');
  const [fillerNote, setFillerNote] = useState('');

  const c = countText(text);
  const converted = convertCase(text, kind);

  const generate = () => {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < 1) { setFiller(''); setFillerNote('Enter a whole number of 1 or more.'); return; }
    const used = Math.min(n, FILLER_MAX[unit]);
    setFiller(generateFiller(unit, used));
    setFillerNote(n > used ? `Shortened to the limit of ${fmt(used)} ${unit}.` : `Generated ${fmt(used)} ${unit}.`);
  };

  return (
    <section data-testid="tool" aria-label="Text counters and converters" className={`${panelCls} space-y-10 lg:p-8`}>
      <section aria-labelledby="count-h" className="space-y-4" data-testid="count-section">
        <h2 id="count-h" className="text-xl font-semibold text-slate-950">Count words and characters</h2>
        <div>
          <label htmlFor="text-in" className={labelCls}>Your text</label>
          <textarea id="text-in" data-testid="text-in" rows={8} className={`${inputCls} resize-y`} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} spellcheck={false} />
          <p className={hintCls}>Type or paste. The counts below update as you go.</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-live="polite" data-testid="counts">
          <Stat id="count-words" label="Words" value={c.words} />
          <Stat id="count-chars" label="Characters" value={c.characters} />
          <Stat id="count-nospace" label="Without spaces" value={c.charactersNoSpaces} />
          <Stat id="count-sentences" label="Sentences" value={c.sentences} />
          <Stat id="count-paragraphs" label="Paragraphs" value={c.paragraphs} />
        </dl>
      </section>

      <hr className="border-slate-200" />

      <section aria-labelledby="case-h" className="space-y-4" data-testid="case-section">
        <h2 id="case-h" className="text-xl font-semibold text-slate-950">Change the case</h2>
        <fieldset className={fieldsetCls}>
          <legend className={legendCls}>Case for the text above</legend>
          <div className="flex flex-wrap gap-2">
            {CASES.map(([k, label]) => (
              <button key={k} type="button" data-testid={`case-${k}`} aria-pressed={kind === k} className={kind === k ? btnToggleOn : btnToggleOff} onClick={() => setKind(k)}>{label}</button>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="case-out" className={labelCls}>Converted text</label>
          <textarea id="case-out" data-testid="case-out" rows={8} readOnly className={`${inputCls} resize-y bg-slate-50`} value={converted} />
          <p className={hintCls}>Select the text to copy it.</p>
        </div>
      </section>

      <hr className="border-slate-200" />

      <section aria-labelledby="filler-h" className="space-y-4" data-testid="filler-section">
        <h2 id="filler-h" className="text-xl font-semibold text-slate-950">Make filler text</h2>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="filler-amount" className={labelCls}>How many</label>
            <input id="filler-amount" data-testid="filler-amount" type="number" min={1} step={1} inputMode="numeric" className={inputCls} value={amount} onInput={(e) => setAmount((e.target as HTMLInputElement).value)} />
          </div>
          <div>
            <label htmlFor="filler-unit" className={labelCls}>Count in</label>
            <select id="filler-unit" data-testid="filler-unit" className={inputCls} value={unit} onChange={(e) => setUnit((e.target as HTMLSelectElement).value as FillerUnit)}>
              {UNITS.map(([u, l]) => <option key={u} value={u}>{l}</option>)}
            </select>
          </div>
          <button type="button" className={btnPrimary} data-testid="filler-go" onClick={generate}>Make text</button>
        </div>
        <p role="status" aria-live="polite" className={hintCls} data-testid="filler-note">{fillerNote}</p>
        <div>
          <label htmlFor="filler-out" className={labelCls}>Filler text</label>
          <textarea id="filler-out" data-testid="filler-out" rows={6} readOnly className={`${inputCls} resize-y bg-slate-50`} value={filler} />
        </div>
      </section>
    </section>
  );
}
