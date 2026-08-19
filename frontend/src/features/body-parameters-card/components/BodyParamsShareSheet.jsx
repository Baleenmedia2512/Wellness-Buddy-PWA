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
const BodyParamsShareSheet = ({ isOpen, onClose, card, preCapCard, previousCard = null }) => {
  const cardRef           = useRef(null);
  const preCapRef         = useRef(null);
  const capturePromiseRef = useRef(null);
  const captureGenRef     = useRef(0);
  const capturedWithPrev  = useRef(false);
  const capturedKeyRef    = useRef('');
  const firedRef          = useRef(false);

  const typedVenue = String(preCapCard?.locationName || '').trim();
  const savedVenue = String(card?.locationName || '').trim();
  const venue = savedVenue || typedVenue;

  // Saved card is source of truth after persist; pre-cap fills in until then.
  const displayCard = card
    ? {
        ...preCapCard,
        ...card,
        locationName: venue,
        creatorName: card.creatorName || preCapCard?.creatorName || '',
      }
    : preCapCard;

  const captureKey = displayCard
    ? [
        displayCard.locationName,
        displayCard.name,
        displayCard.weightKg,
        displayCard.bmi,
        displayCard.fatPercent,
        displayCard.visceralFat,
        displayCard.bmr,
        previousCard?.id,
      ].map((v) => (v == null ? '' : String(v))).join('\u0001')
    : '';

  const doShare = useCallback(async () => {
    const userName = card?.name || preCapCard?.name || '';
    const coachName = card?.creatorName || card?.coachName || preCapCard?.creatorName || '';
    const caption = buildShareCaptionForImage(userName, venue, coachName);
    try {
      const dataUrl = preCapRef.current;
      if (dataUrl) {
        const result = await shareViaCapacitorAPI(dataUrl, {
          title:    `${card?.name || preCapCard?.name || 'Body'} Parameters`,
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
  }, [card, preCapCard, venue, onClose]);

  // Recapture whenever Venue (or other painted fields) change. Do not reuse a
  // stale pre-capture from an earlier venue / card.
  useEffect(() => {
    if (!displayCard || !captureKey) return;
    if (capturedKeyRef.current === captureKey && preCapRef.current) return;

    const needsPreviousLayout = Boolean(previousCard);
    const gen = ++captureGenRef.current;
    preCapRef.current = null;
    capturedWithPrev.current = false;
    capturePromiseRef.current = (async () => {
      await waitForPaint();
      if (gen !== captureGenRef.current || !cardRef.current) return null;
      const dataUrl = await precaptureShareImage(cardRef.current, CAPTURE_OPTS);
      if (gen !== captureGenRef.current) return null;
      preCapRef.current = dataUrl;
      capturedKeyRef.current = captureKey;
      capturedWithPrev.current = needsPreviousLayout;
      debugLog('⚡ [BodyParamsShare] Pre-capture ready', { venue: displayCard.locationName });
      return dataUrl;
    })();
  }, [captureKey, displayCard, previousCard]);

  // Share only after the capture for the current Venue is ready.
  useEffect(() => {
    if (!isOpen || !card) return;
    firedRef.current = false;
    let cancelled = false;

    const run = async () => {
      if (capturePromiseRef.current) {
        await capturePromiseRef.current;
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
  }, [isOpen, card, captureKey, doShare]);

  // Reset capture state when closed
  useEffect(() => {
    if (!isOpen && !preCapCard) {
      captureGenRef.current += 1;
      capturePromiseRef.current = null;
      preCapRef.current = null;
      capturedWithPrev.current = false;
      capturedKeyRef.current = '';
    }
  }, [isOpen, preCapCard]);

  if (!displayCard) return null;

  // Off-screen card — captured by html2canvas for WhatsApp image share.
  return (
    <div style={{ position: 'fixed', left: -9999, top: -9999, opacity: 0, pointerEvents: 'none' }}>
      <BodyParamsCardPreview ref={cardRef} card={displayCard} previousCard={previousCard} />
    </div>
  );
};

export default BodyParamsShareSheet;
