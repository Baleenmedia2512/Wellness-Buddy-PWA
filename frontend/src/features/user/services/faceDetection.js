// Face detection via secure backend proxy. Returns one of:
//   "face_found" | "no_face" | "detection_error"
// The Gemini API key is kept server-side — never exposed to the browser.
import { getApiBaseUrl } from '../../../config/api.config.js';

export const detectFace = async (base64String) => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/misc/detect-face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64String }),
    });
    const result = await res.json();
    // Backend returns { success: true, hasFace: true|false }
    if (result?.success && typeof result?.hasFace === 'boolean') {
      return result.hasFace ? 'face_found' : 'no_face';
    }
    return 'detection_error';
  } catch (err) {
    console.error('[faceDetection] failed:', err.message);
    return 'detection_error';
  }
};
