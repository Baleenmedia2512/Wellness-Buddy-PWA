/**
 * frontend/src/features/quick-share/components/QuickShareCamera.jsx
 * ---------------------------------------------------------------------------
 * Full-screen camera-first capture UI.
 *
 * Tap shutter → cameraService.takePhoto() → shareImageDirectly() → Home.
 * No backend. No preview. Single shutter button.
 * ---------------------------------------------------------------------------
 */
import React, { useCallback } from 'react';
import { Camera as CapCamera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { useShareCapture } from '../hooks/useShareCapture';

/**
 * @param {{ onDone: () => void }} props
 */
export default function QuickShareCamera({ onDone }) {
  const { capture, status, errorMsg } = useShareCapture({ onDone });

  const handlePermissionDenied = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await CapCamera.requestPermissions({ permissions: ['camera'] });
      } catch {
        /* ignore — user must open Settings manually */
      }
    }
    onDone();
  }, [onDone]);

  const isBusy = status === 'capturing' || status === 'sharing';

  return (
    <div
      className="quick-share-camera"
      style={styles.overlay}
      aria-label="Quick share camera"
    >
      {/* Status / feedback */}
      {isBusy && (
        <div style={styles.statusBar} role="status" aria-live="polite">
          {status === 'capturing'  && 'Opening camera…'}
          {status === 'uploading'  && 'Uploading…'}
          {status === 'sharing'    && 'Opening share…'}
        </div>
      )}

      {/* Error / permission-denied state */}
      {status === 'error' && (
        <div style={styles.errorBox} role="alert">
          <p style={styles.errorText}>{errorMsg || 'Something went wrong'}</p>
          {errorMsg?.includes('permission') && (
            <button style={styles.settingsBtn} onClick={handlePermissionDenied}>
              Open Settings
            </button>
          )}
          <button style={styles.closeBtn} onClick={onDone}>
            Go Home
          </button>
        </div>
      )}

      {/* Close / skip button (top-left) */}
      {!isBusy && status !== 'error' && (
        <button
          style={styles.closeBtn}
          aria-label="Close camera"
          onClick={onDone}
        >
          ✕
        </button>
      )}

      {/* Shutter button (centre bottom) */}
      {!isBusy && status !== 'error' && (
        <button
          style={styles.shutterBtn}
          aria-label="Take photo and share"
          onClick={capture}
          disabled={isBusy}
        >
          <span style={styles.shutterInner} />
        </button>
      )}
    </div>
  );
}

// ─── Inline styles (no external CSS dependency) ───────────────────────────

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: '#000',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'flex-end',
    zIndex: 9999,
  },
  statusBar: {
    position: 'absolute', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#fff', fontSize: 16, fontWeight: 500,
    background: 'rgba(0,0,0,0.6)', padding: '8px 18px', borderRadius: 20,
  },
  shutterBtn: {
    width: 72, height: 72, borderRadius: '50%',
    border: '4px solid #fff', background: 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 48, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  shutterInner: {
    width: 54, height: 54, borderRadius: '50%',
    background: '#fff', display: 'block',
  },
  closeBtn: {
    position: 'absolute', top: 24, left: 20,
    background: 'rgba(0,0,0,0.5)', border: 'none',
    color: '#fff', fontSize: 20, padding: '6px 14px',
    borderRadius: 20, cursor: 'pointer',
  },
  errorBox: {
    position: 'absolute', top: '40%', left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(0,0,0,0.8)', borderRadius: 12,
    padding: 24, textAlign: 'center', maxWidth: 280,
  },
  errorText: { color: '#fff', marginBottom: 12, fontSize: 15 },
  settingsBtn: {
    display: 'block', width: '100%',
    background: '#25D366', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 0', marginBottom: 10,
    fontSize: 15, cursor: 'pointer',
  },
};
