// Read-only ideal/current weight + phase badge cards.
import React from 'react';
import { EmojiOrNative } from '../../../../shared/components/icons/EmojiImage';
import {
  formatMarathonWeightDisplayValue,
  isValidMarathonWeightKg,
  resolveMarathonWeightDirection,
} from '../../../marathon/domain/marathonWeightComparison';

const Row = ({ wrapper, label, labelIcon, value, valueClass, sub }) => (
  <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${wrapper}`}>
    <div className="flex items-center gap-2 min-w-0">
      {labelIcon}
      <div>
        <p className="text-xs font-semibold">{label}</p>
        {sub && <p className="text-xs opacity-70">{sub}</p>}
      </div>
    </div>
    <div className={`text-base font-bold flex-shrink-0 ${valueClass}`}>{value}</div>
  </div>
);

function formatInitialWeightDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

function MarathonCrossMarathonWeightProgress({ comparison, title = 'Marathon Weight' }) {
  if (!comparison) return null;

  const hasPrevious = isValidMarathonWeightKg(comparison.previousMarathonEndWeight);
  const hasCurrent = isValidMarathonWeightKg(comparison.currentWeight);
  if (!comparison.partial && !hasPrevious && !hasCurrent) return null;

  let direction = null;
  if (hasPrevious && hasCurrent) {
    direction = comparison.direction
      || resolveMarathonWeightDirection(
        comparison.previousMarathonEndWeight,
        comparison.currentWeight,
      );
  }

  return (
    <div className="space-y-2" data-testid="marathon-cross-marathon-weight-progress">
      <p className="text-xs font-semibold text-gray-500 px-1">{title}</p>
      <Row
        wrapper="bg-indigo-50 border border-indigo-200 text-indigo-600"
        label="Previous Marathon End"
        labelIcon={<EmojiOrNative emoji="🏁" className="w-4 h-4" nativeClassName="text-sm" />}
        value={formatMarathonWeightDisplayValue(comparison.previousMarathonEndWeight)}
        valueClass="text-indigo-700"
      />
      <Row
        wrapper="bg-violet-50 border border-violet-200 text-violet-600"
        label="Current Weight"
        labelIcon={<EmojiOrNative emoji="⚖️" className="w-4 h-4" nativeClassName="text-sm" />}
        value={formatMarathonWeightDisplayValue(comparison.currentWeight, {
          withDirection: true,
          direction,
        })}
        valueClass="text-violet-700"
      />
    </div>
  );
}

function MarathonGapWeightProgress({ comparison }) {
  if (!comparison || comparison.mode !== 'gap') return null;
  return <MarathonCrossMarathonWeightProgress comparison={comparison} />;
}

function MarathonDaysProgress({ comparison }) {
  if (!comparison || comparison.mode !== 'running' || !Array.isArray(comparison.days)) {
    return null;
  }

  return (
    <div className="space-y-2" data-testid="marathon-days-progress">
      <p className="text-xs font-semibold text-gray-500 px-1">Marathon Days</p>
      {comparison.days.map((entry) => (
        <div
          key={`marathon-day-${entry.day}`}
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700"
        >
          <p className="text-xs font-semibold">Day {entry.day}</p>
          <p className="text-base font-bold mt-1">{entry.displayLine}</p>
        </div>
      ))}
    </div>
  );
}

function MarathonWeightProgress({ comparison }) {
  if (!comparison) return null;
  if (comparison.mode === 'running') {
    const showCrossMarathon = comparison.marathonDay === 0;
    return (
      <>
        {showCrossMarathon && (
          <MarathonCrossMarathonWeightProgress comparison={comparison} />
        )}
        <MarathonDaysProgress comparison={comparison} />
      </>
    );
  }
  if (comparison.mode === 'gap') {
    return <MarathonGapWeightProgress comparison={comparison} />;
  }
  return null;
}

const IdealWeightCards = ({
  height,
  latestWeight,
  initialWeight,
  initialWeightDate,
  marathonWeightComparison = null,
}) => {
  const h = parseFloat(height);
  if (!h || h < 50) return null;
  const m = h / 100;
  const idealMin = parseFloat((19 * m * m).toFixed(1));
  const idealMax = parseFloat((23 * m * m).toFixed(1));
  const current = latestWeight;
  const initial = initialWeight != null && Number.isFinite(Number(initialWeight))
    ? Number(initialWeight)
    : null;
  const initialDateLabel = formatInitialWeightDate(initialWeightDate);
  const isLoss = current && current > idealMax + 0.5;
  const isGain = current && current < idealMin - 0.5;
  const display = isGain ? `${idealMin} kg` : `${idealMax} kg`;

  return (
    <>
      <Row wrapper="bg-blue-50 border border-blue-200 text-blue-600"
        label="Ideal Weight" value={display} valueClass="text-blue-700" />
      {initial != null && (
        <Row wrapper="bg-slate-50 border border-slate-200 text-slate-600"
          label="Initial Weight"
          labelIcon={<EmojiOrNative emoji="🏁" className="w-4 h-4" nativeClassName="text-sm" />}
          sub={initialDateLabel || undefined}
          value={`${initial.toFixed(1)} kg`} valueClass="text-slate-700" />
      )}
      {current != null && (
        <Row wrapper="bg-gray-50 border border-gray-200 text-gray-600"
          label="Current Weight"
          labelIcon={<EmojiOrNative emoji="⚖️" className="w-4 h-4" nativeClassName="text-sm" />}
          value={`${current.toFixed(1)} kg`} valueClass="text-gray-700" />
      )}
      <MarathonWeightProgress comparison={marathonWeightComparison} />
      {current != null && isLoss && (
        <Row wrapper="bg-red-50 border border-red-200 text-red-600"
          label="Weight Loss Phase"
          labelIcon={<EmojiOrNative emoji="🔥" className="w-4 h-4" nativeClassName="text-sm" />}
          sub={`${Math.abs(current - idealMax).toFixed(1)} kg above ideal weight`}
          value={`−${Math.abs(current - idealMax).toFixed(1)} kg`} valueClass="text-red-500" />
      )}
      {current != null && isGain && (
        <Row wrapper="bg-orange-50 border border-orange-200 text-orange-600"
          label="Weight Gain Phase"
          labelIcon={<EmojiOrNative emoji="🏋️" className="w-4 h-4" nativeClassName="text-sm" />}
          sub={`${Math.abs(current - idealMin).toFixed(1)} kg below ideal weight`}
          value={`+${Math.abs(current - idealMin).toFixed(1)} kg`} valueClass="text-orange-500" />
      )}
      {current != null && !isLoss && !isGain && (
        <Row wrapper="bg-green-50 border border-green-200 text-green-600"
          label="At Ideal Weight"
          labelIcon={<EmojiOrNative emoji="✅" className="w-4 h-4" nativeClassName="text-sm" />}
          sub="You are within the healthy BMI range (19–23)"
          value={<EmojiOrNative emoji="🎯" className="w-5 h-5" nativeClassName="text-base" />}
          valueClass="text-green-500" />
      )}
    </>
  );
};

export default IdealWeightCards;
