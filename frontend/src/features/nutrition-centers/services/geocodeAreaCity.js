import { areaCityFromComponents } from '../domain/placeAreaCity.js';

/** Reverse-geocode a pin into area and city. Empty when Maps is not ready. */
export function geocodeAreaCity(lat, lng) {
  return new Promise((resolve) => {
    const maps = typeof window !== 'undefined' ? window.google?.maps : null;
    if (!maps || lat == null || lat === '' || lng == null || lng === '') {
      resolve({ area: '', city: '' });
      return;
    }
    const geocoder = new maps.Geocoder();
    geocoder.geocode(
      { location: { lat: Number(lat), lng: Number(lng) } },
      (results, status) => {
        if (status !== 'OK' || !results?.[0]) {
          resolve({ area: '', city: '' });
          return;
        }
        resolve(areaCityFromComponents(results[0].address_components));
      },
    );
  });
}
