/**
 * GpsRequiredModal.jsx
 *
 * Full-screen blocking modal shown when:
 *   1. Location permission has been granted by the user, BUT
 *   2. Location Services (GPS) are currently disabled on the device.
 *
 * The user CANNOT proceed to the Home screen until GPS is enabled.
 * Navigation to all features (Home, Diary, Scanner, AI, Maps) is blocked.
 *
 * App.js automatically re-checks GPS via checkGpsEnabled() each time the app
 * returns to the foreground (appStateChange listener). This modal dismisses
 * itself automatically once GPS is confirmed enabled - no manual polling needed.
 *
 * Props:
 *   onOpenSettings - fn: opens device Location Settings
 *   platform       - 'android' | 'ios' | 'web' - drives copy differences
 */
import React from 'react';

export default function GpsRequiredModal({ onOpenSettings, platform }) {
  const isIOS = platform === 'ios';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Location Services required"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 28px',
        textAlign: 'center',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          background: '#fef2f2',
          border: '2px solid #fca5a5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 38,
          marginBottom: 24,
          flexShrink: 0,
        }}
      >
        {String.fromCodePoint(0x1F4CD)}
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: '#111827',
          margin: '0 0 12px',
          lineHeight: 1.3,
        }}
      >
        Location Services are Off
      </h1>

      {/* Body */}
      <p
        style={{
          fontSize: 15,
          color: '#6b7280',
          margin: '0 0 8px',
          lineHeight: 1.55,
          maxWidth: 320,
        }}
      >
        Wellness Valley needs GPS to track your wellness activity and check you
        in at nutrition centers. Please enable Location Services to continue.
      </p>

      <p
        style={{
          fontSize: 13,
          color: '#9ca3af',
          margin: '0 0 36px',
          lineHeight: 1.45,
          maxWidth: 300,
        }}
      >
        {isIOS
          ? 'Go to Settings > Privacy & Security > Location Services and turn it ON.'
          : 'Go to Settings > Location and turn Location Services ON.'}
      </p>

      {/* Open Settings button */}
      <button
        type="button"
        onClick={onOpenSettings}
        style={{
          width: '100%',
          maxWidth: 340,
          padding: '16px',
          borderRadius: 16,
          border: 'none',
          background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
          color: '#ffffff',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
          transition: 'all 0.15s ease',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        Open Location Settings
      </button>

      {/* Auto-check note */}
      <p
        style={{
          fontSize: 11.5,
          color: '#9ca3af',
          margin: '20px 0 0',
          lineHeight: 1.5,
          maxWidth: 280,
        }}
      >
        Once you enable Location Services and return to Wellness Valley,
        this screen will close automatically.
      </p>
    </div>
  );
}