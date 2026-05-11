import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, RefreshCw, MapPin, X, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TouchFeedbackButton from './TouchFeedbackButton';
import LoadingSpinner from './LoadingSpinner';
import { Capacitor } from '@capacitor/core';

// --- Single Day Picker ---
const SingleDayPicker = ({ selectedDate, onSelect, onClose }) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());

  const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDay = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const isFuture = (day) => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return d > new Date();
  };

  const isSelected = (day) => {
    if (!selectedDate) return false;
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return d.toDateString() === selectedDate.toDateString();
  };

  const blanks = Array(getFirstDay(currentMonth)).fill(null);
  const days = Array.from({ length: daysInMonth(currentMonth) }, (_, i) => i + 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-2 left-0 right-0 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 z-[60] max-w-sm mx-auto"
    >
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h3 className="font-semibold text-gray-800 text-sm">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {blanks.map((_, i) => <div key={`b${i}`} className="aspect-square" />)}
        {days.map(day => (
          <button
            key={day}
            onClick={() => !isFuture(day) && onSelect(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))}
            disabled={isFuture(day)}
            className={`aspect-square flex items-center justify-center text-sm rounded-lg transition-all ${
              isFuture(day) ? 'text-gray-300 cursor-not-allowed'
              : isSelected(day) ? 'bg-green-600 text-white font-bold shadow-md'
              : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            {day}
          </button>
        ))}
      </div>
    </motion.div>
  );
};

const NutritionCentersMap = ({ user, onBack }) => {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teamFilter, setTeamFilter] = useState('self'); // 'self' | 'direct' | 'full' | 'all'
  const [dateRange, setDateRange] = useState('today'); // 'today' | 'yesterday' | 'custom'
  const [customDate, setCustomDate] = useState(null); // single Date object for custom
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showStreetView, setShowStreetView] = useState(false);
  const [streetViewLoading, setStreetViewLoading] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const panoramaRef = useRef(null);
  const streetViewRef = useRef(null);
  const markersRef = useRef([]);
  const markersMapRef = useRef({}); // Map center.id to marker
  const infoWindowRef = useRef(null);

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

  // Load Google Maps script
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setError('Google Maps API key is missing. Please configure REACT_APP_GOOGLE_MAPS_API_KEY in your environment.');
      setLoading(false);
      return;
    }

    if (!window.google || !window.google.maps) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // Double-check that google.maps is available
        if (window.google && window.google.maps) {
          setMapLoaded(true);
        } else {
          setError('Google Maps failed to initialize properly');
          setLoading(false);
        }
      };
      script.onerror = () => {
        setError('Failed to load Google Maps. Please check your internet connection and API key.');
        setLoading(false);
      };
      document.head.appendChild(script);
    } else {
      setMapLoaded(true);
    }

    return () => {
      // Cleanup markers safely
      if (markersRef.current && markersRef.current.length > 0) {
        markersRef.current.forEach(marker => {
          if (marker && marker.setMap) {
            marker.setMap(null);
          }
        });
        markersRef.current = [];
      }
    };
  }, [GOOGLE_MAPS_API_KEY]);

  // Initialize map when Google Maps is loaded
  useEffect(() => {
    if (mapLoaded && mapRef.current && !googleMapRef.current) {
      // Verify Google Maps API is available
      if (!window.google || !window.google.maps || !window.google.maps.Map) {
        setError('Google Maps API is not available. Please refresh the page.');
        setLoading(false);
        return;
      }

      try {
        // Default center (will be adjusted when centers load)
        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: 0, lng: 0 },
          zoom: 2,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });

        googleMapRef.current = map;
        infoWindowRef.current = new window.google.maps.InfoWindow();
      } catch (err) {
        console.error('Error initializing map:', err);
        setError('Failed to initialize map: ' + err.message);
        setLoading(false);
      }
    }
  }, [mapLoaded]);

  // Fetch nutrition centres
  const fetchCenters = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const userId = await getUserId(user.email);
      // Use scope=all for 'all' filter to fetch all system centers globally
      const scope = teamFilter === 'all' ? 'all' : 'team';
      // Always compute dates from local timezone to avoid UTC shift issues
      const pad = n => String(n).padStart(2, '0');
      const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const now = new Date();
      const todayStr = localDate(now);
      const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yesterdayStr = localDate(yesterdayDate);

      let dateParam = dateRange;
      let startParam = '';
      let endParam = '';
      if (dateRange === 'custom' && customDate) {
        dateParam = 'custom';
        startParam = localDate(customDate);
        endParam = localDate(customDate);
      } else if (dateRange === 'yesterday') {
        startParam = yesterdayStr;
        endParam = yesterdayStr;
      } else {
        // today (default)
        startParam = todayStr;
        endParam = todayStr;
      }
      const response = await fetch(
        `${apiBaseUrl}/api/nutrition-centers?userId=${userId}&teamFilter=${teamFilter}&scope=${scope}&dateRange=${dateParam}&startDate=${startParam}&endDate=${endParam}`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch centers');
      }

      setCenters(result.data || []);
      const label = dateRange === 'yesterday' ? 'Yesterday' : dateRange === 'custom' && customDate
        ? customDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'Today';
      renderMarkers(result.data || [], label);
    } catch (err) {
      console.error('Error fetching centers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get user ID helper
  const getUserId = async (email) => {
    const response = await fetch(
      `${apiBaseUrl}/api/user/lookup?email=${encodeURIComponent(email)}`
    );
    const data = await response.json();
    if (!data.success) throw new Error('User not found');
    return data.userId;
  };

  // Open Street View for a center
  const openStreetView = (center) => {
    console.log('🗺️ Opening Street View for:', center.center_name, center);
    console.log('📍 Coordinates:', center.latitude, center.longitude);
    console.log('🔍 Google Maps available:', !!window.google?.maps);
    console.log('🔍 StreetViewPanorama available:', !!window.google?.maps?.StreetViewPanorama);
    
    if (!window.google || !window.google.maps) {
      alert('Google Maps is not loaded yet. Please wait a moment and try again.');
      return;
    }
    
    setSelectedCenter(center);
    setShowStreetView(true);
  };

  // Initialize Street View when overlay is shown
  useEffect(() => {
    if (showStreetView && selectedCenter && panoramaRef.current && window.google && window.google.maps) {
      console.log('🏗️ Initializing Street View...');
      
      const position = {
        lat: parseFloat(selectedCenter.latitude),
        lng: parseFloat(selectedCenter.longitude),
      };

      try {
        // Create Street View panorama
        const panorama = new window.google.maps.StreetViewPanorama(
          panoramaRef.current,
          {
            position: position,
            pov: { heading: 0, pitch: 0 },
            zoom: 1,
            addressControl: true,
            fullscreenControl: true,
            motionTrackingControl: false,
            enableCloseButton: false,
          }
        );

        // Add marker to show club location
        const marker = new window.google.maps.Marker({
          position: position,
          map: panorama,
          title: selectedCenter.center_name,
          label: {
            text: '📍',
            fontSize: '24px',
          },
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 15,
            fillColor: '#10b981',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
        });

        // Add info window for marker
        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 8px;">
              <h3 style="margin: 0 0 4px 0; font-weight: bold; color: #1f2937;">${selectedCenter.center_name}</h3>
              <p style="margin: 0; font-size: 12px; color: #6b7280;">Owner: ${selectedCenter.ownerName}</p>
            </div>
          `,
        });

        marker.addListener('click', () => {
          infoWindow.open(panorama, marker);
        });

        // Auto-open info window
        setTimeout(() => {
          infoWindow.open(panorama, marker);
        }, 500);

        streetViewRef.current = panorama;
        console.log('✅ Street View initialized successfully with marker');
      } catch (err) {
        console.error('❌ Error initializing Street View:', err);
      }
    }
  }, [showStreetView, selectedCenter]);

  // Close Street View
  const closeStreetView = () => {
    setShowStreetView(false);
    setSelectedCenter(null);
    streetViewRef.current = null;
  };

  // Open WhatsApp helper function
  const openWhatsApp = async (phoneNumber) => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    
    try {
      if (Capacitor.isNativePlatform()) {
        // For native Android - use custom plugin to bypass webview
        const { WhatsAppShare } = Capacitor.Plugins;
        
        if (!WhatsAppShare || typeof WhatsAppShare.openChat !== 'function') {
          console.error('WhatsAppShare plugin not available');
          return;
        }
        
        await WhatsAppShare.openChat({ phoneNumber: cleanPhone });
      } else {
        // For web/PWA, open in new tab
        window.open(`https://wa.me/${cleanPhone}`, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
    }
  };

  // View center on map - Simple function to zoom and show details
  const viewCenterOnMap = (center) => {
    if (!googleMapRef.current || !window.google || !window.google.maps) return;

    const position = {
      lat: parseFloat(center.latitude),
      lng: parseFloat(center.longitude),
    };

    // Center and zoom to the selected center
    googleMapRef.current.setCenter(position);
    googleMapRef.current.setZoom(16);

    // Find and trigger the marker's click event to show info window
    const marker = markersMapRef.current[center.id];
    if (marker) {
      window.google.maps.event.trigger(marker, 'click');
    }

    // Scroll map into view
    if (mapRef.current) {
      mapRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Render markers on map
  const renderMarkers = (centersData, dateLabel = 'Today') => {
    if (!googleMapRef.current || !window.google || !window.google.maps) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    markersRef.current = [];
    markersMapRef.current = {};

    if (centersData.length === 0) {
      // Default view if no centers
      googleMapRef.current.setCenter({ lat: 0, lng: 0 });
      googleMapRef.current.setZoom(2);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();

    centersData.forEach((center) => {
      const position = {
        lat: parseFloat(center.latitude),
        lng: parseFloat(center.longitude),
      };

      // Create marker
      const marker = new window.google.maps.Marker({
        position,
        map: googleMapRef.current,
        title: center.center_name,
        animation: window.google.maps.Animation.DROP,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: center.attendancePercentage >= 50 ? '#10b981' : '#f59e0b',
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      // Info window content with Street View button
      const infoContent = `
        <div style="padding: 8px; max-width: 250px;">
          <h3 style="margin: 0 0 8px 0; font-weight: bold; color: #1f2937;">${center.center_name}</h3>
          <p style="margin: 4px 0; font-size: 13px; color: #6b7280;">
            <strong>Owner:</strong> ${center.ownerName}
          </p>
          <p style="margin: 4px 0; font-size: 13px; color: #6b7280;">
            <strong>${dateLabel} Attendance:</strong> ${center.todayAttendance || 0}
          </p>
          <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
            <button 
              onclick="window.openStreetViewForCenter(${center.id})" 
              style="padding: 8px 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500;"
            >
              👁️ View Street View
            </button>
            ${center.owner_phone ? `
              <div style="display: flex; gap: 8px; justify-content: center;">
                <a href="tel:${center.owner_phone}" style="padding: 10px; background: #10b981; text-decoration: none; border-radius: 8px; display: flex; align-items: center; justify-content: center;" title="Call"><img src="/call-icon.png" alt="Call" style="width: 24px; height: 24px;"/></a>
                <button onclick="window.openWhatsAppForCenter('${center.owner_phone.replace(/[^0-9]/g, '')}')" style="padding: 10px; background: #25D366; border: none; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="WhatsApp"><img src="/whatsapp-icon.png" alt="WhatsApp" style="width: 24px; height: 24px;"/></button>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      marker.addListener('click', () => {
        infoWindowRef.current.setContent(infoContent);
        infoWindowRef.current.open(googleMapRef.current, marker);
      });

      markersRef.current.push(marker);
      markersMapRef.current[center.id] = marker;
      bounds.extend(position);
    });

    // Fit map to bounds
    googleMapRef.current.fitBounds(bounds);

    // Adjust zoom if only one center
    if (centersData.length === 1) {
      googleMapRef.current.setZoom(14);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (mapLoaded && user) {
      fetchCenters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, user, teamFilter, dateRange, customDate]);

  // Set up global functions for info window buttons
  useEffect(() => {
    window.openStreetViewForCenter = (centerId) => {
      const center = centers.find(c => c.id === centerId);
      if (center) {
        openStreetView(center);
        infoWindowRef.current?.close();
      }
    };

    window.openWhatsAppForCenter = (phoneNumber) => {
      openWhatsApp(phoneNumber);
      infoWindowRef.current?.close();
    };

    return () => {
      delete window.openStreetViewForCenter;
      delete window.openWhatsAppForCenter;
    };
  }, [centers]);

  return (
    <div className="fixed inset-0 z-50 overflow-auto pb-20" style={{ backgroundColor: '#e8f5e9' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 shadow-md" style={{ backgroundColor: '#a8dbb5', borderBottom: '1px solid #93c9a1' }}>

        {/* Row 1: Back + Title + Refresh */}
        <div className="max-w-4xl mx-auto px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TouchFeedbackButton
              onClick={onBack}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              ariaLabel="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-green-900" />
            </TouchFeedbackButton>
            <div>
              <h1 className="text-base font-bold text-gray-900">Physical Club Report</h1>
              <p className="text-xs text-green-900/70">View club locations & attendance</p>
            </div>
          </div>
          <TouchFeedbackButton
            onClick={fetchCenters}
            disabled={loading}
            className="p-2 hover:bg-white/20 rounded-full disabled:opacity-50 transition-colors"
            ariaLabel="Refresh"
          >
            <RefreshCw className={`h-5 w-5 text-green-900 ${loading ? 'animate-spin' : ''}`} />
          </TouchFeedbackButton>
        </div>

        {/* Row 2: Date filter pills (same as all pages) */}
        <div className="max-w-4xl mx-auto px-4 pb-2 relative">
          <div
            className="flex gap-1.5 overflow-x-auto scrollbar-hide justify-center flex-wrap"
            style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {[
              { value: 'today', label: 'Today' },
              { value: 'yesterday', label: 'Yesterday' },
            ].map((range) => (
              <TouchFeedbackButton
                key={range.value}
                onClick={() => { setDateRange(range.value); setShowDatePicker(false); }}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  dateRange === range.value
                    ? 'bg-green-700 text-white border-green-700 shadow-md'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {range.label}
              </TouchFeedbackButton>
            ))}
            <TouchFeedbackButton
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-all border flex items-center gap-1.5 ${
                dateRange === 'custom'
                  ? 'bg-green-700 text-white border-green-700 shadow-md'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateRange === 'custom' && customDate
                ? customDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'Custom'}
            </TouchFeedbackButton>
          </div>

          {/* Single-day Calendar Picker */}
          <AnimatePresence>
            {showDatePicker && (
              <SingleDayPicker
                selectedDate={customDate}
                onSelect={(date) => {
                  setCustomDate(date);
                  setDateRange('custom');
                  setShowDatePicker(false);
                }}
                onClose={() => setShowDatePicker(false)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Row 3: Team tabs — white pill segment */}
        <div className="max-w-4xl mx-auto px-4 pb-2">
          <div className="bg-white rounded-xl px-2 py-1.5 flex gap-1">
            {[['self','My Club'],['direct','Direct Team'],['full','Full Team'],['all','All']].map(([val, label]) => (
              <TouchFeedbackButton
                key={val}
                onClick={() => setTeamFilter(val)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  teamFilter === val
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-green-800 hover:bg-green-50'
                }`}
              >
                {label}
              </TouchFeedbackButton>
            ))}
          </div>
        </div>

        {/* Row 4: Search bar */}
        <div className="max-w-4xl mx-auto px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search club or owner name..."
              className="w-full pl-9 pr-9 py-2 rounded-full border border-white/60 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
            {searchQuery.length > 0 && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="max-w-4xl mx-auto p-4 pt-4">
        {loading && !mapLoaded ? (
          <div className="flex flex-col items-center justify-center h-96 bg-white rounded-lg shadow-md">
            <LoadingSpinner />
            <p className="mt-4 text-gray-600">Loading map...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <TouchFeedbackButton
              onClick={fetchCenters}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Try Again
            </TouchFeedbackButton>
          </div>
        ) : (
          <>
            {/* Map — compact by default, fullscreen overlay when expanded */}
            <div
              className={mapFullscreen
                ? 'fixed inset-0 z-[55] flex flex-col bg-black'
                : 'relative rounded-xl overflow-hidden shadow-lg border border-green-200'}
            >
              {/* Fullscreen top bar */}
              {mapFullscreen && (
                <div className="flex items-center justify-between px-4 py-3 bg-black/80 flex-shrink-0">
                  <span className="text-white font-semibold text-sm">Physical Club Map</span>
                  <TouchFeedbackButton
                    onClick={() => setMapFullscreen(false)}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-full"
                    ariaLabel="Close fullscreen map"
                  >
                    <X className="h-5 w-5 text-white" />
                  </TouchFeedbackButton>
                </div>
              )}

              {/* The actual map div — always mounted so Google Maps stays attached */}
              <div
                ref={mapRef}
                className={mapFullscreen ? 'flex-1 w-full' : 'w-full h-52'}
              />

              {/* "View Full Map" button shown only in compact mode */}
              {!mapFullscreen && (
                <TouchFeedbackButton
                  onClick={() => setMapFullscreen(true)}
                  className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 hover:bg-white rounded-full shadow text-xs font-semibold text-green-800 border border-green-200 transition-colors"
                  ariaLabel="View full map"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M16 4h4v4M4 16v4h4M16 20h4v-4" />
                  </svg>
                  View Full Map
                </TouchFeedbackButton>
              )}
            </div>
            
            {/* Centres List */}
            <div className="mt-4 space-y-2">
              {(() => {
                const q = searchQuery.trim().toLowerCase();
                const filteredCenters = q
                  ? centers.filter(c =>
                      c.center_name?.toLowerCase().includes(q) ||
                      c.ownerName?.toLowerCase().includes(q)
                    )
                  : centers;
                const totalAttendance = centers.reduce((sum, c) => sum + (c.todayAttendance || 0), 0);
                const dateLabel = dateRange === 'yesterday' ? 'Yesterday'
                  : dateRange === 'custom' && customDate
                  ? customDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'Today';
                return (
                  <>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h2 className="text-lg font-bold text-gray-800">
                        Centres ({q ? `${filteredCenters.length}/` : ''}{centers.length})
                      </h2>
                      {centers.length > 0 && (
                        <span className="text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                          {totalAttendance} attended {dateLabel}
                        </span>
                      )}
                    </div>
                    {filteredCenters.length === 0 ? (
                      <div className="bg-white rounded-lg p-6 text-center shadow-sm">
                        <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500">{centers.length === 0 ? 'No nutrition centres registered yet' : 'No clubs match your search'}</p>
                      </div>
                    ) : (
                      filteredCenters.map((center) => (
                  <div
                    key={center.id}
                    onClick={() => viewCenterOnMap(center)}
                    className="bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-all cursor-pointer overflow-hidden"
                  >
                    {/* Info */}
                    <div className="px-4 pt-4 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate text-[15px]">{center.center_name}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">{center.ownerName}</p>
                        </div>
                        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          (center.todayAttendance || 0) > 0
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-gray-50 text-gray-600 border-gray-300'
                        }`}>
                          {center.todayAttendance || 0} attended
                        </span>
                      </div>
                    </div>

                    {/* Action pills — wrapping row */}
                    <div
                      className="flex flex-wrap gap-2 px-4 pb-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Street View */}
                      <TouchFeedbackButton
                        onClick={(e) => { e.stopPropagation(); openStreetView(center); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-blue-300 bg-blue-50 active:bg-blue-100 transition-colors"
                        ariaLabel="Street View"
                      >
                        <img src="/street-view-icon.png" alt="Street View" className="h-5 w-5 object-contain" />
                        <span className="text-xs font-semibold text-blue-700">Street View</span>
                      </TouchFeedbackButton>

                      {center.owner_phone && (
                        <>
                          <a
                            href={`tel:${center.owner_phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-green-300 bg-green-50 active:bg-green-100 transition-colors"
                            aria-label="Call"
                          >
                            <img src="/call-icon.png" alt="Call" className="h-5 w-5 object-contain" />
                            <span className="text-xs font-semibold text-green-700">Call</span>
                          </a>
                          <TouchFeedbackButton
                            onClick={(e) => { e.stopPropagation(); openWhatsApp(center.owner_phone); }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-full border active:opacity-80 transition-colors"
                            style={{ backgroundColor: '#e7faf0', borderColor: '#25D366' }}
                            ariaLabel="WhatsApp"
                          >
                            <img src="/whatsapp-icon.png" alt="WhatsApp" className="h-5 w-5 object-contain" />
                            <span className="text-xs font-semibold" style={{ color: '#128C7E' }}>WhatsApp</span>
                          </TouchFeedbackButton>
                        </>
                      )}
                    </div>
                  </div>
                      ))
                    )}
                  </>
                );
              })()}
            </div>
          </>
        )}
      </div>

      {/* Street View Overlay */}
      {showStreetView && selectedCenter && (
        <div className="fixed inset-0 z-[60] bg-black">
          <div className="absolute top-0 left-0 right-0 z-10 bg-black bg-opacity-75 p-4 flex items-center justify-between">
            <div>
              <h2 className="text-white text-lg font-bold">{selectedCenter.center_name}</h2>
              <p className="text-white text-sm opacity-75">Street View - {selectedCenter.ownerName}</p>
            </div>
            <TouchFeedbackButton
              onClick={closeStreetView}
              className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg text-white"
              ariaLabel="Close Street View"
            >
              <X className="h-6 w-6" />
            </TouchFeedbackButton>
          </div>
          <div
            ref={panoramaRef}
            className="w-full h-full"
          />
        </div>
      )}
    </div>
  );
};

export default NutritionCentersMap;