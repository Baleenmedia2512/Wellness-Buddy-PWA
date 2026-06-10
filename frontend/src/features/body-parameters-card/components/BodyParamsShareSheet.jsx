/**
 * BodyParamsShareSheet.jsx
 *
 * Invisible component — renders the card off-screen for html2canvas,
 * then immediately fires WhatsApp share. No modal, no buttons shown.
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import BodyParamsCardPreview from './BodyParamsCardPreview.jsx';
import { precaptureShareImage, shareImageWithLink, shareTextViaWhatsApp } from '../../../shared/utils/shareUtils.js';
import { buildShareText } from '../domain/platform-store.rules.js';
import { debugLog } from '../../../shared/utils/logger.js';

/**
 * @param {{ isOpen, onClose, card, shareUrl }} props
 */
const BodyParamsShareSheet = ({ isOpen, onClose, card, shareUrl }) => {
  const cardRef      = useRef(null);
  const preCapRef    = useRef(null);
  const firedRef     = useRef(false);

  const doShare = useCallback(async () => {
    const text = buildShareText(shareUrl, card?.name);
    try {
      if (Capacitor.isNativePlatform() && preCapRef.current) {
        await shareImageWithLink(preCapRef.current, shareUrl, text, `${card?.name || 'Body'} Parameters`);
      } else {
        await shareTextViaWhatsApp(text);
      }
      debugLog('✅ [BodyParamsShare] Auto-share completed');
    } catch {
      // User cancelled share sheet — that's fine.
    } finally {
      onClose();
    }
  }, [shareUrl, card, onClose]);

  useEffect(() => {
    if (!isOpen || !card || !shareUrl) return;
    firedRef.current = false;
    let cancelled = false;

    const run = async () => {
      // Let the off-screen card render first.
      await new Promise((r) => setTimeout(r, 100));
      if (cancelled) return;

      // Capture card image for native share.
      if (cardRef.current) {
        const dataUrl = await precaptureShareImage(cardRef.current, { scale: 1.5, quality: 0.85 });
        if (!cancelled) preCapRef.current = dataUrl;
      }

      if (cancelled || firedRef.current) return;
      firedRef.current = true;
      await doShare();
    };

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, card, shareUrl]);

  if (!isOpen || !card) return null;

  // Off-screen card — needed for html2canvas only, not visible to user.
  return (
    <div style={{ position: 'fixed', left: -9999, top: -9999, opacity: 0, pointerEvents: 'none' }}>
      <BodyParamsCardPreview ref={cardRef} card={card} />
    </div>
  );
};

export default BodyParamsShareSheet;

