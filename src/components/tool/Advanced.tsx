import SelectBox, { selectCls } from './SelectBox';
import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import { derivedDimension, parseNumber, type FieldErrors, type FormState } from './options';
import { toPixels, UNITS, unitLabel, type Unit } from './units';
import { errCls, fieldsetCls, hintCls, inputCls, labelCls, legendCls } from './ui';

interface UpdateProps { form: FormState; errors: FieldErrors; update: (p: Partial<FormState>) => void }

function NumberField({ id, label, value, onChange, error, placeholder, testId, hint }: {
  id: string; label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; testId: string; hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      <input
        id={id}
        data-testid={testId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={`${inputCls} mt-1`}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
      {error ? <p id={`${id}-err`} className={errCls}>{error}</p> : hint ? <p id={`${id}-hint`} className={hintCls}>{hint}</p> : null}
    </div>
  );
}

/** Minimum size (+ the honest "no padding" explanation) and the upscaling opt-in. */
export function MinimumField({ form, errors, update }: UpdateProps) {
  const id = useId();
  const free = form.width.trim() === '' && form.height.trim() === '';
  return (
    <div className="space-y-2">
      <NumberField
        id={`${id}-min`}
        testId="min-size"
        label="Minimum size, in KB (optional)"
        value={form.minKb}
        error={errors.minKb}
        placeholder="e.g. 10"
        onChange={(v) => update({ minKb: v })}
        hint="Some forms need a file that is not too small. SizeTune reaches a minimum only honestly, by higher quality or more pixels. It never pads a file with filler, so a small or simple image can stay below your minimum, and the result says so."
      />
      {form.minKb.trim() !== '' && free && (
        <label className="flex min-h-11 items-start gap-2 text-sm text-slate-900">
          <input type="checkbox" data-testid="allow-enlarge" className="mt-1 size-5 accent-teal-700" checked={form.allowEnlarge} onChange={(e) => update({ allowEnlarge: e.currentTarget.checked })} />
          <span>Allow enlarging the picture (more pixels than the original) to reach the minimum. This adds no detail.</span>
        </label>
      )}
    </div>
  );
}

export function StrategyField({ form, update }: Pick<UpdateProps, 'form' | 'update'>) {
  const id = useId();
  const opt = 'flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border border-slate-500 bg-white p-3 text-sm text-slate-900 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal-700';
  return (
    <fieldset className={fieldsetCls} data-testid="strategy">
      <legend className={legendCls}>How to reach the size</legend>
      <label className={opt}>
        <input type="radio" name={`${id}-s`} data-testid="strategy-quality" className="mt-0.5 size-4 accent-teal-700" checked={form.strategy === 'quality-first'} onChange={() => update({ strategy: 'quality-first' })} />
        <span><strong>Quality first.</strong> Keep the pixels, lower the quality as needed. Best when a form fixes the pixel size.</span>
      </label>
      <label className={opt}>
        <input type="radio" name={`${id}-s`} data-testid="strategy-dimensions" className="mt-0.5 size-4 accent-teal-700" checked={form.strategy === 'dimensions-first'} onChange={() => update({ strategy: 'dimensions-first' })} />
        <span><strong>Dimensions first.</strong> Make the picture smaller in pixels first. Best when only the KB limit matters.</span>
      </label>
    </fieldset>
  );
}

interface DimProps extends UpdateProps {
  /** Pixel size the output is derived from (source, or crop for the signature tool). Used for placeholders only. */
  basis: { width: number; height: number } | null;
  showMax: boolean;
  legend?: string;
  /** Show the unit selector and the DPI field (FEATURE-013). Only the image tool turns this on. */
  print?: boolean;
}

/** Width/height (+ aspect lock, fit) and optional maximum width/height. Nothing is prefilled: blanks mean "keep the original proportions". */
export function DimensionFields({ form, errors, update, basis, showMax, legend, print = false }: DimProps) {
  const id = useId();
  const unit = print ? form.unit : 'px';
  const isPx = unit === 'px';
  const ul = unitLabel(unit);
  const legendText = legend ?? (print ? `Output size in ${isPx ? 'pixels' : ul} (optional)` : 'Output size in pixels (optional)');
  const setUnit = (u: Unit) => update({ unit: u, width: '', height: '', maxWidth: '', maxHeight: '', ...(u !== 'px' && form.dpi.trim() === '' ? { dpi: '300' } : {}) });
  const dpiNum = Number(form.dpi);
  const pxOf = (raw: string) => { const n = Number(raw.replace(/\s*(cm|mm|inch|inches|in)$/i, '')); return !isPx && n > 0 && Number.isInteger(dpiNum) && dpiNum > 0 ? toPixels(n, unit, dpiNum) : null; };
  const wPx = pxOf(form.width); const hPx = pxOf(form.height);
  const both = parseNumber(form.width, 'px').kind === 'ok' && parseNumber(form.height, 'px').kind === 'ok';
  const oneOnly = !both && (parseNumber(form.width, 'px').kind === 'ok' || parseNumber(form.height, 'px').kind === 'ok');
  const phW = form.lockAspect && basis ? derivedDimension(form.height, basis.width, basis.height, 'width') : null;
  const phH = form.lockAspect && basis ? derivedDimension(form.width, basis.width, basis.height, 'height') : null;
  return (
    <fieldset className={fieldsetCls} data-testid="dimensions">
      <legend className={legendCls}>{legendText}</legend>
      {print && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${id}-unit`} className={labelCls}>Unit</label>
            <SelectBox>
              <select id={`${id}-unit`} data-testid="unit" className={`${inputCls} ${selectCls}`} value={form.unit} onChange={(e) => setUnit(e.currentTarget.value as Unit)}>
                {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </SelectBox>
          </div>
          <NumberField id={`${id}-dpi`} testId="dpi" label={isPx ? 'DPI tag (optional)' : 'DPI'} value={form.dpi} error={errors.dpi} placeholder={isPx ? 'not written' : '300'} onChange={(v) => update({ dpi: v })}
            hint={isPx ? 'Writes this DPI into the JPEG or PNG file. Some portals check pixels, not DPI.' : 'Converts the size to pixels and is written into the JPEG or PNG file. Some portals check pixels, not DPI.'} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <NumberField id={`${id}-w`} testId="width" label={`Width (${ul})`} value={form.width} error={errors.width} placeholder={isPx && phW ? String(phW) : 'auto'} onChange={(v) => update({ width: v })} />
        <NumberField id={`${id}-h`} testId="height" label={`Height (${ul})`} value={form.height} error={errors.height} placeholder={isPx && phH ? String(phH) : 'auto'} onChange={(v) => update({ height: v })} />
      </div>
      {(wPx != null || hPx != null) && (
        <p className={hintCls} data-testid="px-preview">That is {wPx != null ? wPx.toLocaleString('en-US') : 'auto'} × {hPx != null ? hPx.toLocaleString('en-US') : 'auto'} pixels at {dpiNum} DPI.</p>
      )}
      <label className="flex min-h-11 items-center gap-2 text-sm text-slate-900">
        <input type="checkbox" data-testid="lock-aspect" className="size-5 accent-teal-700" checked={form.lockAspect} onChange={(e) => update({ lockAspect: e.currentTarget.checked })} />
        <span>Keep the aspect ratio</span>
      </label>
      {(both || !form.lockAspect) && (
        <div>
          <label htmlFor={`${id}-fit`} className={labelCls}>When the shape differs from the original</label>
          <SelectBox>
          <select
            id={`${id}-fit`}
            data-testid="fit"
            className={`${inputCls} ${selectCls}`}
            value={form.lockAspect ? form.fit : 'stretch'}
            disabled={!form.lockAspect}
            aria-describedby={`${id}-fit-hint`}
            onChange={(e) => update({ fit: e.currentTarget.value as FormState['fit'] })}
          >
            <option value="contain">Fit inside the size (nothing is cropped)</option>
            <option value="cover">Fill the size (edges are cropped)</option>
            {!form.lockAspect && <option value="stretch">Stretch to exactly this size (may distort)</option>}
          </select>
          </SelectBox>
          <p id={`${id}-fit-hint`} className={hintCls}>
            {form.lockAspect
              ? both ? 'With both sizes typed and the aspect ratio kept, the picture keeps its shape, so the result can be smaller than one of the sizes.' : 'Type both width and height to choose how the picture is fitted.'
              : 'The aspect ratio is not kept, so the picture is stretched to the exact size you type.'}
            {!form.lockAspect && oneOnly ? ' A side you leave empty keeps its original size.' : ''}
          </p>
        </div>
      )}
      {showMax && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField id={`${id}-mw`} testId="max-width" label={`Largest width (${ul})`} value={form.maxWidth} error={errors.maxWidth} placeholder="no limit" onChange={(v) => update({ maxWidth: v })} />
          <NumberField id={`${id}-mh`} testId="max-height" label={`Largest height (${ul})`} value={form.maxHeight} error={errors.maxHeight} placeholder="no limit" onChange={(v) => update({ maxHeight: v })} />
        </div>
      )}
    </fieldset>
  );
}

 /** `forceOpen`: a field inside has an error, so the section must not hide it. */
export function AdvancedBlock({ children, forceOpen }: { children: ComponentChildren; forceOpen?: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (forceOpen && ref.current) ref.current.open = true; }, [forceOpen]);
  return (
    <details ref={ref} data-testid="advanced" className="rounded-2xl border border-slate-300 bg-white open:pb-4">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 py-2 text-base font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
        Advanced options
      </summary>
      <div className="space-y-5 px-4">{children}</div>
    </details>
  );
}
