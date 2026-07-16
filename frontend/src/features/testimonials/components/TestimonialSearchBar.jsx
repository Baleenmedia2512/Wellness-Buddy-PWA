/**
 * TestimonialSearchBar.jsx
 * Responsive search input with real-time auto-suggestions and keyboard navigation.
 */
import React, { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
export default function TestimonialSearchBar({
  value,
  onChange,
  suggestions,
  isOpen,
  onOpenChange,
  highlightedIndex,
  onHighlightChange,
  onSelectSuggestion,
  onKeyDown,
  disabled = false,
}) {
  const containerRef = useRef(null);
  const listId = 'testimonial-search-suggestions';

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

  const showSuggestions = isOpen && value.trim().length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => onOpenChange(true)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder="Search by name…"
          aria-label="Search team members by name"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? listId : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all disabled:opacity-50"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {showSuggestions && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto"
        >
          {suggestions.length > 0 ? (
            suggestions.map((row, index) => {
              const isHighlighted = index === highlightedIndex;
              return (
                <li key={row.user.userId} role="option" aria-selected={isHighlighted}>
                  <button
                    type="button"
                    onMouseEnter={() => onHighlightChange(index)}
                    onClick={() => onSelectSuggestion(row)}
                    className={`w-full px-4 py-2.5 text-left transition-colors cursor-pointer ${
                      isHighlighted ? 'bg-green-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {row.user.userName}
                    </span>
                  </button>
                </li>
              );
            })
          ) : (
            <li className="px-4 py-3 text-sm text-gray-500">No matching users found.</li>
          )}
        </ul>
      )}
    </div>
  );
}
