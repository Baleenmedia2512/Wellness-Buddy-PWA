/**
 * Custom food entry — name (from search) + g|ml quantity + serving count. No macros.
 */
import React, { useState } from 'react';
import { validateCustomFoodForm } from '../../domain/customFood';

export default function CustomFoodEntryForm({
  foodName = '',
  onCancel,
  onConfirm,
  saving = false,
}) {
  const [unit, setUnit] = useState('g');
  const [quantity, setQuantity] = useState('100');
  const [servingSize, setServingSize] = useState('1');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const result = validateCustomFoodForm({ name: foodName, unit, quantity, servingSize });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError('');
    onConfirm?.(result);
  };

  const qtyLabel = quantity || '?';
  const servingsLabel = servingSize || '?';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-sm font-bold text-gray-900">Add custom food</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Set the serving for <span className="font-semibold text-gray-700">&quot;{foodName}&quot;</span>
        </p>
      </div>

      <div>
        <p className="block text-xs font-semibold text-gray-600 mb-2" id="custom-measurement-unit-label">
          Measurement unit
        </p>
        <div
          className="flex flex-wrap items-center gap-x-6 gap-y-2"
          role="radiogroup"
          aria-labelledby="custom-measurement-unit-label"
        >
          {[
            { value: 'g', label: 'Grams (g)' },
            { value: 'ml', label: 'Millilitres (ml)' },
          ].map((option) => {
            const selected = unit === option.value;
            return (
              <label
                key={option.value}
                className="inline-flex items-center gap-2 cursor-pointer select-none"
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
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected
                      ? 'border-green-600 bg-white'
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  {selected && (
                    <span className="h-2.5 w-2.5 rounded-full bg-green-600" />
                  )}
                </span>
                <span
                  className={`text-sm font-medium ${
                    selected ? 'text-gray-900' : 'text-gray-600'
                  }`}
                >
                  {option.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="custom-quantity" className="block text-xs font-semibold text-gray-600 mb-1">
          Quantity ({unit})
        </label>
        <input
          id="custom-quantity"
          type="number"
          inputMode="decimal"
          min="0.1"
          step="any"
          value={quantity}
          onChange={(e) => {
            setQuantity(e.target.value);
            setError('');
          }}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none text-sm"
          style={{ fontSize: '16px' }}
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="custom-serving-size" className="block text-xs font-semibold text-gray-600 mb-1">
          Serving size
        </label>
        <input
          id="custom-serving-size"
          type="number"
          inputMode="decimal"
          min="0.1"
          step="any"
          value={servingSize}
          onChange={(e) => {
            setServingSize(e.target.value);
            setError('');
          }}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none text-sm"
          style={{ fontSize: '16px' }}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-3 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-semibold"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60"
        >
          {saving
            ? 'Adding…'
            : `Add to meal · ${servingsLabel} × ${qtyLabel} ${unit}`}
        </button>
      </div>
    </form>
  );
}
