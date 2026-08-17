/**
 * DiseaseMultiSelect.jsx
 * Searchable multi-select for "Recovered Health Issues".
 * Shows a curated disease list + free-text custom entry.
 * Selected tags shown as removable pills below the input.
 */
import React, { useState, useRef, useEffect } from 'react';
import { X, Search, Plus, HeartPulse } from 'lucide-react';
import { searchMedicalConditions } from '../domain/medicalConditionSearch.js';
import { ALL_MEDICAL_CONDITIONS } from '../data/medicalConditions.js';

// ── Curated disease list ───────────────────────────────────────────────────────
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

// ── Tag pill ───────────────────────────────────────────────────────────────────
function Tag({ label, onRemove, disabled }) {
  return (
    <span className="inline-flex items-center gap-0.5 max-w-full px-2 py-0.5 bg-green-50 border border-green-200 rounded-full text-[10px] sm:text-[11px] font-medium text-green-800">
      <span className="truncate">{label}</span>
      {!disabled && (
        <button
          type="button"
          onClick={() => onRemove(label)}
          className="inline-flex items-center justify-center h-4 w-4 rounded-full text-green-600 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
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
 *   value: string[],
 *   onChange: (next: string[]) => void,
 *   disabled?: boolean,
 *   maxItems?: number,
 *   required?: boolean,
 * }} props
 */
export default function DiseaseMultiSelect({ value = [], onChange, disabled = false, maxItems = MAX_ITEMS, required = false, autoFocus = false }) {
  const [query,     setQuery]     = useState('');
  const [open,      setOpen]      = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const inputRef  = useRef(null);
  const dropRef   = useRef(null);

  // Auto-focus + open dropdown on mount when requested
  useEffect(() => {
    if (autoFocus && !disabled) {
      const t = setTimeout(() => {
        inputRef.current?.focus();
        setOpen(true);
      }, 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus, disabled]);

  const selected    = Array.isArray(value) ? value : [];
  const atMax       = selected.length >= maxItems;
  const normQuery   = normalize(query);

  // Empty query → curated presets. Typed query → catalog used by users (Back Pain, Lower Back Pain, …).
  const suggestions = (normQuery
    ? searchMedicalConditions(query, { conditions: SEARCH_CATALOG })
    : PRESET_DISEASES
  ).filter((d) => !selected.some((s) => normalize(s) === normalize(d)));

  // Whether the custom query can be added (not already selected, not in presets, non-empty)
  const canAddCustom =
    normQuery.length >= 2 &&
    !selected.some((s) => normalize(s) === normQuery) &&
    !PRESET_DISEASES.some((d) => normalize(d) === normQuery);

  function add(label) {
    if (!label || atMax) return;
    const trimmed = label.trim();
    if (selected.some((s) => normalize(s) === normalize(trimmed))) return;
    onChange([...selected, trimmed]);
    setQuery('');
    setOpen(false);
    setHighlight(-1);
    inputRef.current?.focus();
  }

  function remove(label) {
    onChange(selected.filter((s) => s !== label));
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
      }
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setHighlight(-1);
    }
    if (e.key === 'Backspace' && !query && selected.length > 0) {
      remove(selected[selected.length - 1]);
    }
  }

  // Close on outside click
  useEffect(() => {
    function onOutside(e) {
      if (
        dropRef.current && !dropRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) {
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
    <div className="space-y-2">
      {/* Label row */}
      <div className="flex items-center gap-1.5">
        <HeartPulse className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
        <span className="text-[11px] sm:text-xs font-semibold text-gray-700">
          Recovered Health Issues
          <span className="ml-1 text-gray-400 font-normal">({required ? 'required' : 'optional'} · up to {maxItems})</span>
        </span>
      </div>

      {/* Tag list */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((tag) => (
            <Tag key={tag} label={tag} onRemove={remove} disabled={disabled} />
          ))}
        </div>
      )}

      {/* Input wrapper */}
      {!disabled && (
        <div className="relative">
          <div
            className={`flex items-center gap-2 border rounded-xl px-3 py-2 bg-white transition-all ${
              open ? 'border-green-400 ring-2 ring-green-100' : 'border-gray-300'
            } ${atMax ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder={atMax ? `Max ${maxItems} selected` : 'Search or type a condition…'}
              value={query}
              disabled={atMax}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(-1); }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              className="flex-1 text-xs bg-transparent focus:outline-none text-gray-800 placeholder-gray-400"
            />
          </div>

          {showDrop && listItems && (
            <div
              ref={dropRef}
              className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden"
              style={{ maxHeight: '220px', overflowY: 'auto' }}
            >
              {suggestions.map((d, idx) => (
                <button
                  key={d}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); add(d); }}
                  onMouseEnter={() => setHighlight(idx)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-medium transition-colors ${
                    highlight === idx ? 'bg-green-50 text-green-800' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <HeartPulse className="h-3 w-3 text-rose-400 flex-shrink-0" />
                  {d}
                </button>
              ))}

              {canAddCustom && (
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); add(query.trim()); }}
                  onMouseEnter={() => setHighlight(suggestions.length)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold transition-colors border-t border-gray-100 ${
                    highlight === suggestions.length ? 'bg-emerald-50 text-emerald-800' : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                  Add "{query.trim()}"
                </button>
              )}

              {suggestions.length === 0 && !canAddCustom && (
                <p className="px-4 py-3 text-xs text-gray-400 italic">
                  {normQuery ? 'No match — type at least 2 characters to add custom.' : 'All presets selected.'}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {disabled && selected.length === 0 && (
        <p className="text-xs text-gray-400 italic">No health issues recorded.</p>
      )}
    </div>
  );
}
