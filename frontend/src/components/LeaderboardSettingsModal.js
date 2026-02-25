import React, { useState, useEffect } from 'react';
import { X, Settings, Trophy, Database, Clock } from 'lucide-react';
import TouchFeedbackButton from './TouchFeedbackButton';

/**
 * Leaderboard Settings Modal
 * Admin/Developer only panel to configure leaderboard display
 */
const LeaderboardSettingsModal = ({ isOpen, onClose, onSettingsChange }) => {
  const [topN, setTopN] = useState(3);
  const [useDemoData, setUseDemoData] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedTopN = localStorage.getItem('leaderboard_topN');
    const savedDemoData = localStorage.getItem('leaderboard_useDemoData');
    
    if (savedTopN) setTopN(parseInt(savedTopN));
    if (savedDemoData !== null) setUseDemoData(savedDemoData === 'true');
  }, []);

  // Track changes
  useEffect(() => {
    const savedTopN = localStorage.getItem('leaderboard_topN');
    const savedDemoData = localStorage.getItem('leaderboard_useDemoData');
    
    const currentTopN = savedTopN ? parseInt(savedTopN) : 3;
    const currentDemoData = savedDemoData !== null ? savedDemoData === 'true' : true;
    
    setHasChanges(topN !== currentTopN || useDemoData !== currentDemoData);
  }, [topN, useDemoData]);

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem('leaderboard_topN', topN.toString());
    localStorage.setItem('leaderboard_useDemoData', useDemoData.toString());
    
    // Notify parent component
    if (onSettingsChange) {
      onSettingsChange({ topN, useDemoData });
    }
    
    setHasChanges(false);
    
    // Reload page to apply changes
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleReset = () => {
    localStorage.removeItem('leaderboard_topN');
    localStorage.removeItem('leaderboard_useDemoData');
    setTopN(3);
    setUseDemoData(true);
    setHasChanges(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            <h2 className="text-lg font-bold">Leaderboard Settings</h2>
          </div>
          <TouchFeedbackButton
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </TouchFeedbackButton>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Top N Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-700">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <label className="font-semibold">Display Mode</label>
            </div>
            <p className="text-sm text-gray-600">
              Select how many top performers to display on the leaderboard strip
            </p>
            
            <div className="grid grid-cols-3 gap-3">
              {/* Top 1 */}
              <button
                onClick={() => setTopN(1)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  topN === 1
                    ? 'border-yellow-500 bg-yellow-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl font-bold text-gray-800">1</div>
                <div className="text-xs text-gray-600 mt-1">Testimonial</div>
                <div className="text-xs text-gray-500 mt-0.5">Scrolling</div>
              </button>

              {/* Top 3 */}
              <button
                onClick={() => setTopN(3)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  topN === 3
                    ? 'border-green-500 bg-green-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl font-bold text-gray-800">3</div>
                <div className="text-xs text-gray-600 mt-1">Auto-Slide</div>
                <div className="text-xs text-gray-500 mt-0.5">Balanced</div>
              </button>

              {/* Top 7 */}
              <button
                onClick={() => setTopN(7)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  topN === 7
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl font-bold text-gray-800">7</div>
                <div className="text-xs text-gray-600 mt-1">Extended</div>
                <div className="text-xs text-gray-500 mt-0.5">Full Board</div>
              </button>
            </div>
          </div>

          {/* Demo Data Toggle */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-700">
              <Database className="w-5 h-5 text-blue-500" />
              <label className="font-semibold">Data Source</label>
            </div>
            <p className="text-sm text-gray-600">
              Use demo data for testing or fetch real data from the database
            </p>
            
            <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-lg">
              <button
                onClick={() => setUseDemoData(!useDemoData)}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  useDemoData ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                    useDemoData ? 'translate-x-7' : ''
                  }`}
                />
              </button>
              <div className="flex-1">
                <div className="font-medium text-gray-800">
                  {useDemoData ? 'Demo Data' : 'Real Data'}
                </div>
                <div className="text-xs text-gray-500">
                  {useDemoData
                    ? 'Using sample data for testing'
                    : 'Fetch from database (requires weight records)'}
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-700">
                <strong>Preview:</strong> {topN === 1 ? 'Single card with continuous scroll' : `${topN} cards with auto-slide (10s intervals)`}
              </div>
            </div>
          </div>

          {/* Info Message */}
          {!useDemoData && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                <strong>Note:</strong> Real data requires users to have weight records for both today and yesterday with weight loss &gt; 0.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 p-4 rounded-b-2xl flex gap-3">
          <TouchFeedbackButton
            onClick={handleReset}
            className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            Reset to Default
          </TouchFeedbackButton>
          <TouchFeedbackButton
            onClick={handleSave}
            disabled={!hasChanges}
            className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
              hasChanges
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 active:from-green-800 active:to-emerald-800'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {hasChanges ? 'Save & Reload' : 'No Changes'}
          </TouchFeedbackButton>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardSettingsModal;
