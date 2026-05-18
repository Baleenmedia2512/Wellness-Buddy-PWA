/**
 * frontend/src/features/quick-share/hooks/useQuickShareEntry.js
 * ---------------------------------------------------------------------------
 * Manages the camera-first entry routing logic.
 *
 * Exposes:
 *   - showCamera (boolean) — whether to render the QuickShareCamera screen
 *   - dismissCamera ()     — navigate away from camera (no capture)
 *   - onCaptured ()        — called by QuickShareCamera after share flow ends
 *
 * Reads feature-flag + role preference from sessionStorage so it survives
 * app resume without an extra API call.
 *
 * Per claude.md §2.5, persisted state goes through the session storage
 * wrapper (sessionStorage.js) — never direct localStorage.
 * ---------------------------------------------------------------------------
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { shouldShowCamera, resolveAppStateFromEvent } from '../domain/entry-route.rules.js';

/**
 * @param {{
 *   userId: string|null,
 *   userRole: string,
 *   cameraFirstEnabled: boolean,
 * }} opts
 */
export function useQuickShareEntry({ userId, userRole, cameraFirstEnabled }) {
  const [showCamera, setShowCamera] = useState(false);
  const bgTimestampRef = useRef(null); // when did app go to background

  // ── Cold-start check ───────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return; // not authenticated yet
    const shouldShow = shouldShowCamera({
      cameraFirstEnabled,
      userRole,
      appState: 'cold-start',
    });
    if (shouldShow) setShowCamera(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // only run once when userId becomes available

  // ── Resume-from-background / lock-screen check ─────────────────────────
  useEffect(() => {
    if (!userId || !cameraFirstEnabled) return;

    let handle;
    (async () => {
      handle = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          // App going to background — record timestamp
          bgTimestampRef.current = Date.now();
          return;
        }
        // App coming to foreground
        const backgroundedForMs = bgTimestampRef.current
          ? Date.now() - bgTimestampRef.current
          : 0;
        bgTimestampRef.current = null;

        const appState = resolveAppStateFromEvent({
          isActive: true,
          wasInBackground: backgroundedForMs > 0,
          backgroundedForMs,
        });

        const shouldShow = shouldShowCamera({ cameraFirstEnabled, userRole, appState });
        if (shouldShow) setShowCamera(true);
      });
    })();

    return () => {
      handle?.remove?.();
    };
  }, [userId, cameraFirstEnabled, userRole]);

  const dismissCamera = useCallback(() => setShowCamera(false), []);
  const onCaptured    = useCallback(() => setShowCamera(false), []);

  return { showCamera, dismissCamera, onCaptured };
}
