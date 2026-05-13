/**
 * SearchSortBar.js — search input + sort-direction toggle button.
 */
import React from 'react';
import { Search, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import TouchFeedbackButton from '../../../../shared/components/TouchFeedbackButton';

export default function SearchSortBar({ searchQuery, setSearchQuery, sortField, sortDirection, onToggleSort, placeholder = 'Search by name or email...' }) {
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text" placeholder={placeholder} value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <TouchFeedbackButton
        onClick={() => onToggleSort(sortField)}
        className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors flex-shrink-0"
        ariaLabel="Toggle sort direction">
        <ArrowUpDown className="w-4 h-4" />
        {sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      </TouchFeedbackButton>
    </div>
  );
}
