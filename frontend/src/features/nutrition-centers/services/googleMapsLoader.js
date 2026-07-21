/**
 * Singleton Google Maps script loader.
 * Prevents the script from being appended more than once regardless of how
 * many components request it concurrently.
 */

let loaderPromise = null;

/**
 * Loads the Google Maps JS API (with the Places library) exactly once per
 * page lifecycle.  Subsequent calls return the same Promise.
 *
 * @param {string} apiKey - REACT_APP_GOOGLE_MAPS_API_KEY value
 * @returns {Promise<void>} Resolves when window.google.maps is ready
 */
export function loadGoogleMaps(apiKey) {
  // Already loaded
  if (window.google && window.google.maps) {
    return Promise.resolve();
  }

  // Loading already in progress — share the same promise
  if (loaderPromise) {
    return loaderPromise;
  }

  loaderPromise = new Promise((resolve, reject) => {
    // Re-check after grabbing the promise slot (handles rapid concurrent calls)
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google && window.google.maps) {
        resolve();
      } else {
        loaderPromise = null; // allow retry
        reject(new Error('Google Maps failed to initialize properly'));
      }
    };

    script.onerror = () => {
      loaderPromise = null; // allow retry
      reject(new Error('Failed to load Google Maps. Please check your internet connection and API key.'));
    };

    document.head.appendChild(script);
  });

  return loaderPromise;
}
