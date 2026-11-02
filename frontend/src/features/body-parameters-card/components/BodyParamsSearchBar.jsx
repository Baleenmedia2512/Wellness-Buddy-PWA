/**
 * BodyParamsSearchBar.jsx
 * Name/phone search input with prefix-first autocomplete dropdown.
 * Keeps the existing Body Composition Metrics search look; adds suggestions only.
 */
import React, { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

/**
 * @param {{
 *   value: string,
 *   onChange: (value: string) => void,
 *   suggestions: Array<{ id?: string|number|null, term: string, name?: string, phoneNumber?: string }>,
 *   isOpen: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   highlightedIndex: number,
 *   onHighlightChange: (index: number) => void,
 *   onSelectSuggestion: (suggestion: object) => void,
 *   onKeyDown: (e: React.KeyboardEvent) => void,
 * }} props
 */
export default function BodyParamsSearchBar({
  value,
  onChange,
  suggestions = [],
  isOpen,
  onOpenChange,
  highlightedIndex,
  onHighlightChange,
  onSelectSuggestion,
  onKeyDown,
}) {
  const containerRef = useRef(null);
  const listId = 'bpc-search-suggestions';
  const showSuggestions = isOpen && String(value || '').trim().length > 0;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        onOpenChange(false);
        onHighlightChange(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onOpenChange, onHighlightChange]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} aria-hidden="true" />
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => onOpenChange(true)}
          onKeyDown={onKeyDown}
          aria-label="Search body composition cards by name or phone"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? listId : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {showSuggestions && suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto"
        >
          {suggestions.map((row, index) => {
            const isHighlighted = index === highlightedIndex;
            return (
              <li key={`${row.id ?? row.term}-${index}`} role="option" aria-selected={isHighlighted}>
                <button
                  type="button"
                  onMouseEnter={() => onHighlightChange(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelectSuggestion(row);
                  }}
                  className={`w-full px-3 py-2 text-left transition-colors ${
                    isHighlighted ? 'bg-green-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900 truncate">{row.term}</div>
                  {row.name && row.phoneNumber && row.term !== row.phoneNumber ? (
                    <div className="text-xs text-gray-500 truncate">{row.phoneNumber}</div>
                  ) : null}
                  {row.name && row.term === row.phoneNumber ? (
                    <div className="text-xs text-gray-500 truncate">{row.name}</div>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
