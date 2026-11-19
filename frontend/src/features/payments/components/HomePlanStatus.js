import React from 'react';
import { Calendar, Clock, Crown } from 'lucide-react';
import usePremiumStatus from '../hooks/usePremiumStatus';
import useReportAccess from '../../reports/hooks/useReportAccess';
import { buildHomePlanStatus } from '../domain/homePlanStatus.rules';

/**
 * Membership card under the home welcome photo card.
 * Premium and an active free trial share this layout.
 */
export default function HomePlanStatus({ userId }) {
  const premium = usePremiumStatus(userId);
  const trial = useReportAccess(premium.premium ? null : userId);
  const onTrial = !premium.premium && trial.access === 'trial';
  const card = buildHomePlanStatus({
    premium: premium.premium,
    trial: onTrial,
    daysLeft: premium.premium ? premium.daysLeft : trial.daysLeft,
    expiresAtDisplay: premium.premium ? premium.expiresAtDisplay : trial.expiresAtDisplay,
  });

  if (!card) return null;

  const urgent = card.urgent === true;

  return (
    <section
      className={`relative mx-1 overflow-hidden rounded-2xl border bg-white px-3.5 py-3 shadow-md ${urgent ? 'border-red-200' : 'border-emerald-100'}`}
      role="status"
      data-testid="home-plan-status"
      data-urgent={urgent ? 'true' : 'false'}
      aria-label={card.title}
    >
      <div className={`pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full ${urgent ? 'bg-red-100/80' : 'bg-emerald-100/70'}`} aria-hidden />
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#e8b931] via-[#c9962a] to-[#8d6a12] shadow-md shadow-amber-900/25 xxs:h-10 xxs:w-10 xs:h-11 xs:w-11"
            data-testid="home-plan-crown"
          >
            <Crown
              className="h-[18px] w-[18px] text-white xs:h-5 xs:w-5"
              strokeWidth={2.25}
              aria-hidden
            />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800/80">
              Premium membership
            </p>
            <h3 className="text-[1.15rem] font-extrabold leading-tight text-gray-900">
              {card.title}
            </h3>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${urgent ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${urgent ? 'bg-red-500' : 'bg-emerald-500'}`} aria-hidden />
          {card.badge}
        </span>
      </div>

      <div className="relative mt-3 flex items-center rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
        {card.daysLabel ? (
          <div className="flex shrink-0 items-center gap-2" data-testid="home-plan-days">
            <Calendar className={`h-4 w-4 shrink-0 ${urgent ? 'text-red-600' : 'text-emerald-600'}`} aria-hidden />
            <p className={`text-[15px] font-extrabold leading-tight ${urgent ? 'text-red-700' : 'text-gray-900'}`}>{card.daysLabel}</p>
          </div>
        ) : null}
        {card.daysLabel && card.endsOn ? (
          <div className="mx-2 h-8 w-px shrink-0 bg-gray-200" aria-hidden />
        ) : null}
        {card.endsOn ? (
          <div className="flex min-w-0 flex-1 items-center gap-2" data-testid="home-plan-ends">
            <Clock className={`h-4 w-4 shrink-0 ${urgent ? 'text-red-600' : 'text-emerald-600'}`} aria-hidden />
            <div className="min-w-0">
              <p className="text-[10px] font-medium leading-none text-gray-500">Ends on</p>
              <p className={`mt-0.5 text-[12px] font-bold leading-tight ${urgent ? 'text-red-700' : 'text-gray-900'}`}>{card.endsOn}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div
        className={`relative mt-3 h-2.5 overflow-hidden rounded-full ${urgent ? 'bg-red-100' : 'bg-emerald-100'}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={card.progressPercent}
        aria-label="Time remaining"
        data-testid="home-plan-progress"
      >
        <div
          className={`h-full rounded-full ${urgent ? 'bg-red-500' : 'bg-emerald-500'}`}
          style={{ width: `${card.progressPercent}%` }}
        />
      </div>
    </section>
  );
}
