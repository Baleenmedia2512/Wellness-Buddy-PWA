import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { MapPin } from 'lucide-react';
import { StepCounterPlugin } from '../plugins/stepCounterPlugin';

const POLL_INTERVAL_MS = 2000;

/**
 * LocationGuard
 *
 * Renders a full-screen overlay when device location services are OFF.
 * Polls every 2 s and dismisses automatically once the user enables location.
 * Safe to render on web (overlay never shows there).
 *
 * Props:
 *   children  â€” content to render beneath the guard
 */
export default function LocationGuard({ children }) {
  const [locationOff, setLocationOff] = useState(false);
  const timerRef = useRef(null);

  const checkLocation = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { enabled } = await StepCounterPlugin.isLocationEnabled();
      setLocationOff(!enabled);
    } catch {
      // fail open â€” never block the user on error
      setLocationOff(false);
    }
  };

  useEffect(() => {
    checkLocation();
    timerRef.current = setInterval(checkLocation, POLL_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, []);

  const handleTurnOn = async () => {
    await StepCounterPlugin.openLocationSettings();
  };

  return (
    <>
      {children}

      {locationOff && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              background: '#f0fdf4',
              borderRadius: '20px',
              padding: '36px 28px',
              maxWidth: '320px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 8px 40px rgba(16,185,129,0.2)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(52, 211, 153, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <MapPin size={30} color="#34d399" />
            </div>

            <h2
              style={{
                color: '#065f46',
                fontSize: '20px',
                fontWeight: '700',
                margin: '0 0 10px',
              }}
            >
              Enable Location
            </h2>

            <p
              style={{
                color: '#047857',
                fontSize: '14px',
                lineHeight: '1.6',
                margin: '0 0 28px',
              }}
            >
              This app needs location for steps tracking & attendance
            </p>

            <button
              onClick={handleTurnOn}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                letterSpacing: '0.3px',
              }}
            >
              Turn On Location
            </button>
          </div>
        </div>
      )}
    </>
  );
}
