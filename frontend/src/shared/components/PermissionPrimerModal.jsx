/**
 * PermissionPrimerModal.jsx
 *
 * Shown ONCE on first native install, after the user authenticates.
 * Explains the three permissions Wellness Valley needs — and WHY —
 * before the OS system dialogs appear.
 *
 * Industry pattern: Instagram / Headspace / Duolingo "permission primer".
 * - Never show OS system dialogs without context.
 * - One screen, one CTA, no friction.
 *
 * Props:
 *   onContinue — async fn: runs requestAllPermissions() then resolves.
 *   onSkip     — fn: fail-open path (user declines). Permissions can be
 *                granted later from Settings.
 */
import React, { useState } from 'react';
import wellnessValleyIcon from '../../assets/wellness-valley-icon.png';

const PERMISSIONS = [
  {
    icon: '📸',
    title: 'Camera',
    description: 'Snap your meal and get instant AI nutrition analysis.',
  },
  {
    icon: '🔔',
    title: 'Notifications',
    description: "We'll remind you to log meals, water, and your daily weight.",
  },
  {
    icon: '📍',
    title: 'Location',
    description: 'Auto-check in at your nearest wellness center.',
  },
];

export default function PermissionPrimerModal({ onContinue, onSkip }) {
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setLoading(true);
    try {
      await onContinue();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="App permissions setup"
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
      {/* ── Top gradient hero ── */}
      <div
        style={{
          background: 'linear-gradient(160deg, #16a34a 0%, #15803d 50%, #166534 100%)',
          padding: '52px 24px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 22,
            background: 'rgba(255,255,255,0.15)',
            border: '1.5px solid rgba(255,255,255,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}
        >
          <img
            src={wellnessValleyIcon}
            alt="Wellness Valley"
            style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 12 }}
          />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: '#ffffff',
              margin: 0,
              lineHeight: 1.25,
              letterSpacing: '-0.3px',
            }}
          >
            Quick setup
          </h1>
          <p
            style={{
              fontSize: 15,
              color: 'rgba(255,255,255,0.82)',
              margin: '6px 0 0',
              lineHeight: 1.4,
            }}
          >
            Allow 3 quick permissions so Wellness&nbsp;Valley works its best.
            You’ll see <strong style={{ color: '#fff' }}>3 OS prompts</strong> — one for Camera, Notifications, and Location.
          </p>
        </div>
      </div>

      {/* ── Permission cards ── */}
      <div
        style={{
          flex: 1,
          padding: '28px 20px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {PERMISSIONS.map(({ icon, title, description }) => (
          <div
            key={title}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              background: '#f9fafb',
              border: '1.5px solid #e5e7eb',
              borderRadius: 16,
              padding: '16px 18px',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                flexShrink: 0,
              }}
            >
              {icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#111827',
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {title}
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: '#6b7280',
                  margin: '3px 0 0',
                  lineHeight: 1.45,
                }}
              >
                {description}
              </p>
            </div>
          </div>
        ))}

        {/* Fine-print */}
        <p
          style={{
            fontSize: 11.5,
            color: '#9ca3af',
            textAlign: 'center',
            lineHeight: 1.5,
            marginTop: 4,
            padding: '0 8px',
          }}
        >
          You can change these anytime in your device&nbsp;Settings.
        </p>
      </div>

      {/* ── CTAs ── */}
      <div
        style={{
          padding: '24px 20px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={handleContinue}
          disabled={loading}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 16,
            border: 'none',
            background: loading
              ? '#86efac'
              : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
            color: '#ffffff',
            fontSize: 16,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: loading ? 'none' : '0 4px 14px rgba(22,163,74,0.35)',
            transition: 'all 0.15s ease',
            WebkitTapHighlightColor: 'transparent',
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
                  animation: '_primer_spin 0.7s linear infinite',
                  display: 'inline-block',
                }}
              />
              <span>Tap “Allow” on each of the 3 prompts…</span>
            </>
          ) : (
            'Allow All 3 Permissions → Continue'
          )}
        </button>

        <button
          type="button"
          onClick={onSkip}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 12,
            border: '1.5px solid #e5e7eb',
            background: '#f9fafb',
            color: '#6b7280',
            fontSize: 13,
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            WebkitTapHighlightColor: 'transparent',
            lineHeight: 1.4,
          }}
        >
          Not Now&nbsp;&nbsp;·&nbsp;&nbsp;
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            Some features may not work without permissions
          </span>
        </button>
      </div>

      <style>{`
        @keyframes _primer_spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
