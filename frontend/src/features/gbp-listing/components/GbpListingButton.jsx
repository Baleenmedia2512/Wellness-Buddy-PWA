import React, { useState } from 'react';
import { MapPinned } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { isFlagEnabled } from '../../../config/featureFlags';
import { GBP_FLAG } from '../domain/gbp.rules';
import GbpListingPage from './GbpListingPage';

/**
 * Profile row — opens Map Business hub (GBP request).
 */
export default function GbpListingButton({ userId }) {
  const [open, setOpen] = useState(false);

  if (!isFlagEnabled(GBP_FLAG)) return null;
  if (userId == null || String(userId).trim() === '') return null;

  return (
    <div>
      <TouchFeedbackButton
        onClick={() => setOpen(true)}
        ariaLabel="Google Map Business"
        className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-emerald-50 transition-colors"
      >
        <div className="p-2 rounded-full bg-emerald-50">
          <MapPinned className="w-4 h-4 text-emerald-700" aria-hidden />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-gray-900">Google Map Business</p>
          <p className="text-xs text-gray-400">
            Request a Google Maps business for your center
          </p>
        </div>
      </TouchFeedbackButton>
      {open ? (
        <GbpListingPage
          userId={userId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
