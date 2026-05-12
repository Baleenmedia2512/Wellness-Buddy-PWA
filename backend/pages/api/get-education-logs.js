import { getSupabaseClient } from '../../utils/supabaseClient.js';

export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // CORS handling
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
    res.status(200).end();
    return;
  }

  // Only accept GET
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  // Get userId + optional pagination from query params
  const { userId, limit, offset, includeImage } = req.query;

  // Validation
  if (!userId) {
    res.status(400).json({
      success: false,
      message: 'userId is required'
    });
    return;
  }

  // ✅ Pagination: when limit is provided, fetch only that page
  const parsedLimit = limit !== undefined && limit !== null && limit !== ''
    ? parseInt(limit, 10)
    : null;
  const parsedOffset = offset !== undefined && offset !== null && offset !== ''
    ? parseInt(offset, 10)
    : 0;
  const useLimit = Number.isFinite(parsedLimit) && parsedLimit > 0;
  const fromIdx = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
  // Default behaviour: include the truncated thumbnail (back-compat).
  // Pass `includeImage=false` to omit it entirely (cards lazy-fetch via
  // /api/get-education-log-image when scrolled into view).
  const wantImage = includeImage === undefined ? true : (includeImage === 'true' || includeImage === true);

  try {
    // Database connection
    const supabase = getSupabaseClient();

    // Fetch education logs (exclude soft-deleted)
    // NOTE: We fetch ImageBase64 but truncate it in the response — returning the
    // full base64 for many rows bloats the payload and causes 431 errors when the
    // service worker tries to replay the cached response as a request header.
    const selectFields = wantImage
      ? '"Id", "Platform", "Topic", "CreatedAt", "Confidence", "ImageBase64"'
      : '"Id", "Platform", "Topic", "CreatedAt", "Confidence"';

    let query = supabase
      .from('education_logs_table')
      .select(selectFields)
      .eq('"UserId"', userId)
      .or('"IsDeleted".is.null,"IsDeleted".eq.0')
      .order('"CreatedAt"', { ascending: false });

    if (useLimit) {
      query = query.range(fromIdx, fromIdx + parsedLimit - 1);
    } else {
      // Back-compat: legacy callers expect up to 100 rows
      query = query.limit(100);
    }

    const { data: logs, error } = await query;

    if (error) throw error;

    // Optionally compute total count for pagination clients
    let totalCount = (logs || []).length;
    let hasMore = false;
    if (useLimit) {
      const { count, error: countError } = await supabase
        .from('education_logs_table')
        .select('"Id"', { count: 'exact', head: true })
        .eq('"UserId"', userId)
        .or('"IsDeleted".is.null,"IsDeleted".eq.0');
      if (!countError && typeof count === 'number') {
        totalCount = count;
        hasMore = (fromIdx + (logs || []).length) < count;
      } else {
        // Fallback: assume more if we filled the page
        hasMore = (logs || []).length === parsedLimit;
      }
    }

    // Truncate ImageBase64 to a small thumbnail prefix for the list view.
    // The full image is only needed when a card is opened (EducationCardModal).
    const THUMB_CHARS = 5000; // ~3.75 KB — enough for a blurry 56×56 thumbnail
    const trimmedLogs = (logs || []).map(log => ({
      ...log,
      ImageBase64: wantImage
        ? (log.ImageBase64
            ? (log.ImageBase64.length > THUMB_CHARS
                ? log.ImageBase64.slice(0, THUMB_CHARS)   // truncated thumbnail
                : log.ImageBase64)                          // already small — keep as-is
            : null)
        : null,
      // hasFullImage: when image data was omitted from the SELECT, we can't
      // know for sure — assume true so the card will attempt a lazy fetch
      // (the image API will return success:false if none exists).
      hasFullImage: wantImage
        ? !!(log.ImageBase64 && log.ImageBase64.length > 0)
        : true,
    }));

    res.status(200).json({
      success: true,
      count: trimmedLogs.length,
      logs: trimmedLogs,
      pagination: useLimit
        ? { limit: parsedLimit, offset: fromIdx, total: totalCount, hasMore }
        : null,
    });
    return;

  } catch (error) {

    console.error('❌ Fetch education logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch education logs',
      error: error.message
    });
    return;
  }
}
