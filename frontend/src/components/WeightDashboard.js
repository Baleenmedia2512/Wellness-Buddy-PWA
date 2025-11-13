// src/components/WeightDashboard.js
import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  TrendingUp, 
  TrendingDown, 
  Scale,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cameraService } from '../services/cameraService';
import { weightOcrService } from '../services/weightOcrService';

/**
 * Weight Dashboard - Unified component for weight tracking and insights
 * Matches the style and layout of NutritionDashboard
 */
const WeightDashboard = ({ user, apiBaseUrl, hideHeader }) => {
  // Weight capture states
  const [capturedImage, setCapturedImage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [manualWeight, setManualWeight] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('kg');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Weight history states
  const [weightHistory, setWeightHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [viewMode, setViewMode] = useState('overview'); // 'overview', 'capture', 'history'
  
  // Date selection state
  const [selectedDate, setSelectedDate] = useState(new Date());

  /**
   * Date navigation helper
   */
  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    const today = new Date();
    if (newDate <= today) {
      setSelectedDate(newDate);
    }
  };

  /**
   * Format date header
   */
  const formatDateHeader = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  /**
   * Generate horizontal calendar dates (desktop view)
   */
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

  /**
   * Generate scrollable dates (mobile view)
   */
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

  /**
   * Check if device is mobile
   */
  const isMobileDevice = () =>
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768;

  /**
   * Get entries for selected date
   */
  const getEntriesForDate = () => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    return weightHistory.filter(entry => {
      const entryDate = new Date(entry.CreatedAt).toISOString().split('T')[0];
      return entryDate === dateStr;
    });
  };

  /**
   * Initialize OCR service and fetch data
   */
  useEffect(() => {
    weightOcrService.initialize().catch(err => {
      console.error('Failed to initialize OCR:', err);
    });
    fetchWeightHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Re-fetch when date changes
   */
  useEffect(() => {
    if (weightHistory.length > 0) {
      // Filter entries for selected date (for display)
      getEntriesForDate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

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
          const el = document.querySelector(`[data-date-index="${selectedIndex}"]`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  /**
   * Fetch weight history from backend
   */
  const fetchWeightHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const userId = user.email || user.id || user.uid;
      debugger
      const response = await fetch(`${apiBaseUrl}/api/get-weight-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, limit: 30, offset: 0 })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch weight history');
      }

      alert(setWeightHistory(data.data || []));
      setStats(data.stats || null);

    } catch (err) {
      console.error('❌ Fetch weight history error:', err);
      setError(err.message || 'Failed to load weight history');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle camera capture
   */
  const handleTakePhoto = async () => {
    try {
      setError(null);
      console.log('📸 Opening camera for weighing scale photo...');

      const result = await cameraService.takePhoto();

      if (!result.success) {
        console.log('❌ Camera capture failed:', result);
        setError(result.error || 'Failed to capture photo');
        console.log('❌ Photo capture failed:', result.error);
        return;
      }

      console.log('✅ Photo captured successfully');
      setCapturedImage(result.src);
      setViewMode('capture');

      // Automatically start OCR processing
      await processOcr(result.src, result.file);

    } catch (err) {
      console.error('❌ Camera error:', err);
      setError('Failed to access camera. Please check permissions.');
    }
  };

  /**
   * Process OCR on captured image
   */
  const processOcr = async (imageSource, imageFile) => {
    try {
      setProcessing(true);
      setError(null);

      console.log('🔍 Processing image with OCR...');

      const result = await weightOcrService.extractWeightFromImage(imageFile || imageSource);

      console.log('OCR Result:', result);

      if (result.success) {
        setOcrResult(result);
        setSelectedUnit(result.unit);
        setManualWeight(result.weightValue.toString());
      } else {
        setError('Unable to detect weight. Please enter manually.');
        setShowManualEntry(true);
      }

    } catch (err) {
      console.error('OCR processing error:', err);
      setError('OCR processing failed. Please enter weight manually.');
      setShowManualEntry(true);
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Save weight entry
   */
  const handleSaveWeight = async () => {
    try {
      setError(null);
      setIsSaving(true);

      const weightValue = manualWeight ? parseFloat(manualWeight) : ocrResult?.weightValue;

      if (!weightValue) {
        setError('Please enter a valid weight value');
        setIsSaving(false);
        return;
      }

      const validation = weightOcrService.validateWeight(weightValue, selectedUnit);
      if (!validation.valid) {
        setError(validation.error);
        setIsSaving(false);
        return;
      }

      if (!capturedImage) {
        setError('No image captured. Please take a photo first.');
        setIsSaving(false);
        return;
      }

      const userId = user.email || user.id || user.uid;

      const payload = {
        userId,
        weight: weightValue,
        bmi: null, // Optional: Can be calculated if height is available
        bodyFat: null, // Optional: From scale if available
        muscleMass: null, // Optional: From scale if available
        bmr: null, // Optional: Can be calculated
        weightImageBase64: capturedImage
      };

      console.log('💾 Saving weight entry...', { userId, weight: weightValue });

      const response = await fetch(`${apiBaseUrl}/api/save-weight-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to save weight entry');
      }

      console.log('✅ Weight entry saved successfully:', data);

      // Reset capture state
      setCapturedImage(null);
      setOcrResult(null);
      setManualWeight('');
      setShowManualEntry(false);
      setViewMode('overview');

      // Refresh weight history
      await fetchWeightHistory();

    } catch (err) {
      console.error('❌ Save weight error:', err);
      setError(err.message || 'Failed to save weight entry');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Format date
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  /**
   * Get weight change indicator
   */
  const getWeightChange = () => {
    if (!weightHistory || weightHistory.length < 2) return null;
    const latest = weightHistory[0].Weight;
    const previous = weightHistory[1].Weight;
    return (latest - previous).toFixed(1);
  };

  /**
   * Render overview mode
   */
  const renderOverview = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="backdrop-blur-xl bg-white/30 rounded-2xl md:rounded-3xl p-8 md:p-12 border border-white/30 shadow-2xl">
            <div className="animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-4 border-purple-300 border-t-purple-600 mb-4 md:mb-6 mx-auto"></div>
            <p className="text-gray-700 font-semibold text-lg md:text-xl text-center">Loading weight data...</p>
          </div>
        </div>
      );
    }

    const weightChange = getWeightChange();
    const latestWeight = weightHistory.length > 0 ? weightHistory[0] : null;
    const dailyEntries = getEntriesForDate();

    return (
      <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-6">
        {/* Horizontal Calendar Date Selector */}
        <div className="mb-4 bg-white/50 backdrop-blur-sm shadow-sm">
          {isMobileDevice() ? (
            <div className="px-4 py-3">
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <style jsx>{`div::-webkit-scrollbar{display:none;}`}</style>
                <div className="flex space-x-2 pb-1" style={{ minWidth: 'max-content' }}>
                  {generateScrollableDates().map((day, index) => (
                    <React.Fragment key={index}>
                      {day.isNewMonth && index > 0 && (
                        <div className="flex items-center justify-center mx-1 relative">
                          <div className="backdrop-blur-sm bg-white/30 rounded-lg px-1.5 py-1.5 shadow-sm border border-white/20">
                            <div
                              className="text-xs font-semibold text-gray-600"
                              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', fontSize: '9px', letterSpacing: '1px' }}
                            >
                              {day.monthName.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      )}
                      <button
                        data-date-index={index}
                        onClick={() => setSelectedDate(day.date)}
                        className={`flex-shrink-0 w-12 text-center py-2 px-1 rounded-lg transition-all duration-300 relative backdrop-blur-sm border
                          ${day.isSelected ? 'bg-gradient-to-br from-purple-400 to-indigo-500 text-white shadow-lg scale-105 border-purple-300'
                            : day.isToday ? 'bg-white/40 text-gray-800 border-white/30 shadow-md'
                            : 'text-gray-600 hover:bg-white/30 bg-white/20 border-white/20' }`}
                      >
                        <div className="text-xs font-medium mb-0.5">{day.dayName}</div>
                        <div className="text-sm font-semibold">{day.dayNumber}</div>
                        {day.isToday && (
                          <div className={`w-1 h-1 rounded-full mx-auto mt-0.5 ${day.isSelected ? 'bg-white' : 'bg-purple-500'}`} />
                        )}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center px-4 py-3 md:px-6 md:py-2">
              <button
                onClick={() => navigateDate(-1)}
                className="p-2 md:p-3 hover:bg-white/30 rounded-xl md:rounded-2xl transition-all duration-300 mr-2 md:mr-3 backdrop-blur-sm border border-white/20"
              >
                <ChevronLeft className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
              </button>

              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-center space-x-1 md:space-x-2">
                  {generateHorizontalCalendarDates().map((day, index) => (
                    <React.Fragment key={index}>
                      {day.isNewMonth && index > 0 && (
                        <div className="flex items-center justify-center mx-1 md:mx-2 relative h-full">
                          <div className="backdrop-blur-sm bg-white/30 rounded-lg md:rounded-xl px-1.5 md:px-2 py-2 md:py-3 shadow-sm border border-white/20">
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
                        className={`w-12 h-12 md:w-16 md:h-16 text-center rounded-lg md:rounded-2xl transition-all duration-300 relative backdrop-blur-sm border
                          ${day.isSelected ? 'bg-gradient-to-br from-purple-400 to-indigo-500 text-white shadow-lg scale-105 border-purple-300'
                            : day.isToday ? 'bg-white/40 text-gray-800 border-white/30 shadow-md'
                            : day.isFuture ? 'text-gray-300 cursor-not-allowed bg-white/10 border-white/10'
                            : 'text-gray-600 hover:bg-white/30 bg-white/20 border-white/20' }`}
                      >
                        <div className="text-xs font-medium mb-0.5 md:mb-1">{day.dayName}</div>
                        <div className="text-sm md:text-lg font-semibold">{day.dayNumber}</div>
                        {day.isToday && (
                          <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full mx-auto mt-0.5 md:mt-1 ${day.isSelected ? 'bg-white' : 'bg-purple-500'}`} />
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
                className="p-2 md:p-3 hover:bg-white/30 rounded-xl md:rounded-2xl transition-all duration-300 ml-2 md:ml-3 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm border border-white/20"
              >
                <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
              </button>
            </div>
          )}
        </div>

        <div className="px-4 md:px-6">
          {/* Latest Weight Card */}
          <div className="mt-5 mb-4">
          <div className="w-full max-w-md mx-auto bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-white/80">Current Weight</p>
                {latestWeight ? (
                  <>
                    <p className="text-4xl font-bold mt-1">
                      {latestWeight.Weight}
                      <span className="text-lg font-normal ml-1">kg</span>
                    </p>
                    <p className="text-xs text-white/70 mt-1">{formatDate(latestWeight.CreatedAt)}</p>
                  </>
                ) : (
                  <p className="text-2xl font-bold mt-1">No data</p>
                )}
              </div>
              <div className="flex flex-col items-end space-y-2">
                {weightChange && (
                  <div className={`flex items-center space-x-1 px-2 py-1 rounded-full ${
                    parseFloat(weightChange) > 0 
                      ? 'bg-red-500/30' 
                      : 'bg-green-500/30'
                  }`}>
                    {parseFloat(weightChange) > 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">
                      {parseFloat(weightChange) > 0 ? '+' : ''}{weightChange} kg
                    </span>
                  </div>
                )}
                <Scale className="w-8 h-8 text-white/60" />
              </div>
            </div>

            {/* Stats Row */}
            {stats && (
              <div className="flex justify-between items-center pt-4 border-t border-white/20">
                <div className="text-center">
                  <p className="text-xs text-white/70">Entries</p>
                  <p className="text-lg font-bold">{stats.totalEntries || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-white/70">Lowest</p>
                  <p className="text-lg font-bold">{stats.lowestWeight || '-'}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-white/70">Highest</p>
                  <p className="text-lg font-bold">{stats.highestWeight || '-'}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Capture Button */}
        <div className="mb-6">
          <button
            onClick={handleTakePhoto}
            className="w-full max-w-md mx-auto flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-4 px-6 rounded-xl font-semibold shadow-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-200"
          >
            <Camera className="w-5 h-5" />
            <span>Capture Weight from Scale</span>
          </button>
        </div>

        {/* Recent Weight History */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-800 px-2">
            {dailyEntries.length > 0 ? 'Entries for ' + formatDateHeader(selectedDate) : 'Recent Entries'}
          </h3>
          
          {(dailyEntries.length > 0 ? dailyEntries : weightHistory.slice(0, 10)).length === 0 ? (
            <div className="text-center py-16 px-6 backdrop-blur-xl bg-white/30 rounded-2xl shadow-lg border border-white/40">
              <div className="text-6xl mb-4">⚖️</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Weight Entries</h3>
              <p className="text-gray-600 max-w-xs mx-auto">
                Take a photo of your weighing scale to start tracking your weight.
              </p>
            </div>
          ) : (
            (dailyEntries.length > 0 ? dailyEntries : weightHistory.slice(0, 10)).map((entry, index) => {
              const displayList = dailyEntries.length > 0 ? dailyEntries : weightHistory;
              const prevEntry = displayList[index + 1];
              const change = prevEntry ? (entry.Weight - prevEntry.Weight).toFixed(1) : null;

              return (
                <div
                  key={entry.Id}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {entry.WeightImageBase64 ? (
                        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            src={entry.WeightImageBase64.startsWith('data:image') ? entry.WeightImageBase64 : `data:image/jpeg;base64,${entry.WeightImageBase64}`}
                            alt="Scale"
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Scale className="w-6 h-6 text-purple-600" />
                        </div>
                      )}
                      <div>
                        <p className="text-lg font-bold text-gray-900">
                          {entry.Weight} kg
                        </p>
                        <p className="text-xs text-gray-500">{formatDate(entry.CreatedAt)}</p>
                      </div>
                    </div>

                    {change && (
                      <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                        parseFloat(change) > 0 
                          ? 'bg-red-50 text-red-600' 
                          : 'bg-green-50 text-green-600'
                      }`}>
                        {parseFloat(change) > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        <span>{parseFloat(change) > 0 ? '+' : ''}{change}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        </div>
      </div>
    );
  };

  /**
   * Render capture mode
   */
  const renderCapture = () => {
    return (
      <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-6 px-4 md:px-6 mt-5">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          {/* Image Preview */}
          {capturedImage && (
            <div className="mb-4">
              <img
                src={capturedImage}
                alt="Weighing scale"
                className="w-full rounded-lg shadow-md"
              />
            </div>
          )}

          {/* Processing State */}
          {processing && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-300 border-t-purple-600 mx-auto mb-3"></div>
              <p className="text-gray-600 font-medium">Detecting weight...</p>
            </div>
          )}

          {/* OCR Result or Manual Entry */}
          {!processing && (
            <div className="space-y-4">
              {ocrResult && !showManualEntry && (
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-700 font-medium mb-2">✅ Weight Detected</p>
                  <p className="text-3xl font-bold text-green-800">
                    {ocrResult.weightValue} {ocrResult.unit}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Confidence: {Math.round(ocrResult.confidence * 100)}%
                  </p>
                </div>
              )}

              {(showManualEntry || !ocrResult) && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Enter Weight Manually
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      step="0.1"
                      value={manualWeight}
                      onChange={(e) => setManualWeight(e.target.value)}
                      placeholder="e.g., 72.5"
                      className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-lg"
                    />
                    <select
                      value={selectedUnit}
                      onChange={(e) => setSelectedUnit(e.target.value)}
                      className="px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                    >
                      <option value="kg">kg</option>
                      <option value="lbs">lbs</option>
                    </select>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setCapturedImage(null);
                    setOcrResult(null);
                    setManualWeight('');
                    setShowManualEntry(false);
                    setError(null);
                    setViewMode('overview');
                  }}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveWeight}
                  disabled={isSaving || (!manualWeight && !ocrResult)}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save Weight'}
                </button>
              </div>

              {!showManualEntry && ocrResult && (
                <button
                  onClick={() => setShowManualEntry(true)}
                  className="w-full text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  Edit weight manually
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Main render
  if (!hideHeader) {
    return (
      <div className="min-h-screen bg-gray-50">
        {viewMode === 'overview' && renderOverview()}
        {viewMode === 'capture' && renderCapture()}
      </div>
    );
  }

  return (
    <>
      {viewMode === 'overview' && renderOverview()}
      {viewMode === 'capture' && renderCapture()}
    </>
  );
};

export default WeightDashboard;
