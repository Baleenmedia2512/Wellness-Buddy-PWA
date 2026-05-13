/**
 * TeamSearchResults.js — presentational.
 * Dropdown panel listing matching team members. Renders three states:
 * loading, results, or empty.
 */
import React from 'react';
import { User } from 'lucide-react';

export default function TeamSearchResults({
  dropdownRef, loading, suggestions, searchQuery,
  selectedMemberId, onSelect,
}) {
  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto"
    >
      {loading ? (
        <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-500 border-t-transparent" />
          Loading team members...
        </div>
      ) : suggestions.length > 0 ? (
        <ul className="py-1">
          {suggestions.map((member, index) => (
            <li key={`${member.userId}-${index}`}>
              <button
                onClick={() => onSelect(member)}
                className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
              >
                <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {member.userName}
                    {member.isSelf && <span className="ml-2 text-xs text-green-600">(Me)</span>}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{member.email}</p>
                </div>
                {selectedMemberId === member.userId && (
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500" />
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-4 py-3 text-sm text-gray-500">
          No team members found matching &quot;{searchQuery}&quot;
        </div>
      )}
    </div>
  );
}
