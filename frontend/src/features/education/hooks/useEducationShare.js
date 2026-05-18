/**
 * useEducationShare.js — slice-internal hook.
 * Pre-captures the share image off the click path and exposes a single
 * `handleShare` callback. Keeps async work out of the JSX components.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  captureAndShare, precaptureShareImage, shareCachedDataUrl,
} from '../../../shared/utils/shareUtils';

export function useEducationShare({ educationData, imagePreview, deps = [] } = {}) {
  const [isSharing, setIsSharing] = useState(false);
  const shareRef = useRef(null);
  const cachedRef = useRef(null);

  useEffect(() => {
    cachedRef.current = null;
    if (!shareRef.current || !educationData || !imagePreview) return undefined;
    let cancelled = false;
    precaptureShareImage(shareRef.current).then((dataUrl) => {
      if (!cancelled) cachedRef.current = dataUrl;
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, [educationData, imagePreview, ...deps]);

  const handleShare = useCallback(async (e) => {
    if (e) { e.preventDefault?.(); e.stopPropagation?.(); }
    if (isSharing || !shareRef.current || !educationData) return;

    setIsSharing(true);
    await new Promise((r) => setTimeout(r, 0));
    try {
      const shareOpts = {
        title: `Education Session - ${educationData.topic}`,
        text: '',
        fileName: `wellness-valley-education-${educationData.topic.toLowerCase().replace(/\s+/g, '-')}.png`,
      };
      const cached = cachedRef.current;
      if (cached) {
        const ok = await shareCachedDataUrl(cached, shareOpts);
        if (ok) return;
      }
      await captureAndShare(shareRef.current, shareOpts);
    } catch (err) {
      // eslint-disable-next-line no-console -- FSM / lifecycle code — must reach crash reporters before logger is ready
      console.error('Failed to share:', err);
    } finally {
      setIsSharing(false);
    }
  }, [educationData, isSharing]);

  return { shareRef, isSharing, handleShare };
}
