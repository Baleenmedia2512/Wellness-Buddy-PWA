/**
 * PermissionBlockedDialog.jsx
 *
 * Minimal blocking overlay shown ONLY after a native permission request was
 * denied. It never appears before an OS prompt.
 *
 * Always shows both actions:
 *   [ Allow Again ]  — triggers the native OS permission request again.
 *   [ Exit App    ]  — exits the application.
 *
 * Props:
 *   type       {string}   'camera' | 'location' | 'notifications'
 *   config     {object}   Entry from PERMISSION_CONFIG for this type.
 *   canRequest {boolean}  true  → OS can still show a system dialog — show [Allow Again][Exit App].
 *                         false → permanently denied (Android "Don\'t ask again") — show [Exit App] only.
 *   onAllow    {function} Called when user taps "Allow Again".
 *   onExit     {function} Called when user taps "Exit App".
 *   loading    {boolean}  True while the OS dialog is open.
 */
import React from 'react';

const ACCENT = {
  camera:        '#16a34a',
  location:      '#2563eb',
  notifications: '#d97706',
};

export default function PermissionBlockedDialog({
  type,
  config,
  canRequest,
  onAllow,
  onExit,
  loading = false,
}) {
  const accent = ACCENT[type] ?? '#111827';

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={`${config.label} required`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.72)',
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
          padding: '32px 24px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Icon */}
        <div style={{ fontSize: 44, marginBottom: 18, lineHeight: 1 }}>
          {config.icon}
        </div>

        {/* Primary message */}
        <p
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: '#111827',
            textAlign: 'center',
            margin: '0 0 24px',
            lineHeight: 1.4,
          }}
        >
          {config.label} is required to continue.
        </p>

        {/* Allow Again — only when OS can still present a system dialog */}
        {canRequest && (
          <button
              type="button"
              onClick={onAllow}
              disabled={loading}
              style={{
                width: '100%',
                padding: '15px',
                borderRadius: 14,
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
              {loading ? 'Requesting…' : 'Allow Again'}
            </button>
        )}

        {/* Exit App */}
        <button
          type="button"
          onClick={onExit}
          style={{
            width: '100%',
            padding: '15px',
            borderRadius: 14,
            border: '1.5px solid #e5e7eb',
            background: 'transparent',
            color: '#374151',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Exit App
        </button>
      </div>
    </div>
  );
}
