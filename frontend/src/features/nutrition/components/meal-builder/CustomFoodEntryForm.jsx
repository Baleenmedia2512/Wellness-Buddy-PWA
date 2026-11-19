/**
 * One tile: Add "name"; responsive row — g/ml · qty stepper · +.
 * Serving always 1 (hidden).
 */
import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { validateCustomFoodForm } from '../../domain/customFood';

const QTY_STEP = 10;
const QTY_MIN = 1;

function bumpQuantity(raw, delta) {
  const n = Number(raw);
  const base = Number.isFinite(n) && n > 0 ? n : 100;
  const next = Math.round((base + delta) * 100) / 100;
  return String(Math.max(QTY_MIN, next));
}

export default function CustomFoodEntryForm({
  foodName = '',
  onConfirm,
  saving = false,
}) {
  const [unit, setUnit] = useState('g');
  const [quantity, setQuantity] = useState('100');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const result = validateCustomFoodForm({
      name: foodName,
      unit,
      quantity,
      servingSize: 1,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError('');
    onConfirm?.(result);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-full rounded-xl border border-green-200 bg-green-50/70 px-3 py-2.5 space-y-2.5"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          aria-hidden="true"
          className="flex-shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm"
        >
          +
        </span>
        <p className="text-sm font-semibold text-green-800 break-words min-w-0 flex-1">
          Add &quot;{foodName}&quot;
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full">
        <div
          className="flex items-center gap-3 flex-shrink-0"
          role="radiogroup"
          aria-label="Measurement unit"
        >
          {[
            { value: 'g', label: 'g' },
            { value: 'ml', label: 'ml' },
          ].map((option) => {
            const selected = unit === option.value;
            return (
              <label
                key={option.value}
                className="inline-flex items-center gap-1.5 cursor-pointer select-none"
              >
                <input
                  type="radio"
                  name="custom-measurement-unit"
                  value={option.value}
                  checked={selected}
                  onChange={() => setUnit(option.value)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected ? 'border-green-600 bg-white' : 'border-gray-300 bg-white'
                  }`}
                >
                  {selected && <span className="h-2 w-2 rounded-full bg-green-600" />}
                </span>
                <span className={`text-xs font-medium ${selected ? 'text-gray-900' : 'text-gray-600'}`}>
                  {option.label}
                </span>
              </label>
            );
          })}
        </div>

        <div
          className="flex items-center h-9 flex-1 min-w-[8.5rem] rounded-lg border border-green-200 bg-white overflow-hidden"
          role="group"
          aria-label={`Quantity in ${unit}`}
        >
          <button
            type="button"
            aria-label="Decrease quantity"
            className="w-9 h-9 flex items-center justify-center text-green-700 active:bg-green-50 flex-shrink-0"
            onClick={() => {
              setQuantity((q) => bumpQuantity(q, -QTY_STEP));
              setError('');
            }}
          >
            <Minus className="w-4 h-4" strokeWidth={2.5} />
          </button>
          <label htmlFor="custom-quantity" className="sr-only">
            Quantity ({unit})
          </label>
          <input
            id="custom-quantity"
            type="number"
            inputMode="decimal"
            min={QTY_MIN}
            step="any"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              setError('');
            }}
            className="flex-1 min-w-0 w-full text-center border-x border-green-100 outline-none text-sm bg-white py-1.5"
            style={{ fontSize: '16px' }}
          />
          <span className="text-xs font-semibold text-gray-500 pr-1.5 flex-shrink-0">{unit}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            className="w-9 h-9 flex items-center justify-center text-green-700 active:bg-green-50 flex-shrink-0"
            onClick={() => {
              setQuantity((q) => bumpQuantity(q, QTY_STEP));
              setError('');
            }}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        <button
          type="submit"
          disabled={saving}
          aria-label={saving ? 'Adding' : `Add ${quantity || '?'} ${unit}`}
          className="flex-shrink-0 w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center disabled:opacity-60 ml-auto"
        >
          {saving ? (
            <span className="text-xs font-bold">…</span>
          ) : (
            <Plus className="w-4 h-4" strokeWidth={2.5} />
          )}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600" role="alert">{error}</p>
      )}
    </form>
  );
}
