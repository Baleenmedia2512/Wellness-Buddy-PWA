/**
 * Lean map pin picker — search / tap / GPS → lat/lng + reverse-geocoded city/area.
 * Reuses Google Maps loader + Nominatim helper (same idea as club center create).
 * Map loads only while `open` (collapsed by default in the form).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { LocateFixed, MapPin, X } from 'lucide-react';
import { loadGoogleMaps } from '../../features/nutrition-centers/services/googleMapsLoader';
import { fetchCityVillage } from '../lib/reverseGeocode';
import TouchFeedbackButton from './TouchFeedbackButton';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';
/** India-friendly default when GPS is unavailable */
const FALLBACK_CENTER = { lat: 13.0827, lng: 80.2707 };

function mapsUrl(lat, lng) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   disabled?: boolean,
 *   onResolved: (place: {
 *     city: string,
 *     locality: string,
 *     mapsLink: string,
 *     lat: number,
 *     lng: number,
 *   }) => void,
 * }} props
 */
export default function PlaceMapPicker({ open, onClose, disabled = false, onResolved }) {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const autocompleteRef = useRef(null);
  const searchInputRef = useRef(null);
  const resolveSeq = useRef(0);
  const placeMarkerRef = useRef(null);
  const onResolvedRef = useRef(onResolved);
  const disabledRef = useRef(disabled);

  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('Search or tap the map to set City & Area');

  onResolvedRef.current = onResolved;
  disabledRef.current = disabled;

  useEffect(() => {
    if (!open) return undefined;
    if (!GOOGLE_MAPS_API_KEY) {
      setError('Maps key missing — type City & Area manually');
      return undefined;
    }

    let cancelled = false;
    setError('');
    setMapReady(false);
    setHint('Search or tap the map to set City & Area');

    const applyLatLng = async (lat, lng) => {
      if (disabledRef.current || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const seq = ++resolveSeq.current;
      setBusy(true);
      setHint('Looking up City & Area…');
      setError('');

      const { city, village } = await fetchCityVillage(lat, lng);
      if (cancelled || seq !== resolveSeq.current) return;

      const cityLabel = String(city || '').trim();
      const areaLabel = String(village || '').trim();
      const payload = {
        city: cityLabel,
        locality: areaLabel || cityLabel,
        mapsLink: mapsUrl(lat, lng),
        lat,
        lng,
      };

      if (!cityLabel && !areaLabel) {
        payload.locality = '';
        setBusy(false);
        setHint('Pin set — type City & Area if lookup failed');
        onResolvedRef.current?.(payload);
        return;
      }

      onResolvedRef.current?.(payload);
      setBusy(false);
      setHint(
        areaLabel
          ? `Filled: ${areaLabel}, ${cityLabel || '—'}`
          : `Filled city: ${cityLabel} — add Area if needed`,
      );
    };

    const placeMarker = (latLng) => {
      const map = mapRef.current;
      if (!map || !window.google?.maps) return;
      const lat = typeof latLng.lat === 'function' ? latLng.lat() : Number(latLng.lat);
      const lng = typeof latLng.lng === 'function' ? latLng.lng() : Number(latLng.lng);

      if (markerRef.current) {
        markerRef.current.setPosition({ lat, lng });
      } else {
        markerRef.current = new window.google.maps.Marker({
          position: { lat, lng },
          map,
          draggable: true,
          title: 'Selected place',
        });
        markerRef.current.addListener('dragend', (ev) => {
          if (!ev.latLng) return;
          applyLatLng(ev.latLng.lat(), ev.latLng.lng());
        });
      }
      map.panTo({ lat, lng });
      if (map.getZoom() < 14) map.setZoom(15);
      applyLatLng(lat, lng);
    };

    placeMarkerRef.current = placeMarker;

    loadGoogleMaps(GOOGLE_MAPS_API_KEY)
      .then(async () => {
        if (cancelled || !mapElRef.current || !window.google?.maps) return;

        let center = FALLBACK_CENTER;
        let usedGps = false;
        try {
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 60_000,
          });
          center = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          usedGps = true;
        } catch {
          // keep India fallback
        }
        if (cancelled) return;

        const map = new window.google.maps.Map(mapElRef.current, {
          center,
          zoom: usedGps ? 15 : 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
          clickableIcons: false,
        });
        mapRef.current = map;
        map.addListener('click', (ev) => {
          if (ev.latLng) placeMarker(ev.latLng);
        });

        if (searchInputRef.current && window.google.maps.places) {
          const ac = new window.google.maps.places.Autocomplete(searchInputRef.current, {
            fields: ['geometry', 'formatted_address', 'name'],
            componentRestrictions: { country: ['in'] },
          });
          ac.bindTo('bounds', map);
          autocompleteRef.current = ac;
          ac.addListener('place_changed', () => {
            const place = ac.getPlace();
            if (!place?.geometry?.location) return;
            placeMarker(place.geometry.location);
          });
        }

        setMapReady(true);
        if (usedGps) placeMarker(center);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'Could not load map');
        }
      });

    return () => {
      cancelled = true;
      resolveSeq.current += 1;
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      autocompleteRef.current = null;
      mapRef.current = null;
      placeMarkerRef.current = null;
      setMapReady(false);
    };
  }, [open]);

  const goToMyLocation = async () => {
    if (disabled || !mapRef.current) return;
    setBusy(true);
    setError('');
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
      if (typeof placeMarkerRef.current === 'function') {
        placeMarkerRef.current({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } else {
        setBusy(false);
      }
    } catch {
      setBusy(false);
      setError('Location permission needed — search or tap the map instead');
    }
  };

  if (!open) return null;

  return (
    <div className="space-y-2 rounded-2xl border border-emerald-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-bold text-emerald-900">Pick on map</p>
          <p className="text-[11px] text-slate-500">{hint}</p>
        </div>
        <TouchFeedbackButton
          type="button"
          onClick={onClose}
          ariaLabel="Close map"
          className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
        >
          <X className="h-4 w-4" aria-hidden />
        </TouchFeedbackButton>
      </div>

      <input
        ref={searchInputRef}
        type="search"
        disabled={disabled || !mapReady}
        placeholder="Search area, landmark, city…"
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
        autoComplete="off"
      />

      <div className="relative overflow-hidden rounded-xl border border-slate-200">
        <div ref={mapElRef} className="h-52 w-full bg-slate-100" />
        {!mapReady && !error ? (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
            Loading map…
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <TouchFeedbackButton
          type="button"
          disabled={disabled || busy || !mapReady}
          onClick={goToMyLocation}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-800 disabled:opacity-50"
        >
          <LocateFixed className="h-3.5 w-3.5" aria-hidden />
          Use my location
        </TouchFeedbackButton>
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          Tap map or drag pin
        </span>
      </div>

      {error ? <p className="text-[11px] font-medium text-amber-700">{error}</p> : null}
      {busy ? <p className="text-[11px] text-slate-500">Updating City & Area…</p> : null}
    </div>
  );
}
