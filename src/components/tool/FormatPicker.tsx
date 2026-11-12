import { useId } from 'react';
import type { OutputFormat } from '../../lib/engine/types';
import { backgroundFor, needsFlattenChoice, type BgChoice, type FieldErrors, type FormState } from './options';
import { errCls, fieldsetCls, hintCls, inputCls, legendCls } from './ui';
import { normalizeHex } from './format';

const LABEL: Record<OutputFormat, string> = { auto: 'Auto', jpeg: 'JPEG', png: 'PNG', webp: 'WebP' };
const HELP: Record<OutputFormat, string> = {
  auto: 'Keeps the original format (JPEG, PNG or WebP). Transparency is kept when the image has any.',
  jpeg: 'Smallest for photographs and accepted almost everywhere. JPEG cannot store transparency.',
  png: 'Exact pixels and transparency, but large for photographs. Size is reduced by shrinking the pixels.',
  webp: 'Small and keeps transparency. Not every portal accepts WebP.',
};

interface Props {
  form: FormState;
  errors: FieldErrors;
  update: (patch: Partial<FormState>) => void;
  formats: OutputFormat[];
  webp: boolean | null;
  /** From the file header: true when the picture has transparent pixels. */
  hasAlpha: boolean | null;
  /** Text shown above the choices explaining the default for this tool. */
  intro?: string;
}

const optCls = 'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-500 bg-white px-3 py-2 text-base text-slate-900 has-[:checked]:border-indigo-800 has-[:checked]:bg-indigo-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-800 has-[:disabled]:cursor-not-allowed has-[:disabled]:bg-slate-100 has-[:disabled]:text-slate-600';

export default function FormatPicker({ form, errors, update, formats, webp, hasAlpha, intro }: Props) {
  const id = useId();
  const flatten = needsFlattenChoice(form.format, hasAlpha);
  const bgValue = normalizeHex(form.bgCustom) ?? '#ffffff';
  const bgOptions: Array<[BgChoice, string]> = [['white', 'White'], ['black', 'Black'], ['custom', 'Custom colour']];
  return (
    <div className="space-y-3">
      <fieldset className={fieldsetCls} data-testid="format-picker">
        <legend className={legendCls}>Output format</legend>
        {intro && <p className={hintCls}>{intro}</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {formats.map((f) => {
            const disabled = f === 'webp' && webp === false;
            return (
              <label key={f} className={optCls}>
                <input
                  type="radio"
                  name={`${id}-format`}
                  value={f}
                  data-testid={`format-${f}`}
                  checked={form.format === f}
                  disabled={disabled}
                  className="size-4 accent-indigo-800"
                  onChange={() => update({ format: f })}
                />
                <span>{LABEL[f]}{disabled ? ' (not available)' : ''}</span>
              </label>
            );
          })}
        </div>
        <p className={hintCls} data-testid="format-help">{HELP[form.format]}</p>
        {formats.includes('webp') && webp === false && (
          <p className={hintCls} data-testid="webp-unsupported">This browser cannot save WebP images, so WebP is switched off. JPEG and PNG work here.</p>
        )}
      </fieldset>

      {hasAlpha === true && (
        <p className="rounded-lg border border-sky-700 bg-sky-50 p-3 text-sm text-sky-950" data-testid="alpha-note">
          This image has transparent areas.{' '}
          {form.format === 'jpeg'
            ? 'JPEG cannot store transparency, so those areas will be filled with the colour you choose below.'
            : 'The chosen format keeps them transparent. Pick JPEG only if your form needs it; you would then choose a fill colour.'}
        </p>
      )}

      {flatten && (
        <fieldset className={fieldsetCls} data-testid="flatten-choice">
          <legend className={legendCls}>Fill transparent areas with</legend>
          <div className="grid grid-cols-3 gap-2">
            {bgOptions.map(([v, label]) => (
              <label key={v} className={optCls}>
                <input type="radio" name={`${id}-bg`} value={v} data-testid={`bg-${v}`} checked={form.bg === v} className="size-4 accent-indigo-800" onChange={() => update({ bg: v })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {form.bg === 'custom' && (
            <div className="flex items-center gap-3">
              <label htmlFor={`${id}-color`} className="text-sm font-medium text-slate-900">Colour</label>
              <input
                id={`${id}-color`}
                data-testid="bg-color"
                type="color"
                value={bgValue}
                className={`h-11 w-16 cursor-pointer rounded-lg border border-slate-500 bg-white p-1`}
                onChange={(e) => update({ bgCustom: e.target.value })}
              />
              <label htmlFor={`${id}-hex`} className="sr-only">Colour as hex code</label>
              <input id={`${id}-hex`} type="text" className={`${inputCls} max-w-32`} value={form.bgCustom} aria-invalid={errors.bgCustom ? true : undefined} onChange={(e) => update({ bgCustom: e.target.value })} />
            </div>
          )}
          {errors.bgCustom && <p className={errCls}>{errors.bgCustom}</p>}
          <p className={hintCls}>
            Filling with {backgroundFor(form) ?? 'your colour'} changes how the picture looks. The result will state what was filled.
          </p>
        </fieldset>
      )}
    </div>
  );
}
