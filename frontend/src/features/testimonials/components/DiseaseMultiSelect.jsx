/**
 * DiseaseMultiSelect.jsx
 * Filter-style multi-select for Health Issues (chips inside the search field).
 * Shared by Transformation testimonials and Body Parameters Card.
 * No heart icon — label is "Health Issues".
 */
import React, { useEffect, useRef, useState } from 'react';
import { Search, X, Plus, ChevronDown } from 'lucide-react';
import { searchMedicalConditions } from '../domain/medicalConditionSearch.js';
import { ALL_MEDICAL_CONDITIONS } from '../data/medicalConditions.js';

const PRESET_DISEASES = [
  'Diabetes Type 2',
  'Pre-Diabetes',
  'High Blood Pressure',
  'High Cholesterol',
  'Fatty Liver',
  'PCOD / PCOS',
  'Hypothyroidism',
  'Hyperthyroidism',
  'Knee Pain',
  'Back Pain',
  'Joint Pain / Arthritis',
  'Sleep Apnea',
  'Acid Reflux / GERD',
  'IBS / Digestive Issues',
  'Hormonal Imbalance',
  'Irregular Periods',
  'Anemia',
  'Vitamin Deficiency',
  'Hair Loss',
  'Skin Issues (Eczema / Psoriasis)',
  'Migraine',
  'Anxiety / Stress',
  'Low Energy / Fatigue',
  'Insulin Resistance',
  'Uric Acid / Gout',
  'Sleep Disorders (Insomnia)',
  'Liver Disorders',
  'Kidney Stones',
  'Varicose Veins',
  'Breathing Difficulties',
];

const MAX_ITEMS = 10;
const SEARCH_CATALOG = [...new Set([...PRESET_DISEASES, ...ALL_MEDICAL_CONDITIONS])];

function normalize(str) {
  return (str || '').toLowerCase().trim();
}

function Chip({ label, onRemove, disabled }) {
  return (
    <span className="inline-flex items-center gap-1 max-w-[11rem] pl-2 pr-1 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-[11px] font-medium text-indigo-800">
      <span className="truncate">{label}</span>
      {!disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(label);
          }}
          className="inline-flex items-center justify-center h-4 w-4 rounded text-indigo-500 hover:text-red-600 hover:bg-red-50"
          aria-label={`Remove ${label}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

/**
 * @param {{
 *   value?: string[],
 *   onChange: (next: string[]) => void,
 *   disabled?: boolean,
 *   maxItems?: number,
 *   required?: boolean,
 *   autoFocus?: boolean,
 * }} props
 */
export default function DiseaseMultiSelect({
  value = [],
  onChange,
  disabled = false,
  maxItems = MAX_ITEMS,
  required = false,
  autoFocus = false,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef(null);
  const rootRef = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => {
    if (autoFocus && !disabled) {
      const t = setTimeout(() => {
        inputRef.current?.focus();
        setOpen(true);
      }, 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus, disabled]);

  const selected = Array.isArray(value) ? value : [];
  const atMax = selected.length >= maxItems;
  const normQuery = normalize(query);

  const suggestions = (normQuery
    ? searchMedicalConditions(query, { conditions: SEARCH_CATALOG })
    : PRESET_DISEASES
  ).filter((d) => !selected.some((s) => normalize(s) === normalize(d)));

  const canAddCustom =
    normQuery.length >= 2
    && !selected.some((s) => normalize(s) === normQuery)
    && !SEARCH_CATALOG.some((d) => normalize(d) === normQuery);

  function add(label) {
    if (!label || atMax || disabled) return;
    const trimmed = label.trim();
    if (!trimmed) return;
    if (selected.some((s) => normalize(s) === normalize(trimmed))) return;
    onChange([...selected, trimmed]);
    setQuery('');
    setHighlight(-1);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function remove(label) {
    if (disabled) return;
    onChange(selected.filter((s) => s !== label));
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    const listSize = suggestions.length + (canAddCustom ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h < listSize - 1 ? h + 1 : 0));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h > 0 ? h - 1 : listSize - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && highlight < suggestions.length) {
        add(suggestions[highlight]);
      } else if (highlight === suggestions.length && canAddCustom) {
        add(query.trim());
      } else if (canAddCustom) {
        add(query.trim());
      } else if (suggestions[0]) {
        add(suggestions[0]);
      }
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setHighlight(-1);
      return;
    }
    if (e.key === 'Backspace' && !query && selected.length > 0) {
      remove(selected[selected.length - 1]);
    }
  }

  useEffect(() => {
    function onOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setHighlight(-1);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const showDrop = open && !atMax && !disabled;
  const listItems = suggestions.length > 0 || canAddCustom;

  return (
    <div className="flex flex-col gap-1" ref={rootRef}>
      <label className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
        Health Issues
        <span className="ml-1 font-normal normal-case tracking-normal text-indigo-400">
          ({required ? 'required' : 'optional'} · up to {maxItems})
        </span>
      </label>

      <div className="relative">
        <div
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          tabIndex={-1}
          onClick={() => {
            if (disabled) return;
            setOpen(true);
            inputRef.current?.focus();
          }}
          className={`w-full min-h-[42px] flex flex-wrap items-center gap-1.5 border rounded-lg px-2.5 py-1.5 text-left bg-white transition-all ${
            open
              ? 'border-indigo-400 ring-2 ring-indigo-200'
              : 'border-indigo-200 hover:border-indigo-300'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-text'}`}
        >
          <Search className="h-3.5 w-3.5 text-indigo-300 flex-shrink-0" />

          {selected.map((tag) => (
            <Chip key={tag} label={tag} onRemove={remove} disabled={disabled} />
          ))}

          {!disabled && !atMax && (
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder={selected.length === 0 ? 'Search health issues…' : 'Add more…'}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                setHighlight(-1);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              className="flex-1 min-w-[7rem] text-sm bg-transparent focus:outline-none text-gray-800 placeholder-gray-400 py-0.5"
            />
          )}

          {atMax && (
            <span className="text-[11px] text-gray-400 py-0.5">Max {maxItems}</span>
          )}

          <ChevronDown
            className={`ml-auto h-4 w-4 text-indigo-300 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>

        {showDrop && listItems && (
          <div
            ref={dropRef}
            className="absolute z-50 w-full mt-1 bg-white border border-indigo-100 rounded-xl shadow-lg overflow-hidden"
            style={{ maxHeight: 220, overflowY: 'auto' }}
          >
            {suggestions.map((d, idx) => (
              <button
                key={d}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(d);
                }}
                onMouseEnter={() => setHighlight(idx)}
                className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                  highlight === idx
                    ? 'bg-indigo-50 text-indigo-900'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {d}
              </button>
            ))}

            {canAddCustom && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(query.trim());
                }}
                onMouseEnter={() => setHighlight(suggestions.length)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium border-t border-gray-100 ${
                  highlight === suggestions.length
                    ? 'bg-indigo-50 text-indigo-900'
                    : 'text-indigo-700 hover:bg-indigo-50'
                }`}
              >
                <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                Add &quot;{query.trim()}&quot;
              </button>
            )}

            {suggestions.length === 0 && !canAddCustom && (
              <p className="px-3 py-2.5 text-xs text-gray-400 italic">
                {normQuery
                  ? 'No match — type at least 2 characters to add custom.'
                  : 'All presets selected.'}
              </p>
            )}
          </div>
        )}
      </div>

      {disabled && selected.length === 0 && (
        <p className="text-xs text-gray-400 italic">No health issues recorded.</p>
      )}
    </div>
  );
}
