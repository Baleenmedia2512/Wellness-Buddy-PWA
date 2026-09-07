/**
 * BodyParamsShareSheet.jsx
 *
 * Invisible: off-screen card for html2canvas, then native share.
 * Pre-captures while API saves; reuses image when capture key matches.
 */
import React, { useRef, useEffect, useCallback } from 'react';
import BodyParamsCardPreview from './BodyParamsCardPreview.jsx';
import {
  precaptureShareImage,
  shareViaCapacitorAPI,
  shareTextViaWhatsApp,
} from '../../../shared/utils/shareUtils.js';
import { buildShareCaptionForImage } from '../domain/platform-store.rules.js';
import { getShareCardCaptureKey } from '../domain/shareCardCaptureKey.js';
import { mergeDisplayCard } from '../domain/mergeDisplayCard.js';
import {
  setShareCapturePromise,
  setShareCaptureResult,
  getShareCaptureForKey,
  clearShareCaptureCache,
} from '../utils/bcmShareCaptureCache.js';
import { debugLog } from '../../../shared/utils/logger.js';

const CAPTURE_OPTS = { scale: 1.25, quality: 0.8, immediate: true };
const waitForPaint = () => new Promise((r) => {
  requestAnimationFrame(() => requestAnimationFrame(r));
});

const BodyParamsShareSheet = ({
  isOpen, onClose, card, preCapCard, previousCard = null,
  preparedImageUrl = null, preparedImageKey = null,
}) => {
  const cardRef = useRef(null);
  const firedRef = useRef(false);
  const captureGenRef = useRef(0);

  const displayCard = mergeDisplayCard(card, preCapCard);
  const captureKey = displayCard
    ? getShareCardCaptureKey(displayCard, card ? previousCard : null)
    : '';

  const doShare = useCallback(async (dataUrl) => {
    const userName = card?.name || preCapCard?.name || '';
    const coachName = card?.creatorName || card?.coachName || preCapCard?.creatorName || '';
    const venue = String(card?.locationName || preCapCard?.locationName || '').trim();
    const caption = buildShareCaptionForImage(userName, venue, coachName);
    try {
      if (dataUrl) {
        const result = await shareViaCapacitorAPI(dataUrl, {
          title: `${card?.name || preCapCard?.name || 'Body'} Parameters`,
          text: caption,
          fileName: `wellness-body-params-${Date.now()}.jpg`,
        });
        if (!result?.ok && !result?.dismissed) await shareTextViaWhatsApp(caption);
      } else {
        await shareTextViaWhatsApp(caption);
      }
      debugLog('✅ [BodyParamsShare] share completed', { hadImage: Boolean(dataUrl) });
    } catch {
      /* user cancelled */
    } finally {
      onClose();
    }
  }, [card, preCapCard, onClose]);

  // Pre-capture while API runs (preCapCard only — no previousCard yet).
  useEffect(() => {
    if (!displayCard || !captureKey || card) return undefined;
    const gen = ++captureGenRef.current;
    const run = (async () => {
      await waitForPaint();
      if (gen !== captureGenRef.current || !cardRef.current) return null;
      const t0 = performance.now();
      const dataUrl = await precaptureShareImage(cardRef.current, CAPTURE_OPTS);
      debugLog('⚡ [BodyParamsShare] pre-capture', { ms: Math.round(performance.now() - t0), ok: Boolean(dataUrl) });
      if (gen !== captureGenRef.current) return null;
      if (dataUrl) setShareCaptureResult(captureKey, dataUrl);
      return dataUrl;
    })();
    setShareCapturePromise(captureKey, run);
    return undefined;
  }, [captureKey, displayCard, card]);

  // Share when saved card is ready — reuse pre-cap if key matches.
  useEffect(() => {
    if (!isOpen || !card || !captureKey) return undefined;
    firedRef.current = false;
    let cancelled = false;

    const run = async () => {
      const t0 = performance.now();
      let dataUrl = (preparedImageUrl && preparedImageKey === captureKey)
        ? preparedImageUrl
        : await getShareCaptureForKey(captureKey);

      if (!dataUrl && cardRef.current) {
        await waitForPaint();
        if (cancelled) return;
        const tCap = performance.now();
        dataUrl = await precaptureShareImage(cardRef.current, CAPTURE_OPTS);
        debugLog('⚡ [BodyParamsShare] final capture', { ms: Math.round(performance.now() - tCap), ok: Boolean(dataUrl) });
        if (dataUrl) setShareCaptureResult(captureKey, dataUrl);
      } else if (dataUrl) {
        debugLog('⚡ [BodyParamsShare] reused pre-capture', { ms: Math.round(performance.now() - t0) });
      }

      if (cancelled || firedRef.current) return;
      firedRef.current = true;
      debugLog('⏱️ [BodyParamsShare] ready→sheet', { ms: Math.round(performance.now() - t0) });
      await doShare(dataUrl);
    };

    run();
    return () => { cancelled = true; };
  }, [isOpen, card, captureKey, preparedImageUrl, preparedImageKey, doShare]);

  useEffect(() => {
    if (!isOpen && !preCapCard) {
      captureGenRef.current += 1;
      clearShareCaptureCache();
      firedRef.current = false;
    }
  }, [isOpen, preCapCard]);

  if (!displayCard) return null;

  return (
    <div style={{ position: 'fixed', left: -9999, top: -9999, opacity: 0, pointerEvents: 'none' }}>
      <BodyParamsCardPreview ref={cardRef} card={displayCard} previousCard={card ? previousCard : null} />
    </div>
  );
};

export default BodyParamsShareSheet;
