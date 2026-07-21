/**
 * Device IANA timezone detection for automatic backend profile sync.
 * Never hardcodes a timezone — uses the platform Intl API.
 */

/**
 * @returns {string|undefined} IANA timezone when detectable; undefined when unavailable.
 */
export function getDeviceTimezoneIana() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof tz === 'string' && tz.trim()) {
      return tz.trim();
    }
  } catch {
    // Platform API unavailable — backend will fall back to Asia/Kolkata.
  }
  return undefined;
}
