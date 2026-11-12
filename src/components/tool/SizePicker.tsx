import { useId } from 'react';
import { activePreset, PRESETS_KB, type FieldErrors, type FormState } from './options';
import { btnToggleOff, btnToggleOn, errCls, fieldsetCls, hintCls, inputCls, labelCls, legendCls } from './ui';

interface Props {
  form: FormState;
  errors: FieldErrors;
  update: (patch: Partial<FormState>) => void;
  /** Hide the quality slider (it only appears when there is no size target at all). */
  showQuality?: boolean;
}

export default function SizePicker({ form, errors, update, showQuality = true }: Props) {
  const id = useId();
  const active = form.noLimit ? null : activePreset(form.maxKb);
  const errId = `${id}-err`;
  const qualityVisible = showQuality && form.noLimit && form.minKb.trim() === '' && form.format !== 'png';
  return (
    <fieldset className={fieldsetCls} data-testid="size-picker">
      <legend className={legendCls}>Maximum file size</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {PRESETS_KB.map((kb) => (
          <button
            key={kb}
            type="button"
            data-testid={`preset-${kb}`}
            aria-pressed={active === kb}
            className={active === kb ? btnToggleOn : btnToggleOff}
            onClick={() => update({ maxKb: String(kb), noLimit: false })}
          >
            {kb} KB
          </button>
        ))}
        <button
          type="button"
          data-testid="preset-none"
          aria-pressed={form.noLimit}
          className={form.noLimit ? btnToggleOn : btnToggleOff}
          onClick={() => update({ noLimit: true })}
        >
          No limit
        </button>
      </div>
      <div>
        <label htmlFor={`${id}-max`} className={labelCls}>Or type your own maximum, in KB</label>
        <input
          id={`${id}-max`}
          data-testid="target"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className={`${inputCls} mt-1 sm:max-w-48`}
          placeholder={form.noLimit ? 'No limit' : 'e.g. 35'}
          value={form.noLimit ? '' : form.maxKb}
          aria-invalid={errors.maxKb ? true : undefined}
          aria-describedby={errors.maxKb ? errId : `${id}-hint`}
          onChange={(e) => update({ maxKb: e.target.value, noLimit: false })}
        />
        {errors.maxKb ? <p id={errId} className={errCls}>{errors.maxKb}</p> : (
          <p id={`${id}-hint`} className={hintCls}>
            The file is aimed to be under the number × 1,000 bytes, so it also passes a form that counts 1 KB as 1,024 bytes.
          </p>
        )}
      </div>
      {qualityVisible && (
        <div>
          <label htmlFor={`${id}-q`} className={labelCls}>Quality: <span data-testid="quality-value">{form.quality}</span></label>
          <input
            id={`${id}-q`}
            data-testid="quality"
            type="range"
            min={1}
            max={100}
            step={1}
            value={form.quality}
            className="mt-1 h-11 w-full accent-indigo-800"
            onChange={(e) => update({ quality: Number(e.target.value) })}
          />
          <p className={hintCls}>Without a size limit the image is saved at this fixed quality. Higher quality means a larger file.</p>
        </div>
      )}
    </fieldset>
  );
}
