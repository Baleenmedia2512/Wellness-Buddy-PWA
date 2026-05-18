/**
 * frontend/src/features/quick-share/index.js
 * Public API for the quick-share feature (claude.md §2.3).
 */
export { default as QuickShareCamera } from './components/QuickShareCamera';
export { useQuickShareEntry }          from './hooks/useQuickShareEntry';
export { useShareCapture }             from './hooks/useShareCapture';
export { createCapture }               from './api/captures.client';
export { buildShareCaption }           from './domain/share-caption.rules';
