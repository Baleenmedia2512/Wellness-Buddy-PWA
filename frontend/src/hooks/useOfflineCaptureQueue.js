/**
 * hooks/useOfflineCaptureQueue.js
 * ---------------------------------------------------------------------------
 * Drains photos captured while the device was offline as soon as network
 * connectivity is restored.
 *
 * Photos are written to the queue via captureQueue.enqueue() inside
 * handleImageSelect when navigator.onLine is false. This hook:
 *   1. Listens for the browser `online` event.
 *   2. On reconnect (or on mount if already online with pending items),
 *      flushes the queue and re-submits each photo through handleImageSelect
 *      with a 3-second gap between items to avoid server flooding.
 *
 * Extracted from App.js (2026-07-16) — behavior is byte-identical.
 *
 * @param {Function} handleImageSelect - App.js image-analysis entry point.
 *   Receives (file: File, exifTimestamp: string|null).
 * @param {Function} showToast         - transient toast notification callback.
 */
import { useState, useEffect } from 'react';
import * as captureQueue from '../shared/services/captureQueue';

export function useOfflineCaptureQueue(handleImageSelect, showToast) {
  // Incrementing this counter is the signal that triggers the drain effect.
  // Using a counter (not a boolean) means rapid online/offline cycles each
  // schedule their own drain pass without coalescing into a single one.
  const [_trigger, setTrigger] = useState(0);

  // Effect 1: register the wake listener and handle mount-time drain.
  useEffect(() => {
    // The setter form means the drain effect always receives the latest
    // handleImageSelect reference via its own dependency, not this closure.
    const wake = () => setTrigger((n) => n + 1);
    window.addEventListener('online', wake);
    // Process items queued during a previous offline session on mount.
    if (navigator.onLine && captureQueue.size() > 0) wake();
    return () => window.removeEventListener('online', wake);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- wake only uses stable setter

  // Effect 2: drain the queue each time the trigger increments.
  useEffect(() => {
    if (_trigger === 0 || !navigator.onLine) return;
    const items = captureQueue.flush();
    if (items.length === 0) return;
    showToast(
      `📶 Back online — processing ${items.length} queued photo${
        items.length === 1 ? '' : 's'
      }…`,
    );
    let idx = 0;
    const processNext = async () => {
      if (idx >= items.length) return;
      const item = items[idx++];
      try {
        const dataUrl = item.imageBase64.startsWith('data:')
          ? item.imageBase64
          : `data:image/jpeg;base64,${item.imageBase64}`;
        const res  = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], 'queued-capture.jpg', { type: 'image/jpeg' });
        handleImageSelect(file, item.exifTimestamp);
        setTimeout(processNext, 3000); // 3 s gap — avoids server flooding
      } catch (err) {
        console.warn('[CaptureQueue] Failed to process queued item:', err);
        setTimeout(processNext, 1000);
      }
    };
    processNext();
  }, [_trigger, handleImageSelect]); // eslint-disable-line react-hooks/exhaustive-deps
}
