import React from 'react';
import { Check, ChevronRight, Crown, Sparkles, UserRound } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import GoPremiumButton from '../../payments/components/GoPremiumButton';
import { requestCommunityPositionFill } from '../../user/domain/communityPositionFocus';

function daysLeftLabel(daysLeft) {
  const days = Number(daysLeft);
  if (!Number.isFinite(days) || days < 1) return '1 day left';
  return days === 1 ? '1 day left' : `${days} days left`;
}

function perksFor(featureName) {
  if (featureName === 'Digital Portfolio') {
    return ['Your coach website', 'Photos and intro video', 'A page members can open'];
  }
  return ['Ideal weight for your team', 'Nutrition and body trends', 'Wellness score in one view'];
}

function needsCommunityPosition(error) {
  return /community position/i.test(String(error || ''));
}

function PremiumMark() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg shadow-amber-900/20">
      <Crown className="h-7 w-7 text-white" aria-hidden />
    </div>
  );
}

function PositionFillCard({ featureName }) {
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_24px_50px_-24px_rgba(6,78,59,0.45)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#064e3b] via-emerald-700 to-teal-600 px-6 pb-8 pt-8 text-center text-white">
        <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white/15 ring-1 ring-inset ring-white/30">
          <UserRound className="h-7 w-7" strokeWidth={1.75} aria-hidden />
        </div>
        <p className="relative text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/90">
          {featureName}
        </p>
        <h2 className="relative mt-2 text-[1.7rem] font-semibold leading-tight tracking-tight">
          Community Position
        </h2>
      </div>
      <div className="px-6 pb-6 pt-5 text-center">
        <p className="text-[15px] leading-relaxed text-gray-600">
          Fill Community Position on your profile.
        </p>
        <TouchFeedbackButton
          onClick={requestCommunityPositionFill}
          ariaLabel="Fill Community Position"
          className="mt-5 flex w-full items-center justify-center gap-1 rounded-2xl bg-emerald-800 px-4 py-3.5 text-[15px] font-semibold text-white"
        >
          Fill Community Position
          <ChevronRight className="h-4 w-4" aria-hidden />
        </TouchFeedbackButton>
      </div>
    </div>
  );
}

/**
 * Trial and Go Premium banner (Reports / Digital Portfolio).
 * Paid members render nothing.
 */
export default function ReportAccessBanner({
  access,
  daysLeft = null,
  error = '',
  starting = false,
  onStartTrial,
  onRetry,
  userId,
  onPremiumCheck,
  centered = false,
  trialLengthDays = 14,
  allowedPages = null,
  featureName = 'Reports',
  onLeave,
}) {
  const days = Number(trialLengthDays);
  const lengthLabel = Number.isFinite(days) && days > 0 ? days : 14;
  const perks = perksFor(featureName);

  if (access === 'premium') return null;

  if (error) {
    const fillPosition = needsCommunityPosition(error);
    if (fillPosition && centered) {
      return <PositionFillCard featureName={featureName} />;
    }
    if (fillPosition) {
      return (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-white px-3 py-2.5 shadow-sm">
          <p className="text-sm font-semibold text-gray-800" role="alert">{error}</p>
          <TouchFeedbackButton
            onClick={requestCommunityPositionFill}
            ariaLabel="Fill Community Position"
            className="shrink-0 rounded-full bg-emerald-800 px-4 py-2 text-sm font-bold text-white"
          >
            Fill
          </TouchFeedbackButton>
        </div>
      );
    }
    return (
      <div className={centered
        ? 'w-full max-w-sm rounded-3xl border border-amber-100 bg-white px-6 py-8 text-center shadow-xl'
        : 'mt-3 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2'}
      >
        <p className="text-sm text-amber-950" role="alert">{error}</p>
        <TouchFeedbackButton
          onClick={onRetry}
          ariaLabel="Try again"
          className={`${centered ? 'mt-4' : ''} shrink-0 rounded-full bg-amber-700 px-4 py-2 text-xs font-bold text-white`}
        >
          Try again
        </TouchFeedbackButton>
      </div>
    );
  }

  if (access === 'trial') {
    return (
      <p className={centered
        ? 'inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950'
        : 'mt-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-950'}
      >
        <Sparkles className="h-3.5 w-3.5 text-amber-500" aria-hidden />
        {daysLeftLabel(daysLeft)}
      </p>
    );
  }

  if (access === 'ended') {
    return (
      <GoPremiumButton
        userId={userId}
        isPremium={false}
        renew
        openOnMount
        onDismiss={onLeave}
        onPremiumCheck={onPremiumCheck}
        allowedPages={allowedPages}
      />
    );
  }

  return (
    <div className={centered
      ? 'w-full max-w-sm overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-[0_24px_60px_-28px_rgba(6,78,59,0.55)]'
      : 'mt-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-white px-3 py-2 shadow-sm'}
    >
      {centered ? (
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-600 to-teal-500 px-6 pb-7 pt-8 text-center text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -left-6 bottom-0 h-20 w-20 rounded-full bg-amber-300/20" />
          <div className="relative mx-auto mb-4 w-fit">
            <PremiumMark />
          </div>
          <p className="relative text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">Premium feature</p>
          <h2 className="relative mt-2 text-2xl font-extrabold tracking-tight">{featureName}</h2>
          <p className="relative mt-2 text-sm text-emerald-50">
            Free trial for {lengthLabel} days
          </p>
        </div>
      ) : (
        <p className="text-sm font-semibold text-emerald-950">Free trial for {lengthLabel} days</p>
      )}
      {centered ? (
        <div className="px-6 pb-6 pt-5">
          <ul className="space-y-2.5">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-2.5 text-sm text-gray-700">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <Check className="h-3 w-3" aria-hidden />
                </span>
                {perk}
              </li>
            ))}
          </ul>
          <TouchFeedbackButton
            onClick={onStartTrial}
            disabled={starting}
            ariaLabel="Start free trial"
            className="mt-5 flex w-full items-center justify-center rounded-2xl bg-emerald-700 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 disabled:opacity-60"
          >
            {starting ? 'Starting' : 'Start free trial'}
          </TouchFeedbackButton>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-gray-500">
            {lengthLabel} days free. Continue with Premium whenever you are ready.
          </p>
        </div>
      ) : (
        <TouchFeedbackButton
          onClick={onStartTrial}
          disabled={starting}
          ariaLabel="Start free trial"
          className="shrink-0 rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {starting ? 'Starting' : 'Start free trial'}
        </TouchFeedbackButton>
      )}
    </div>
  );
}
