import React from 'react';
import { isFlagEnabled } from '../../../config/featureFlags';
import { PORTFOLIO_FLAG } from '../domain/portfolio.rules';
import CoachWebsitePage from './CoachWebsitePage';

/**
 * Digital Portfolio entry — opens the websites hub directly (no Paid Features shell).
 */
export default function PaidFeaturesPage({ userId, onClose }) {
  const portfolioOn = isFlagEnabled(PORTFOLIO_FLAG);

  if (!portfolioOn) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Digital Portfolio is not available right now.
        </p>
      </div>
    );
  }

  if (userId == null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Sign in to open Digital Portfolio.
        </p>
      </div>
    );
  }

  return (
    <CoachWebsitePage
      userId={userId}
      onClose={typeof onClose === 'function' ? onClose : () => {}}
    />
  );
}
