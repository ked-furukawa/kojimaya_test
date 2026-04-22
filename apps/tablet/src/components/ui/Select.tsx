import { type ReactNode } from 'react';
import { Select as BaseSelect } from '@base-ui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';

export type SelectOption<T> = {
  value: T;
  label: ReactNode;
  textLabel?: string;
  disabled?: boolean;
};

export type SelectProps<T extends string | number> = {
  value: T | null;
  onValueChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  className?: string;
  triggerClassName?: string;
  ariaLabel?: string;
};

export function Select<T extends string | number>({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  required,
  name,
  className,
  triggerClassName,
  ariaLabel,
}: SelectProps<T>) {
  return (
    <BaseSelect.Root
      value={value}
      onValueChange={(v) => {
        if (v != null) onValueChange(v as T);
      }}
      disabled={disabled}
      required={required}
      name={name}
    >
      <BaseSelect.Trigger
        aria-label={ariaLabel}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 data-[popup-open]:border-emerald-500 ${
          triggerClassName ?? ''
        } ${className ?? ''}`}
      >
        <BaseSelect.Value className="truncate text-left">
          {(rawValue) => {
            const matched = options.find((o) => o.value === rawValue);
            if (matched) return matched.label;
            return (
              <span className="text-slate-400">
                {placeholder ?? '選択してください'}
              </span>
            );
          }}
        </BaseSelect.Value>
        <BaseSelect.Icon className="shrink-0 text-slate-500">
          <ChevronUpDownIcon className="h-5 w-5" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          sideOffset={4}
          alignItemWithTrigger={false}
          className="z-50 outline-none"
        >
          <BaseSelect.Popup className="max-h-[min(60vh,24rem)] min-w-[var(--anchor-width)] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl outline-none">
            <BaseSelect.List>
              {options.map((opt) => (
                <BaseSelect.Item
                  key={String(opt.value)}
                  value={opt.value}
                  label={opt.textLabel}
                  disabled={opt.disabled}
                  className="flex cursor-default items-center gap-2 px-3 py-2 text-base text-slate-900 outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-emerald-50 data-[highlighted]:text-emerald-900 data-[selected]:font-semibold"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-emerald-600">
                    <BaseSelect.ItemIndicator>
                      <CheckIcon className="h-5 w-5" />
                    </BaseSelect.ItemIndicator>
                  </span>
                  <BaseSelect.ItemText className="truncate">
                    {opt.label}
                  </BaseSelect.ItemText>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
