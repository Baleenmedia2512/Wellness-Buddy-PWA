import React from 'react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import GoPremiumButton from '../../payments/components/GoPremiumButton';

function daysLeftLabel(daysLeft) {
  const days = Number(daysLeft);
  if (!Number.isFinite(days) || days < 1) return '1 day left';
  return days === 1 ? '1 day left' : `${days} days left`;
}

/**
 * Trial and Go Premium for the Reports header.
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
}) {
  if (error) {
    return (
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
        <p className="text-sm text-amber-950" role="alert">{error}</p>
        <TouchFeedbackButton
          onClick={onRetry}
          ariaLabel="Try again"
          className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-amber-950"
        >
          Try again
        </TouchFeedbackButton>
      </div>
    );
  }

  if (access === 'premium') return null;

  if (access === 'trial') {
    return (
      <p className="mt-3 text-sm font-semibold text-teal-800">
        {daysLeftLabel(daysLeft)}
      </p>
    );
  }

  if (access === 'ended') {
    return (
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-800">Free trial ended</p>
        <GoPremiumButton
          userId={userId}
          isPremium={false}
          onPremiumCheck={onPremiumCheck}
        />
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2">
      <p className="text-sm font-semibold text-teal-950">Free trial for 14 days</p>
      <TouchFeedbackButton
        onClick={onStartTrial}
        disabled={starting}
        ariaLabel="Start free trial"
        className="shrink-0 rounded-full bg-teal-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
      >
        {starting ? 'Starting' : 'Start free trial'}
      </TouchFeedbackButton>
    </div>
  );
}
