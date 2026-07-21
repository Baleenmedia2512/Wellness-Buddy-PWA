/**
 * PermissionPrimerModal.jsx
 *
 * Shown ONCE on first native install, after the user authenticates.
 * Explains the permissions Wellness Valley needs — and WHY — before the
 * sequential per-permission OS dialogs appear.
 *
 * Industry pattern: Instagram / Headspace / Duolingo "permission primer".
 * - Never show OS system dialogs without context.
 * - One screen, one CTA, no friction.
 *
 * This component is ONLY used as the first-install intro screen. It is NOT
 * shown on permission denial or revocation — those cases are handled by
 * PermissionRequestDialog (canRequest: true) and PermissionSettingsGuide
 * (canRequest: false / permanently denied).
 *
 * Props:
 *   onContinue  - async fn: starts the sequential per-permission flow.
 */
import React, { useState } from 'react';
import wellnessValleyIcon from '../../assets/wellness-valley-icon.png';

const PERMISSIONS = [
  {
    icon: 'CAMERA',
    title: 'Camera',
    description: 'Snap your meal and get instant AI nutrition analysis.',
    required: true,
  },
  {
    icon: 'PIN',
    title: 'Location',
    description: 'Auto-check in at your nearest wellness center.',
    required: true,
  },
  {
    icon: 'BELL',
    title: 'Notifications',
    description: "We'll remind you to log meals, water, and your daily weight.",
    required: false,
  },
];

const ICON_MAP = { CAMERA: String.fromCodePoint(0x1F4F8), PIN: String.fromCodePoint(0x1F4CD), BELL: String.fromCodePoint(0x1F514) };

export default function PermissionPrimerModal({ onContinue }) {
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
            Allow permissions so Wellness Valley works its best. You will see OS prompts for Camera, Location, and Notifications.
          </p>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: '28px 20px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {PERMISSIONS.map(({ icon, title, description, required }) => (
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
              {ICON_MAP[icon]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 6,
                    background: required ? '#dcfce7' : '#f3f4f6',
                    color: required ? '#15803d' : '#9ca3af',
                    letterSpacing: '0.3px',
                    textTransform: 'uppercase',
                  }}
                >
                  {required ? 'Required' : 'Optional'}
                </span>
              </div>
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
          Camera and Location are required.
          Notifications are optional and can be changed in device Settings.
        </p>
      </div>

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
              <span>Starting permission setup…</span>
            </>
          ) : (
            'Allow Permissions - Continue'
          )}
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