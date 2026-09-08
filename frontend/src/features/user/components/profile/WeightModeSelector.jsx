// Auto-derived weight goal mode — read-only display (not user-switchable).
import React, { useMemo } from 'react';
import { deriveWeightGoalMode } from '../../../weight/services/weightFormService';
import { EmojiOrNative } from '../../../../shared/components/icons/EmojiImage';
import BathroomScaleIcon from '../../../../shared/components/icons/BathroomScaleIcon';

const MODE_META = {
  loss: {
    pill: 'bg-red-500',
    wrap: 'bg-red-100',
    icon: <EmojiOrNative emoji="🔥" className="w-4 h-4" nativeClassName="text-sm leading-none" />,
    label: 'Loss Mode',
    hint: 'App will alert you when weight increases unexpectedly.',
  },
  gain: {
    pill: 'bg-blue-500',
    wrap: 'bg-blue-100',
    icon: <EmojiOrNative emoji="💪" className="w-4 h-4" nativeClassName="text-sm leading-none" />,
    label: 'Gain Mode',
    hint: 'App will alert you when weight decreases unexpectedly.',
  },
  maintain: {
    pill: 'bg-green-500',
    wrap: 'bg-green-100',
    // Same weighing-scale asset as Manual Log (`/scale.png`).
    icon: <BathroomScaleIcon className="w-4 h-4" alt="" />,
    label: 'Maintain',
    hint: 'You are within your ideal weight range.',
  },
};

const WeightModeSelector = ({ height, currentWeight, fallbackMode = 'loss' }) => {
  const derivedMode = useMemo(
    () => deriveWeightGoalMode({ heightCm: height, currentWeightKg: currentWeight }),
    [height, currentWeight],
  );
  const mode = derivedMode || fallbackMode;
  const meta = MODE_META[mode] || MODE_META.loss;
  const isAuto = derivedMode != null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-700">Weight Goal Mode</p>

      <div
        className={`flex items-center justify-center gap-2 h-12 rounded-full px-4 ${meta.wrap}`}
        aria-live="polite"
      >
        <span
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white shadow-md ${meta.pill}`}
        >
          {meta.icon}
          <span>{meta.label}</span>
        </span>
      </div>

      <p className="text-xs text-gray-400">
        {isAuto
          ? `Set automatically from your current weight vs ideal (BMI 19–23). ${meta.hint}`
          : 'Log your weight to detect your goal mode automatically.'}
      </p>
    </div>
  );
};

export default WeightModeSelector;
