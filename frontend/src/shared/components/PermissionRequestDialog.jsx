/**
 * PermissionRequestDialog.jsx
 *
 * In-app explanation dialog shown when a permission is needed and the OS CAN
 * still present a system dialog (canRequest: true / status: 'prompt').
 *
 * This is the screen the user sees BEFORE the native OS prompt appears.
 * Industry pattern used by Duolingo, Headspace, Instagram, etc.
 *
 * Behaviour:
 *   • "Allow"  → calls onAllow() which invokes the native OS permission request.
 *   • "Cancel" → calls onCancel().
 *     – For required permissions the caller keeps the app blocked.
 *     – For optional permissions the caller advances to the next step.
 *
 * Props:
 *   type         {string}   'camera' | 'location' | 'notifications'
 *   config       {object}   Entry from PERMISSION_CONFIG for this type.
 *   onAllow      {function} Called when user taps "Allow".
 *   onCancel     {function} Called when user taps "Cancel" / "Skip".
 *   loading      {boolean}  True while the OS dialog is pending.
 */
import React from 'react';

const COLORS = {
  camera:        { accent: '#16a34a', bg: '#dcfce7', text: '#15803d' },
  location:      { accent: '#2563eb', bg: '#dbeafe', text: '#1d4ed8' },
  notifications: { accent: '#d97706', bg: '#fef3c7', text: '#b45309' },
};

export default function PermissionRequestDialog({
  type,
  config,
  onAllow,
  onCancel,
  loading = false,
}) {
  const colors = COLORS[type] ?? COLORS.camera;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${config.label} permission request`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 0 env(safe-area-inset-bottom,0px)',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '24px 24px 0 0',
          width: '100%',
          maxWidth: 480,
          padding: '32px 24px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
        }}
      >
        {/* Drag handle */}
        <div
          aria-hidden="true"
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: '#e5e7eb',
            marginBottom: 28,
          }}
        />

        {/* Icon */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 22,
            background: colors.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
            marginBottom: 20,
          }}
        >
          {config.icon}
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#111827',
            margin: '0 0 10px',
            textAlign: 'center',
            lineHeight: 1.25,
            letterSpacing: '-0.3px',
          }}
        >
          Allow {config.label} Access
        </h2>

        {/* Reason */}
        <p
          style={{
            fontSize: 15,
            color: '#4b5563',
            textAlign: 'center',
            margin: '0 0 28px',
            lineHeight: 1.55,
            padding: '0 8px',
          }}
        >
          {config.reason}
        </p>

        {/* Required / Optional badge */}
        <div
          style={{
            padding: '6px 14px',
            borderRadius: 20,
            background: config.required ? '#dcfce7' : '#f3f4f6',
            color: config.required ? '#15803d' : '#6b7280',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            marginBottom: 28,
          }}
        >
          {config.required ? 'Required' : 'Optional'}
        </div>

        {/* Allow button */}
        <button
          type="button"
          onClick={onAllow}
          disabled={loading}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 16,
            border: 'none',
            background: loading
              ? '#86efac'
              : `linear-gradient(135deg, ${colors.accent} 0%, ${colors.text} 100%)`,
            color: '#ffffff',
            fontSize: 16,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: loading ? 'none' : `0 4px 14px ${colors.accent}55`,
            transition: 'all 0.15s ease',
            WebkitTapHighlightColor: 'transparent',
            marginBottom: 12,
          }}
        >
          {loading ? (
            <>
              <span
                style={{
                  width: 18,
                  height: 18,
                  border: '2.5px solid rgba(255,255,255,0.4)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: '_prd_spin 0.7s linear infinite',
                  display: 'inline-block',
                }}
              />
              <span>Waiting for permission…</span>
            </>
          ) : (
            `Allow ${config.label}`
          )}
        </button>

        {/* Cancel / Skip */}
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 16,
            border: '1.5px solid #e5e7eb',
            background: 'transparent',
            color: '#6b7280',
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {config.required ? 'Not Now' : 'Skip for Now'}
        </button>
      </div>

      <style>{`
        @keyframes _prd_spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
