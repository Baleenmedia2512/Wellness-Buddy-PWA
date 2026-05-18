/**
 * frontend/src/features/quick-share/hooks/useShareCapture.js
 * ---------------------------------------------------------------------------
 * Quick-share capture flow.
 *   1. takePhoto()                              (no confirm step)
 *   2. POST /api/quick-share/captures          (returns { token, viewUrl })
 *      Backend kicks off Gemini analysis in the background.
 *   3. shareImageDirectly(photo, { text: caption })
 *      Caption contains the public viewUrl so the recipient can open the
 *      analysis report without an account.
 *   4. onDone() → navigate Home.
 *
 * Failure policy: if the upload step fails (network, server, missing userId),
 * the share still happens — just without a caption — so the user is never
 * blocked by our backend. The error is surfaced via `errorMsg` for telemetry.
 * ---------------------------------------------------------------------------
 */
import { useState, useRef, useCallback } from 'react';
import { cameraService } from '../../../shared/services/cameraService';
import { shareImageDirectly } from '../../../shared/utils/shareUtils';
import { debugLog } from '../../../shared/utils/logger';
import { createCapture } from '../api/captures.client';
import { buildShareCaption } from '../domain/share-caption.rules';

/**
 * @param {{ onDone: () => void, userId?: string|number|null }} opts
 */
export function useShareCapture({ onDone, userId = null }) {
  const [status, setStatus]     = useState('idle'); // idle|capturing|uploading|sharing|done|error
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

      // Step 2 — upload (best-effort; never blocks the share)
      let viewUrl = '';
      if (userId != null && userId !== '') {
        try {
          setStatus('uploading');
          const resp = await createCapture({
            userId: String(userId),
            imageBase64: photo.src,
          });
          viewUrl = resp?.viewUrl || '';
        } catch (uploadErr) {
          debugLog('[useShareCapture] upload failed, sharing without caption', uploadErr?.message);
          setErrorMsg(uploadErr?.message || 'Upload failed');
          // intentionally swallow — proceed to share
        }
      }

      setStatus('sharing');
      await shareImageDirectly(photo.src, {
        title: 'Wellness Valley',
        text: buildShareCaption(viewUrl),
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
  }, [onDone, userId]);

  return { capture, status, errorMsg };
}
