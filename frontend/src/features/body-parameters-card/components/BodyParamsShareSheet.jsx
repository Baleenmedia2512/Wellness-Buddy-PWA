/**
 * BodyParamsShareSheet.jsx
 *
 * Shown after a card is saved. Renders the card preview, allows
 * html2canvas capture, and fires the native Capacitor Share sheet.
 * On WhatsApp tap it sends a text link (same pattern as food share).
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Share as ShareIcon, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import BodyParamsCardPreview from './BodyParamsCardPreview.jsx';
import { precaptureShareImage, shareImageWithLink, shareTextViaWhatsApp } from '../../../shared/utils/shareUtils.js';
import { buildShareText } from '../domain/platform-store.rules.js';
import { debugLog } from '../../../shared/utils/logger.js';

/**
 * @param {{ isOpen, onClose, card, shareUrl }} props
 */
const BodyParamsShareSheet = ({ isOpen, onClose, card, shareUrl }) => {
  const cardRef            = useRef(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError]     = useState('');
  const preCapRef          = useRef(null);
  const autoFiredRef       = useRef(false);   // prevent double-trigger

  // Pre-capture the card image; once done, auto-fire WhatsApp share.
  useEffect(() => {
    if (!isOpen || !card || !shareUrl) return;
    autoFiredRef.current = false;             // reset on each open
    let cancelled = false;

    const run = async () => {
      // Give the DOM a moment to paint the card.
      await new Promise((r) => setTimeout(r, 300));
      if (cancelled) return;

      // Capture image (best-effort — share still works without it).
      if (cardRef.current) {
        const dataUrl = await precaptureShareImage(cardRef.current, { scale: 2, quality: 0.9 });
        if (!cancelled) preCapRef.current = dataUrl;
      }

      if (cancelled || autoFiredRef.current) return;
      autoFiredRef.current = true;

      // ── Auto-open WhatsApp ──────────────────────────────────────────
      const text = buildShareText(shareUrl, card?.name);
      try {
        if (Capacitor.isNativePlatform() && preCapRef.current) {
          await shareImageWithLink(preCapRef.current, shareUrl, text, `${card?.name || 'Body'} Parameters`);
        } else {
          await shareTextViaWhatsApp(text);
        }
        debugLog('✅ [BodyParamsShare] Auto-share completed');
        if (!cancelled) onClose();
      } catch {
        // Share cancelled by user or WhatsApp not installed — sheet stays open.
      }
    };

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, card, shareUrl]);

  const handleShare = useCallback(async () => {
    if (sharing) return;
    autoFiredRef.current = true;
    setSharing(true);
    setError('');
    try {
      const text = buildShareText(shareUrl, card?.name);
      if (Capacitor.isNativePlatform() && preCapRef.current) {
        await shareImageWithLink(preCapRef.current, shareUrl, text, `${card?.name || 'Body'} Parameters`);
      } else {
        await shareTextViaWhatsApp(text);
      }
      debugLog('✅ [BodyParamsShare] Manual share completed');
      onClose();
    } catch {
      setError('Could not open WhatsApp. Try copying the link below.');
    } finally {
      setSharing(false);
    }
  }, [sharing, shareUrl, card, onClose]);

  if (!isOpen || !card) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[80] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <span className="font-bold text-sm">Card Ready — Share via WhatsApp</span>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full"><X size={18} /></button>
        </div>

        {/* Card preview — off-screen rendered for html2canvas */}
        <div className="flex justify-center py-4 overflow-hidden">
          <div style={{ transform: 'scale(0.82)', transformOrigin: 'top center' }}>
            <BodyParamsCardPreview ref={cardRef} card={card} />
          </div>
        </div>

        {/* Share URL */}
        <div className="mx-4 mb-3">
          <p className="text-xs text-gray-500 mb-1">Share link</p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-indigo-700 break-all select-all">
            {shareUrl}
          </div>
        </div>

        {error && <p className="text-xs text-red-600 mx-4 mb-2">{error}</p>}

        {/* Actions */}
        <div className="px-4 pb-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={handleShare}
            disabled={sharing}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ShareIcon size={16} />
            {sharing ? 'Sharing…' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BodyParamsShareSheet;
