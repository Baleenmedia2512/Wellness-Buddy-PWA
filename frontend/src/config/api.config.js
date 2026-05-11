/**
 * Single source of truth for API configuration on the frontend.
 * Per VSA rules, this is the ONLY file allowed to read process.env for API config.
 * Components/services must import getApiBaseUrl() from here.
 */

const FALLBACK = 'http://localhost:3000';

export function getApiBaseUrl() {
  return process.env.REACT_APP_API_BASE_URL || FALLBACK;
}
