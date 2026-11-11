import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * In-page dropdown for registration. Expands inside the form (not OS popup),
 * so options stay on-screen on mobile / DevTools device mode.
 */
export default function RegistrationSelect({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = 'Choose',
  hasError = false,
  required = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = String(value || '');
  const selectedLabel =
    options.find((option) => String(option.value) === selected)?.label ||
    (selected ? selected : placeholder);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  const borderClass = hasError
    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
    : 'border-gray-300 focus:border-emerald-600 focus:ring-emerald-100';

  return (
    <div ref={rootRef} className="relative mt-2 w-full min-w-0 max-w-full">
      <select
        id={id}
        name={name}
        required={required}
        value={selected}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(false);
        }}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        tabIndex={-1}
        aria-hidden="true"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        id={`${id}-trigger`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        onClick={() => setOpen((prev) => !prev)}
        className={`box-border flex min-h-11 w-full max-w-full touch-manipulation items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 text-left text-base leading-normal outline-none focus:ring-2 ${borderClass} ${
          selected ? 'text-gray-900' : 'text-gray-500'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          aria-labelledby={`${id}-trigger`}
          className="mt-1 max-h-52 w-full max-w-full overflow-y-auto overscroll-contain rounded-lg border border-gray-200 bg-white shadow-sm"
        >
          {!required || !selected ? (
            <li role="option" aria-selected={!selected}>
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className={`flex min-h-11 w-full items-center px-3 py-2.5 text-left text-base ${
                  !selected ? 'bg-emerald-50 font-semibold text-emerald-900' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {placeholder}
              </button>
            </li>
          ) : null}
          {options.map((option) => {
            const on = selected === String(option.value);
            return (
              <li key={option.value} role="option" aria-selected={on}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(String(option.value));
                    setOpen(false);
                  }}
                  className={`flex min-h-11 w-full items-center px-3 py-2.5 text-left text-base ${
                    on ? 'bg-emerald-50 font-semibold text-emerald-900' : 'text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
