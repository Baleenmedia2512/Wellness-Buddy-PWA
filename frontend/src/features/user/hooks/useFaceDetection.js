// Face detection state — wraps faceDetection service.
// `awaitResult()` returns a Promise that resolves when the in-flight detection
// completes (used by save handlers to gate submission while detection runs).
import { useCallback, useRef, useState } from 'react';
import { detectFace } from '../services/faceDetection';

export default function useFaceDetection() {
  // status: "idle" | "detecting" | "face_found" | "no_face" | "detection_error"
  const [status, setStatus] = useState('idle');
  const promiseRef = useRef(null);
  const resolveRef = useRef(null);

  const reset = () => setStatus('idle');

  const run = useCallback(async (base64) => {
    promiseRef.current = new Promise((resolve) => { resolveRef.current = resolve; });
    setStatus('detecting');
    const result = await detectFace(base64);
    setStatus(result);
    resolveRef.current?.(result);
  }, []);

  const awaitResult = useCallback(async () => {
    if (status !== 'detecting') return status;
    if (!promiseRef.current) return status;
    return promiseRef.current;
  }, [status]);

  return { status, setStatus, run, reset, awaitResult };
}
