import React from 'react';
import { isFlagEnabled } from '../../../config/featureFlags';
import { GBP_FLAG } from '../domain/gbp.rules';
import GbpListingPage from './GbpListingPage';

/**
 * Bottom-nav entry for Google Map Business (same hub as former Profile row).
 */
export default function MapBusinessNavPage({ userId, onClose }) {
  if (!isFlagEnabled(GBP_FLAG)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Google Map Business is not available right now.
        </p>
      </div>
    );
  }

  if (userId == null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Sign in to open Google Map Business.
        </p>
      </div>
    );
  }

  return (
    <GbpListingPage
      userId={userId}
      onClose={typeof onClose === 'function' ? onClose : () => {}}
    />
  );
}
