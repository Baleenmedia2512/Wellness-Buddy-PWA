/**
 * EmailAutocomplete.jsx
 *
 * Email input with suggestions dropdown (similar to phone autocomplete).
 * Shows common email domains and previously used emails for quick selection.
 *
 * Props:
 *   value        {string}   current input value (controlled)
 *   onChange     {function} called with the new email string when typing
 *   onSelect     {function} called when a suggestion is selected
 *   suggestions  {Array}    optional array of email suggestions
 *   disabled     {boolean}  disable input
 */
import React, { useEffect, useRef, useState } from 'react';

const COMMON_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'protonmail.com',
];

/**
 * Generate email suggestions based on current input
 */
const generateSuggestions = (value, previousEmails = []) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return [];

  const suggestions = [];

  // If user typed something before @, suggest domains
  if (!trimmed.includes('@')) {
    COMMON_DOMAINS.forEach(domain => {
      suggestions.push(`${trimmed}@${domain}`);
    });
  } else {
    // If user started typing a domain, filter matching domains
    const [username, partialDomain] = trimmed.split('@');
    if (username && partialDomain) {
      COMMON_DOMAINS
        .filter(domain => domain.startsWith(partialDomain))
        .forEach(domain => {
          suggestions.push(`${username}@${domain}`);
        });
    }
  }

  // Add previously used emails that match
  previousEmails.forEach(email => {
    if (email.toLowerCase().includes(trimmed) && !suggestions.includes(email)) {
      suggestions.unshift(email); // Add to beginning
    }
  });

  return suggestions.slice(0, 5); // Limit to 5 suggestions
};

const EmailAutocomplete = ({ 
  value, 
  onChange, 
  onSelect, 
  suggestions: externalSuggestions = [], 
  disabled = false,
  placeholder = "Enter your email"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localSuggestions, setLocalSuggestions] = useState([]);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Get previously used emails from localStorage
  const getPreviousEmails = () => {
    try {
      const stored = localStorage.getItem('previousEmails');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  // Generate suggestions based on input
  useEffect(() => {
    if (!value || disabled) {
      setLocalSuggestions([]);
      setIsOpen(false);
      return;
    }

    const previousEmails = getPreviousEmails();
    const combined = externalSuggestions.length > 0 
      ? externalSuggestions 
      : generateSuggestions(value, previousEmails);
    
    setLocalSuggestions(combined);
    setIsOpen(combined.length > 0);
  }, [value, externalSuggestions, disabled]);

  // Close on outside click
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

  const handleSelect = (email) => {
    onChange(email);
    if (onSelect) onSelect(email);
    setIsOpen(false);
    
    // Save to previous emails
    const previousEmails = getPreviousEmails();
    if (!previousEmails.includes(email)) {
      const updated = [email, ...previousEmails].slice(0, 10); // Keep last 10
      localStorage.setItem('previousEmails', JSON.stringify(updated));
    }
  };

  const handleFocus = () => {
    if (localSuggestions.length > 0) {
      setIsOpen(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && isOpen && localSuggestions.length > 0) {
      e.preventDefault();
      handleSelect(localSuggestions[0]);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        ref={inputRef}
        id="recipient"
        type="email"
        inputMode="email"
        autoComplete="email username"
        name="email"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        disabled={disabled}
        required
        placeholder={placeholder}
        className="flex-1 w-full px-4 py-3 focus:outline-none text-base min-w-0 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all duration-300"
      />

      {isOpen && localSuggestions.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {localSuggestions.map((email, index) => (
            <li
              key={`${email}-${index}`}
              onMouseDown={(e) => { 
                e.preventDefault(); 
                handleSelect(email); 
              }}
              className="px-4 py-3 cursor-pointer hover:bg-green-50 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center">
                <svg 
                  className="w-4 h-4 mr-2 text-gray-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
                  />
                </svg>
                <span className="text-sm text-gray-800">{email}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default EmailAutocomplete;
