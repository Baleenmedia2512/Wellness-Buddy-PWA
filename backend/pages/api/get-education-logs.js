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

  // Get userId from query params
  const { userId } = req.query;

  // Validation
  if (!userId) {
    res.status(400).json({
      success: false,
      message: 'userId is required'
    });
    return;
  }

  
  try {
    // Database connection
    const supabase = getSupabaseClient();

    // Fetch education logs (exclude soft-deleted)
    // NOTE: We fetch ImageBase64 but truncate it in the response — returning the
    // full base64 for 100 rows bloats the payload and causes 431 errors when the
    // service worker tries to replay the cached response as a request header.
    const { data: logs, error } = await supabase
      .from('education_logs_table')
      .select('"Id", "Platform", "Topic", "CreatedAt", "Confidence", "ImageBase64"')
      .eq('UserId', userId)
      .or('IsDeleted.is.null,IsDeleted.eq.0')
      .order('CreatedAt', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Truncate ImageBase64 to a small thumbnail prefix for the list view.
    // The full image is only needed when a card is opened (EducationCardModal).
    const THUMB_CHARS = 5000; // ~3.75 KB — enough for a blurry 56×56 thumbnail
    const trimmedLogs = (logs || []).map(log => ({
      ...log,
      ImageBase64: log.ImageBase64
        ? (log.ImageBase64.length > THUMB_CHARS
            ? log.ImageBase64.slice(0, THUMB_CHARS)   // truncated thumbnail
            : log.ImageBase64)                          // already small — keep as-is
        : null,
      hasFullImage: !!(log.ImageBase64 && log.ImageBase64.length > 0), // flag for modal
    }));

    res.status(200).json({
      success: true,
      count: trimmedLogs.length,
      logs: trimmedLogs,
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
