import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, MapPin, Clock, Phone, Save, Trash2, CheckCircle, XCircle, Loader, X } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import CustomAlertModal from '../../../shared/components/CustomAlertModal';
import PhoneContactActions from '../../../shared/components/PhoneContactActions.jsx';
import { Geolocation } from '@capacitor/geolocation';
import { debugLog } from '../../../shared/utils/logger.js';
import { loadGoogleMaps } from '../services/googleMapsLoader';
import { getUserId } from '../../../shared/services/userIdentity';
import { accountPhoneFromUser, phonesMatch, splitOwnerPhone } from '../domain/ownerPhone.js';
import { cardAreaCity, formatAreaCity } from '../domain/placeAreaCity.js';
import { geocodeAreaCity } from '../services/geocodeAreaCity.js';
import {
  centreCodeBody,
  centreCodeError,
  centreCodeFromSuffix,
  centrePhotosError,
  centrePhotosForApi,
  centrePhotosFromApi,
  emptyCentrePhotos,
} from '../domain/centreProfile.rules.js';
import CentrePhotoSlots from './CentrePhotoSlots';
import CentreListingFields from './CentreListingFields';
import { centreListingError, defaultOpeningHours, seatingCountError } from '../domain/centreListing.rules.js';
import { apiFetch } from '../../../shared/services/apiFetch.js';

