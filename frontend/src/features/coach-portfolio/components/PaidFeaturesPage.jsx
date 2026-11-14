import React, { useState } from 'react';
import { isFlagEnabled } from '../../../config/featureFlags';
import ReportAccessBanner from '../../reports/components/ReportAccessBanner';
import useEventsAccess from '../../events/hooks/useEventsAccess';
import { PORTFOLIO_FLAG } from '../domain/portfolio.rules';
import CoachWebsitePage from './CoachWebsitePage';

/**
 * Digital Portfolio entry — opens the websites hub directly (no Paid Features shell).
 */
export default function PaidFeaturesPage({ userId, onClose }) {
  const [openWebsite, setOpenWebsite] = useState(false);
  const websiteOn = isFlagEnabled(PORTFOLIO_FLAG);
  const trialEnabled = isFlagEnabled('ff.events-trial');
  const eventsAccess = useEventsAccess(trialEnabled && userId != null ? userId : null);
  const waitingAccess = trialEnabled && (userId == null || !eventsAccess.loaded);
  const hostLocked = trialEnabled && userId != null && eventsAccess.loaded && !eventsAccess.canUseHostTools;

  const accessBanner = trialEnabled && eventsAccess.loaded ? (
    <ReportAccessBanner
      featureName="Digital Portfolio"
      centered={hostLocked}
      access={eventsAccess.access}
      daysLeft={eventsAccess.daysLeft}
      error={eventsAccess.error}
      starting={eventsAccess.starting}
      onStartTrial={eventsAccess.startTrial}
      onRetry={eventsAccess.refresh}
      userId={userId}
      trialLengthDays={14}
      onPremiumCheck={async () => {
        const next = await eventsAccess.refresh();
        return next?.access === 'premium';
      }}
      onLeave={onClose}
    />
  ) : null;

  if (openWebsite && userId != null && !hostLocked) {
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

  if (waitingAccess) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (hostLocked) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-white px-4 py-6">
        {accessBanner}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      {eventsAccess.access === 'trial' ? (
        <div className="px-4 pt-4">{accessBanner}</div>
      ) : null}
      <CoachWebsitePage
        userId={userId}
        onClose={typeof onClose === 'function' ? onClose : () => {}}
      />
    </div>
  );
}
