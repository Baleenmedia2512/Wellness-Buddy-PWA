/**
 * @file Numeric / size limits used across the app.
 * Keep all magic numbers (request sizes, retry counts, debounce
 * durations, cache TTLs, image dimensions) here so they are tunable
 * in one place.
 */

/** Bytes in 1 MB (1024 * 1024). */
export const ONE_MB = 1024 * 1024;

/** API body budget after client compression (not a pick-time photo cap). */
export const MAX_UPLOAD_BYTES = 10 * ONE_MB;

/** Maximum dimension (px) for any user-uploaded image after resize. */
export const MAX_IMAGE_DIMENSION_PX = 1600;

/** JPEG quality used by client-side image compression. */
export const IMAGE_JPEG_QUALITY = 0.82;

/** Profile avatar: max side length (px) after crop. */
export const PROFILE_IMAGE_MAX_DIMENSION_PX = 256;

/** Profile avatar: starting JPEG quality (may step down to hit target bytes). */
export const PROFILE_IMAGE_JPEG_QUALITY = 0.65;

/** Profile avatar: max decoded JPEG size before base64 (~22 KB). Must match backend avatarJpeg.js. */
export const PROFILE_IMAGE_TARGET_BYTES = 22 * 1024;

/**
 * Diary / capture storage thumb after AI (or on pending capture write).
 * Analysis still uses ≤800px / q0.7 in memory; only DB persistence is tiny.
 */
export const STORAGE_IMAGE_MAX_DIMENSION_PX = 256;

/** Storage thumb: starting JPEG quality (steps down to hit target bytes). */
export const STORAGE_IMAGE_JPEG_QUALITY = 0.65;

/** Storage thumb: max decoded JPEG size (~22 KB). */
export const STORAGE_IMAGE_TARGET_BYTES = 22 * 1024;

/** Good Habit Manual Log images: ~30 KB after compression. */
export const GOOD_HABIT_IMAGE_TARGET_BYTES = 30 * 1024;

/** Good Habit share/storage max side length (px). */
export const GOOD_HABIT_IMAGE_MAX_DIMENSION_PX = 480;

/** Good Habit notes field. */
export const GOOD_HABIT_NOTES_MAX_LEN = 200;

/** Default network request timeout (ms). */
export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

/** Number of automatic retries for idempotent network calls. */
export const DEFAULT_FETCH_RETRIES = 1;

/** React Query staleTime / gcTime defaults (ms). */
export const QUERY_STALE_TIME_MS = 5 * 60 * 1000;
export const QUERY_GC_TIME_MS = 10 * 60 * 1000;

/** Default debounce delay for search / type-ahead inputs (ms). */
export const DEFAULT_DEBOUNCE_MS = 300;

/**
 * How often Diary re-fetches while background AI is in flight
 * ("Analyzing…" → typed row). Keep ≥10s to avoid Network-tab floods.
 */
export const DIARY_ANALYZING_POLL_MS = 10_000;

/** Maximum allowed length for free-text user inputs. */
export const MAX_TEXT_INPUT_LEN = 500;

/** Pagination defaults. */
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** Maximum entries kept in client-side per-feature in-memory caches. */
export const CLIENT_CACHE_MAX_ENTRIES = 200;
