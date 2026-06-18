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
import { Capacitor } from '@capacitor/core';
import BodyParamsCardPreview from './BodyParamsCardPreview.jsx';
import { precaptureShareImage, shareImageWithLink, shareTextViaWhatsApp } from '../../../shared/utils/shareUtils.js';
import { buildShareText } from '../domain/platform-store.rules.js';
import { debugLog } from '../../../shared/utils/logger.js';

const NEEDS_IMAGE_CAPTURE = Capacitor.isNativePlatform();
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
    const textWithUrl    = buildShareText(shareUrl, card?.name);  // for web WhatsApp (URL in text)
    const textWithoutUrl = buildShareText(null,     card?.name);  // for native (url passed separately)
    try {
      if (NEEDS_IMAGE_CAPTURE && preCapRef.current) {
        await shareImageWithLink(preCapRef.current, shareUrl, {
          title:    `${card?.name || 'Body'} Parameters`,
          text:     textWithoutUrl,
          fileName: `wellness-body-params-${Date.now()}.jpg`,
        });
      } else {
        await shareTextViaWhatsApp(textWithUrl);
      }
      debugLog('✅ [BodyParamsShare] Auto-share completed');
    } catch {
      // User cancelled share sheet — that's fine.
    } finally {
      onClose();
    }
  }, [shareUrl, card, onClose]);

  // ⚡ Phase 1 — pre-capture starts as soon as preCapCard arrives
  // (runs IN PARALLEL with the API save; skipped on web — text-only share)
  useEffect(() => {
    if (!preCapCard || !NEEDS_IMAGE_CAPTURE) return;

    preCapRef.current = null;
    capturePromiseRef.current = (async () => {
      await waitForPaint();
      if (!cardRef.current) return null;
      const dataUrl = await precaptureShareImage(cardRef.current, CAPTURE_OPTS);
      preCapRef.current = dataUrl;
      debugLog('⚡ [BodyParamsShare] Pre-capture ready');
      return dataUrl;
    })();
  }, [preCapCard]);

  // ⚡ Phase 2 — once isOpen + shareUrl arrive, share immediately
  useEffect(() => {
    if (!isOpen || !card || !shareUrl) return;
    firedRef.current = false;
    let cancelled = false;

    const run = async () => {
      if (NEEDS_IMAGE_CAPTURE) {
        if (!preCapRef.current && capturePromiseRef.current) {
          preCapRef.current = await capturePromiseRef.current;
        }
        if (!preCapRef.current && cardRef.current) {
          preCapRef.current = await precaptureShareImage(cardRef.current, CAPTURE_OPTS);
        }
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

  // Off-screen card — needed for html2canvas on native only, not visible to user.
  return (
    <div style={{ position: 'fixed', left: -9999, top: -9999, opacity: 0, pointerEvents: 'none' }}>
      <BodyParamsCardPreview ref={cardRef} card={displayCard} previousCard={previousCard} />
    </div>
  );
};

export default BodyParamsShareSheet;
