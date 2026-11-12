import React from 'react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import GoPremiumButton from '../../payments/components/GoPremiumButton';

function daysLeftLabel(daysLeft) {
  const days = Number(daysLeft);
  if (!Number.isFinite(days) || days < 1) return '1 day left';
  return days === 1 ? '1 day left' : `${days} days left`;
}

/**
 * Trial and Go Premium banner (Reports / Events host tools).
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
}) {
  const row = centered
    ? 'flex flex-col items-center justify-center gap-4 text-center'
    : 'mt-3 flex items-center justify-between gap-3';

  if (error) {
    return (
      <div className={`${row} ${centered ? '' : 'rounded-xl border border-amber-200 bg-amber-50 px-3 py-2'}`}>
        <p className="text-sm text-amber-950" role="alert">{error}</p>
        <TouchFeedbackButton
          onClick={onRetry}
          ariaLabel="Try again"
          className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-amber-950 border border-amber-200"
        >
          Try again
        </TouchFeedbackButton>
      </div>
    );
  }

  if (access === 'premium') return null;

  if (access === 'trial') {
    return (
      <p className={`${centered ? 'text-center' : 'mt-3'} text-sm font-semibold text-teal-800`}>
        {daysLeftLabel(daysLeft)}
      </p>
    );
  }

  if (access === 'ended') {
    return (
      <div className={row}>
        <p className="text-sm font-semibold text-gray-800">Free trial ended</p>
        <GoPremiumButton
          userId={userId}
          isPremium={false}
          onPremiumCheck={onPremiumCheck}
        />
      </div>
    );
  }

  const days = Number(trialLengthDays);
  const lengthLabel = Number.isFinite(days) && days > 0 ? days : 14;

  return (
    <div className={`${row} ${centered ? '' : 'rounded-xl border border-teal-200 bg-teal-50 px-3 py-2'}`}>
      <p className="text-sm font-semibold text-teal-950">Free trial for {lengthLabel} days</p>
      <TouchFeedbackButton
        onClick={onStartTrial}
        disabled={starting}
        ariaLabel="Start free trial"
        className="shrink-0 rounded-full bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {starting ? 'Starting' : 'Start free trial'}
      </TouchFeedbackButton>
    </div>
  );
}
