/**
 * AdminHeader.js — sticky top bar (back button, title, refresh).
 */
import React from 'react';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

export default function AdminHeader({ onClose, onRefresh, refreshing, savedFlash }) {
  return (
    <div className="sticky top-0 z-10 px-4 py-4"
      style={{ backgroundColor: '#a8dbb5', borderBottom: '1px solid #93c9a1' }}>
      <div className="flex items-center justify-between">
        <TouchFeedbackButton onClick={onClose} ariaLabel="Go back"
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors text-gray-700">
          <ChevronLeft className="w-6 h-6" />
        </TouchFeedbackButton>
        <div className="flex-1 text-center">
          <h1 className="text-lg font-bold text-gray-800">AI Token Monitor</h1>
          <p className="text-xs text-gray-500 mt-0.5">Track token usage and spending</p>
        </div>
        <div className="flex items-center gap-1">
          {savedFlash && <div className="text-green-600 text-sm mr-2">Saved!</div>}
          <TouchFeedbackButton onClick={onRefresh} ariaLabel="Refresh data"
            className={`p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors ${refreshing ? 'animate-spin text-green-600' : 'text-gray-500'}`}>
            <RefreshCw className="w-5 h-5" />
          </TouchFeedbackButton>
        </div>
      </div>
    </div>
  );
}
