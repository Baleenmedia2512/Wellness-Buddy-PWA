/**
 * useAdminBackButton.js — wires the Capacitor Android back button
 * to a close callback while this component is mounted.
 */
import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { debugLog } from '../../../shared/utils/logger.js';

export default function useAdminBackButton(onClose) {
  useEffect(() => {
    let listener;
    (async () => {
      try { listener = await CapacitorApp.addListener('backButton', () => onClose?.()); }
      catch (err) { debugLog('Back button handler not available:', err); }
    })();
    return () => { if (listener) listener.remove(); };
  }, [onClose]);
}
