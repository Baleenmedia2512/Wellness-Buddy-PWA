import React, { useState } from 'react';
import { Globe2 } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { isFlagEnabled } from '../../../config/featureFlags';
import { PORTFOLIO_FLAG } from '../domain/portfolio.rules';
import CoachWebsitePage from './CoachWebsitePage';

/**
 * Profile row — opens Digital Portfolio hub (one page per owned center).
 */
export default function CoachWebsiteButton({ userId }) {
  const [open, setOpen] = useState(false);

  if (!isFlagEnabled(PORTFOLIO_FLAG)) return null;
  if (userId == null || String(userId).trim() === '') return null;

  return (
    <div>
      <TouchFeedbackButton
        onClick={() => setOpen(true)}
        ariaLabel="Digital Portfolio"
        className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-emerald-50 transition-colors"
      >
        <div className="p-2 rounded-full bg-emerald-50">
          <Globe2 className="w-4 h-4 text-emerald-700" aria-hidden />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-gray-900">Digital Portfolio</p>
          <p className="text-xs text-gray-400">
            Create one page per center — coach OTP to publish
          </p>
        </div>
      </TouchFeedbackButton>
      {open ? (
        <CoachWebsitePage
          userId={userId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
