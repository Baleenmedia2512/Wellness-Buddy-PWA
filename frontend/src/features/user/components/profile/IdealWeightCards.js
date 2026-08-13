// Read-only ideal/current weight + phase badge cards.
import React from 'react';
import { EmojiOrNative } from '../../../../shared/components/icons/EmojiImage';

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

const IdealWeightCards = ({ height, latestWeight, initialWeight, initialWeightDate }) => {
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
