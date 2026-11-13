import React from 'react';
import { isFlagEnabled } from '../../../config/featureFlags';
import ReportAccessBanner from '../../reports/components/ReportAccessBanner';
import useEventsAccess from '../../events/hooks/useEventsAccess';
import { PORTFOLIO_FLAG } from '../domain/portfolio.rules';
import CoachWebsitePage from './CoachWebsitePage';

/**
 * Digital Portfolio entry — opens the websites hub directly (no Paid Features shell).
 */
export default function PaidFeaturesPage({ userId }) {
  const [openWebsite, setOpenWebsite] = useState(false);
  const websiteOn = isFlagEnabled(PORTFOLIO_FLAG);
  const trialEnabled = isFlagEnabled('ff.events-trial');
  const eventsAccess = useEventsAccess(trialEnabled && userId != null ? userId : null);
  const waitingAccess = trialEnabled && (userId == null || !eventsAccess.loaded);
  const hostLocked = trialEnabled && userId != null && eventsAccess.loaded && !eventsAccess.canUseHostTools;

  const accessBanner = trialEnabled && eventsAccess.loaded ? (
    <ReportAccessBanner
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

  return (
    <CoachWebsitePage
      userId={userId}
      onClose={typeof onClose === 'function' ? onClose : () => {}}
    />
  );
}
