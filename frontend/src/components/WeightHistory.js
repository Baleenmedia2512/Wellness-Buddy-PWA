import React, { useState, useEffect } from 'react';
import { Scale, TrendingDown, TrendingUp, Minus, Calendar, Trash2, Camera, X, ChevronLeft, ChevronRight, Activity, Heart, Zap } from 'lucide-react';
import WeightScaleCapture from './WeightScaleCapture';
import BodyCompositionForm from './BodyCompositionForm';

/**
 * WeightHistory Component
 * Displays user's weight tracking history with photos and OCR data
 */
const WeightHistory = ({ user, apiBaseUrl, onBack }) => {
  const [weightEntries, setWeightEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCompositionForm, setShowCompositionForm] = useState(false);

  /**
   * Helper functions for date selector
   */
  const isMobileDevice = () =>
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768;

  const generateScrollableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = -20; i <= 0; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const prevDate = i > -20 ? new Date(today) : null;
      if (prevDate) prevDate.setDate(today.getDate() + (i - 1));
      const isNewMonth = i === -20 || (prevDate && date.getMonth() !== prevDate.getMonth());
      dates.push({
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('en-US', { month: 'short' }),
        isToday: date.toDateString() === today.toDateString(),
        isSelected: date.toDateString() === selectedDate.toDateString(),
        isFuture: false,
        isNewMonth
      });
    }
    return dates;
  };

  const generateHorizontalCalendarDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = -3; i <= 3; i++) {
      const date = new Date(selectedDate);
      date.setDate(selectedDate.getDate() + i);
      const prevDate = i > -3 ? new Date(selectedDate) : null;
      if (prevDate) prevDate.setDate(selectedDate.getDate() + (i - 1));
      const isNewMonth = i === -3 || (prevDate && date.getMonth() !== prevDate.getMonth());
      dates.push({
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('en-US', { month: 'short' }),
        isToday: date.toDateString() === today.toDateString(),
        isSelected: date.toDateString() === selectedDate.toDateString(),
        isFuture: date > today,
        isNewMonth
      });
    }
    return dates;
  };

  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + direction);
    if (newDate <= new Date()) {
      setSelectedDate(newDate);
    }
  };

  /**
   * Auto-scroll to selected date on mobile
   */
  useEffect(() => {
    if (isMobileDevice()) {
      setTimeout(() => {
        const scrollableDates = generateScrollableDates();
        const selectedIndex = scrollableDates.findIndex(
          (d) => d.date.toDateString() === selectedDate.toDateString()
        );
        if (selectedIndex !== -1) {
          const el = document.querySelector(`[data-weight-date-index="${selectedIndex}"]`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  /**
   * Fetch weight history from API
   */
  const fetchWeightHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      // Format selected date for API query
      const dateStr = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD

      const response = await fetch(
        `${apiBaseUrl}/api/get-weight-history?userId=${user.id}&date=${dateStr}&limit=30`
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch weight history');
      }

      console.log('✅ Weight history loaded for', dateStr, ':', data.data.length, 'entries');
      
      // Filter entries for the selected date
      const filteredEntries = data.data.filter(entry => {
        const entryDate = new Date(entry.CreatedAt);
        return entryDate.toDateString() === selectedDate.toDateString();
      });
      
      setWeightEntries(filteredEntries);
      setStats(data.stats);

    } catch (err) {
      console.error('❌ Error fetching weight history:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch weight history on mount and when date changes
  useEffect(() => {
    if (user?.id) {
      fetchWeightHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedDate]);

  /**
   * Handle weight saved callback
   */
  const handleWeightSaved = (newEntry) => {
    console.log('✅ New weight entry saved:', newEntry);
    setShowCamera(false);
    // Refresh the list
    fetchWeightHistory();
  };

  /**
   * Delete weight entry
   */
  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this weight entry?')) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/delete-weight-entry`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: entryId,
          userId: user.id
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to delete entry');
      }

      console.log('✅ Weight entry deleted');
      // Refresh the list
      fetchWeightHistory();

    } catch (err) {
      console.error('❌ Error deleting entry:', err);
      alert(err.message);
    }
  };

  /**
   * Format date
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * Get trend icon
   */
  const getTrendIcon = () => {
    if (!stats || !stats.changeDirection) return <Minus className="w-5 h-5" />;

    if (stats.changeDirection === 'loss') {
      return <TrendingDown className="w-5 h-5 text-green-600" />;
    } else if (stats.changeDirection === 'gain') {
      return <TrendingUp className="w-5 h-5 text-orange-600" />;
    }
    return <Minus className="w-5 h-5 text-gray-600" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-cyan-50 pb-20">
      
      {/* Date selector */}
      <div className="bg-white shadow-sm">
        <div className="w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
          {isMobileDevice() ? (
            <div className="px-3 py-4">
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <style jsx>{`div::-webkit-scrollbar{display:none;}`}</style>
                <div className="flex space-x-2 pb-1" style={{ minWidth: 'max-content' }}>
                  {generateScrollableDates().map((day, index) => (
                    <React.Fragment key={index}>
                      {day.isNewMonth && index > 0 && (
                        <div className="flex items-center justify-center mx-1 relative">
                          <div className="bg-gray-100 rounded-lg px-2 py-1.5 shadow-sm">
                            <div
                              className="text-xs font-bold text-gray-500"
                              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', fontSize: '9px', letterSpacing: '1px' }}
                            >
                              {day.monthName.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      )}
                      <button
                        data-weight-date-index={index}
                        onClick={() => setSelectedDate(day.date)}
                        className={`flex-shrink-0 w-14 text-center py-2.5 px-2 rounded-xl transition-all duration-200 ${
                          day.isSelected 
                            ? 'bg-teal-500 text-white shadow-md scale-105' 
                            : day.isToday 
                              ? 'bg-teal-50 text-teal-700 border border-teal-200' 
                              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <div className="text-xs font-medium mb-1">{day.dayName}</div>
                        <div className="text-base font-bold">{day.dayNumber}</div>
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center px-4 py-3 md:px-6 md:py-4">
              <button
                onClick={() => navigateDate(-1)}
                className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-all duration-200 mr-2 md:mr-3"
              >
                <ChevronLeft className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
              </button>

              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-center space-x-1 md:space-x-2">
                  {generateHorizontalCalendarDates().map((day, index) => (
                    <React.Fragment key={index}>
                      {day.isNewMonth && index > 0 && (
                        <div className="flex items-center justify-center mx-1 md:mx-2 relative h-full">
                          <div className="bg-gray-100 rounded-lg md:rounded-xl px-1.5 md:px-2 py-2 md:py-3 shadow-sm">
                            <div
                              className="text-xs font-bold text-gray-600 tracking-wider"
                              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '2px' }}
                            >
                              {day.monthName.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => !day.isFuture && setSelectedDate(day.date)}
                        disabled={day.isFuture}
                        className={`w-12 h-12 md:w-14 md:h-14 text-center rounded-xl transition-all duration-200 
                          ${day.isSelected ? 'bg-teal-500 text-white shadow-md scale-105'
                            : day.isToday ? 'bg-teal-50 text-teal-700 border border-teal-200'
                            : day.isFuture ? 'text-gray-300 cursor-not-allowed bg-gray-50'
                            : 'text-gray-600 hover:bg-gray-100 bg-white' }`}
                      >
                        <div className="text-xs font-medium mb-0.5 md:mb-1">{day.dayName}</div>
                        <div className="text-sm md:text-base font-bold">{day.dayNumber}</div>
                        {day.isToday && !day.isSelected && (
                          <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-teal-500 mx-auto mt-0.5" />
                        )}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <button
                onClick={() => navigateDate(1)}
                disabled={(() => {
                  const nextDay = new Date(selectedDate);
                  nextDay.setDate(selectedDate.getDate() + 1);
                  return nextDay > new Date();
                })()}
                className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-all duration-200 ml-2 md:ml-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Add Weight Button */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3 items-end">
        {/* Body Composition Button */}
        <button
          onClick={() => setShowCompositionForm(true)}
          className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-4 py-3 rounded-full shadow-2xl hover:from-purple-600 hover:to-pink-700 transition-all duration-200 flex items-center gap-2"
          title="Full Body Composition"
        >
          <Activity className="w-5 h-5" />
          <span className="text-sm font-semibold">Full Data</span>
        </button>

        {/* Quick Weight Button */}
        <button
          onClick={() => setShowCamera(true)}
          className="bg-gradient-to-r from-blue-500 to-teal-600 text-white p-4 rounded-full shadow-2xl hover:from-blue-600 hover:to-teal-700 transition-all duration-200 flex items-center gap-2"
          title="Quick Weight Scan"
        >
          <Camera className="w-6 h-6" />
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="max-w-4xl mx-auto px-4 pt-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Current Weight */}
            <div className="bg-white rounded-xl shadow-lg p-4 border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Current Weight</p>
                <Scale className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.currentWeight} {stats.currentUnit}
              </p>
            </div>

            {/* Weight Change */}
            <div className="bg-white rounded-xl shadow-lg p-4 border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Change</p>
                {getTrendIcon()}
              </div>
              <p className={`text-2xl font-bold ${
                stats.changeDirection === 'loss' ? 'text-green-600' : 
                stats.changeDirection === 'gain' ? 'text-orange-600' : 
                'text-gray-600'
              }`}>
                {stats.weightChange > 0 ? '+' : ''}{stats.weightChange.toFixed(1)} {stats.currentUnit}
              </p>
            </div>

            {/* Total Entries */}
            <div className="bg-white rounded-xl shadow-lg p-4 border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Total Entries</p>
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalEntries}
              </p>
            </div>

          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4">
        
        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading weight history...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-600 font-semibold mb-2">Error Loading Data</p>
            <p className="text-red-500 text-sm mb-4">{error}</p>
            <button
              onClick={fetchWeightHistory}
              className="bg-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && weightEntries.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <Scale className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              {selectedDate.toDateString() === new Date().toDateString() 
                ? 'No Weight Entries Yet' 
                : 'No Entries for This Date'}
            </h3>
            <p className="text-gray-600 mb-6">
              {selectedDate.toDateString() === new Date().toDateString()
                ? 'Start tracking your weight by taking a photo of your weighing scale'
                : `No weight entries found for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </p>
            {selectedDate.toDateString() === new Date().toDateString() && (
              <button
                onClick={() => setShowCamera(true)}
                className="bg-gradient-to-r from-blue-500 to-teal-600 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:from-blue-600 hover:to-teal-700 transition-all duration-200 flex items-center justify-center gap-2 mx-auto"
              >
                <Camera className="w-5 h-5" />
                Take First Photo
              </button>
            )}
          </div>
        )}

        {/* Weight Entries List */}
        {!loading && !error && weightEntries.length > 0 && (
          <div className="space-y-4">
            {weightEntries.map((entry) => (
              <div
                key={entry.ID}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-4 border border-gray-100"
              >
                <div className="flex items-start gap-4">
                  
                  {/* Photo Thumbnail */}
                  {entry.ImageBase64 && (
                    <button
                      onClick={() => setSelectedImage(entry.ImageBase64)}
                      className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-400 transition-colors"
                    >
                      <img
                        src={entry.ImageBase64}
                        alt="Scale"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  )}

                  {/* Entry Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {entry.WeightValue} {entry.WeightUnit}
                        </p>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(entry.CreatedAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteEntry(entry.ID)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* OCR Info */}
                    {entry.OCRConfidence && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          OCR: {Math.round(entry.OCRConfidence)}% confidence
                        </span>
                      </div>
                    )}

                    {/* Notes */}
                    {entry.Notes && (
                      <p className="text-sm text-gray-600 mt-2 italic">
                        "{entry.Notes}"
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <WeightScaleCapture
          user={user}
          apiBaseUrl={apiBaseUrl}
          onWeightSaved={handleWeightSaved}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Body Composition Form Modal */}
      {showCompositionForm && (
        <BodyCompositionForm
          user={user}
          apiBaseUrl={apiBaseUrl}
          onSaved={handleWeightSaved}
          onClose={() => setShowCompositionForm(false)}
        />
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={selectedImage}
              alt="Scale preview"
              className="rounded-lg shadow-2xl max-w-full max-h-[90vh] object-contain"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 bg-white text-gray-800 p-2 rounded-full shadow-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeightHistory;
