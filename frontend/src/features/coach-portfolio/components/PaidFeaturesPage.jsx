import React, { useState } from 'react';
import { ArrowLeft, ChevronRight, Globe2, Sparkles } from 'lucide-react';
import { isFlagEnabled } from '../../../config/featureFlags';
import { APP_VERSION } from '../../../config/version';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import ReportAccessBanner from '../../reports/components/ReportAccessBanner';
import useEventsAccess from '../../events/hooks/useEventsAccess';
import { PORTFOLIO_FLAG, usesPortfolioSiteSlots } from '../domain/portfolio.rules';
import CoachWebsitePage from './CoachWebsitePage';

/**
 * Paid Feature hub. Digital Portfolio is one module inside.
 * Next-release builds: hub always open (pay per website). Older: trial/Premium gate.
 */
export default function PaidFeaturesPage({ userId, onClose, allowedPages = null }) {
  const [activeModule, setActiveModule] = useState(null); // null | 'digital-portfolio'
  const websiteOn = isFlagEnabled(PORTFOLIO_FLAG);
  const siteSlots = usesPortfolioSiteSlots(APP_VERSION.VERSION);
  const trialEnabled = !siteSlots && isFlagEnabled('ff.events-trial');
  const eventsAccess = useEventsAccess(
    trialEnabled && userId != null && activeModule === 'digital-portfolio' ? userId : null,
  );
  const waitingAccess = trialEnabled
    && activeModule === 'digital-portfolio'
    && (userId == null || !eventsAccess.loaded);
  const hostLocked = trialEnabled
    && activeModule === 'digital-portfolio'
    && userId != null
    && eventsAccess.loaded
    && !eventsAccess.canUseHostTools;

  const accessBanner = trialEnabled && eventsAccess.loaded && activeModule === 'digital-portfolio' ? (
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
      allowedPages={allowedPages}
      trialLengthDays={14}
      onPremiumCheck={async () => {
        const next = await eventsAccess.refresh();
        return next?.access === 'premium';
      }}
      onLeave={() => setActiveModule(null)}
    />
  ) : null;

  if (activeModule === 'digital-portfolio') {
    if (!websiteOn) {
      return (
        <div className="mx-auto max-w-lg px-4 py-6">
          <TouchFeedbackButton
            onClick={() => setActiveModule(null)}
            className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800"
            ariaLabel="Back to Paid Feature"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Paid Feature
          </TouchFeedbackButton>
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
        <CoachWebsitePage
          userId={userId}
          onClose={() => setActiveModule(null)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-5">
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100">
          <Sparkles className="h-5 w-5 text-emerald-800" aria-hidden />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Paid Feature</h1>
      </div>

      {websiteOn ? (
        <TouchFeedbackButton
          type="button"
          onClick={() => setActiveModule('digital-portfolio')}
          ariaLabel="Open Digital Portfolio"
          className="flex w-full items-center gap-3 rounded-2xl border border-emerald-100 bg-white p-4 text-left shadow-sm"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
            <Globe2 className="h-6 w-6 text-emerald-700" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Digital Portfolio</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Paid module · one page per center you own
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
        </TouchFeedbackButton>
      ) : (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No paid modules available right now.
        </p>
      )}
    </div>
  );
}
