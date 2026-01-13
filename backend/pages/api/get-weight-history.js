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
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { userId, includeImage = 'true' } =
    req.method === 'POST' ? req.body : req.query;

  if (!userId) {
    return res.status(400).json({
      message: 'Missing required field: userId',
    });
  }

  try {
    const supabase = getSupabaseClient();

    // Get weight history using Supabase
    const shouldIncludeImage = includeImage === 'true' || includeImage === true;
    const selectFields = shouldIncludeImage
      ? 'ID, UserId, Weight, Bmi, BodyFat, MuscleMass, Bmr, WeightImageBase64, CreatedAt'
      : 'ID, UserId, Weight, Bmi, BodyFat, MuscleMass, Bmr, CreatedAt';

    const { data: rows, error } = await supabase
      .from('weight_records_table')
      .select(selectFields)
      .eq('UserId', userId)
      .or('IsDeleted.is.null,IsDeleted.eq.0')
      .order('CreatedAt', { ascending: false });

    if (error) throw error;

    // ✅ Format CreatedAt as local time string (without UTC conversion)
    // MySQL stores local time, but mysql2 returns Date objects which get serialized as UTC
    const formattedRows = rows.map(row => ({
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

    // ✅ Calculate min/max/avg from the loaded data
    const weights = formattedRows.map(r => parseFloat(r.Weight)).filter(w => !isNaN(w));
    const globalMinWeight = weights.length > 0 ? Math.min(...weights) : null;
    const globalMaxWeight = weights.length > 0 ? Math.max(...weights) : null;
    const globalAvgWeight = weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : null;
    const totalCount = formattedRows.length;

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

    if (formattedRows.length > 0) {
      stats.latestWeight = {
        value: parseFloat(formattedRows[0].Weight),
        date: formattedRows[0].CreatedAt,
      };

      if (formattedRows.length > 1) {
        stats.previousWeight = {
          value: parseFloat(formattedRows[1].Weight),
          date: formattedRows[1].CreatedAt,
        };
        stats.weightChange =
          parseFloat(formattedRows[0].Weight) - parseFloat(formattedRows[1].Weight);
      }
    }
res.status(200).json({
      success: true,
      data: formattedRows,
      stats,
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
