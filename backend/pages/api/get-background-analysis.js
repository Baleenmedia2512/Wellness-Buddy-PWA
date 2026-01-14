import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { cache, cacheKeys } from '../../utils/cache.js';

export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { userId, limit = 50, offset = 0 } = req.query;

  if (!userId) {
    return res.status(400).json({ message: 'UserId is required' }); 
  }

  try {
    const supabase = getSupabaseClient();
    
    // Get pagination params
    const limitInt = parseInt(limit) || 50;
    const offsetInt = parseInt(offset) || 0;
    
    // Note: Removed caching for paginated responses since cache hit rate is low
    // Users rarely request the same page twice, making caching ineffective
    
    // Use proper pagination
    const { data: rows, error, count } = await supabase
      .from('food_nutrition_data_table')
      .select('*', { count: 'exact' })
      .eq('"UserID"', userId)
      .eq('"IsDeleted"', 0)
      .order('"CreatedAt"', { ascending: false })
      .range(offsetInt, offsetInt + limitInt - 1);

    if (error) throw error;
    
    const response = {
      success: true,
      data: rows || [],
      pagination: {
        total: count || 0,
        limit: limitInt,
        offset: offsetInt,
        hasMore: (offsetInt + limitInt) < (count || 0)
      }
    };
    
    res.status(200).json(response);

  } catch (error) {
    console.error('Failed to fetch background analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
