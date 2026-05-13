/**
 * @file useAsyncState — minimal async state machine for one-shot
 * promise-returning operations (fetch, save, delete...).
 *
 * Returns `{ status, data, error, run, reset }`. Components can
 * branch on `status` ('idle' | 'pending' | 'success' | 'error')
 * instead of juggling separate loading/error booleans.
 */

import { useCallback, useRef, useState, useEffect } from 'react';

/**
 * @template T
 * @typedef {Object} AsyncState
 * @property {'idle'|'pending'|'success'|'error'} status
 * @property {T|null} data
 * @property {Error|null} error
 * @property {(...args: any[]) => Promise<T>} run
 * @property {() => void} reset
 */

/**
 * @template T
 * @param {(...args: any[]) => Promise<T>} asyncFn
 * @returns {AsyncState<T>}
 */
export function useAsyncState(asyncFn) {
  const [status, setStatus] = useState('idle');
  const [data, setData] = useState(/** @type {T|null} */ (null));
  const [error, setError] = useState(/** @type {Error|null} */ (null));

  const mountedRef = useRef(true);
  const fnRef = useRef(asyncFn);
  fnRef.current = asyncFn;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const run = useCallback(async (...args) => {
    setStatus('pending');
    setError(null);
    try {
      const result = await fnRef.current(...args);
      if (mountedRef.current) {
        setData(result);
        setStatus('success');
      }
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (mountedRef.current) {
        setError(e);
        setStatus('error');
      }
      throw e;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setData(null);
    setError(null);
  }, []);

  return { status, data, error, run, reset };
}
