/**
 * BodyParamsShareSheet.jsx
 *
 * Invisible component — renders the card off-screen for html2canvas,
 * then immediately fires WhatsApp share. No modal, no buttons shown.
 *
 * Accepts `preCapCard` (form data before API save completes) so html2canvas
 * runs IN PARALLEL with the API call — making share feel instant.
 */
import React, { useRef, useEffect, useCallback } from 'react';
import BodyParamsCardPreview from './BodyParamsCardPreview.jsx';
import {
  precaptureShareImage,
  shareViaCapacitorAPI,
  shareTextViaWhatsApp,
} from '../../../shared/utils/shareUtils.js';
import { buildShareCaptionForImage } from '../domain/platform-store.rules.js';
import { debugLog } from '../../../shared/utils/logger.js';

const CAPTURE_OPTS = { scale: 1.25, quality: 0.8, immediate: true };

/** Wait two animation frames so the off-screen card is painted before capture. */
const waitForPaint = () => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
});

/**
 * @param {{ isOpen, onClose, card, shareUrl, preCapCard, previousCard }} props
 */
const BodyParamsShareSheet = ({ isOpen, onClose, card, shareUrl, preCapCard, previousCard = null }) => {
  const cardRef           = useRef(null);
  const preCapRef         = useRef(null);
  const capturePromiseRef = useRef(null);
  const firedRef          = useRef(false);

  const doShare = useCallback(async () => {
    const coachName = card?.creatorName || card?.coachName || preCapCard?.creatorName || '';
    const venue = card?.locationName || preCapCard?.locationName || '';
    const caption = buildShareCaptionForImage(coachName, venue, shareUrl);
    try {
      const dataUrl = preCapRef.current;
      if (dataUrl) {
        const result = await shareViaCapacitorAPI(dataUrl, {
          title:    `${card?.name || 'Body'} Parameters`,
          text:     caption,
          fileName: `wellness-body-params-${Date.now()}.jpg`,
        });
        if (!result?.ok && !result?.dismissed) {
          await shareTextViaWhatsApp(caption);
        }
      } else {
        await shareTextViaWhatsApp(caption);
      }
      debugLog('✅ [BodyParamsShare] Auto-share completed');
    } catch {
      // User cancelled share sheet — that's fine.
    } finally {
      onClose();
    }
  }, [shareUrl, card, preCapCard, onClose]);

  // Pre-capture when form data or saved card is available (web + native).
  useEffect(() => {
    if (!preCapCard && !card) return;

    preCapRef.current = null;
    capturePromiseRef.current = (async () => {
      await waitForPaint();
      if (!cardRef.current) return null;
      const dataUrl = await precaptureShareImage(cardRef.current, CAPTURE_OPTS);
      preCapRef.current = dataUrl;
      debugLog('⚡ [BodyParamsShare] Pre-capture ready');
      return dataUrl;
    })();
  }, [preCapCard, card]);

  // Once isOpen + shareUrl arrive, share immediately.
  useEffect(() => {
    if (!isOpen || !card || !shareUrl) return;
    firedRef.current = false;
    let cancelled = false;

    const run = async () => {
      if (!preCapRef.current && capturePromiseRef.current) {
        preCapRef.current = await capturePromiseRef.current;
      }
      if (!preCapRef.current && cardRef.current) {
        preCapRef.current = await precaptureShareImage(cardRef.current, CAPTURE_OPTS);
      }

      if (cancelled || firedRef.current) return;
      firedRef.current = true;
      await doShare();
    };

    run();
    return () => { cancelled = true; };
  }, [isOpen, card, shareUrl, doShare]);

  // Reset capture state when closed
  useEffect(() => {
    if (!isOpen && !preCapCard) {
      capturePromiseRef.current = null;
      preCapRef.current = null;
    }
  }, [isOpen, preCapCard]);

  const displayCard = preCapCard || card;
  if (!displayCard) return null;

  // Off-screen card — captured by html2canvas for WhatsApp image share.
  return (
    <div style={{ position: 'fixed', left: -9999, top: -9999, opacity: 0, pointerEvents: 'none' }}>
      <BodyParamsCardPreview ref={cardRef} card={displayCard} previousCard={previousCard} />
    </div>
  );
};

export default BodyParamsShareSheet;
