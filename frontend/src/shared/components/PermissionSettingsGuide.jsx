/**
 * PermissionSettingsGuide.jsx
 *
 * Lightweight full-screen overlay shown when a permission is PERMANENTLY DENIED
 * (canRequest: false / status: 'denied') and the OS can no longer present a
 * system dialog. The only resolution path the OS allows is the app's Settings
 * page — so that is the only action offered.
 *
 * This component REPLACES the old "Quick Setup" screen (PermissionPrimerModal)
 * that was incorrectly shown in this situation. It is intentionally minimal:
 * no permission list, no intro text — just the blocked permission, the reason,
 * and a direct path to Settings.
 *
 * Behaviour:
 *   • "Open App Settings" → calls onOpenSettings() (usually openAppSettings()
 *     from permissionManager.js). The app then waits for the appStateChange
 *     listener to detect that the user returned and re-checks the permission.
 *   • "Exit" (required permissions only) → calls onExit() — exits or blocks app.
 *   • "Continue without" (optional permissions only) → calls onSkip().
 *
 * Props:
 *   type           {string}   'camera' | 'location' | 'notifications'
 *   config         {object}   Entry from PERMISSION_CONFIG for this type.
 *   onOpenSettings {function} Open the OS settings page for this app.
 *   onSkip         {function} (optional permissions only) continue without it.
 *   platform       {string}   'android' | 'ios' — used for platform-specific copy.
 */
import React from 'react';

const COLORS = {
  camera:        { accent: '#16a34a', bg: '#dcfce7', light: '#f0fdf4', border: '#bbf7d0' },
  location:      { accent: '#2563eb', bg: '#dbeafe', light: '#eff6ff', border: '#bfdbfe' },
  notifications: { accent: '#d97706', bg: '#fef3c7', light: '#fffbeb', border: '#fde68a' },
};

function PlatformSteps({ type, platform }) {
  const isIOS = platform === 'ios';

  if (type === 'camera') {
    return isIOS
      ? 'Settings → Wellness Valley → Camera → Allow'
      : 'Settings → Apps → Wellness Valley → Permissions → Camera → Allow';
  }
  if (type === 'location') {
    return isIOS
      ? 'Settings → Wellness Valley → Location → While Using or Always'
      : 'Settings → Apps → Wellness Valley → Permissions → Location → Allow';
  }
  if (type === 'notifications') {
    return isIOS
      ? 'Settings → Wellness Valley → Notifications → Allow Notifications'
      : 'Settings → Apps → Wellness Valley → Notifications → On';
  }
  return null;
}

export default function PermissionSettingsGuide({
  type,
  config,
  onOpenSettings,
  onSkip,
  platform = 'android',
}) {
  const colors = COLORS[type] ?? COLORS.camera;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${config.label} permission required — open Settings`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Header band */}
      <div
        style={{
          background: `linear-gradient(160deg, ${colors.accent} 0%, #111827 100%)`,
          padding: '60px 24px 44px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          flexShrink: 0,
        }}
      >
        {/* Large icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: 'rgba(255,255,255,0.15)',
            border: '1.5px solid rgba(255,255,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 40,
          }}
        >
          {config.icon}
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#ffffff',
              margin: 0,
              lineHeight: 1.25,
              letterSpacing: '-0.3px',
            }}
          >
            {config.label} Access Blocked
          </h1>
          <p
            style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.78)',
              margin: '8px 0 0',
              lineHeight: 1.5,
            }}
          >
            {config.required
              ? `${config.label} is required to use Wellness Valley.`
              : `${config.label} is needed for the best experience.`}
          </p>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          padding: '28px 20px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Why card */}
        <div
          style={{
            background: colors.light,
            border: `1.5px solid ${colors.border}`,
            borderRadius: 16,
            padding: '18px 18px',
          }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: colors.accent,
              margin: '0 0 6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Why {config.label}?
          </p>
          <p style={{ fontSize: 14, color: '#374151', margin: 0, lineHeight: 1.55 }}>
            {config.reason}
          </p>
        </div>

        {/* How to fix */}
        <div
          style={{
            background: '#f9fafb',
            border: '1.5px solid #e5e7eb',
            borderRadius: 16,
            padding: '18px 18px',
          }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#374151',
              margin: '0 0 8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            How to enable
          </p>
          <p
            style={{
              fontSize: 13,
              color: '#6b7280',
              margin: 0,
              lineHeight: 1.6,
              fontFamily: 'monospace',
              background: '#f3f4f6',
              borderRadius: 8,
              padding: '8px 10px',
              wordBreak: 'break-word',
            }}
          >
            <PlatformSteps type={type} platform={platform} />
          </p>
        </div>

        {/* Permanently blocked notice */}
        <div
          role="alert"
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            padding: '12px 14px',
            borderRadius: 12,
            background: '#fef2f2',
            border: '1.5px solid #fca5a5',
          }}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <p style={{ margin: 0, fontSize: 13, color: '#b91c1c', lineHeight: 1.5 }}>
            The OS has blocked further permission prompts for {config.label}.
            Tapping "Open App Settings" is the only way to grant it.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div
        style={{
          padding: '28px 20px 44px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onOpenSettings}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 16,
            border: 'none',
            background: `linear-gradient(135deg, ${colors.accent} 0%, #111827 100%)`,
            color: '#ffffff',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: `0 4px 16px ${colors.accent}44`,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span>⚙️</span>
          Open App Settings
        </button>

        {!config.required && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 16,
              border: '1.5px solid #e5e7eb',
              background: 'transparent',
              color: '#6b7280',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Continue without {config.label}
          </button>
        )}
      </div>
    </div>
  );
}
