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

/**
 * @param {{ isOpen, onClose, card, shareUrl, preCapCard }} props
 */
const BodyParamsShareSheet = ({ isOpen, onClose, card, shareUrl, preCapCard }) => {
  const cardRef      = useRef(null);
  const preCapRef    = useRef(null);
  const firedRef     = useRef(false);
  const capturingRef = useRef(false);

  const doShare = useCallback(async () => {
    const text = buildShareText(shareUrl, card?.name);
    try {
      if (Capacitor.isNativePlatform() && preCapRef.current) {
        await shareImageWithLink(preCapRef.current, shareUrl, {
          title:    `${card?.name || 'Body'} Parameters`,
          text,
          fileName: `wellness-body-params-${Date.now()}.jpg`,
        });
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

  // ⚡ Phase 1 — pre-capture starts as soon as preCapCard arrives
  // (runs IN PARALLEL with the API save)
  useEffect(() => {
    if (!preCapCard || capturingRef.current) return;
    capturingRef.current = true;
    preCapRef.current = null;

    const run = async () => {
      // Small tick so the hidden card renders into the DOM first.
      await new Promise((r) => setTimeout(r, 80));
      if (!cardRef.current) return;
      const dataUrl = await precaptureShareImage(cardRef.current, { scale: 1.5, quality: 0.85 });
      preCapRef.current = dataUrl;
      debugLog('⚡ [BodyParamsShare] Pre-capture ready');
    };
    run();
  }, [preCapCard]);

  // ⚡ Phase 2 — once isOpen + shareUrl arrive, share immediately
  // (image is likely already captured from Phase 1)
  useEffect(() => {
    if (!isOpen || !card || !shareUrl) return;
    firedRef.current = false;
    let cancelled = false;

    const run = async () => {
      // If pre-capture not done yet, wait briefly for it (max 1.5s)
      if (!preCapRef.current) {
        const deadline = Date.now() + 1500;
        while (!preCapRef.current && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 50));
        }
      }
      if (cancelled || firedRef.current) return;
      firedRef.current = true;

      // Fallback: if pre-capture failed, try live capture now
      if (!preCapRef.current && cardRef.current) {
        preCapRef.current = await precaptureShareImage(cardRef.current, { scale: 1.5, quality: 0.85 });
      }

      await doShare();
    };

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, card, shareUrl]);

  // Reset capturing flag when closed
  useEffect(() => {
    if (!isOpen && !preCapCard) {
      capturingRef.current = false;
      preCapRef.current = null;
    }
  }, [isOpen, preCapCard]);

  const displayCard = preCapCard || card;
  if (!displayCard) return null;

  // Off-screen card — needed for html2canvas only, not visible to user.
  return (
    <div style={{ position: 'fixed', left: -9999, top: -9999, opacity: 0, pointerEvents: 'none' }}>
      <BodyParamsCardPreview ref={cardRef} card={displayCard} />
    </div>
  );
};

export default BodyParamsShareSheet;

