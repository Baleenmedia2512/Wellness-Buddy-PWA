// src/components/WeightInsights.js
import React, { useState, useEffect } from 'react';

const WeightInsights = ({ user, apiBaseUrl, onBack }) => {
  const [weightHistory, setWeightHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);

  /**
   * Fetch weight history from backend
   */
  const fetchWeightHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const userId = user.email || user.id || user.uid;

      const response = await fetch(`${apiBaseUrl}/api/get-weight-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, limit: 50, offset: 0 })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch weight history');
      }

      setWeightHistory(data.data || []);
      setStats(data.stats || null);

    } catch (err) {
      console.error('❌ Fetch weight history error:', err);
      setError(err.message || 'Failed to load weight history');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete weight entry
   */
  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this weight entry?')) {
      return;
    }

    try {
      const userId = user.email || user.id || user.uid;

      const response = await fetch(`${apiBaseUrl}/api/delete-weight-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, entryId })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete weight entry');
      }

      // Remove from local state
      setWeightHistory(prev => prev.filter(entry => entry.ID !== entryId));
      alert('✅ Weight entry deleted successfully');

      // Refresh data
      fetchWeightHistory();

    } catch (err) {
      console.error('❌ Delete weight entry error:', err);
      alert('Failed to delete entry: ' + err.message);
    }
  };

  /**
   * Format date
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * Format weight change with color
   */
  const formatWeightChange = (change) => {
    if (!change) return null;
    
    const prefix = change > 0 ? '+' : '';
    const color = change > 0 ? 'text-red-600' : 'text-green-600';
    const icon = change > 0 ? '📈' : '📉';
    
    return (
      <span className={`${color} font-semibold`}>
        {icon} {prefix}{change.toFixed(1)} kg
      </span>
    );
  };

  // Fetch data on mount
  useEffect(() => {
    fetchWeightHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading weight history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      {/* Header */}
      <div className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-green-600 hover:text-green-700 font-medium"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back</span>
          </button>
          <h1 className="text-xl font-bold text-green-700">📊 Weight Insights</h1>
          <button
            onClick={fetchWeightHistory}
            className="text-green-600 hover:text-green-700"
            title="Refresh"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start space-x-2">
              <span className="text-red-600">⚠️</span>
              <div>
                <p className="text-red-700 font-medium">Error</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        {stats && stats.totalEntries > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Latest Weight */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Latest Weight</h3>
              <p className="text-3xl font-bold text-green-700">
                {stats.latestWeight?.value} {stats.latestWeight?.unit}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {stats.latestWeight?.date ? formatDate(stats.latestWeight.date) : 'N/A'}
              </p>
            </div>

            {/* Weight Change */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Weight Change</h3>
              <div className="text-2xl font-bold">
                {stats.weightChange !== null 
                  ? formatWeightChange(stats.weightChange)
                  : <span className="text-gray-400">No change yet</span>
                }
              </div>
              <p className="text-xs text-gray-400 mt-2">Since last entry</p>
            </div>

            {/* Average Weight */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Average Weight</h3>
              <p className="text-3xl font-bold text-purple-700">
                {stats.averageWeight?.toFixed(1)} kg
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Range: {stats.minWeight?.toFixed(1)} - {stats.maxWeight?.toFixed(1)} kg
              </p>
            </div>
          </div>
        )}

        {/* Weight History List */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            📅 Weight History ({stats?.totalEntries || 0} entries)
          </h2>

          {weightHistory.length === 0 ? (
            <div className="text-center py-12">
              <svg className="h-24 w-24 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-500 text-lg font-medium">No weight entries yet</p>
              <p className="text-gray-400 text-sm mt-2">Start tracking your weight by taking a photo of your scale!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {weightHistory.map((entry, index) => (
                <div
                  key={entry.ID}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedEntry(selectedEntry?.ID === entry.ID ? null : entry)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl font-bold text-green-700">
                          {parseFloat(entry.WeightValue).toFixed(1)} {entry.Unit}
                        </span>
                        {entry.ConfidenceScore && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            {Math.round(entry.ConfidenceScore * 100)}% confidence
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatDate(entry.CreatedAt)}
                      </p>
                      
                      {/* Show weight difference from previous entry */}
                      {index < weightHistory.length - 1 && (
                        <p className="text-xs mt-1">
                          {formatWeightChange(
                            parseFloat(entry.WeightValue) - parseFloat(weightHistory[index + 1].WeightValue)
                          )}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {entry.ImageBase64 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEntry(selectedEntry?.ID === entry.ID ? null : entry);
                          }}
                          className="text-blue-600 hover:text-blue-700"
                          title="View image"
                        >
                          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEntry(entry.ID);
                        }}
                        className="text-red-600 hover:text-red-700"
                        title="Delete entry"
                      >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {selectedEntry?.ID === entry.ID && entry.ImageBase64 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <img
                        src={entry.ImageBase64.startsWith('data:') ? entry.ImageBase64 : `data:image/jpeg;base64,${entry.ImageBase64}`}
                        alt="Weighing Scale"
                        className="w-full max-h-96 object-contain rounded-lg border border-gray-300"
                      />
                      {entry.Notes && (
                        <p className="text-sm text-gray-600 mt-3">
                          <strong>Notes:</strong> {entry.Notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weight Chart Placeholder */}
        {weightHistory.length > 1 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📈 Weight Trend</h2>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="text-center text-gray-400">
                <svg className="h-16 w-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <p className="text-sm">Chart visualization coming soon</p>
                <p className="text-xs mt-1">Track more entries to see your progress</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeightInsights;
