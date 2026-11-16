import { useId } from 'preact/hooks';
import { activePreset, outputIsLossless, PRESETS_KB, type FieldErrors, type FormState } from './options';
import { btnToggleOff, btnToggleOn, errCls, fieldsetCls, hintCls, inputCls, labelCls, legendCls } from './ui';

interface Props {
  form: FormState;
  errors: FieldErrors;
  update: (patch: Partial<FormState>) => void;
  /** Hide the quality slider (it only appears when there is no size target at all). */
  showQuality?: boolean;
  /** Real format of the selected file (from its header); Auto keeps a PNG source as PNG, where quality does not apply. */
  sourceKind?: 'jpeg' | 'png' | 'webp' | null;
}

export default function SizePicker({ form, errors, update, showQuality = true, sourceKind = null }: Props) {
  const id = useId();
  const active = form.noLimit ? null : activePreset(form.maxKb);
  const errId = `${id}-err`;
  const qualityVisible = showQuality && form.noLimit && form.minKb.trim() === '' && !outputIsLossless(form.format, sourceKind);
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
          onChange={(e) => update({ maxKb: e.currentTarget.value, noLimit: false })}
        />
        {errors.maxKb ? <p id={errId} className={errCls}>{errors.maxKb}</p> : (
          <p id={`${id}-hint`} className={hintCls}>
            The file is aimed to be under the number × 1,000 bytes, so it also passes a form that counts 1 KB as 1,024 bytes.
          </p>
        )}
      </div>
      {form.noLimit && (
        <p className={hintCls} data-testid="nolimit-note">
          No limit keeps the original pixel size, except for very large photos (above about 12 megapixels, for example 4000 × 3000): those are still reduced to fit your browser's memory.
        </p>
      )}
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
            className="mt-1 h-11 w-full accent-teal-700"
            onChange={(e) => update({ quality: Number(e.currentTarget.value) })}
          />
          <p className={hintCls}>Without a size limit the image is saved at this fixed quality. Higher quality means a larger file.</p>
        </div>
      )}
    </fieldset>
  );
}
