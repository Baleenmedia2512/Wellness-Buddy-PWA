import React from 'react';
import { X } from 'lucide-react';

/**
 * FoodBreakdownModal - Bottom sheet showing food contributions (no icons)
 */
const FoodBreakdownModal = ({
  isOpen,
  onClose,
  nutrientName,
  unit = 'g',
  totalConsumed,
  target = 0,
  foodBreakdown = [],
}) => {
  if (!isOpen) return null;

  const percentOfTarget = target > 0 ? Math.round((totalConsumed / target) * 100) : null;
  const excess = totalConsumed > target ? totalConsumed - target : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-[60]"
        onClick={onClose}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      />

      {/* Bottom Sheet */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-[61] bg-white rounded-t-3xl shadow-2xl max-h-[75vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{nutrientName}</h2>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-sm text-gray-600">
                {totalConsumed.toFixed(0)}{unit} / {target.toFixed(0)}{unit}
              </span>
              {percentOfTarget !== null && (
                <span className={`text-xs font-semibold ${percentOfTarget > 100 ? 'text-orange-600' : 'text-emerald-600'}`}>
                  {percentOfTarget}% of target
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Top Contributing Foods Header */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">Top Contributing Foods</span>
          <span className="text-xs text-gray-500">% of total {nutrientName.toLowerCase()}</span>
        </div>

        {/* Food List - Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {foodBreakdown.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No foods logged</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {foodBreakdown.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.foodName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-semibold text-gray-900 whitespace-nowrap">
                      {item.amount.toFixed(0)}{unit}
                    </span>
                    <span className="text-gray-500 w-10 text-right">
                      {item.percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Summary */}
        {target > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs">
              <div className="text-center">
                <p className="text-gray-500 mb-0.5">Target</p>
                <p className="font-semibold text-gray-900">{target.toFixed(0)}{unit}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-500 mb-0.5">Consumed</p>
                <p className="font-semibold text-emerald-600">{totalConsumed.toFixed(0)}{unit}</p>
              </div>
              {excess > 0 && (
                <div className="text-center">
                  <p className="text-gray-500 mb-0.5">Excess</p>
                  <p className="font-semibold text-orange-600">{excess.toFixed(0)}{unit}</p>
                </div>
              )}
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-2">
              Foods are sorted by their contribution to your total {nutrientName.toLowerCase()}
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

export default FoodBreakdownModal;
