/**
 * frontend/src/features/quick-share/hooks/useQuickShareEntry.js
 * ---------------------------------------------------------------------------
 * Orchestrates the camera-first capture flow:
 *
 * 1. Opens the camera on mount (and on app resume) for authenticated users.
 * 2. First capture of the day: runs synchronous AI type detection.
 *    - Weight → share immediately with weight photo.
 *    - Food/other → post to backend for background analysis + share with link.
 * 3. Subsequent captures: skip sync detection, post to backend immediately,
 *    show WhatsApp share button with the analysis link.
 * 4. After share or camera dismiss → calls onDismiss (→ showMainPage).
 * ---------------------------------------------------------------------------
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { debugLog } from '../../../shared/utils/logger.js';
import { imageTypeDetector } from '../../../shared/services/imageTypeDetector.js';
import { shareImageDirectly } from '../../../shared/utils/shareUtils.js';
import { postCapture } from '../api/captures.client.js';
import * as nativeLifecycle from '../../../shared/services/nativeLifecycle/index.js';
// daily-capture.rules.js exports are kept in the domain layer but the hook
// no longer needs a daily counter — AI detection always runs so weight photos
// are handled correctly regardless of how many captures were made today.
import { buildShareCaption, buildShareTitle } from '../domain/share-caption.rules.js';



/**
 * Convert a base64 string (with or without data-URL prefix) to a File.
 * @param {string} base64
 * @param {string} [filename]
 * @param {string} [mimeType]
 * @returns {File}
 */
