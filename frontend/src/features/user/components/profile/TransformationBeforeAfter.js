import React, { useMemo } from 'react';
import {
  DEFAULT_TRANSFORMATION_COMPARE_TYPE,
  TRANSFORMATION_COMPARE_TYPES,
  formatTransformationRecordWeight,
  selectTransformationBeforeAfter,
} from '../../domain/transformationBeforeAfter';

const TAB_LABELS = { front: 'Front', left: 'Left', right: 'Right' };

const PhotoFrame = ({ src, alt }) => (
  src ? (
    <img
      src={src}
      alt={alt}
      className="w-full aspect-[3/4] object-cover rounded-xl border border-green-200"
    />
  ) : (
    <div className="w-full aspect-[3/4] rounded-xl border-2 border-dashed border-gray-200 bg-gray-50" />
  )
);

const WeightLine = ({ kg }) => (
  <p className="text-sm font-semibold text-gray-800 text-center">
    {kg != null ? `${kg} kg` : '—'}
  </p>
);

const TransformationBeforeAfter = ({
  history = [],
  selectedType = DEFAULT_TRANSFORMATION_COMPARE_TYPE,
  onSelectType,
}) => {
  const pair = useMemo(
    () => selectTransformationBeforeAfter(history, selectedType),
    [history, selectedType],
  );
  const beforeKg = formatTransformationRecordWeight(pair.before);
  const afterKg = formatTransformationRecordWeight(pair.after);
  const typeLabel = TAB_LABELS[selectedType];

  return (
    <div className="space-y-3 pt-2">
      <p className="text-sm font-semibold text-gray-800">Before vs After</p>
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 text-center">Before</p>
          <PhotoFrame src={pair.before?.imageUrl} alt={`Before ${typeLabel}`} />
          <WeightLine kg={beforeKg} />
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 text-center">After</p>
          <PhotoFrame src={pair.after?.imageUrl} alt={`After ${typeLabel}`} />
          <WeightLine kg={afterKg} />
        </div>
      </div>
    </div>
  );
};

export default TransformationBeforeAfter;