const NutritionCenterRegistration = ({ user, onBack, onSaved, initialCenter, forceComplete = false }) => {
  const [centerName, setCenterName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [resolvedPlaces, setResolvedPlaces] = useState({});
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
  const [editingCenter, setEditingCenter] = useState(null); // set when opened from Physical Club Report
  const [nameAvailable, setNameAvailable] = useState(null); // null=unchecked, true=available, false=taken
  const [nameChecking, setNameChecking] = useState(false);
  const [centreCodeSuffix, setCentreCodeSuffix] = useState('');
  const [centrePhotos, setCentrePhotos] = useState(emptyCentrePhotos);
  const [openingHours, setOpeningHours] = useState(defaultOpeningHours);
  const [facilities, setFacilities] = useState([]);
  const [seatingCount, setSeatingCount] = useState('');
  const [approvalSent, setApprovalSent] = useState(false);
  const [coachName, setCoachName] = useState('');
  const [coachOtp, setCoachOtp] = useState('');
  const [coachApproved, setCoachApproved] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpVerified, setPhoneOtpVerified] = useState(false);
  const [phoneOtpLoading, setPhoneOtpLoading] = useState(false);
  const [photosLoading, setPhotosLoading] = useState(false);
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

  const handleCentreCodeChange = (value) => {
    setCentreCodeSuffix(centreCodeBody(value).slice(0, 16));
  };

  const centreProfilePayload = () => {
    const codeError = centreCodeError(centreCodeSuffix);
    if (codeError) throw new Error(codeError);
    const photoError = centrePhotosError(centrePhotos);
    if (photoError) throw new Error(photoError);
    const listingError = centreListingError(openingHours, facilities);
    if (listingError) throw new Error(listingError);
    const seatError = seatingCountError(seatingCount);
    if (seatError) throw new Error(seatError);
    return {
      centerCode: centreCodeFromSuffix(centreCodeSuffix),
      photos: centrePhotosForApi(centrePhotos),
      openingHours,
      facilities,
      seatingCount: String(seatingCount).trim() === '' ? null : Number(seatingCount),
    };
  };

  // Load Google Maps script
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setError('Google Maps API key is missing. Please configure REACT_APP_GOOGLE_MAPS_API_KEY in your environment.');
      return;
    }

    loadGoogleMaps(GOOGLE_MAPS_API_KEY)
      .then(() => setMapLoaded(true))
      .catch((err) => setError(err.message));

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
          fields: ['geometry', 'formatted_address', 'name', 'address_components'],
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
        debugLog('ðŸ“ Map clicked/tapped at:', event.latLng.lat(), event.latLng.lng());
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
      console.error('âŒ Google Maps not available');
      return;
    }

    debugLog('✅ Placing marker at:', location.lat(), location.lng());

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
    geocodeAreaCity(lat, lng).then((place) => {
      if (place.area || place.city) {
        setArea(place.area);
        setCity(place.city);
      }
    });
    debugLog('ðŸ“ Coordinates updated:', lat, lng);

    // Add drag listener
    marker.addListener('dragend', (event) => {
      const newLat = event.latLng.lat().toFixed(8);
      const newLng = event.latLng.lng().toFixed(8);
      setLatitude(newLat);
      setLongitude(newLng);
      geocodeAreaCity(newLat, newLng).then((place) => {
        if (place.area || place.city) {
          setArea(place.area);
          setCity(place.city);
        }
      });
      debugLog('ðŸ“ Marker dragged to:', newLat, newLng);
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
    setPhoneOtp('');
    setPhoneOtpSent(false);
    setPhoneOtpVerified(false);
  };

  const accountPhone = accountPhoneFromUser(user);
  const enteredPhone = ownerPhone ? `${countryCode}${ownerPhone}` : '';
  const savedCentrePhone = editingCenter?.owner_phone || '';
  const phoneNeedsOtp = Boolean(ownerPhone)
    && !phonesMatch(enteredPhone, accountPhone)
    && !phonesMatch(enteredPhone, savedCentrePhone);
  const phoneAutofilledRef = useRef(false);

  useEffect(() => {
    if (phoneAutofilledRef.current || initialCenter) return;
    const account = splitOwnerPhone(accountPhone);
    if (!account.phone) return;
    phoneAutofilledRef.current = true;
    // Club form shows +91 only; keep national digits from the app profile.
    setCountryCode('+91');
    setOwnerPhone(account.phone.replace(/\D/g, '').slice(-10));
  }, [accountPhone, initialCenter]);

  // Resolve DB UserId from session/user object (supports phone-login users without email)
  const resolveOwnerUserId = async () => {
    const userId = await getUserId(user);
    if (!userId) {
      throw new Error('Unable to verify your account. Please sign in again.');
    }
    return userId;
  };

  // Fetch user's centres
  const fetchMyCenters = async () => {
    if (!user) return;

    setLoadingCenters(true);
    try {
      const userId = await resolveOwnerUserId();
      const response = await fetch(
        `${apiBaseUrl}/api/nutrition-centers?userId=${userId}&teamFilter=self&paginate=0`,
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
    if (!mapLoaded) return undefined;
    let cancelled = false;
    myCenters.forEach((center) => {
      if (formatAreaCity(center.area, center.city)) return;
      geocodeAreaCity(center.latitude, center.longitude).then((place) => {
        if (cancelled || !formatAreaCity(place.area, place.city)) return;
        setResolvedPlaces((prev) => (prev[center.id] ? prev : { ...prev, [center.id]: place }));
      });
    });
    return () => { cancelled = true; };
  }, [myCenters, mapLoaded]);

  useEffect(() => {
    if (user) {
      fetchMyCenters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, [user]);

  // Pre-fill form when opened from Physical Club Report via Edit button
  const handleEdit = (center) => {
    setEditingCenter(center);
    setCenterName(center.center_name);
    setLatitude(String(center.latitude));
    setLongitude(String(center.longitude));
    setArea(center.area || '');
    setCity(center.city || '');
    const { phone: nextPhone } = splitOwnerPhone(center.owner_phone);
    setCountryCode('+91');
    setOwnerPhone(String(nextPhone || '').replace(/\D/g, '').slice(-10));
    setCentreCodeSuffix(centreCodeBody(center.center_code));
    setCentrePhotos(emptyCentrePhotos());
    if (center.openingHours) setOpeningHours(center.openingHours);
    setFacilities(Array.isArray(center.facilities) ? center.facilities : []);
    setSeatingCount(center.seatingCount == null ? '' : String(center.seatingCount));
    setNameAvailable(null);
    setNameChecking(false);
    setSearchAddress('');
    if (searchBoxRef.current) {
      searchBoxRef.current.value = '';
    }
    setError(null);
    setSuccess(null);
    if (googleMapRef.current && window.google) {
      const pos = { lat: center.latitude, lng: center.longitude };
      if (markerRef.current) markerRef.current.setMap(null);
      markerRef.current = new window.google.maps.Marker({
        position: pos,
        map: googleMapRef.current,
        title: 'Selected Location',
      });
      googleMapRef.current.panTo(pos);
    }
    loadCentrePhotos(center.id);
  };

  const loadCentrePhotos = async (centerId) => {
    setPhotosLoading(true);
    try {
      const userId = await resolveOwnerUserId();
      const response = await apiFetch(
        `/api/nutrition-centers?userId=${encodeURIComponent(userId)}&centerId=${encodeURIComponent(centerId)}&includePhotos=1`,
        { apiBaseUrl, cache: 'no-store' },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not load centre photos');
      }
      if (result.data?.centerCode) {
        setCentreCodeSuffix(centreCodeBody(result.data.centerCode));
      }
      setCentrePhotos(centrePhotosFromApi(result.data?.photos));
      if (result.data?.openingHours) setOpeningHours(result.data.openingHours);
      setFacilities(Array.isArray(result.data?.facilities) ? result.data.facilities : []);
      setSeatingCount(result.data?.seatingCount == null ? '' : String(result.data.seatingCount));
    } catch (err) {
      setError(err.message || 'Could not load centre photos');
    } finally {
      setPhotosLoading(false);
    }
  };

  const requestLeaveForm = () => {
    if (forceComplete) {
      setAlertModal({
        isOpen: true,
        title: 'Complete centre details',
        message: 'Your club is missing required details (code, hours, facilities, or photos). Please fill them in and tap Save — then this screen will not appear again.',
        type: 'warning',
        confirmText: 'OK',
        cancelText: null,
        onConfirm: () => setAlertModal((prev) => ({ ...prev, isOpen: false })),
        onCancel: null,
      });
      return;
    }
    if (typeof onBack === 'function') onBack();
  };

  const handleCancelEdit = () => {
    if (forceComplete) {
      requestLeaveForm();
      return;
    }
    setEditingCenter(null);
    setCenterName('');
    setLatitude('');
    setLongitude('');
    setArea('');
    setCity('');
    setOwnerPhone('');
    setCountryCode('+91');
    setCentreCodeSuffix('');
    setCentrePhotos(emptyCentrePhotos());
    setOpeningHours(defaultOpeningHours());
    setFacilities([]);
    setSeatingCount('');
    setApprovalSent(false);
    setCoachName('');
    setCoachOtp('');
    setCoachApproved(false);
    setPhotosLoading(false);
    setNameAvailable(null);
    setNameChecking(false);
    setSearchAddress('');
    if (searchBoxRef.current) {
      searchBoxRef.current.value = '';
    }
    setError(null);
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
    
    // Navigate back to Physical Club Report
    if (onBack) {
      onBack();
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (phoneNeedsOtp && !phoneOtpVerified) {
        throw new Error('Verify the new mobile number with the OTP sent to it');
      }
      if (!centerName || !latitude || !longitude) {
        throw new Error('Please fill in all required fields and select a location on the map');
      }
      if (photosLoading) {
        throw new Error('Centre photos are still loading');
      }
      if (nameAvailable === false) {
        throw new Error('This centre name is already taken. Please choose a different name.');
      }
      const profile = centreProfilePayload();
      const userId = await resolveOwnerUserId();
      const response = await apiFetch(`${apiBaseUrl}/api/nutrition-centers`, {
        apiBaseUrl,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centerId: editingCenter.id,
          userId,
          centerName,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          ownerPhone: ownerPhone ? `${countryCode}${ownerPhone}` : null,
          centerCode: profile.centerCode,
          photos: profile.photos,
          openingHours: profile.openingHours,
          facilities: profile.facilities,
          seatingCount: profile.seatingCount,
          area: area || null,
          city: city || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update centre');
      }
      // Leave as soon as the write succeeds. The club list paints this row
      // immediately and refreshes attendance in the background.
      if (typeof onSaved === 'function') onSaved(result.data);
      if (typeof onBack === 'function') onBack();
    } catch (err) {
      debugLog('Error updating centre:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-enter edit mode when opened from Physical Club Report
  useEffect(() => {
    if (initialCenter) {
      handleEdit(initialCenter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, []);

  const handleSendPhoneOtp = async () => {
    setError(null);
    setPhoneOtpLoading(true);
    try {
      if (!ownerPhone || ownerPhone.length < getPhoneMaxLength(countryCode)) {
        throw new Error('Enter the full mobile number before sending the OTP');
      }
      const userId = await resolveOwnerUserId();
      const response = await apiFetch(`${apiBaseUrl}/api/nutrition-centers/phone-otp`, {
        apiBaseUrl,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', userId, phone: `${countryCode}${ownerPhone}` }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not send the OTP');
      }
      setPhoneOtpSent(true);
      setPhoneOtp('');
      setPhoneOtpVerified(false);
      setSuccess(result.message || 'OTP sent to this mobile number.');
    } catch (err) {
      setError(err.message || 'Could not send the OTP');
    } finally {
      setPhoneOtpLoading(false);
    }
  };

  const handlePhoneOtpChange = async (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
    setPhoneOtp(digits);
    setPhoneOtpVerified(false);
    if (digits.length < 4) return;
    setError(null);
    setPhoneOtpLoading(true);
    try {
      const userId = await resolveOwnerUserId();
      const response = await apiFetch(`${apiBaseUrl}/api/nutrition-centers/phone-otp`, {
        apiBaseUrl,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          userId,
          phone: `${countryCode}${ownerPhone}`,
          otp: digits,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Invalid OTP');
      }
      setPhoneOtpVerified(true);
      setSuccess(result.message || 'Mobile number verified.');
    } catch (err) {
      setPhoneOtpVerified(false);
      setError(err.message || 'Invalid OTP');
    } finally {
      setPhoneOtpLoading(false);
    }
  };

  const handleSendForApproval = async () => {
    setError(null);
    setSuccess(null);
    setApprovalLoading(true);
    try {
      if (phoneNeedsOtp && !phoneOtpVerified) {
        throw new Error('Verify the new mobile number with the OTP sent to it');
      }
      if (!centerName || !latitude || !longitude) {
        throw new Error('Please fill in all required fields and select a location on the map');
      }
      if (photosLoading) throw new Error('Centre photos are still loading');
      if (nameAvailable === false) {
        throw new Error('This centre name is already taken. Please choose a different name.');
      }
      centreProfilePayload();
      const userId = await resolveOwnerUserId();
      const response = await apiFetch(`${apiBaseUrl}/api/nutrition-centers/approval`, {
        apiBaseUrl,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', userId }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not send the centre for approval');
      }
      setApprovalSent(true);
      setCoachApproved(false);
      setCoachOtp('');
      setCoachName(result.data?.coachName || '');
      setSuccess(result.message || 'Sent for approval. OTP sent to your coach.');
    } catch (err) {
      setError(err.message || 'Could not send the centre for approval');
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleCoachOtpChange = async (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
    setCoachOtp(digits);
    setCoachApproved(false);
    if (digits.length < 4) return;
    setError(null);
    setApprovalLoading(true);
    try {
      const userId = await resolveOwnerUserId();
      const response = await apiFetch(`${apiBaseUrl}/api/nutrition-centers/approval`, {
        apiBaseUrl,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', userId, otp: digits }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Invalid OTP');
      }
      setCoachApproved(true);
      setSuccess(result.message || 'Coach approved. You can register this centre now.');
    } catch (err) {
      setCoachApproved(false);
      setError(err.message || 'Invalid OTP');
    } finally {
      setApprovalLoading(false);
    }
  };

  // Handle form submission
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (phoneNeedsOtp && !phoneOtpVerified) {
        throw new Error('Verify the new mobile number with the OTP sent to it');
      }
      if (!coachApproved) {
        throw new Error('Send this centre for coach approval and enter the OTP first');
      }
      if (!centerName || !latitude || !longitude) {
        throw new Error('Please fill in all required fields and select a location on the map');
      }

      // Block submission if name is taken
      if (nameAvailable === false) {
        throw new Error('This centre name is already taken. Please choose a different name.');
      }

      const profile = centreProfilePayload();
      const userId = await resolveOwnerUserId();

      const response = await apiFetch(`${apiBaseUrl}/api/nutrition-centers`, {
        apiBaseUrl,
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
          centerCode: profile.centerCode,
          photos: profile.photos,
          openingHours: profile.openingHours,
          facilities: profile.facilities,
          seatingCount: profile.seatingCount,
          area: area || null,
          city: city || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to register centre');
      }

      setSuccess('Nutrition centre registered successfully!');

      // Leave the form and show Mine, including the club just registered.
      if (typeof onSaved === 'function') onSaved(result.data);
      if (typeof onBack === 'function') onBack();
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
      title: 'Delete Nutrition Centre',
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
      const userId = await resolveOwnerUserId();

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
      setAlertModal(prev => ({ ...prev, isOpen: false }));
      if (typeof onSaved === 'function') onSaved();
      else fetchMyCenters();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error unregistering centre:', err);
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-green-50 to-blue-50 z-[70] overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TouchFeedbackButton
              onClick={forceComplete ? requestLeaveForm : onBack}
              className="p-2 hover:bg-gray-100 rounded-full"
              ariaLabel="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </TouchFeedbackButton>
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                {forceComplete
                  ? 'Complete Nutrition Centre'
                  : editingCenter
                    ? 'Edit Nutrition Centre'
                    : 'Register Nutrition Centre'}
              </h1>
              <p className="text-xs text-gray-500">
                {forceComplete
                  ? 'Required details are missing. Save once — then this will not show again.'
                  : editingCenter
                    ? `Editing: ${editingCenter.center_name}`
                    : 'Add a new club location'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-3 space-y-6">
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
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-800">
                {forceComplete
                  ? 'Missing Centre Details'
                  : editingCenter
                    ? 'Edit Centre Details'
                    : 'New Centre Details'}
              </h2>
              {editingCenter && (
                <div className="flex gap-2 shrink-0">
                  <TouchFeedbackButton
                    type="button"
                    onClick={handleUpdate}
                    disabled={loading || photosLoading || nameAvailable === false}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        Saving...
                      </>
                    ) : (
                      <>
                        {/* <span className="text-lg"></span> */}
                        Save
                      </>
                    )}
                  </TouchFeedbackButton>
                  {!forceComplete && (
                    <TouchFeedbackButton
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 flex items-center gap-2"
                    >
                      Cancel
                    </TouchFeedbackButton>
                  )}
                </div>
              )}
            </div>
            {forceComplete && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Add centre code, opening hours, facilities, and at least one photo in each required group, then Save.
              </p>
            )}
          </div>
          <form onSubmit={editingCenter ? handleUpdate : handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Centre Code <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="w-16 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 font-semibold text-center">
                  RS
                </div>
                <input
                  type="text"
                  value={centreCodeSuffix}
                  onChange={(e) => handleCentreCodeChange(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                  placeholder="e.g. 1024"
                  maxLength={16}
                  autoCapitalize="characters"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {centreCodeSuffix ? `Saved as RS${centreCodeSuffix}` : 'Required. The code always starts with RS.'}
              </p>
            </div>

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
              {(nameChecking || nameAvailable !== null) && (
                <div className="mt-1 flex items-center gap-1">
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
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <div className="flex gap-2">
                <div className="flex w-20 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-gray-50 px-2 text-sm font-semibold text-gray-800">
                  +91
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={ownerPhone}
                    onChange={(e) => {
                      if (countryCode !== '+91') setCountryCode('+91');
                      handlePhoneInput(e.target.value);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="10 digit number"
                    maxLength={10}
                    aria-label="Phone number"
                  />
                  {phoneNeedsOtp && !phoneOtpVerified && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-amber-700">This is a different number. Verify it with an OTP before using it.</p>
                      <TouchFeedbackButton
                        type="button"
                        onClick={handleSendPhoneOtp}
                        disabled={phoneOtpLoading}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:bg-gray-300"
                      >
                        {phoneOtpLoading && !phoneOtpSent ? 'Sending OTP...' : 'Send OTP'}
                      </TouchFeedbackButton>
                      {phoneOtpSent && (
                        <input
                          type="text"
                          inputMode="numeric"
                          value={phoneOtp}
                          onChange={(e) => handlePhoneOtpChange(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg tracking-widest text-center"
                          placeholder="Enter 4-digit OTP"
                          maxLength={4}
                          aria-label="Mobile number OTP"
                        />
                      )}
                    </div>
                  )}
                  {phoneNeedsOtp && phoneOtpVerified && (
                    <p className="text-xs text-green-600 mt-1">Mobile number verified.</p>
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
                {formatAreaCity(area, city) && (
                  <p className="text-sm font-medium text-gray-800">{formatAreaCity(area, city)}</p>
                )}
              </div>
            </div>

            <CentreListingFields
              hours={openingHours}
              onHoursChange={setOpeningHours}
              facilities={facilities}
              onFacilitiesChange={setFacilities}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                No. of seating
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={seatingCount}
                onChange={(e) => setSeatingCount(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Optional"
              />
              <p className="text-xs text-gray-500 mt-1">Optional. How many people can sit at the centre.</p>
            </div>

            <CentrePhotoSlots
              photos={centrePhotos}
              onChange={setCentrePhotos}
              disabled={loading || photosLoading}
              onError={setError}
            />
            {photosLoading && (
              <p className="text-xs text-gray-400">Loading saved photos...</p>
            )}

            {!editingCenter && !coachApproved && (
              <div className="space-y-3">
                <TouchFeedbackButton
                  type="button"
                  onClick={handleSendForApproval}
                  disabled={loading || photosLoading || approvalLoading || nameAvailable === false}
                  className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {approvalLoading && !approvalSent ? 'Sending for approval...' : 'Send for approval'}
                </TouchFeedbackButton>
                {approvalSent && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                    <p className="text-sm text-blue-800">
                      Sent for approval. OTP sent to your coach{coachName ? ` ${coachName}` : ''}.
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={coachOtp}
                      onChange={(e) => handleCoachOtpChange(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg tracking-widest text-center"
                      placeholder="Enter 4-digit OTP"
                      maxLength={4}
                      aria-label="Coach approval OTP"
                    />
                    {approvalLoading && coachOtp.length === 4 && (
                      <p className="text-xs text-gray-500">Checking OTP...</p>
                    )}
                  </div>
                )}
              </div>
            )}
            {!editingCenter && coachApproved && (
              <TouchFeedbackButton
                type="submit"
                disabled={loading || photosLoading || nameAvailable === false}
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
            )}
          </form>
        </div>

        {/* My Centres — hidden when editing an existing centre */}
        {!editingCenter && <div className="bg-white rounded-lg shadow-md p-6">
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
                    {center.center_code && (
                      <p className="text-xs font-medium text-green-700 mt-0.5">{center.center_code}</p>
                    )}
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{cardAreaCity(center, resolvedPlaces) || `${center.latitude}, ${center.longitude}`}</span>
                      </div>
                      {center.education_hour && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>{center.education_hour}</span>
                        </div>
                      )}
                      {center.owner_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 flex-shrink-0" />
                          <PhoneContactActions phone={center.owner_phone} size="sm" />
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
        </div>}
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
