/**
 * PermissionDeniedModal.jsx
 *
 * Lightweight center-card modal shown when a required permission was denied
 * but the OS can still present a system dialog (canRequest: true — e.g. first
 * denial on Android without "Don't ask again").
 *
 * Shows:
 *   "<Permission> permission is required to continue."
 *   [ Allow Again ]   — immediately invokes the native OS permission dialog.
 *   [ Exit         ]  — exits the application.
 *
 * Never shown before the first native permission request.
 * Never shown for permanently denied permissions (use PermissionBlockedPage).
 */
import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import * as nativeLifecycle from '../services/nativeLifecycle/index.js';

const ACCENT = {
  camera:        '#16a34a',
  location:      '#2563eb',
  notifications: '#d97706',
};

export default function PermissionDeniedModal({
  type,
  config,
  onAllow,
  onExit,
  loading = false,
}) {
  const accent = ACCENT[type] ?? '#111827';
  const [gpsOff, setGpsOff] = useState(false);

  useEffect(() => {
    if (type !== 'location' || !Capacitor.isNativePlatform()) return;
    let cancelled = false;
    nativeLifecycle.checkGpsEnabled().then((on) => {
      if (!cancelled) setGpsOff(!on);
    });
    return () => { cancelled = true; };
  }, [type]);

  const showLocationSettings = type === 'location' && gpsOff;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={`${config.label} permission required`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          width: '100%',
          maxWidth: 340,
          padding: '28px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Icon */}
        <div style={{ fontSize: 40, marginBottom: 14, lineHeight: 1 }}>
          {config.icon}
        </div>

        {/* Message */}
        <p
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#111827',
            textAlign: 'center',
            margin: '0 0 20px',
            lineHeight: 1.45,
          }}
        >
          {config.label} permission is required to continue.
        </p>

        {showLocationSettings && (
          <p
            style={{
              fontSize: 13,
              color: '#6b7280',
              textAlign: 'center',
              margin: '0 0 20px',
              lineHeight: 1.5,
            }}
          >
            Turn on Location Services on your device first.
          </p>
        )}

        {/* Allow Again / Open Location Settings */}
        <button
          type="button"
          onClick={showLocationSettings
            ? () => nativeLifecycle.openLocationSettings()
            : onAllow}
          disabled={loading && !showLocationSettings}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 12,
            border: 'none',
            background: loading ? '#d1fae5' : accent,
            color: '#ffffff',
            fontSize: 15,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: 10,
            WebkitTapHighlightColor: 'transparent',
            transition: 'opacity 0.15s',
          }}
        >
          {showLocationSettings
            ? 'Open Location Settings'
            : loading
              ? 'Requesting\u2026'
              : 'Allow Again'}
        </button>

        {/* Exit */}
        <button
          type="button"
          onClick={onExit}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 12,
            border: '1.5px solid #e5e7eb',
            background: 'transparent',
            color: '#374151',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Exit
        </button>
      </div>
    </div>
  );
}
