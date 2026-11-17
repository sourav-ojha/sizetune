/** Print units for the size fields (FEATURE-013). Pure: the engine only ever sees pixels. */
export type Unit = 'px' | 'cm' | 'mm' | 'in';

export const UNITS: Array<{ value: Unit; label: string }> = [
  { value: 'px', label: 'px' },
  { value: 'cm', label: 'cm' },
  { value: 'mm', label: 'mm' },
  { value: 'in', label: 'inch' },
];

const MM_PER_UNIT: Record<Exclude<Unit, 'px'>, number> = { cm: 10, mm: 1, in: 25.4 };

/** Pixels for a length at a DPI, rounded to a whole pixel and never below 1. px passes through (rounded). */
export function toPixels(value: number, unit: Unit, dpi: number): number {
  if (unit === 'px') return Math.max(1, Math.round(value));
  return Math.max(1, Math.round((value * MM_PER_UNIT[unit] * dpi) / 25.4));
}

export function unitLabel(unit: Unit): string { return UNITS.find((u) => u.value === unit)?.label ?? unit; }
