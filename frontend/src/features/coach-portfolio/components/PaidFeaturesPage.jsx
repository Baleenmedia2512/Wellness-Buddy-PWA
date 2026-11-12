import React, { useState } from 'react';
import { Globe2, Sparkles } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { isFlagEnabled } from '../../../config/featureFlags';
import { PORTFOLIO_FLAG } from '../domain/portfolio.rules';
import CoachWebsitePage from './CoachWebsitePage';

/**
 * Hub for paid add-ons. Website is self-serve per owned center (coach OTP to publish).
 */
export default function PaidFeaturesPage({ userId }) {
  const [openWebsite, setOpenWebsite] = useState(false);
  const websiteOn = isFlagEnabled(PORTFOLIO_FLAG);

  if (openWebsite && userId != null) {
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
          Tools you control yourself — update anytime. Payment options come later.
        </p>
      </div>

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
    </div>
  );
}
