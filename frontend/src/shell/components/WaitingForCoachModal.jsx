/**
 * shell/components/WaitingForCoachModal.jsx
 * ---------------------------------------------------------------------------
 * Full-screen loading overlay shown while App.js sends a coach-OTP request
 * (the `isWaitingForCoachOTP` state). Previously inlined 4 times across the
 * early-return render branches and portal call sites.
 *
 * Extracted from App.js (2026-07-16) — visual design matches the primary
 * "HIGHEST PRIORITY" variant that was already the canonical first render.
 *
 * This component renders plain JSX (no portal). Call sites that need portal
 * mounting wrap it:  ReactDOM.createPortal(<WaitingForCoachModal />, document.body)
 * ---------------------------------------------------------------------------
 */
import React from 'react';

export function WaitingForCoachModal() {
  return (
    <div
      data-waiting-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '20px',
          padding: '40px',
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              border: '5px solid #22c55e',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'wv-spin 1s linear infinite',
            }}
          />
        </div>
        <h2
          style={{
            fontSize: '26px',
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '14px',
          }}
        >
          Contacting Your Sponsor...
        </h2>
        <p
          style={{
            color: '#6b7280',
            fontSize: '16px',
            lineHeight: '1.7',
            margin: 0,
          }}
        >
          Sending a verification request to your sponsor. This usually takes a
          few seconds.
        </p>
      </div>
      <style>{`@keyframes wv-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
