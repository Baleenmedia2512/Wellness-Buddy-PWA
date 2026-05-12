import { getSupabaseClient } from '../../utils/supabaseClient.js';

export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { userId, includeImage = 'true', limit, offset } =
    req.method === 'POST' ? req.body : req.query;

  if (!userId) {
    res.status(400).json({
      message: 'Missing required field: userId',
    });
    return;
  }

  try {
    const supabase = getSupabaseClient();

    // Get weight history using Supabase
    // Strategy: always fetch all records WITHOUT images first for stats/chart,
    // then fetch only the latest 10 WITH images — merge them together.
    // This prevents Vercel 4.5MB response limit from being hit.
    const shouldIncludeImage = includeImage === 'true' || includeImage === true;

    // ✅ Pagination: when limit is provided, fetch only that page
    const parsedLimit = limit !== undefined && limit !== null && limit !== ''
      ? parseInt(limit, 10)
      : null;
    const parsedOffset = offset !== undefined && offset !== null && offset !== ''
      ? parseInt(offset, 10)
      : 0;
    const useLimit = Number.isFinite(parsedLimit) && parsedLimit > 0;

    let query = supabase
    // Step 1: Fetch ALL records without images (lightweight)
    const { data: rows, error } = await supabase
      .from('weight_records_table')
      .select('ID, UserId, Weight, Bmi, BodyFat, MuscleMass, Bmr, CreatedAt')
      .eq('UserId', userId)
      .or('IsDeleted.is.null,IsDeleted.eq.0')
      .order('CreatedAt', { ascending: false });

    if (useLimit) {
      const from = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
      const to = from + parsedLimit - 1;
      query = query.range(from, to);
    }

    const { data: rows, error } = await query;

    if (error) throw error;

    // Step 2: If images requested, fetch only the latest 10 records WITH images
    let imageMap = {};
    if (shouldIncludeImage) {
      const { data: imageRows, error: imageError } = await supabase
        .from('weight_records_table')
        .select('ID, WeightImageBase64')
        .eq('UserId', userId)
        .or('IsDeleted.is.null,IsDeleted.eq.0')
        .order('CreatedAt', { ascending: false })
        .limit(10);

      if (!imageError && imageRows) {
        imageRows.forEach(r => {
          if (r.WeightImageBase64) imageMap[r.ID] = r.WeightImageBase64;
        });
      }
    }

    // Step 3: Merge image data into the full records
    const mergedRows = rows.map(row => ({
      ...row,
      WeightImageBase64: imageMap[row.ID] || null,
    }));

    // ✅ Format CreatedAt as local time string (without UTC conversion)
    // MySQL stores local time, but mysql2 returns Date objects which get serialized as UTC
    const formattedRows = mergedRows.map(row => ({
      ...row,
      CreatedAt: row.CreatedAt instanceof Date 
        ? row.CreatedAt.getFullYear() + '-' +
          String(row.CreatedAt.getMonth() + 1).padStart(2, '0') + '-' +
          String(row.CreatedAt.getDate()).padStart(2, '0') + 'T' +
          String(row.CreatedAt.getHours()).padStart(2, '0') + ':' +
          String(row.CreatedAt.getMinutes()).padStart(2, '0') + ':' +
          String(row.CreatedAt.getSeconds()).padStart(2, '0')
        : row.CreatedAt
    }));

    // ✅ Calculate min/max/avg from ALL data (separate lightweight query when paginating)
    let globalMinWeight = null;
    let globalMaxWeight = null;
    let globalAvgWeight = null;
    let totalCount = formattedRows.length;
    let latestRow = formattedRows[0] || null;
    let previousRow = formattedRows[1] || null;

    if (useLimit) {
      // Fetch all weights (no images) for accurate global stats + total count + latest/previous
      const { data: allRows, error: statsError } = await supabase
        .from('weight_records_table')
        .select('Weight, CreatedAt')
        .eq('UserId', userId)
        .or('IsDeleted.is.null,IsDeleted.eq.0')
        .order('CreatedAt', { ascending: false });

      if (!statsError && Array.isArray(allRows)) {
        const allWeights = allRows
          .map(r => parseFloat(r.Weight))
          .filter(w => !isNaN(w));
        globalMinWeight = allWeights.length > 0 ? Math.min(...allWeights) : null;
        globalMaxWeight = allWeights.length > 0 ? Math.max(...allWeights) : null;
        globalAvgWeight = allWeights.length > 0
          ? allWeights.reduce((a, b) => a + b, 0) / allWeights.length
          : null;
        totalCount = allRows.length;
        latestRow = allRows[0] || null;
        previousRow = allRows[1] || null;
      }
    } else {
      const weights = formattedRows.map(r => parseFloat(r.Weight)).filter(w => !isNaN(w));
      globalMinWeight = weights.length > 0 ? Math.min(...weights) : null;
      globalMaxWeight = weights.length > 0 ? Math.max(...weights) : null;
      globalAvgWeight = weights.length > 0
        ? weights.reduce((a, b) => a + b, 0) / weights.length
        : null;
    }

    // ✅ Calculate statistics
    let stats = {
      totalEntries: totalCount,
      latestWeight: null,
      previousWeight: null,
      weightChange: null,
      averageWeight: globalAvgWeight,
      minWeight: globalMinWeight,
      maxWeight: globalMaxWeight,
    };

    if (latestRow) {
      stats.latestWeight = {
        value: parseFloat(latestRow.Weight),
        date: latestRow.CreatedAt,
      };

      // ✅ Convert any timestamp to IST date string "YYYY-MM-DD"
      // All timestamps are stored as IST, but Supabase may return UTC-offset strings
      // (e.g. "2026-05-10T22:30:00+00:00" for an IST time of "2026-05-11T04:00:00+05:30").
      // Using plain substring(0,10) on a UTC string would make an early-morning IST entry
      // appear to be from the previous day, incorrectly triggering the "different date" filter.
      // Solution: always convert to IST (+5:30) before extracting the date portion.
      const getISTDateStr = (ts) => {
        if (!ts) return null;
        const d = new Date(ts);
        if (isNaN(d.getTime())) {
          // Fallback for already-formatted IST strings without timezone marker
          return String(ts).substring(0, 10);
        }
        // Add IST offset (UTC+5:30) to get the correct IST calendar date
        const istTime = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
        return istTime.toISOString().substring(0, 10); // "YYYY-MM-DD" in IST
      };

      // ✅ previousWeight = most recent entry from a DIFFERENT IST calendar date (yesterday or earlier)
      // This ensures the diff shown in WhatsApp/share card is today vs yesterday, not today's 2nd vs 1st entry
      const latestDateStr = getISTDateStr(formattedRows[0].CreatedAt); // "YYYY-MM-DD" in IST
      const prevEntry = formattedRows.find(
        (r, idx) => idx > 0 && getISTDateStr(r.CreatedAt) !== latestDateStr
      );

      if (prevEntry) {
        stats.previousWeight = {
          value: parseFloat(prevEntry.Weight),
          date: prevEntry.CreatedAt,
        };
        stats.weightChange =
          parseFloat(formattedRows[0].Weight) - parseFloat(prevEntry.Weight);
      }
    }

    const returnedOffset = useLimit && Number.isFinite(parsedOffset) && parsedOffset >= 0
      ? parsedOffset
      : 0;
    const hasMore = useLimit
      ? (returnedOffset + formattedRows.length) < totalCount
      : false;

    res.status(200).json({
      success: true,
      data: formattedRows,
      stats,
      pagination: {
        limit: useLimit ? parsedLimit : null,
        offset: returnedOffset,
        total: totalCount,
        hasMore,
      },
    });
  } catch (error) {
    console.error('❌ Database query error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve weight history',
      error: error.message,
    });
  }
}
