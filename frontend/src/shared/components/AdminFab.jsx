import React from 'react';
import { Bot } from 'lucide-react';
import { isAdminLikeRole } from '../constants/roles';

/**
 * Admin-only FAB for Home — opens AI Credits Setup directly.
 * Returns null for non-admin roles or when AI credits feature is disabled.
 */
export default function AdminFab({ userRole, onNavigate, showAiCreditsItem = true }) {
  if (!isAdminLikeRole(userRole) || !showAiCreditsItem) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="Open AI Credits Setup"
      onClick={() => {
        if (typeof onNavigate === 'function') {
          onNavigate('ai-credits-setup');
        }
      }}
      className="fixed z-50 flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-[0_4px_12px_rgba(0,0,0,0.22)] transition-transform hover:bg-green-700 active:scale-95"
      style={{
        bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        right: 'calc(16px + env(safe-area-inset-right, 0px))',
      }}
    >
      <Bot className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
    </button>
  );
}
