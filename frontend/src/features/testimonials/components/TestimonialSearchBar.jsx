/**
 * TestimonialSearchBar.jsx
 * Reusable search input with suggestions.
 * variant="name"  → search team members by name
 * variant="issue" → search recovered health issues
 */
import React, { useEffect, useRef } from 'react';
import { HeartPulse, Search, X } from 'lucide-react';

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
  variant = 'name',
  placeholder,
  ariaLabel,
  emptyText,
}) {
  const containerRef = useRef(null);
  const isIssue = variant === 'issue';
  const listId = isIssue ? 'testimonial-health-issue-suggestions' : 'testimonial-name-suggestions';
  const resolvedPlaceholder = placeholder
    || (isIssue ? 'Search health issue...' : 'Search by name…');
  const resolvedAriaLabel = ariaLabel
    || (isIssue ? 'Search health issues' : 'Search team members by name');
  const resolvedEmpty = emptyText
    || (isIssue ? 'No matching health issues' : 'No matching users found.');

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        onOpenChange(false);
        onHighlightChange(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onOpenChange, onHighlightChange]);

  const showSuggestions = isOpen && value.trim().length > 0;
  const items = Array.isArray(suggestions) ? suggestions : [];

  return (
    <div ref={containerRef} className={`relative ${showSuggestions ? 'z-50' : 'z-10'}`}>
      <div className="relative z-10">
        <Search
          className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none ${
            isIssue ? 'text-green-600' : 'text-gray-400'
          }`}
          aria-hidden="true"
        />
        {/* type="text" so WebKit does not render a second native clear "X" */}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => onOpenChange(true)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={resolvedPlaceholder}
          aria-label={resolvedAriaLabel}
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? listId : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className={`w-full pl-9 pr-9 py-2.5 rounded-xl border bg-white text-sm text-gray-800 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all disabled:opacity-50 ${
            isIssue ? 'border-green-200' : 'border-gray-200'
          }`}
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
          className={`absolute left-0 right-0 top-full z-50 mt-1 bg-white rounded-xl shadow-lg max-h-64 overflow-y-auto isolate ${
            isIssue ? 'border border-green-200' : 'border border-gray-200'
          }`}
        >
          {items.length > 0 ? (
            items.map((item, index) => {
              const isHighlighted = index === highlightedIndex;
              const label = isIssue
                ? (typeof item === 'string' ? item : item?.label)
                : (item?.user?.userName || '');
              const key = isIssue ? `issue-${label}` : `member-${item?.user?.userId ?? index}`;
              return (
                <li key={key} role="option" aria-selected={isHighlighted}>
                  <button
                    type="button"
                    onMouseEnter={() => onHighlightChange(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onSelectSuggestion(item)}
                    className={`w-full px-4 py-2.5 text-left transition-colors cursor-pointer flex items-center gap-2 ${
                      isHighlighted ? 'bg-green-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    {isIssue && <HeartPulse className="h-3.5 w-3.5 text-rose-400 shrink-0" />}
                    <span className="text-sm font-medium text-gray-900 truncate">{label}</span>
                  </button>
                </li>
              );
            })
          ) : (
            <li className="px-4 py-3 text-sm text-gray-500">{resolvedEmpty}</li>
          )}
        </ul>
      )}
    </div>
  );
}
