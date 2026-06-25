/**
 * @file Numeric / size limits used across the app.
 * Keep all magic numbers (request sizes, retry counts, debounce
 * durations, cache TTLs, image dimensions) here so they are tunable
 * in one place.
 */

/** Bytes in 1 MB (1024 * 1024). */
export const ONE_MB = 1024 * 1024;

/** Maximum request body size accepted by image-upload endpoints. */
export const MAX_UPLOAD_BYTES = 10 * ONE_MB;

/** Maximum dimension (px) for any user-uploaded image after resize. */
export const MAX_IMAGE_DIMENSION_PX = 1600;

/** JPEG quality used by client-side image compression. */
export const IMAGE_JPEG_QUALITY = 0.82;

/** Default network request timeout (ms). */
export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

/** Number of automatic retries for idempotent network calls. */
export const DEFAULT_FETCH_RETRIES = 1;

/** React Query staleTime / gcTime defaults (ms). */
export const QUERY_STALE_TIME_MS = 5 * 60 * 1000;
export const QUERY_GC_TIME_MS = 10 * 60 * 1000;

/** Default debounce delay for search / type-ahead inputs (ms). */
export const DEFAULT_DEBOUNCE_MS = 300;

/** Maximum allowed length for free-text user inputs. */
export const MAX_TEXT_INPUT_LEN = 500;

/** Pagination defaults. */
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** Maximum entries kept in client-side per-feature in-memory caches. */
export const CLIENT_CACHE_MAX_ENTRIES = 200;
