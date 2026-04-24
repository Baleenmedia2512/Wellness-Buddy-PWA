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

    // Helper: extract a plate from a DB row (returns null if not a multi-item meal with a match)
    function extractPlate(row) {
      try {
        const analysis = typeof row.AnalysisData === 'string'
          ? JSON.parse(row.AnalysisData)
          : row.AnalysisData;
        const foods = analysis?.foods || [];
        const hasMatch = foods.some(f => (f.name || '').toLowerCase().includes(lowerTerm));
        if (!hasMatch || foods.length < 2) return null;

        const allFoods = foods.map(f => ({
          name: (f.name || '').trim(),
          calories: f.nutrition?.calories != null ? Math.round(f.nutrition.calories) : null,
          protein: f.nutrition?.protein != null ? Math.round(f.nutrition.protein) : null,
          carbs: f.nutrition?.carbs != null ? Math.round(f.nutrition.carbs) : null,
          fat: f.nutrition?.fat != null ? Math.round(f.nutrition.fat) : null,
          fiber: f.nutrition?.fiber != null ? Math.round(f.nutrition.fiber) : null,
        }));

        const total = analysis?.total || allFoods.reduce((acc, f) => ({
          calories: (acc.calories || 0) + (f.calories || 0),
          protein: (acc.protein || 0) + (f.protein || 0),
          carbs: (acc.carbs || 0) + (f.carbs || 0),
          fat: (acc.fat || 0) + (f.fat || 0),
          fiber: (acc.fiber || 0) + (f.fiber || 0),
        }), {});

        return {
          mealId: row.ID,
          title: foods[0].name || searchTerm,
          foods: allFoods,
          total: {
            calories: total.calories != null ? Math.round(total.calories) : null,
            protein: total.protein != null ? Math.round(total.protein) : null,
            carbs: total.carbs != null ? Math.round(total.carbs) : null,
            fat: total.fat != null ? Math.round(total.fat) : null,
            fiber: total.fiber != null ? Math.round(total.fiber) : null,
          },
          createdAt: row.CreatedAt,
        };
      } catch { return null; }
    }

    // Deduplicate plates by normalized title — keep most recent
    function dedupPlates(rows) {
      const plateMap = new Map();
      for (const row of rows) {
        const plate = extractPlate(row);
        if (!plate) continue;
        const key = plate.title.toLowerCase().trim();
        if (!plateMap.has(key)) plateMap.set(key, plate);
      }
      return Array.from(plateMap.values());
    }

    const myPlates = dedupPlates(myMealRes.data || []);
    const communityPlates = dedupPlates(communityMealRes.data || []);

    return res.status(200).json({
      success: true,
      myPlates,
      communityPlates,
    });
  } catch (error) {
    console.error('[search-food-history] Error:', error);
    return res.status(500).json({ success: false, message: 'Search failed', error: error.message });
  }
}
