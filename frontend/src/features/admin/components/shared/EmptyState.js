/**
 * EmptyState.js — small empty/error state used by the user-list tab.
 */
import React from 'react';
import { Search, Activity } from 'lucide-react';

export default function EmptyState({ apiError, searchQuery }) {
  if (apiError) {
    return (
      <div className="p-6 text-center text-sm text-red-500">
        <p className="font-medium">Error loading data</p>
        <p className="text-xs mt-1">{apiError}</p>
      </div>
    );
  }
  const Icon = searchQuery ? Search : Activity;
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <Icon className="h-8 w-8 text-gray-300" />
      </div>
      <h3 className="text-gray-900 font-medium">{searchQuery ? 'No users found' : 'No data available'}</h3>
      <p className="text-gray-500 text-sm mt-1">
        {searchQuery ? `No users found matching "${searchQuery}"` : 'No user spending data for this period'}
      </p>
    </div>
  );
}
