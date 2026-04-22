import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@base-ui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export type NumberPadProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: number | null;
  onConfirm: (value: number | null) => void;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  allowDecimal?: boolean;
  maxFractionDigits?: number;
  maxIntegerDigits?: number;
  allowClear?: boolean;
};

function clamp(n: number, min: number | undefined, max: number | undefined): number {
  let v = n;
  if (min != null && v < min) v = min;
  if (max != null && v > max) v = max;
  return v;
}

function valueToBuffer(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '';
  return value.toString();
}

function exceedsDigits(
  buffer: string,
  maxIntegerDigits: number,
  maxFractionDigits: number,
): boolean {
  const dot = buffer.indexOf('.');
  if (dot === -1) return buffer.length > maxIntegerDigits;
  const intPart = buffer.slice(0, dot);
  const fracPart = buffer.slice(dot + 1);
  return intPart.length > maxIntegerDigits || fracPart.length > maxFractionDigits;
}

export function NumberPad({
  open,
  onOpenChange,
  value,
  onConfirm,
  label,
  unit,
  min,
  max,
  allowDecimal = false,
  maxFractionDigits = 2,
  maxIntegerDigits = 4,
  allowClear = true,
}: NumberPadProps) {
  const [buffer, setBuffer] = useState<string>('');

  useEffect(() => {
    if (open) setBuffer(valueToBuffer(value));
  }, [open, value]);

  const previewNumber = useMemo(() => {
    if (buffer === '' || buffer === '.') return null;
    const n = Number(buffer);
    return Number.isFinite(n) ? n : null;
  }, [buffer]);

  const outOfRange = useMemo(() => {
    if (previewNumber == null) return false;
    if (min != null && previewNumber < min) return true;
    if (max != null && previewNumber > max) return true;
    return false;
  }, [previewNumber, min, max]);

  const dotDisabled = !allowDecimal || buffer.includes('.');

  function appendDigit(d: string) {
    const next = buffer + d;
    if (exceedsDigits(next, maxIntegerDigits, maxFractionDigits)) return;
    setBuffer(next);
  }

  function appendDot() {
    if (dotDisabled) return;
    setBuffer(buffer === '' ? '0.' : buffer + '.');
  }

  function backspace() {
    if (buffer.length === 0) return;
    setBuffer(buffer.slice(0, -1));
  }

  function clear() {
    setBuffer('');
  }

  function confirm() {
    if (buffer === '' || buffer === '.') {
      if (allowClear) {
        onConfirm(null);
        onOpenChange(false);
      }
      return;
    }
    const n = Number(buffer);
    if (!Number.isFinite(n)) return;
    onConfirm(clamp(n, min, max));
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-lg font-bold text-slate-800">
              {label}
            </Dialog.Title>
            <Dialog.Close
              aria-label="閉じる"
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            >
              <XMarkIcon className="h-6 w-6" />
            </Dialog.Close>
          </div>

          <div
            className={`mb-4 flex items-baseline justify-end rounded-xl px-4 py-3 ${
              outOfRange ? 'bg-amber-50 text-amber-900' : 'bg-slate-900 text-white'
            }`}
          >
            <span className="text-5xl font-bold tabular-nums">
              {buffer === '' ? '—' : buffer}
            </span>
            {unit && <span className="ml-2 text-2xl text-slate-300">{unit}</span>}
          </div>
          {outOfRange && (
            <div className="mb-3 text-xs text-amber-700">
              範囲外の値です({min ?? '-∞'} 〜 {max ?? '+∞'})。確定時に自動補正します。
            </div>
          )}

          <div className="flex gap-2">
            <div className="grid flex-1 grid-cols-3 gap-2">
              {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => appendDigit(String(d))}
                  className="h-16 rounded-lg border border-slate-300 bg-white text-3xl font-semibold tabular-nums text-slate-800 hover:bg-slate-50 active:bg-slate-200"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={appendDot}
                disabled={dotDisabled}
                className={`h-16 rounded-lg border text-3xl font-semibold tabular-nums ${
                  dotDisabled
                    ? 'border-slate-200 bg-slate-50 text-slate-300'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-200'
                }`}
              >
                .
              </button>
              <button
                type="button"
                onClick={() => appendDigit('0')}
                className="h-16 rounded-lg border border-slate-300 bg-white text-3xl font-semibold tabular-nums text-slate-800 hover:bg-slate-50 active:bg-slate-200"
              >
                0
              </button>
              <button
                type="button"
                onClick={backspace}
                aria-label="1文字削除"
                className="h-16 rounded-lg bg-slate-100 text-2xl font-semibold text-slate-700 hover:bg-slate-200 active:bg-slate-300"
              >
                ⌫
              </button>
            </div>
            <div className="flex w-24 flex-col gap-2">
              {allowClear && (
                <button
                  type="button"
                  onClick={clear}
                  className="h-16 rounded-lg bg-slate-100 text-base font-semibold text-slate-700 hover:bg-slate-200 active:bg-slate-300"
                >
                  クリア
                </button>
              )}
              <button
                type="button"
                onClick={confirm}
                disabled={buffer === '' && !allowClear}
                className="flex-1 rounded-lg bg-emerald-600 text-base font-bold text-white shadow hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50"
              >
                確定
              </button>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
