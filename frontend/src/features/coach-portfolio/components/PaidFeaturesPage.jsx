import React, { useState } from 'react';
import { Globe2, Sparkles } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { isFlagEnabled } from '../../../config/featureFlags';
import ReportAccessBanner from '../../reports/components/ReportAccessBanner';
import useEventsAccess from '../../events/hooks/useEventsAccess';
import { PORTFOLIO_FLAG } from '../domain/portfolio.rules';
import CoachWebsitePage from './CoachWebsitePage';

/**
 * Hub for paid add-ons. Same trial/Premium gate as Create Event and Check-in:
 * 14-day free trial → Go Premium → full access after payment.
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
      <CoachWebsitePage
        userId={userId}
        onClose={() => setOpenWebsite(false)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
          <Sparkles className="h-5 w-5 text-emerald-700" aria-hidden />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Paid Features</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
          Tools you control yourself — start a free trial, then continue with Premium.
        </p>
      </div>

      {waitingAccess ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : hostLocked ? (
        <div className="flex min-h-[50vh] items-center justify-center px-2">
          {accessBanner}
        </div>
      ) : (
        <>
          {trialEnabled && eventsAccess.access === 'trial' ? accessBanner : null}

          {websiteOn ? (
            <TouchFeedbackButton
              onClick={() => setOpenWebsite(true)}
              ariaLabel="Open My Websites"
              className="w-full rounded-2xl border border-emerald-100 bg-white p-4 text-left shadow-sm hover:bg-emerald-50/60"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                  <Globe2 className="h-5 w-5 text-emerald-700" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">My Websites</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                    One website per center. Publish after your coach shares the email OTP.
                  </p>
                </div>
              </div>
            </TouchFeedbackButton>
          ) : (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Website module is not available right now.
            </p>
          )}
        </>
      )}
    </div>
  );
}
