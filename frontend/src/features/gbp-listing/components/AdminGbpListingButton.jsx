import React, { useState } from 'react';
import { MapPinned } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { isFlagEnabled } from '../../../config/featureFlags';
import { GBP_FLAG, isGbpAdminRole } from '../domain/gbp.rules';
import AdminGbpListingPage from './AdminGbpListingPage';

export default function AdminGbpListingButton({ userId, userRole }) {
  const [open, setOpen] = useState(false);

  if (!isFlagEnabled(GBP_FLAG)) return null;
  if (!isGbpAdminRole(userRole)) return null;

  return (
    <div>
      <TouchFeedbackButton
        onClick={() => setOpen(true)}
        ariaLabel="Map Business queue"
        className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-emerald-50 transition-colors"
      >
        <div className="p-2 rounded-full bg-emerald-50">
          <MapPinned className="w-4 h-4 text-emerald-700" aria-hidden />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-gray-900">Map Business Queue</p>
          <p className="text-xs text-gray-400">
            Admin only — review requests and paste Maps URLs
          </p>
        </div>
      </TouchFeedbackButton>
      {open ? (
        <AdminGbpListingPage
          requesterUserId={userId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
