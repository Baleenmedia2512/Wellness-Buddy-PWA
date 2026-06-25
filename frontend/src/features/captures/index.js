export { default as UnknownCaptureModal } from './components/UnknownCaptureModal.jsx';
export { default as UnknownShareViewer } from './components/UnknownShareViewer.jsx';
export { fetchUnknownShare, promoteUnknownToFood, deleteCapture, undoDeleteCapture } from './api/captureShareClient.js';
export {
  buildAnalysisFromGeminiAnalysis,
  hasRecognizedFood,
  isCaptureApiSuccess,
} from './domain/unknown-promotion.helpers';
