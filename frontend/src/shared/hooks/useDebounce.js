/**
 * @file useDebounce — returns a value that only updates after the
 * caller has stopped changing it for `delayMs`. Useful for
 * search-as-you-type, autosave, and resize handlers.
 */

import { useEffect, useState } from 'react';
import { DEFAULT_DEBOUNCE_MS } from '../constants/limits.js';

/**
 * @template T
 * @param {T} value     The latest value.
 * @param {number} [delayMs=DEFAULT_DEBOUNCE_MS]
 * @returns {T} The debounced value.
 */
export function useDebounce(value, delayMs = DEFAULT_DEBOUNCE_MS) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (delayMs <= 0) {
      setDebounced(value);
      return undefined;
    }
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
