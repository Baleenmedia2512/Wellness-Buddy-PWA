/**
 * MarathonShareSheet.jsx
 *
 * Invisible orchestrator — renders card(s) off-screen for html2canvas,
 * then fires the WhatsApp share sheet.
 *
 * Pattern mirrors BodyParamsShareSheet.jsx exactly:
 *  Phase 1 — pre-capture: starts as soon as `card` prop arrives (parallel with nothing here)
 *  Phase 2 — share:      fires once `isOpen` + `shareUrl` are set
 *
 * Props:
 *   isOpen      {boolean}     — trigger share (set true once API responds)
 *   onClose     {function}    — called after share or cancel
 *   card        {object}      — card data from API (must include cardType)
 *   shareUrl    {string|null} — e.g. https://app.wellnessvalley.com/share/marathon/<token>
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { Capacitor }           from '@capacitor/core';
import MarathonLeaderCard      from './MarathonLeaderCard.jsx';
import MarathonTeamCard        from './MarathonTeamCard.jsx';
import {
  precaptureShareImage,
  shareImageWithLink,
  shareTextViaWhatsApp,
}                              from '../../../shared/utils/shareUtils.js';
import { debugLog }            from '../../../shared/utils/logger.js';

const NEEDS_IMAGE_CAPTURE = Capacitor.isNativePlatform();
const CAPTURE_OPTS        = { scale: 1.5, quality: 0.85, immediate: true };

const waitForPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

function buildShareText(shareUrl, card) {
  const { cardType, marathonName, lapNumber, dayNumber } = card || {};
  const label = cardType === 'day_leader'  ? 'Marathon Day Leader'
              : cardType === 'lap_leader'  ? 'Marathon Lap Leader'
              : cardType === 'team'        ? 'Marathon Team Card'
              : 'Marathon Community Leader';

  const context = marathonName ? ` · ${marathonName}` : '';
  const period  = lapNumber && dayNumber ? ` — Lap ${lapNumber}, Day ${dayNumber}` : '';
  const base    = `🏃 ${label}${context}${period}\n\nWellness Valley`;
  return shareUrl ? `${base}\n${shareUrl}` : base;
}

const MarathonShareSheet = ({ isOpen, onClose, card, shareUrl }) => {
  const cardRef           = useRef(null);
  const preCapRef         = useRef(null);
  const capturePromiseRef = useRef(null);
  const firedRef          = useRef(false);

  const doShare = useCallback(async () => {
    const textWithUrl    = buildShareText(shareUrl, card);
    const textWithoutUrl = buildShareText(null,     card);
    try {
      if (NEEDS_IMAGE_CAPTURE && preCapRef.current) {
        await shareImageWithLink(preCapRef.current, shareUrl, {
          title:    `Wellness Valley — ${card?.cardType || 'Marathon Card'}`,
          text:     textWithoutUrl,
          fileName: `wv-marathon-${card?.cardType || 'card'}-${Date.now()}.jpg`,
        });
      } else {
        await shareTextViaWhatsApp(textWithUrl);
      }
      debugLog('✅ [MarathonShare] Share completed');
    } catch {
      // User cancelled — normal
    } finally {
      onClose();
    }
  }, [shareUrl, card, onClose]);

  // Phase 1: pre-capture as soon as card data arrives (native only)
  useEffect(() => {
    if (!card || !NEEDS_IMAGE_CAPTURE) return;

    preCapRef.current         = null;
    capturePromiseRef.current = (async () => {
      await waitForPaint();
      if (!cardRef.current) return null;
      const dataUrl = await precaptureShareImage(cardRef.current, CAPTURE_OPTS);
      preCapRef.current = dataUrl;
      debugLog('⚡ [MarathonShare] Pre-capture ready');
      return dataUrl;
    })();
  }, [card]);

  // Phase 2: share once isOpen + shareUrl are ready
  useEffect(() => {
    if (!isOpen || !card || !shareUrl) return;
    firedRef.current = false;
    let cancelled    = false;

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

  // Reset on close
  useEffect(() => {
    if (!isOpen && !card) {
      capturePromiseRef.current = null;
      preCapRef.current         = null;
      firedRef.current          = false;
    }
  }, [isOpen, card]);

  if (!card) return null;

  const isLeaderCard = card.cardType === 'day_leader'
                    || card.cardType === 'lap_leader'
                    || card.cardType === 'community_leader';

  return (
    <div
      aria-hidden="true"
      style={{
        position:   'fixed',
        left:       '-9999px',
        top:        0,
        width:      400,
        pointerEvents: 'none',
        zIndex:     -1,
      }}
    >
      <div ref={cardRef}>
        {isLeaderCard
          ? <MarathonLeaderCard card={card} />
          : <MarathonTeamCard   card={card} />
        }
      </div>
    </div>
  );
};

export default MarathonShareSheet;
