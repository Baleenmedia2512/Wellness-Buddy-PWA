import React, { useMemo } from 'react';
import {
  DEFAULT_TRANSFORMATION_COMPARE_TYPE,
  TRANSFORMATION_COMPARE_TYPES,
  filterTransformationHistoryByType,
  formatTransformationRecordWeight,
} from '../../domain/transformationBeforeAfter';

const TAB_LABELS = { front: 'Front', left: 'Left', right: 'Right' };

const PhotoFrame = ({ src, alt, children = null }) => (
  <div
    className={`relative w-full aspect-[3/4] rounded-xl overflow-hidden ${
      src ? 'border border-green-200' : 'border-2 border-dashed border-gray-200 bg-gray-50'
    }`}
  >
    {src ? (
      <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-cover" />
    ) : null}
    {children ? (
      <div className={`absolute inset-0 flex items-center justify-center p-2 ${src ? 'bg-black/25' : ''}`}>
        {children}
      </div>
    ) : null}
  </div>
);

const TransformationBeforeAfter = ({
  history = [],
  selectedType = DEFAULT_TRANSFORMATION_COMPARE_TYPE,
  onSelectType,
  slotActions = null,
}) => {
  const current = useMemo(() => {
    const list = filterTransformationHistoryByType(history, selectedType);
    return list.length > 0 ? list[list.length - 1] : null;
  }, [history, selectedType]);
  const kg = formatTransformationRecordWeight(current);
  const typeLabel = TAB_LABELS[selectedType];

  return (
    <div className="space-y-3 pt-2">
      {/* <p className="text-sm font-semibold text-gray-800">Front, Left, and Right</p> */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
        {TRANSFORMATION_COMPARE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onSelectType?.(type)}
            className={`py-1.5 rounded-lg text-xs font-semibold ${
              selectedType === type
                ? 'bg-white text-green-700 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            {TAB_LABELS[type]}
          </button>
        ))}
      </div>
      <div className="max-w-sm mx-auto space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 text-center">
          {typeLabel}
        </p>
        <PhotoFrame src={current?.imageUrl} alt={typeLabel}>
          {slotActions}
        </PhotoFrame>
        <p className="text-sm font-semibold text-gray-800 text-center">
          {kg != null ? `${kg} kg` : '—'}
        </p>
      </div>
    </div>
  );
};

export default TransformationBeforeAfter;
