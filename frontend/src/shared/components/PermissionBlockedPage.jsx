/**
 * PermissionBlockedPage.jsx
 *
 * Full-screen page shown when a required permission is PERMANENTLY DENIED —
 * i.e. the OS will no longer present a system dialog (Android "Don't ask
 * again" / any iOS denial).
 *
 * The only way to grant the permission at this point is via the OS Settings
 * app. This page explains clearly why the permission is needed and provides
 * a direct settings action.
 *
 * Behaviour:
 *   • Location + GPS off → opens system Location Services (device toggle).
 *   • Location + GPS on  → opens this app's Permissions page.
 *   • Other permissions    → opens App Settings.
 *   • "Exit App" → closes the application.
 */
import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import * as nativeLifecycle from '../services/nativeLifecycle/index.js';

const PAGE_CONTENT = {
  camera: {
    title: 'Camera Permission Required',
    description:
      'Wellness Valley uses your camera to capture meal photos for AI nutrition analysis. Without this permission, this feature cannot work.',
    accent: '#16a34a',
    iconBg: '#f0fdf4',
  },
  location: {
    title: 'Location Permission Required',
    description:
      'Wellness Valley uses your location to automatically check you in at your nearest wellness center. Without this permission, attendance tracking cannot work.',
    accent: '#2563eb',
    iconBg: '#eff6ff',
  },
  notifications: {
    title: 'Notifications Permission Required',
    description:
      'Wellness Valley uses notifications to remind you to log your meals, water intake, and daily weight on time.',
    accent: '#d97706',
    iconBg: '#fffbeb',
  },
};

export default function PermissionBlockedPage({
  type,
  config,
  onOpenSettings,
  onExit,
}) {
  const content = PAGE_CONTENT[type] ?? PAGE_CONTENT.camera;
  const [gpsOff, setGpsOff] = useState(false);

  useEffect(() => {
    if (type !== 'location' || !Capacitor.isNativePlatform()) return;
    let cancelled = false;
    nativeLifecycle.checkGpsEnabled().then((on) => {
      if (!cancelled) setGpsOff(!on);
    });
    return () => { cancelled = true; };
  }, [type]);

  const settingsLabel = type === 'location' && gpsOff
    ? 'Open Location Settings'
    : 'Open App Settings';

  const handleOpenSettings = () => {
    if (type === 'location') {
      nativeLifecycle.openLocationPermissionSettings();
    } else if (onOpenSettings) {
      onOpenSettings();
    }
  };

  return (
    <div
      role="main"
      aria-label={`${config.label} permission required — open Settings`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 28px 48px',
        overflowY: 'auto',
      }}
    >
      {/* Large icon in a soft circle */}
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: content.iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 50,
          marginBottom: 32,
          flexShrink: 0,
        }}
      >
        {config.icon}
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: '#111827',
          textAlign: 'center',
          margin: '0 0 16px',
          lineHeight: 1.3,
          letterSpacing: '-0.3px',
        }}
      >
        {content.title}
      </h1>

      {/* Description */}
      <p
        style={{
          fontSize: 15,
          color: '#6b7280',
          textAlign: 'center',
          margin: '0 0 44px',
          lineHeight: 1.65,
          maxWidth: 320,
        }}
      >
        {content.description}
      </p>

      {type === 'location' && gpsOff && (
        <p
          style={{
            fontSize: 13,
            color: '#9ca3af',
            textAlign: 'center',
            margin: '0 0 24px',
            lineHeight: 1.5,
            maxWidth: 300,
          }}
        >
          Your device Location Services are turned off. Turn on &quot;Use location&quot;
          in Settings, then return here.
        </p>
      )}

      {/* Settings action — primary */}
      <button
        type="button"
        onClick={handleOpenSettings}
        style={{
          width: '100%',
          maxWidth: 320,
          padding: '16px',
          borderRadius: 16,
          border: 'none',
          background: content.accent,
          color: '#ffffff',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: 12,
          WebkitTapHighlightColor: 'transparent',
          boxShadow: `0 4px 16px ${content.accent}44`,
          transition: 'opacity 0.15s',
          flexShrink: 0,
        }}
      >
        {settingsLabel}
      </button>

      {/* Exit App — secondary action */}
      <button
        type="button"
        onClick={onExit}
        style={{
          width: '100%',
          maxWidth: 320,
          padding: '14px',
          borderRadius: 16,
          border: '1.5px solid #e5e7eb',
          background: 'transparent',
          color: '#6b7280',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          flexShrink: 0,
        }}
      >
        Exit App
      </button>
    </div>
  );
}
