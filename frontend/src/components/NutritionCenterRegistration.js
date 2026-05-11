import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, MapPin, Clock, Phone, Save, Trash2, CheckCircle, XCircle, Loader } from 'lucide-react';
import TouchFeedbackButton from './TouchFeedbackButton';
import LoadingSpinner from './LoadingSpinner';
import CustomAlertModal from './CustomAlertModal';
import { Geolocation } from '@capacitor/geolocation';

const NutritionCenterRegistration = ({ user, onBack }) => {
  const [centerName, setCenterName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91'); // Default to India
  const [loading, setLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [myCenters, setMyCenters] = useState([]);
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [searchAddress, setSearchAddress] = useState('');
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    confirmText: 'OK',
    cancelText: null,
    onConfirm: null,
    onCancel: null,
  });
  const [centerToDelete, setCenterToDelete] = useState(null);
  const [nameAvailable, setNameAvailable] = useState(null); // null=unchecked, true=available, false=taken
  const [nameChecking, setNameChecking] = useState(false);
  const nameCheckTimerRef = useRef(null);
  
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markerRef = useRef(null);
  const currentLocationMarkerRef = useRef(null);
  const searchBoxRef = useRef(null);
  const autocompleteRef = useRef(null);

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

  // Debounced centre name availability check
  const checkNameAvailability = useCallback((name) => {
    if (nameCheckTimerRef.current) clearTimeout(nameCheckTimerRef.current);

    if (!name || name.trim().length < 2) {
      setNameAvailable(null);
      setNameChecking(false);
      return;
    }

    setNameChecking(true);
    setNameAvailable(null);

    nameCheckTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/nutrition-centers/check-name?name=${encodeURIComponent(name.trim())}`,
          { cache: 'no-store' }
        );
        const data = await response.json();
        setNameAvailable(data.available);
      } catch {
        setNameAvailable(null);
      } finally {
        setNameChecking(false);
      }
    }, 600);
  }, [apiBaseUrl]);

  const handleCenterNameChange = (value) => {
    setCenterName(value);
    checkNameAvailability(value);
  };

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
      // Try to get user's current location using Capacitor
      getUserLocation();
    }
  }, [mapLoaded]);

  const getUserLocation = async () => {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
      
      const userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      initializeMap(userLocation);
    } catch (error) {
      console.warn('Failed to get location:', error);
      // Default to generic location if geolocation fails or permission denied
      initializeMap({ lat: 0, lng: 0 });
    }
  };

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
        gestureHandling: 'greedy', // Better mobile touch handling
        clickableIcons: false, // Prevent POI clicks from interfering
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
      
      locationButton.addEventListener('click', async () => {
        if (currentLocation) {
          map.setCenter(currentLocation);
          map.setZoom(15);
        } else {
          // Try to get current location again
          try {
            const position = await Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            });
            
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
          } catch (error) {
            console.error('Failed to get location:', error);
            // Silently fail - permissions were already requested at login
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
            // User pressed Enter without selecting a suggestion - ignore silently
            return;
          }

          // Exit street view if active
          const streetView = map.getStreetView();
          if (streetView && streetView.getVisible()) {
            streetView.setVisible(false);
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

      // Add click/tap listener to place marker
      // Using 'click' event which Google Maps handles for both mouse clicks and touch taps
      map.addListener('click', (event) => {
        console.log('📍 Map clicked/tapped at:', event.latLng.lat(), event.latLng.lng());
        if (event.latLng) {
          placeMarker(event.latLng);
        }
      });

      // Center map on user location if available
      if (center.lat !== 0) {
        map.setCenter(center);
      }
    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Failed to initialize map: ' + err.message);
    }
  };

  const placeMarker = (location) => {
    if (!window.google || !window.google.maps) {
      console.error('❌ Google Maps not available');
      return;
    }

    console.log('✅ Placing marker at:', location.lat(), location.lng());

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
    const lat = location.lat().toFixed(8);
    const lng = location.lng().toFixed(8);
    setLatitude(lat);
    setLongitude(lng);
    console.log('📍 Coordinates updated:', lat, lng);

    // Add drag listener
    marker.addListener('dragend', (event) => {
      const newLat = event.latLng.lat().toFixed(8);
      const newLng = event.latLng.lng().toFixed(8);
      setLatitude(newLat);
      setLongitude(newLng);
      console.log('📍 Marker dragged to:', newLat, newLng);
    });
  };

  // Geocode address search
  const geocodeAddress = (address) => {
    if (!address || !window.google || !window.google.maps) return;

    const geocoder = new window.google.maps.Geocoder();
    
    geocoder.geocode({ address: address }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const location = results[0].geometry.location;
        
        // Exit street view if active
        if (googleMapRef.current) {
          const streetView = googleMapRef.current.getStreetView();
          if (streetView && streetView.getVisible()) {
            streetView.setVisible(false);
          }
          
          // Center map on geocoded location
          googleMapRef.current.setCenter(location);
          googleMapRef.current.setZoom(15);
        }

        // Place marker at geocoded location
        placeMarker(location);

        // Update search box with formatted address
        setSearchAddress(results[0].formatted_address);
      } else {
        setError('Location not found. Please try a different search term.');
        setTimeout(() => setError(null), 3000);
      }
    });
  };

  // Get phone number max length based on country code
  const getPhoneMaxLength = (code) => {
    const phoneLengths = {
      '+91': 10,  // India
      '+1': 10,   // USA/Canada
      '+44': 11,  // UK
      '+61': 9,   // Australia
      '+81': 10,  // Japan
      '+86': 11,  // China
      '+971': 9,  // UAE
      '+966': 9,  // Saudi Arabia
      '+65': 8,   // Singapore
      '+60': 10,  // Malaysia
    };
    return phoneLengths[code] || 15; // Default max 15 digits
  };

  // Handle phone number input (only numbers)
  const handlePhoneInput = (value) => {
    // Remove all non-digit characters
    const digitsOnly = value.replace(/\D/g, '');
    
    // Get max length for selected country
    const maxLength = getPhoneMaxLength(countryCode);
    
    // Limit to max length
    const limitedValue = digitsOnly.slice(0, maxLength);
    
    setOwnerPhone(limitedValue);
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

  // Fetch user's centres
  const fetchMyCenters = async () => {
    if (!user) return;

    setLoadingCenters(true);
    try {
      const userId = await getUserId(user.email);
      const response = await fetch(
        `${apiBaseUrl}/api/nutrition-centers?userId=${userId}&teamFilter=self`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        }
      );

      const result = await response.json();
      if (result.success) {
        // Backend handles co-coach partnership — returns clubs for both coach & co-coach
        setMyCenters(result.data || []);
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

      // Block submission if name is taken
      if (nameAvailable === false) {
        throw new Error('This centre name is already taken. Please choose a different name.');
      }

      const userId = await getUserId(user.email);

      const response = await fetch(`${apiBaseUrl}/api/nutrition-centers`, {
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
          ownerPhone: ownerPhone ? `${countryCode}${ownerPhone}` : null,
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
      setCountryCode('+91');
      setNameAvailable(null);
      setNameChecking(false);
      
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
    // Show confirmation modal
    setCenterToDelete(centerId);
    setAlertModal({
      isOpen: true,
      title: '⚠️ Delete Nutrition Centre',
      message: 'Are you sure you want to unregister this nutrition centre? This action cannot be undone.',
      type: 'warning',
      confirmText: 'Yes, Delete',
      cancelText: 'Cancel',
      onConfirm: () => confirmUnregister(centerId),
      onCancel: () => setCenterToDelete(null),
    });
  };

  // Confirm unregister after user confirmation
  const confirmUnregister = async (centerId) => {

    try {
      const userId = await getUserId(user.email);

      const response = await fetch(`${apiBaseUrl}/api/nutrition-centers/unregister`, {
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
                onChange={(e) => handleCenterNameChange(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
                  nameAvailable === false
                    ? 'border-red-400 focus:ring-red-400'
                    : nameAvailable === true
                    ? 'border-green-400 focus:ring-green-400'
                    : 'border-gray-300 focus:ring-green-500'
                }`}
                placeholder="e.g., Downtown Wellness Hub"
                required
              />
              {/* Name availability indicator */}
              <div className="mt-1 h-5 flex items-center gap-1">
                {nameChecking && (
                  <>
                    <Loader className="h-3.5 w-3.5 text-gray-400 animate-spin" />
                    <span className="text-xs text-gray-400">Checking availability...</span>
                  </>
                )}
                {!nameChecking && nameAvailable === true && (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-xs text-green-600 font-medium">Name is available</span>
                  </>
                )}
                {!nameChecking && nameAvailable === false && (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-xs text-red-600 font-medium">This name is already taken</span>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <div className="flex gap-2">
                {/* Country Code Selector */}
                <select
                  value={countryCode}
                  onChange={(e) => {
                    setCountryCode(e.target.value);
                    // Re-validate phone number with new country code
                    handlePhoneInput(ownerPhone);
                  }}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                >
                  <option value="+91">🇮🇳 +91</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+61">🇦🇺 +61</option>
                  <option value="+81">🇯🇵 +81</option>
                  <option value="+86">🇨🇳 +86</option>
                  <option value="+971">🇦🇪 +971</option>
                  <option value="+966">🇸🇦 +966</option>
                  <option value="+65">🇸🇬 +65</option>
                  <option value="+60">🇲🇾 +60</option>
                </select>
                
                {/* Phone Number Input */}
                <div className="flex-1">
                  <input
                    type="tel"
                    value={ownerPhone}
                    onChange={(e) => handlePhoneInput(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder={`Enter ${getPhoneMaxLength(countryCode)} digit number`}
                    maxLength={getPhoneMaxLength(countryCode)}
                  />
                  {ownerPhone && (
                    <p className="text-xs text-gray-500 mt-1">
                      {countryCode} {ownerPhone} ({ownerPhone.length}/{getPhoneMaxLength(countryCode)} digits)
                    </p>
                  )}
                </div>
              </div>
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
                onKeyDown={(e) => {
                  // When Enter is pressed, geocode the address
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    geocodeAddress(searchAddress);
                  }
                }}
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
                  style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
                />
              ) : (
                <div className="w-full h-80 rounded-lg border border-gray-300 flex items-center justify-center bg-gray-50">
                  <LoadingSpinner />
                </div>
              )}
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                <p>Blue dot = Your current location</p>
                <p>Red marker = Selected centre location (tap/click map or search to place)</p>
                <p className="text-blue-600 font-medium">Tip: Tap once on the map to place a marker at that location</p>
              </div>
            </div>

            <TouchFeedbackButton
              type="submit"
              disabled={loading || nameAvailable === false || nameChecking}
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
      
      {/* Custom Alert Modal */}
      <CustomAlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        confirmText={alertModal.confirmText}
        cancelText={alertModal.cancelText}
        onConfirm={alertModal.onConfirm}
        onCancel={alertModal.onCancel}
      />
    </div>
  );
};

export default NutritionCenterRegistration;
