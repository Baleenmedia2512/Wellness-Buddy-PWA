import React, { useState, useEffect } from 'react';
import { getUserCorrections } from '../services/foodCorrectionService';
import { X, RefreshCw, TrendingUp } from 'lucide-react';

/**
 * Debug panel to view user's food corrections
 * Only visible in development mode
 */
const FoodCorrectionsDebugPanel = ({ userId, isOpen, onClose }) => {
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load corrections
  const loadCorrections = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await getUserCorrections(userId);
      setCorrections(response.data || []);
    } catch (err) {
      console.error('Error loading corrections:', err);
      setError('Failed to load corrections');
    } finally {
      setLoading(false);
    }
  };

  // Load on mount and when userId changes
  useEffect(() => {
    if (isOpen && userId) {
      loadCorrections();
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3 md:p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm md:text-base font-semibold">Food Corrections</h2>
            <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] md:text-xs rounded font-medium">DEV MODE</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={loadCorrections}
              disabled={loading}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading && !corrections.length && (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2.5 text-red-800 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && corrections.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              <p className="text-sm">No corrections yet</p>
              <p className="text-xs mt-1.5">Edit some food names to see them here!</p>
            </div>
          )}

          {corrections.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-gray-600 mb-2 px-1">
                Total: <span className="font-semibold">{corrections.length}</span> correction{corrections.length !== 1 ? 's' : ''}
              </div>

              {corrections.map((correction) => (
                <div
                  key={correction.id}
                  className="bg-gray-50 rounded-md p-2.5 border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-red-600 line-through text-xs md:text-sm truncate">
                          {correction.ai_detected}
                        </span>
                        <span className="text-gray-400 text-xs">→</span>
                        <span className="text-green-600 font-medium text-xs md:text-sm truncate">
                          {correction.user_corrected}
                        </span>
                      </div>
                      <div className="text-[10px] md:text-xs text-gray-500">
                        {new Date(correction.last_corrected).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium whitespace-nowrap">
                      {correction.times_corrected}×
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t bg-gray-50 text-[10px] md:text-xs text-gray-600 space-y-0.5">
          <p>This panel shows all food name corrections you've made.</p>
          <p>The AI will learn from these corrections to improve future suggestions.</p>
        </div>
      </div>
    </div>
  );
};

export default FoodCorrectionsDebugPanel;
