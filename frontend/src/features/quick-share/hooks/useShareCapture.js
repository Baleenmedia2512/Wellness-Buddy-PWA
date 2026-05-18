/**
 * frontend/src/features/quick-share/hooks/useShareCapture.js
 * ---------------------------------------------------------------------------
 * Captures a photo and shares it directly using the existing shareUtils
 * infrastructure (shareImageDirectly → native share sheet / WhatsApp).
 *
 * No backend round-trip. Reuses:
 *   - cameraService.takePhoto()      (existing, returns base64 data URL)
 *   - shareImageDirectly(dataUrl)    (existing, handles Android fast-path)
 * ---------------------------------------------------------------------------
 */
import { useState, useRef, useCallback } from 'react';
import { cameraService } from '../../../shared/services/cameraService';
import { shareImageDirectly } from '../../../shared/utils/shareUtils';
import { debugLog } from '../../../shared/utils/logger';

/**
 * @param {{ onDone: () => void }} opts
 */
export function useShareCapture({ onDone }) {
  const [status, setStatus]   = useState('idle'); // idle|capturing|sharing|done|error
  const [errorMsg, setErrorMsg] = useState(null);
  const isFiringRef = useRef(false); // debounce double-tap

  const capture = useCallback(async () => {
    if (isFiringRef.current) return;
    isFiringRef.current = true;

    try {
      setStatus('capturing');
      setErrorMsg(null);

      const photo = await cameraService.takePhoto();
      if (!photo.success) {
        // User cancelled or permission denied — just go Home
        setStatus('idle');
        onDone();
        return;
      }

      setStatus('sharing');
      await shareImageDirectly(photo.src, {
        title: 'Wellness Valley',
        text: '',
        fileName: `wellness-${Date.now()}.jpg`,
        shareAsDocument: false,
      });

      setStatus('done');
    } catch (err) {
      debugLog('[useShareCapture] error', err?.message);
      setErrorMsg(err?.message || 'Something went wrong');
      setStatus('error');
    } finally {
      isFiringRef.current = false;
      onDone(); // always navigate Home
    }
  }, [onDone]);

  return { capture, status, errorMsg };
}
