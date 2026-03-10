import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, RefreshCw, MapPin, Phone, MessageCircle } from 'lucide-react';
import TouchFeedbackButton from './TouchFeedbackButton';
import LoadingSpinner from './LoadingSpinner';

const NutritionCentersMap = ({ user, onBack }) => {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teamFilter, setTeamFilter] = useState('direct'); // 'direct' | 'full'
  const [mapLoaded, setMapLoaded] = useState(false);
  
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
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

  // Fetch nutrition centers
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

      // Info window content
      const infoContent = `
        <div style="padding: 8px; max-width: 250px;">
          <h3 style="margin: 0 0 8px 0; font-weight: bold; color: #1f2937;">${center.center_name}</h3>
          <p style="margin: 4px 0; font-size: 13px; color: #6b7280;">
            <strong>Owner:</strong> ${center.ownerName}
          </p>
          <p style="margin: 4px 0; font-size: 13px; color: #6b7280;">
            <strong>Participants:</strong> ${center.totalParticipants}
          </p>
          <p style="margin: 4px 0; font-size: 13px; color: #6b7280;">
            <strong>Today's Attendance:</strong> ${center.todayAttendance} (${center.attendancePercentage}%)
          </p>
          ${center.education_hour ? `<p style="margin: 4px 0; font-size: 13px; color: #6b7280;"><strong>Education Hour:</strong> ${center.education_hour}</p>` : ''}
          ${center.owner_phone ? `
            <div style="margin-top: 12px; display: flex; gap: 8px;">
              <a href="tel:${center.owner_phone}" style="padding: 6px 12px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; font-size: 12px; flex: 1; text-align: center;">📞 Call</a>
              <a href="https://wa.me/${center.owner_phone.replace(/[^0-9]/g, '')}" target="_blank" style="padding: 6px 12px; background: #25D366; color: white; text-decoration: none; border-radius: 6px; font-size: 12px; flex: 1; text-align: center;">💬 WhatsApp</a>
            </div>
          ` : ''}
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
              <h1 className="text-xl font-bold text-gray-800">Nutrition Centers Map</h1>
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
            
            {/* Centers List */}
            <div className="mt-4 space-y-2">
              <h2 className="text-lg font-bold text-gray-800 mb-2">
                Centers ({centers.length})
              </h2>
              {centers.length === 0 ? (
                <div className="bg-white rounded-lg p-6 text-center shadow-sm">
                  <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No nutrition centers registered yet</p>
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
                        {center.education_hour && (
                          <p className="text-xs text-gray-500 mt-1">🕐 Education Hour: {center.education_hour}</p>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          <span>👥 {center.totalParticipants} participants</span>
                          <span className={center.attendancePercentage >= 50 ? 'text-green-600 font-medium' : 'text-orange-600'}>
                            ✅ {center.todayAttendance} today ({center.attendancePercentage}%)
                          </span>
                        </div>
                      </div>

                      {center.owner_phone && (
                        <div className="flex gap-2 ml-4">
                          <a
                            href={`tel:${center.owner_phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                            title="Call"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                          <a
                            href={`https://wa.me/${center.owner_phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                            title="WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NutritionCentersMap;