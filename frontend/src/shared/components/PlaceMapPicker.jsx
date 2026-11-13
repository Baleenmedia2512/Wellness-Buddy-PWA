/**
 * Lean map pin picker — search / tap / GPS → preview city/area → user confirms.
 * Does not auto-save or auto-close on GPS (that flashed the map shut with a wrong place).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Check, LocateFixed, MapPin, X } from 'lucide-react';
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
  const movePinRef = useRef(null);
  const disabledRef = useRef(disabled);

  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('Search or tap the map, then confirm');
  const [pending, setPending] = useState(null);

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
    setPending(null);
    setHint('Search or tap the map, then confirm');

    /** Preview only — never calls onResolved (parent used to close the map). */
    const previewLatLng = async (lat, lng) => {
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
        setPending(payload);
        setBusy(false);
        setHint('Pin set — confirm, or type City & Area if lookup failed');
        return;
      }

      setPending(payload);
      setBusy(false);
      setHint(
        areaLabel
          ? `Preview: ${areaLabel}, ${cityLabel || '—'} — tap Confirm to use`
          : `Preview city: ${cityLabel} — tap Confirm to use`,
      );
    };

    const movePin = (latLng, { preview = true } = {}) => {
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
          previewLatLng(ev.latLng.lat(), ev.latLng.lng());
        });
      }
      map.panTo({ lat, lng });
      if (map.getZoom() < 14) map.setZoom(15);
      if (preview) previewLatLng(lat, lng);
    };

    movePinRef.current = movePin;

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
          if (ev.latLng) movePin(ev.latLng);
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
            movePin(place.geometry.location);
          });
        }

        setMapReady(true);
        // GPS: show pin + preview only — do not auto-confirm (wrong village names).
        if (usedGps) {
          movePin(center, { preview: true });
          setHint('GPS pin shown — move pin or search, then Confirm');
        }
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
      movePinRef.current = null;
      setMapReady(false);
      setPending(null);
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
      if (typeof movePinRef.current === 'function') {
        movePinRef.current({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } else {
        setBusy(false);
      }
    } catch {
      setBusy(false);
      setError('Location permission needed — search or tap the map instead');
    }
  };

  const confirmPlace = () => {
    if (disabled || !pending) return;
    onResolved?.(pending);
  };

  if (!open) return null;

  const previewLabel = pending
    ? [pending.locality, pending.city].filter(Boolean).join(', ')
    : '';

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

      {previewLabel ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-900">
          Selected: {previewLabel}
        </p>
      ) : null}

      <TouchFeedbackButton
        type="button"
        disabled={disabled || busy || !pending}
        onClick={confirmPlace}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-3.5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
      >
        <Check className="h-4 w-4" aria-hidden />
        Confirm City & Area
      </TouchFeedbackButton>

      {error ? <p className="text-[11px] font-medium text-amber-700">{error}</p> : null}
      {busy ? <p className="text-[11px] text-slate-500">Looking up place…</p> : null}
    </div>
  );
}
