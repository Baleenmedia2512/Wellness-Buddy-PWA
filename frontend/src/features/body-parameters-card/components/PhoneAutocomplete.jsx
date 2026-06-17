/**
 * PhoneAutocomplete.jsx
 *
 * Phone number input with prefix-match dropdown.
 * Stays inside the body-parameters-card feature — do not promote to shared/
 * until used in a second feature (claude.md §2.4).
 *
 * Props:
 *   value        {string}   current input value (controlled)
 *   onChange     {function} called with the raw string when typing
 *   suggestions  {Array}    [{ phoneNumber, userName, userId, heightCm, bmr }]
 *   onSelect     {function} called with the full suggestion object when picked
 *   isLoading    {boolean}  show spinner while search is in-flight
 */
import React, { useEffect, useRef, useState } from 'react';

/**
 * @param {{ value, onChange, suggestions, onSelect, isLoading, inputRef, onEnter }} props
 */
const PhoneAutocomplete = ({ value, onChange, suggestions = [], onSelect, isLoading = false, inputRef, onEnter }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Open dropdown when suggestions arrive, close when empty.
  useEffect(() => {
    setIsOpen(suggestions.length > 0);
  }, [suggestions]);

  // Close on outside click.
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInputChange = (e) => {
    onChange(e.target.value);
  };

  const handleSelect = (suggestion) => {
    onChange(suggestion.phoneNumber);
    onSelect(suggestion);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onEnter && !isOpen) {
      e.preventDefault();
      onEnter();
    }
  };

  const handleFocus = () => {
    if (suggestions.length > 0) setIsOpen(true);
  };

  return (
    <div ref={wrapperRef} className="relative flex flex-col gap-1">
      <label className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
        Phone Number
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="tel"
          inputMode="tel"
          pattern="[0-9]*"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder="Client phone — creates team member"
          maxLength={10}
          className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white pr-8"
          autoComplete="off"
        />
        {isLoading && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 text-xs animate-pulse">
            ⟳
          </span>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-indigo-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s) => (
            <li
              key={s.userId}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
              className="px-3 py-2 cursor-pointer hover:bg-indigo-50 transition-colors"
            >
              <div className="text-sm font-medium text-gray-800">{s.phoneNumber}</div>
              <div className="text-xs text-gray-500 truncate">
                {s.userName}
                {s.heightCm ? ` · ${s.heightCm} cm` : ''}
                {s.bmr ? ` · BMR ${s.bmr}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PhoneAutocomplete;
