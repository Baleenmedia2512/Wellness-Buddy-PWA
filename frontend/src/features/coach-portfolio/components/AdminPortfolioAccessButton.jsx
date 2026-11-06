import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { isFlagEnabled } from '../../../config/featureFlags';
import { isPortfolioAdminRole, PORTFOLIO_FLAG } from '../domain/portfolio.rules';
import AdminPortfolioAccessPage from './AdminPortfolioAccessPage';

/**
 * Profile row for admin/developer — mark coaches paid for portfolio testing.
 */
export default function AdminPortfolioAccessButton({ userId, userRole }) {
  const [open, setOpen] = useState(false);

  if (!isFlagEnabled(PORTFOLIO_FLAG)) return null;
  if (!isPortfolioAdminRole(userRole)) return null;

  return (
    <div>
      <TouchFeedbackButton
        onClick={() => setOpen(true)}
        ariaLabel="Coach Website Access"
        className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-emerald-50 transition-colors"
      >
        <div className="p-2 rounded-full bg-emerald-50">
          <ShieldCheck className="w-4 h-4 text-emerald-700" aria-hidden />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-gray-900">Coach Website Access</p>
          <p className="text-xs text-gray-400">
            Mark a coach paid so their form can open
          </p>
        </div>
      </TouchFeedbackButton>
      {open ? (
        <AdminPortfolioAccessPage
          requesterUserId={userId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
