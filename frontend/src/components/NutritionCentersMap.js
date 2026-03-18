import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, RefreshCw, MapPin, Eye, X } from 'lucide-react';
import TouchFeedbackButton from './TouchFeedbackButton';
import LoadingSpinner from './LoadingSpinner';
import { Capacitor } from '@capacitor/core';

const NutritionCentersMap = ({ user, onBack }) => {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teamFilter, setTeamFilter] = useState('self'); // 'self' | 'direct' | 'full' | 'all'
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showStreetView, setShowStreetView] = useState(false);
  const [streetViewLoading, setStreetViewLoading] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState(null);
  
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
      const response = await fetch(
        `${apiBaseUrl}/api/get-nutrition-centers?userId=${userId}&teamFilter=${teamFilter}&scope=${scope}`,
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
      renderMarkers(result.data || []);
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
      `${apiBaseUrl}/api/lookup-user-id?email=${encodeURIComponent(email)}`
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
  const renderMarkers = (centersData) => {
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
            <strong>Participants:</strong> ${center.totalParticipants}
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
  }, [mapLoaded, user, teamFilter]);

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
    <div className="fixed inset-0 bg-gradient-to-br from-green-50 to-blue-50 z-50 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TouchFeedbackButton
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-full"
              ariaLabel="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </TouchFeedbackButton>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Physical Club Report</h1>
              <p className="text-xs text-gray-500">View club locations & attendance</p>
            </div>
          </div>
          <TouchFeedbackButton
            onClick={fetchCenters}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-50"
            ariaLabel="Refresh"
          >
            <RefreshCw className={`h-5 w-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </TouchFeedbackButton>
        </div>

        {/* Team Filter */}
        <div className="max-w-4xl mx-auto px-4 pb-3 flex gap-2">
          <TouchFeedbackButton
            onClick={() => setTeamFilter('self')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              teamFilter === 'self'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            My Club
          </TouchFeedbackButton>
          <TouchFeedbackButton
            onClick={() => setTeamFilter('direct')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              teamFilter === 'direct'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            My Direct Team
          </TouchFeedbackButton>
          <TouchFeedbackButton
            onClick={() => setTeamFilter('full')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              teamFilter === 'full'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            My Full Team
          </TouchFeedbackButton>
          <TouchFeedbackButton
            onClick={() => setTeamFilter('all')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              teamFilter === 'all'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All System
          </TouchFeedbackButton>
        </div>
      </div>

      {/* Map Container */}
      <div className="max-w-4xl mx-auto p-4">
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
            <div
              ref={mapRef}
              className="w-full h-[500px] rounded-lg shadow-lg border border-gray-200"
            />
            
            {/* Centres List */}
            <div className="mt-4 space-y-2">
              <h2 className="text-lg font-bold text-gray-800 mb-2">
                Centres ({centers.length})
              </h2>
              {centers.length === 0 ? (
                <div className="bg-white rounded-lg p-6 text-center shadow-sm">
                  <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No nutrition centres registered yet</p>
                </div>
              ) : (
                centers.map((center) => (
                  <div
                    key={center.id}
                    onClick={() => viewCenterOnMap(center)}
                    className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-green-300 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800">{center.center_name}</h3>
                        <p className="text-sm text-gray-600 mt-1">Owner: {center.ownerName}</p>
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          <span>👥 {center.totalParticipants} participants</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <TouchFeedbackButton
                          onClick={(e) => {
                            e.stopPropagation();
                            openStreetView(center);
                          }}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                          title="Street View"
                        >
                          <Eye className="h-4 w-4" />
                        </TouchFeedbackButton>
                        {center.owner_phone && (
                          <>
                            <a
                              href={`tel:${center.owner_phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-3 bg-green-500 rounded-lg hover:bg-green-600 transition-colors shadow-sm"
                              title="Call"
                            >
                              <img src="/call-icon.png" alt="Call" className="h-5 w-5" />
                            </a>
                            <TouchFeedbackButton
                              onClick={(e) => {
                                e.stopPropagation();
                                openWhatsApp(center.owner_phone);
                              }}
                              className="p-3 bg-green-500 rounded-lg hover:bg-green-600 transition-colors shadow-sm"
                              title="WhatsApp"
                            >
                              <img src="/whatsapp-icon.png" alt="WhatsApp" className="h-5 w-5" />
                            </TouchFeedbackButton>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
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