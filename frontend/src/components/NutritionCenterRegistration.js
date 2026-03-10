import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MapPin, Clock, Phone, Save, Trash2 } from 'lucide-react';
import TouchFeedbackButton from './TouchFeedbackButton';
import LoadingSpinner from './LoadingSpinner';

const NutritionCenterRegistration = ({ user, onBack }) => {
  const [centerName, setCenterName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [myCenters, setMyCenters] = useState([]);
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [searchAddress, setSearchAddress] = useState('');
  
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markerRef = useRef(null);
  const currentLocationMarkerRef = useRef(null);
  const searchBoxRef = useRef(null);
  const autocompleteRef = useRef(null);

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

  // Load Google Maps script
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setError('Google Maps API key is missing. Please configure REACT_APP_GOOGLE_MAPS_API_KEY in your environment.');
      return;
    }

    if (!window.google || !window.google.maps) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google && window.google.maps) {
          setMapLoaded(true);
        } else {
          setError('Google Maps failed to initialize properly');
        }
      };
      script.onerror = () => {
        setError('Failed to load Google Maps. Please check your internet connection and API key.');
      };
      document.head.appendChild(script);
    } else {
      setMapLoaded(true);
    }

    return () => {
      if (markerRef.current && markerRef.current.setMap) {
        markerRef.current.setMap(null);
      }
      if (currentLocationMarkerRef.current && currentLocationMarkerRef.current.setMap) {
        currentLocationMarkerRef.current.setMap(null);
      }
    };
  }, [GOOGLE_MAPS_API_KEY]);

  // Initialize map
  useEffect(() => {
    if (mapLoaded && mapRef.current && !googleMapRef.current) {
      // Try to get user's current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            initializeMap(userLocation);
          },
          () => {
            // Default to a generic location if geolocation fails
            initializeMap({ lat: 0, lng: 0 });
          }
        );
      } else {
        initializeMap({ lat: 0, lng: 0 });
      }
    }
  }, [mapLoaded]);

  const initializeMap = (center) => {
    if (!window.google || !window.google.maps || !window.google.maps.Map) {
      setError('Google Maps API is not available. Please refresh the page.');
      return;
    }

    try {
      const map = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: center.lat === 0 ? 2 : 15,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
      });

      googleMapRef.current = map;

      // Save current location
      if (center.lat !== 0) {
        setCurrentLocation(center);
        
        // Add blue marker for current location
        const currentMarker = new window.google.maps.Marker({
          position: center,
          map: map,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          title: 'Your Current Location',
          zIndex: 1,
        });
        currentLocationMarkerRef.current = currentMarker;
      }

      // Add custom "My Location" button
      const locationButton = document.createElement('button');
      locationButton.className = 'custom-map-control-button';
      locationButton.innerHTML = `
        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">
          <circle cx=\"12\" cy=\"12\" r=\"10\"></circle>
          <circle cx=\"12\" cy=\"12\" r=\"3\"></circle>
          <line x1=\"12\" y1=\"2\" x2=\"12\" y2=\"4\"></line>
          <line x1=\"12\" y1=\"20\" x2=\"12\" y2=\"22\"></line>
          <line x1=\"2\" y1=\"12\" x2=\"4\" y2=\"12\"></line>
          <line x1=\"20\" y1=\"12\" x2=\"22\" y2=\"12\"></line>
        </svg>
      `;
      locationButton.title = 'Go to my location';
      locationButton.style.cssText = `
        background: white;
        border: none;
        border-radius: 2px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
        margin: 10px;
        padding: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      `;
      
      locationButton.addEventListener('mouseenter', () => {
        locationButton.style.background = '#f5f5f5';
      });
      
      locationButton.addEventListener('mouseleave', () => {
        locationButton.style.background = 'white';
      });
      
      locationButton.addEventListener('click', () => {
        if (currentLocation) {
          map.setCenter(currentLocation);
          map.setZoom(15);
        } else {
          // Try to get current location again
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const newLocation = {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                };
                setCurrentLocation(newLocation);
                map.setCenter(newLocation);
                map.setZoom(15);
                
                // Add/update current location marker
                if (currentLocationMarkerRef.current) {
                  currentLocationMarkerRef.current.setPosition(newLocation);
                } else {
                  const marker = new window.google.maps.Marker({
                    position: newLocation,
                    map: map,
                    icon: {
                      path: window.google.maps.SymbolPath.CIRCLE,
                      scale: 8,
                      fillColor: '#4285F4',
                      fillOpacity: 1,
                      strokeColor: '#ffffff',
                      strokeWeight: 2,
                    },
                    title: 'Your Current Location',
                    zIndex: 1,
                  });
                  currentLocationMarkerRef.current = marker;
                }
              },
              (error) => {
                alert('Unable to get your location: ' + error.message);
              }
            );
          }
        }
      });

      map.controls[window.google.maps.ControlPosition.RIGHT_BOTTOM].push(locationButton);

      // Setup Places Autocomplete
      if (searchBoxRef.current && window.google.maps.places) {
        const autocomplete = new window.google.maps.places.Autocomplete(searchBoxRef.current, {
          fields: ['geometry', 'formatted_address', 'name'],
        });
        
        autocomplete.bindTo('bounds', map);
        autocompleteRef.current = autocomplete;

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          
          if (!place.geometry || !place.geometry.location) {
            setError('No location found for: ' + place.name);
            return;
          }

          // Center map on selected place
          map.setCenter(place.geometry.location);
          map.setZoom(15);

          // Place marker at selected location
          placeMarker(place.geometry.location);

          // Update search box text
          setSearchAddress(place.formatted_address || place.name || '');
        });
      }

      // Add click listener to place marker
      map.addListener('click', (event) => {
        placeMarker(event.latLng);
      });

      // Enable location controls
      if (navigator.geolocation && center.lat !== 0) {
        map.setCenter(center);
      }
    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Failed to initialize map: ' + err.message);
    }
  };

  const placeMarker = (location) => {
    if (!window.google || !window.google.maps) return;

    // Remove existing marker
    if (markerRef.current && markerRef.current.setMap) {
      markerRef.current.setMap(null);
    }

    // Create new red marker for selected location
    const marker = new window.google.maps.Marker({
      position: location,
      map: googleMapRef.current,
      draggable: true,
      animation: window.google.maps.Animation.DROP,
      icon: {
        url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
      },
      title: 'Selected Centre Location',
      zIndex: 2,
    });

    markerRef.current = marker;

    // Update coordinates
    setLatitude(location.lat().toFixed(8));
    setLongitude(location.lng().toFixed(8));

    // Add drag listener
    marker.addListener('dragend', (event) => {
      setLatitude(event.latLng.lat().toFixed(8));
      setLongitude(event.latLng.lng().toFixed(8));
    });
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

  // Fetch user's centres
  const fetchMyCenters = async () => {
    if (!user) return;

    setLoadingCenters(true);
    try {
      const userId = await getUserId(user.email);
      const response = await fetch(
        `${apiBaseUrl}/api/get-nutrition-centers?userId=${userId}&teamFilter=direct`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        }
      );

      const result = await response.json();
      if (result.success) {
        // Filter to show only centres owned by current user
        const ownedCenters = (result.data || []).filter(
          (c) => c.owner_user_id === userId
        );
        setMyCenters(ownedCenters);
      }
    } catch (err) {
      console.error('Error fetching centres:', err);
    } finally {
      setLoadingCenters(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMyCenters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Handle form submission
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!centerName || !latitude || !longitude) {
        throw new Error('Please fill in all required fields and select a location on the map');
      }

      const userId = await getUserId(user.email);

      const response = await fetch(`${apiBaseUrl}/api/register-nutrition-center`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          centerName,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          educationHour: '09:00',
          ownerUserId: userId,
          ownerPhone: ownerPhone || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to register centre');
      }

      setSuccess('Nutrition centre registered successfully!');
      
      // Reset form
      setCenterName('');
      setLatitude('');
      setLongitude('');
      setOwnerPhone('');
      
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }

      // Refresh centres list
      fetchMyCenters();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error registering centre:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle unregister
  const handleUnregister = async (centerId) => {
    if (!window.confirm('Are you sure you want to unregister this nutrition centre?')) {
      return;
    }

    try {
      const userId = await getUserId(user.email);

      const response = await fetch(`${apiBaseUrl}/api/unregister-nutrition-center`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          centerId,
          userId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to unregister centre');
      }

      setSuccess('Centre unregistered successfully');
      fetchMyCenters();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error unregistering centre:', err);
      setError(err.message);
    }
  };

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
              <h1 className="text-xl font-bold text-gray-800">Register Nutrition Centre</h1>
              <p className="text-xs text-gray-500">Add a new club location</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-600 text-sm">{success}</p>
          </div>
        )}

        {/* Registration Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">New Centre Details</h2>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Centre Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={centerName}
                onChange={(e) => setCenterName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="e.g., Downtown Wellness Hub"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="+1-234-567-8900"
              />
            </div>

            {/* Address Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Address
              </label>
              <input
                ref={searchBoxRef}
                type="text"
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Type address to search..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Type to search or click on the map to select location
              </p>
            </div>

            {/* Map */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location <span className="text-red-500">*</span>
              </label>
              {mapLoaded ? (
                <div
                  ref={mapRef}
                  className="w-full h-80 rounded-lg border border-gray-300"
                />
              ) : (
                <div className="w-full h-80 rounded-lg border border-gray-300 flex items-center justify-center bg-gray-50">
                  <LoadingSpinner />
                </div>
              )}
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                <p>Blue dot = Your current location</p>
                <p>Red marker = Selected centre location (click map or search to place)</p>
              </div>
            </div>

            <TouchFeedbackButton
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  Registering...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Register Centre
                </>
              )}
            </TouchFeedbackButton>
          </form>
        </div>

        {/* My Centres */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">My Registered Centres</h2>
          {loadingCenters ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : myCenters.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No centres registered yet</p>
          ) : (
            <div className="space-y-3">
              {myCenters.map((center) => (
                <div
                  key={center.id}
                  className="flex items-start justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800">{center.center_name}</h3>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{center.latitude}, {center.longitude}</span>
                      </div>
                      {center.education_hour && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>{center.education_hour}</span>
                        </div>
                      )}
                      {center.owner_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          <span>{center.owner_phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <TouchFeedbackButton
                    onClick={() => handleUnregister(center.id)}
                    className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    ariaLabel="Unregister centre"
                  >
                    <Trash2 className="h-5 w-5" />
                  </TouchFeedbackButton>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NutritionCenterRegistration;
