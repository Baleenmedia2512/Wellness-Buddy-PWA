import { getSupabaseClient } from '../../utils/supabaseClient.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { userId, query } = req.query;

  if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });
  if (!query || query.trim().length < 1) return res.status(400).json({ success: false, message: 'query is required' });

  const searchTerm = query.trim();

  try {
    const supabase = getSupabaseClient();

    // Run user meals + community meals in parallel
    const [myMealRes, communityMealRes] = await Promise.all([
      // My own logged meals
      supabase
        .from('food_nutrition_data_table')
        .select('"ID","AnalysisData","CreatedAt"')
        .eq('"UserID"', userId)
        .eq('"IsDeleted"', 0)
        .ilike('"AnalysisData"', `%${searchTerm}%`)
        .order('"CreatedAt"', { ascending: false })
        .limit(100),

      // Community meals (other users)
      supabase
        .from('food_nutrition_data_table')
        .select('"ID","AnalysisData","CreatedAt"')
        .neq('"UserID"', userId)
        .eq('"IsDeleted"', 0)
        .ilike('"AnalysisData"', `%${searchTerm}%`)
        .order('"CreatedAt"', { ascending: false })
        .limit(200),
    ]);

    if (myMealRes.error) throw myMealRes.error;
    if (communityMealRes.error) throw communityMealRes.error;

    const lowerTerm = searchTerm.toLowerCase();

    // Extract individual food items that match the search term from a DB row
    function extractMatchingItems(row) {
      try {
        const analysis = typeof row.AnalysisData === 'string'
          ? JSON.parse(row.AnalysisData)
          : row.AnalysisData;
        const foods = analysis?.foods || [];
        return foods
          .filter(f => (f.name || '').toLowerCase().includes(lowerTerm))
          .map(f => ({
            name: (f.name || '').trim(),
            weight_g: f.weight_g != null ? Math.round(f.weight_g) : 100,
            calories: f.nutrition?.calories != null ? Math.round(f.nutrition.calories) : null,
            protein: f.nutrition?.protein != null ? Math.round(f.nutrition.protein) : null,
            carbs: f.nutrition?.carbs != null ? Math.round(f.nutrition.carbs) : null,
            fat: f.nutrition?.fat != null ? Math.round(f.nutrition.fat) : null,
            fiber: f.nutrition?.fiber != null ? Math.round(f.nutrition.fiber) : null,
          }));
      } catch { return []; }
    }

    // Deduplicate by normalized food name — keep most recent (rows sorted desc)
    function dedupItems(rows) {
      const seen = new Map();
      for (const row of rows) {
        for (const item of extractMatchingItems(row)) {
          const key = item.name.toLowerCase().trim();
          if (!seen.has(key)) seen.set(key, item);
        }
      }
      return Array.from(seen.values());
    }

    const myItems = dedupItems(myMealRes.data || []);
    const communityItems = dedupItems(communityMealRes.data || []);

    return res.status(200).json({
      success: true,
      myItems,
      communityItems,
    });
  } catch (error) {
    console.error('[search-food-history] Error:', error);
    return res.status(500).json({ success: false, message: 'Search failed', error: error.message });
  }
}