function base64ToFile(base64, filename = 'capture.jpg', mimeType = 'image/jpeg') {
  const dataStr = base64.includes(',') ? base64 : `data:${mimeType};base64,${base64}`;
  const arr = dataStr.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

/**
 * @typedef {'idle'|'capturing'|'detecting'|'posting'|'share_ready'|'sharing'|'done'|'error'} CapturePhase
 */

/**
 * @param {{ user: object|null, onDismiss: () => void }} opts
 */
export function useQuickShareEntry({ user, onDismiss }) {
  /** @type {[CapturePhase, Function]} */
  const [phase, setPhase] = useState('idle');
  const [capturedDataUrl, setCapturedDataUrl] = useState(null); // data URL of taken photo
  const [imageType, setImageType] = useState(null);             // 'weight'|'food'|'education'|null
  const [viewUrl, setViewUrl] = useState(null);                 // backend public link (2nd+ photo)
  const [errorMsg, setErrorMsg] = useState('');

  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  // ── Native camera capture ─────────────────────────────────────────────────
  const triggerCapture = useCallback(async () => {
    if (!user) {
      debugLog('[useQuickShareEntry] No user — skipping camera');
      onDismiss();
      return;
    }

    setPhase('capturing');
    setErrorMsg('');
    setCapturedDataUrl(null);
    setImageType(null);
    setViewUrl(null);

    try {
      let dataUrl;
      let mimeType = 'image/jpeg';

      if (Capacitor.isNativePlatform()) {
        const photo = await Camera.getPhoto({
          quality: 85,
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
          allowEditing: false,
          correctOrientation: true,
          width: 1280,
          height: 1280,
        });

        if (!photo?.base64String) {
          // User dismissed without taking a photo
          debugLog('[useQuickShareEntry] Camera dismissed without photo');
          if (isMountedRef.current) onDismiss();
          return;
        }

        mimeType = photo.format === 'png' ? 'image/png' : 'image/jpeg';
        dataUrl = `data:${mimeType};base64,${photo.base64String}`;
      } else {
        // Web fallback: trigger hidden file input via a temporary <input> element
        dataUrl = await captureViaFileInput();
        if (!dataUrl) {
          debugLog('[useQuickShareEntry] Web file input cancelled');
          if (isMountedRef.current) onDismiss();
          return;
        }
        mimeType = dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      }

      if (!isMountedRef.current) return;
      setCapturedDataUrl(dataUrl);

      // Always run AI type detection so weight photos are correctly identified
      // regardless of how many captures have been made today.
      await handleFirstCapture(dataUrl, mimeType);
    } catch (err) {
      const cancelled =
        err?.message?.toLowerCase().includes('cancel') ||
        err?.message?.toLowerCase().includes('cancelled') ||
        err?.message === 'User cancelled photos app';

      if (cancelled) {
        debugLog('[useQuickShareEntry] Camera cancelled by user');
        if (isMountedRef.current) onDismiss();
        return;
      }

      debugLog('[useQuickShareEntry] Camera/capture error', err);
      if (isMountedRef.current) {
        setErrorMsg(err?.message || 'Camera failed. Please try again.');
        setPhase('error');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onDismiss + user are stable refs
  }, [user, onDismiss]);

  // ── First-capture flow: sync AI type detection ────────────────────────────
  const handleFirstCapture = useCallback(async (dataUrl, mimeType) => {
    setPhase('detecting');
    let detectedType = 'food';

    try {
      const imgFile = base64ToFile(
        dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl,
        'capture.jpg',
        mimeType,
      );
      await imageTypeDetector.initialize();
      const result = await imageTypeDetector.detectImageType(dataUrl, imgFile);
      detectedType = result?.type || 'food';
      debugLog('[useQuickShareEntry] First-photo AI detection:', detectedType);
    } catch (err) {
      debugLog('[useQuickShareEntry] Type detection failed, defaulting to food:', err?.message);
    }

    if (!isMountedRef.current) return;
    setImageType(detectedType);

    // For weight we don't need a backend link — share the photo directly.
    // For food (and other types) we still post to backend so the recipient
    // can see analysis. viewUrl will be set.
    if (detectedType !== 'weight') {
      await postCaptureToBackend(dataUrl, mimeType, detectedType);
    } else {
      setPhase('share_ready');
    }
  }, []);

  // ── POST to backend (background analysis) ────────────────────────────────
  const postCaptureToBackend = useCallback(async (dataUrl, mimeType, detectedType) => {
    const userId = user?.id || user?.Id || user?.userId;
    if (!userId) {
      debugLog('[useQuickShareEntry] No userId — showing share without link');
      if (isMountedRef.current) setPhase('share_ready');
      return;
    }

    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

    try {
      const result = await postCapture({ imageBase64: base64, mimeType, userId: String(userId) });
      if (isMountedRef.current) {
        setViewUrl(result.viewUrl);
        setImageType((prev) => prev || detectedType);
        setPhase('share_ready');
      }
    } catch (err) {
      debugLog('[useQuickShareEntry] postCapture failed:', err?.message);
      // Still show share button — just without the link
      if (isMountedRef.current) {
        setPhase('share_ready');
      }
    }
  }, [user]);

  // ── WhatsApp share ────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!capturedDataUrl) return;
    setPhase('sharing');

    const isBackground = phase === 'share_ready' && !!viewUrl;
    const caption = buildShareCaption({ imageType, viewUrl, isBackground });
    const title = buildShareTitle({ imageType });

    try {
      await shareImageDirectly(capturedDataUrl, {
        title,
        text: caption,
        fileName: imageType === 'weight' ? 'weight-update.jpg' : 'meal-analysis.jpg',
        shareAsDocument: false,
      });
      debugLog('[useQuickShareEntry] Share complete');
    } catch (err) {
      debugLog('[useQuickShareEntry] Share error (likely cancelled):', err?.message);
    } finally {
      if (isMountedRef.current) {
        setPhase('done');
        onDismiss(); // navigate to Home
      }
    }
  }, [capturedDataUrl, phase, viewUrl, imageType, onDismiss]);

  // App resume is handled by App.js which calls fileInputRef.current.openCamera()
  // so the existing ImageUpload flow (nutrition analysis) runs instead.

  return {
    phase,
    capturedDataUrl,
    imageType,
    viewUrl,
    errorMsg,
    triggerCapture,
    handleShare,
    dismiss: onDismiss,
  };
}

// ── Web fallback: capture via a temporary <input type="file"> ─────────────
function captureViaFileInput() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); document.body.removeChild(input); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target.result);
        document.body.removeChild(input);
      };
      reader.onerror = () => { resolve(null); document.body.removeChild(input); };
      reader.readAsDataURL(file);
    };

    input.oncancel = () => { resolve(null); document.body.removeChild(input); };
    // Trigger click on next tick so the DOM insertion completes first
    setTimeout(() => input.click(), 0);
  });
}
