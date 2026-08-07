// Profile photo acceptance — AI face verification disabled.
// Kept as a thin hook so existing save/auto-save callers keep working without
// calling /api/misc/detect-face or charging AI credits.
import { useCallback, useRef, useState } from 'react';

export default function useFaceDetection() {
  // status: "idle" | "face_found" (detecting / no_face / detection_error unused)
  const [status, setStatus] = useState('idle');
  const promiseRef = useRef(null);

  const reset = () => setStatus('idle');

  const run = useCallback(async (_base64, _userId = null) => {
    // Accept any photo — no AI face check.
    promiseRef.current = Promise.resolve('face_found');
    setStatus('face_found');
    return 'face_found';
  }, []);

  const awaitResult = useCallback(async () => {
    if (status === 'face_found') return 'face_found';
    if (promiseRef.current) return promiseRef.current;
    return status;
  }, [status]);

  return { status, setStatus, run, reset, awaitResult };
}
