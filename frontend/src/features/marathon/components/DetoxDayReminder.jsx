/**
 * Home-hero banner for marathon reminders near Take Photo / Gallery:
 * eve of Day 0, and Days 3 / 8 (eve of Detox Days).
 * Calendar rules live in domain/marathonCalendar.js.
 * Detox copy is a link that opens the Turbo Shake recipe.
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';
import { useBusinessToday } from '../../../shared/hooks/useBusinessToday';
import storage from '../../../shared/lib/storage';
import {
  getDetoxReminder,
  resolveMarathonToday,
  MARATHON_TEST_DATE_STORAGE_KEY,
} from '../domain/marathonCalendar';
import { resolveMarathonTimezoneSource } from '../withMarathonWhatsAppNotice';

const TURBO_SHAKE_INGREDIENTS = [
  'Herbalife Formula 1 : 2 scoop',
  'Herbalife Personalized Protein Powder : 2 scoop',
  'Optional : aloe drink, probiotic or fiber',
  'Herbalife Afresh : 4 scoop',
  'Water : 1 ltr',
];

const TURBO_SHAKE_METHOD = [
  'In your Mixie - Juice jar first pour 100ml water then add formula 1, protein and if u have add aloe drink, probiotic and fiber( if u dont have skip it).',
  'Run ur mixie for 15 to 20 seconds.',
  'Mix all the above in remaining 900ml water alongwith 4 scoop afresh.',
  'Shake the bottle.',
];

const TURBO_SHAKE_BENEFITS = [
  'Whole day you feel energetic and active',
  'Toxin is removed from your body which is formed daily.',
];

function TurboShakeRecipePopup({ onClose }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex w-full max-w-[100vw] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-3xl"
        style={{
          maxHeight: 'min(88dvh, 100%)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="turbo-shake-recipe-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-amber-100 px-3 py-2.5 xs:gap-3 xs:px-4 xs:py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 xs:text-[11px]">
              Detox Day Drink Recipe
            </p>
            <h2 id="turbo-shake-recipe-title" className="break-words text-[15px] font-bold leading-snug text-amber-950 xs:text-base">
              Turbo Shake Ingredients:
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-amber-50"
            aria-label="Close recipe"
          >
            <X className="h-5 w-5 text-amber-800/70" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-3 py-3 text-[13px] leading-snug text-gray-800 xs:px-4 xs:text-sm xs:leading-relaxed">
          <ul className="space-y-1 break-words">
            {TURBO_SHAKE_INGREDIENTS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          <p className="mt-4 font-bold text-amber-950">Method:</p>
          <ol className="mt-1 list-decimal space-y-2 break-words pl-5">
            {TURBO_SHAKE_METHOD.map((step) => (
              <li key={step} className="pl-1">{step}</li>
            ))}
          </ol>

          <p className="mt-4 break-words">
            Now your Powerful energy booster Turbo Shake is ready to drink.
          </p>
          <p className="mt-3 break-words">
            <span className="font-bold text-amber-950">Time to take on Detox day: </span>
            4: 30pm to 6 pm
          </p>
          <p className="mt-3 break-words">
            <span className="font-bold text-amber-950">Method to drink: </span>
            Sip by sip you have to taste this drink.
          </p>

          <p className="mt-4 font-bold text-amber-950">Benefits:</p>
          <ol className="mt-1 list-decimal space-y-1 break-words pl-5">
            {TURBO_SHAKE_BENEFITS.map((line) => (
              <li key={line} className="pl-1">{line}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * @param {object} props
 * @param {string} [props.today] YYYY-MM-DD override (tests). Defaults to the
 *   signed-in user's business date (Qatar / USA / India) or
 *   `localStorage.marathon.testDate` when set for QA.
 * @param {object|null} [props.user] Signed-in user (`timezone` / `timezoneIana`).
 */
export default function DetoxDayReminder({ today: todayOverride, user = null } = {}) {
  const timezoneSource = resolveMarathonTimezoneSource(user);
  const liveToday = useBusinessToday(timezoneSource);
  const today = resolveMarathonToday(
    liveToday,
    todayOverride || storage.get(MARATHON_TEST_DATE_STORAGE_KEY),
  );
  const reminder = getDetoxReminder(today);
  const [recipeOpen, setRecipeOpen] = useState(false);
  if (!reminder) return null;

  const isDetoxRecipe = reminder.kind === 'detox';

  return (
    <>
      <div
        className="mt-2 flex w-full min-w-0 max-w-full items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 xs:mt-3 xs:gap-2.5 xs:px-3 xs:py-2.5"
        role="status"
        aria-live="polite"
        data-testid="detox-day-reminder"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 xs:h-8 xs:w-8">
          <Bell className="h-3.5 w-3.5 xs:h-4 xs:w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words text-[13px] font-bold leading-snug text-amber-900 xs:text-sm">{reminder.title}</p>
          {isDetoxRecipe ? (
            <button
              type="button"
              onClick={() => setRecipeOpen(true)}
              className="mt-0.5 block w-full min-w-0 break-words rounded-lg py-1.5 text-left text-[13px] font-semibold leading-snug text-amber-950 underline decoration-amber-800/70 underline-offset-2 xs:text-xs"
            >
              {reminder.subtitle}
            </button>
          ) : (
            <p className="mt-0.5 break-words text-[13px] leading-snug text-amber-800/90 xs:text-xs">{reminder.subtitle}</p>
          )}
        </div>
      </div>
      {recipeOpen && isDetoxRecipe ? (
        <TurboShakeRecipePopup onClose={() => setRecipeOpen(false)} />
      ) : null}
    </>
  );
}
