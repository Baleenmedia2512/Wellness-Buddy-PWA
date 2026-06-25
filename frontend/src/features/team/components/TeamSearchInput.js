/**
 * TeamSearchInput.js — presentational.
 * Search input with leading user icon, trailing search/clear icon, and an
 * optional "View Mine" button when a non-self member is selected.
 */
import React from 'react';
import { User, Search, X } from 'lucide-react';

export default function TeamSearchInput({
  inputRef, value, searchQuery, onChange, onFocus, onClear,
  showViewMine, onClearSelection,
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <User className="h-4 w-4 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onClick={(e) => { if (!searchQuery) e.target.select(); }}
          placeholder="Type a name to search members..."
          className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all cursor-pointer"
        />
        {searchQuery ? (
          <button
            onClick={onClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
        )}
      </div>
      {showViewMine && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onClearSelection}
            className="flex-shrink-0 text-xs text-green-600 hover:text-green-700 font-medium px-3 py-2 border border-green-200 rounded-lg bg-green-50 hover:bg-green-100 transition-colors"
            title="View my dashboard"
          >
            View Mine
          </button>
        </div>
      )}
    </div>
  );
}
