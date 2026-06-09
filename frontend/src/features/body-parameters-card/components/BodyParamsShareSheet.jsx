/**
 * BodyParamsShareSheet.jsx
 *
 * Shown after a card is saved. Renders the card preview, allows
 * html2canvas capture, and fires the native Capacitor Share sheet.
 * On WhatsApp tap it sends a text link (same pattern as food share).
 */
import React, { useRef, useState, useEffect } from 'react';
import { Share as ShareIcon, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import BodyParamsCardPreview from './BodyParamsCardPreview.jsx';
import { precaptureShareImage, shareImageWithLink } from '../../../shared/utils/shareUtils.js';
import { buildShareText, getStoreLink } from '../domain/platform-store.rules.js';
import { debugLog } from '../../../shared/utils/logger.js';

/**
 * @param {{ isOpen, onClose, card, shareUrl }} props
 */
const BodyParamsShareSheet = ({ isOpen, onClose, card, shareUrl }) => {
  const cardRef      = useRef(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError]     = useState('');
  const preCapRef = useRef(null);

  // Pre-capture the card image on mount (idle time).
  useEffect(() => {
    if (!isOpen || !card) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!cardRef.current || cancelled) return;
      const dataUrl = await precaptureShareImage(cardRef.current, { scale: 2, quality: 0.9 });
      if (!cancelled) preCapRef.current = dataUrl;
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [isOpen, card]);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    setError('');
    try {
      const platform  = Capacitor.getPlatform();
      const storeLink = getStoreLink(platform);
      const text      = buildShareText(shareUrl, card?.name);

      // Try to share with image first; fall back to link-only text share.
      if (preCapRef.current) {
        await shareImageWithLink(preCapRef.current, shareUrl, text, `${card?.name || 'Body'} Parameters`);
      } else {
        // Minimal fallback: copy to clipboard
        await navigator.clipboard?.writeText(text).catch(() => {});
      }
      debugLog('✅ [BodyParamsShare] Share completed, storeLink:', storeLink);
      onClose();
    } catch (err) {
      setError('Could not open share sheet. Try copying the link below.');
    } finally {
      setSharing(false);
    }
  };

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
