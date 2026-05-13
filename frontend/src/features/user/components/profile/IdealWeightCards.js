// Read-only ideal/current weight + phase badge cards.
import React from 'react';

const Row = ({ wrapper, label, value, valueClass, sub }) => (
  <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${wrapper}`}>
    <div>
      <p className="text-xs font-semibold">{label}</p>
      {sub && <p className="text-xs opacity-70">{sub}</p>}
    </div>
    <p className={`text-base font-bold ${valueClass}`}>{value}</p>
  </div>
);

const IdealWeightCards = ({ height, latestWeight }) => {
  const h = parseFloat(height);
  if (!h || h < 50) return null;
  const m = h / 100;
  const idealMin = parseFloat((19 * m * m).toFixed(1));
  const idealMax = parseFloat((23 * m * m).toFixed(1));
  const current = latestWeight;
  const isLoss = current && current > idealMax + 0.5;
  const isGain = current && current < idealMin - 0.5;
  const display = isGain ? `${idealMin} kg` : `${idealMax} kg`;
  return (
    <>
      <Row wrapper="bg-blue-50 border border-blue-200 text-blue-600"
        label="Ideal Weight" value={display} valueClass="text-blue-700" />
      {current != null && (
        <Row wrapper="bg-gray-50 border border-gray-200 text-gray-600"
          label="⚖️ Current Weight" value={`${current.toFixed(1)} kg`} valueClass="text-gray-700" />
      )}
      {current != null && isLoss && (
        <Row wrapper="bg-red-50 border border-red-200 text-red-600"
          label="🔥 Weight Loss Phase"
          value={`−${Math.abs(current - idealMax).toFixed(1)} kg`} valueClass="text-red-500" />
      )}
      {current != null && isGain && (
        <Row wrapper="bg-orange-50 border border-orange-200 text-orange-600"
          label="🏋️ Weight Gain Phase"
          sub={`${Math.abs(current - idealMin).toFixed(1)} kg below ideal weight`}
          value={`+${Math.abs(current - idealMin).toFixed(1)} kg`} valueClass="text-orange-500" />
      )}
      {current != null && !isLoss && !isGain && (
        <Row wrapper="bg-green-50 border border-green-200 text-green-600"
          label="✅ At Ideal Weight" value="🎯" valueClass="text-green-500" />
      )}
    </>
  );
};

export default IdealWeightCards;
