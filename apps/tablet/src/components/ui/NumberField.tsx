import { useState } from 'react';
import { NumberField as BaseNumberField } from '@base-ui/react';
import { NumberPad } from './NumberPad';

export type NumberFieldProps = {
  label: string;
  value: number | null;
  onValueChange: (v: number | null) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  smallStep?: number;
  allowDecimal?: boolean;
  maxFractionDigits?: number;
  maxIntegerDigits?: number;
  allowPad?: boolean;
  allowClear?: boolean;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  warning?: string;
  format?: Intl.NumberFormatOptions;
  className?: string;
  inputClassName?: string;
};

export function NumberField({
  label,
  value,
  onValueChange,
  unit,
  min,
  max,
  step = 1,
  smallStep,
  allowDecimal,
  maxFractionDigits,
  maxIntegerDigits,
  allowPad = true,
  allowClear = false,
  required,
  disabled,
  placeholder,
  warning,
  format,
  className,
  inputClassName,
}: NumberFieldProps) {
  const [padOpen, setPadOpen] = useState(false);

  const resolvedAllowDecimal =
    allowDecimal ?? (typeof step === 'number' && step < 1);
  const resolvedMaxFractionDigits =
    maxFractionDigits ?? (resolvedAllowDecimal ? 2 : 0);

  return (
    <div className={className}>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <BaseNumberField.Root
        value={value}
        onValueChange={(v) => onValueChange(v ?? null)}
        step={step}
        smallStep={smallStep}
        min={min}
        max={max}
        format={format}
        disabled={disabled}
        required={required}
      >
        <BaseNumberField.Group className="mt-1 inline-flex items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white">
          <BaseNumberField.Decrement
            aria-label={`${label}を減らす`}
            className="flex h-12 w-12 items-center justify-center border-r border-slate-300 text-2xl text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40"
          >
            −
          </BaseNumberField.Decrement>

          <button
            type="button"
            onClick={() => {
              if (allowPad && !disabled) setPadOpen(true);
            }}
            disabled={disabled}
            className="flex min-w-[7rem] flex-1 items-center justify-center px-3 disabled:opacity-50"
            aria-label={`${label}を入力`}
          >
            <span className="inline-flex items-baseline gap-1">
              <BaseNumberField.Input
                readOnly
                tabIndex={-1}
                placeholder={placeholder}
                className={`pointer-events-none w-full bg-transparent text-center text-lg tabular-nums text-slate-900 placeholder:text-slate-400 outline-none ${
                  inputClassName ?? ''
                }`}
              />
              {unit && (
                <span className="text-sm text-slate-500" aria-hidden="true">
                  {unit}
                </span>
              )}
            </span>
          </button>

          <BaseNumberField.Increment
            aria-label={`${label}を増やす`}
            className="flex h-12 w-12 items-center justify-center border-l border-slate-300 text-2xl text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40"
          >
            +
          </BaseNumberField.Increment>
        </BaseNumberField.Group>
      </BaseNumberField.Root>

      {warning && <p className="mt-1 text-xs text-amber-700">{warning}</p>}

      {allowPad && (
        <NumberPad
          open={padOpen}
          onOpenChange={setPadOpen}
          value={value}
          onConfirm={(v) => onValueChange(v)}
          label={label}
          unit={unit}
          min={min}
          max={max}
          allowDecimal={resolvedAllowDecimal}
          maxFractionDigits={resolvedMaxFractionDigits}
          maxIntegerDigits={maxIntegerDigits}
          allowClear={allowClear}
        />
      )}
    </div>
  );
}
