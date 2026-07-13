/**
 * MedicalConditionAutocomplete.jsx
 *
 * Searchable medical condition / disease input with custom-value support.
 * Data layer is decoupled via medicalConditionSearch.js for future API swap.
 */
import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Search, X } from 'lucide-react';
import { useDebounce } from '../../../shared/hooks/useDebounce.js';
import {
  MEDICAL_CONDITION_MAX_LENGTH,
  validateMedicalCondition,
} from '../domain/medicalConditionValidation.js';
import {
  recordRecentMedicalCondition,
  searchMedicalConditions,
  VISIBLE_SUGGESTION_CAP,
} from '../domain/medicalConditionSearch.js';

const SEARCH_DEBOUNCE_MS = 200;

function HighlightMatch({ text, query }) {
  const q = query.trim();
  if (!q) return <>{text}</>;

  const lowerText = text.toLowerCase();
  const lowerQuery = q.toLowerCase();
  const parts = [];
  let start = 0;
  let idx = lowerText.indexOf(lowerQuery);

  while (idx !== -1) {
    if (idx > start) {
      parts.push({ text: text.slice(start, idx), match: false });
    }
    parts.push({ text: text.slice(idx, idx + q.length), match: true });
    start = idx + q.length;
    idx = lowerText.indexOf(lowerQuery, start);
  }

  if (start < text.length) {
    parts.push({ text: text.slice(start), match: false });
  }

  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          <mark key={i} className="bg-green-200 text-green-900 rounded-sm px-0.5 font-semibold">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

/**
 * @param {{
 *   value: string,
 *   onChange: (value: string) => void,
 *   onBlur?: () => void,
 *   error?: string,
 *   disabled?: boolean,
 *   required?: boolean,
 * }} props
 */
export default function MedicalConditionAutocomplete({
  value,
  onChange,
  onBlur,
  error = '',
  disabled = false,
  required = true,
}) {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isTyping, setIsTyping] = useState(false);

  const debouncedQuery = useDebounce(value, SEARCH_DEBOUNCE_MS);

  const suggestions = useMemo(() => {
    if (!isTyping || !debouncedQuery.trim()) return [];
    return searchMedicalConditions(debouncedQuery);
  }, [debouncedQuery, isTyping]);

  const showDropdown = isOpen && isTyping && value.trim().length > 0;
  const hasSuggestions = suggestions.length > 0;
  const trimmedValue = value.trim();
  const customOptionIndex = hasSuggestions ? suggestions.length : 0;
  const optionCount = hasSuggestions ? suggestions.length : trimmedValue ? 1 : 0;

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
    setIsTyping(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [closeDropdown]);

  const selectCondition = useCallback(
    (condition) => {
      const { value: normalized } = validateMedicalCondition(condition);
      onChange(normalized || condition.trim());
      recordRecentMedicalCondition(normalized || condition.trim());
      closeDropdown();
      inputRef.current?.blur();
    },
    [onChange, closeDropdown],
  );

  const handleInputChange = (e) => {
    const next = e.target.value.slice(0, MEDICAL_CONDITION_MAX_LENGTH);
    onChange(next);
    setIsTyping(true);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleClear = () => {
    onChange('');
    setIsTyping(false);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (!showDropdown) {
      if (e.key === 'ArrowDown' && value.trim()) {
        setIsTyping(true);
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % optionCount);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? optionCount - 1 : prev - 1));
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
      return;
    }

    if (e.key === 'Enter') {
      if (highlightedIndex >= 0) {
        e.preventDefault();
        if (hasSuggestions && highlightedIndex < suggestions.length) {
          selectCondition(suggestions[highlightedIndex]);
        } else if (!hasSuggestions && trimmedValue) {
          selectCondition(trimmedValue);
        }
      }
      return;
    }

    if (e.key === 'Tab') {
      closeDropdown();
    }
  };

  const handleBlur = () => {
    onBlur?.();
  };

  const inputClassName = `
    w-full h-[52px] pl-11 pr-11 text-sm sm:text-base text-gray-800 placeholder-gray-500
    bg-green-50 border rounded-2xl shadow-sm
    transition-all duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500
    disabled:opacity-50 disabled:cursor-not-allowed
    ${error ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : 'border-green-200'}
  `;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <label
        htmlFor={inputId}
        className="block text-xs sm:text-sm font-medium text-gray-700 mb-2"
      >
        Medical Condition
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600 pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={disabled}
          required={required}
          maxLength={MEDICAL_CONDITION_MAX_LENGTH}
          placeholder="Search or type your medical condition"
          autoComplete="off"
          aria-label="Medical condition"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listboxId : undefined}
          aria-autocomplete="list"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={inputClassName}
        />
        {value ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-green-100 transition-colors"
            aria-label="Clear medical condition"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Medical condition suggestions"
          className="absolute z-50 w-full mt-2 bg-white border border-green-200 rounded-2xl shadow-lg overflow-hidden"
          style={{ maxHeight: `${VISIBLE_SUGGESTION_CAP * 44}px` }}
        >
          <div className="overflow-y-auto" style={{ maxHeight: `${VISIBLE_SUGGESTION_CAP * 44}px` }}>
            {hasSuggestions ? (
              suggestions.map((condition, index) => {
                const isHighlighted = index === highlightedIndex;
                return (
                  <li key={condition} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isHighlighted}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectCondition(condition)}
                      className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                        isHighlighted ? 'bg-green-50 text-green-900' : 'hover:bg-green-50/70 text-gray-800'
                      }`}
                    >
                      <HighlightMatch text={condition} query={debouncedQuery} />
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="px-4 py-3 text-sm text-gray-500 border-b border-gray-100">
                No medical condition found
              </li>
            )}

            {!hasSuggestions && trimmedValue ? (
              <li role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={highlightedIndex === customOptionIndex}
                  onMouseEnter={() => setHighlightedIndex(customOptionIndex)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectCondition(trimmedValue)}
                  className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                    highlightedIndex === customOptionIndex
                      ? 'bg-green-50 text-green-900'
                      : 'hover:bg-green-50/70 text-gray-800'
                  }`}
                >
                  Use &ldquo;<span className="font-semibold">{trimmedValue}</span>&rdquo; as a custom
                  condition
                </button>
              </li>
            ) : null}
          </div>
        </ul>
      )}
    </div>
  );
}
