import { getSupabaseClient } from '../../utils/supabaseClient.js';

/**
 * GET /api/get-watch-burned-calories?userId=&date=YYYY-MM-DD
 *
 * Reads today's smartwatch / fitness-app education log entries
 * (Topic starts with "Calories Burned:") and returns the total
 * calories burned for the given date.
 *
 * The watch card saves:  Topic = "Calories Burned: 2000 kcal"
 * This API parses that number and sums all entries for the day.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ message: 'Method not allowed' }); return; }

  const { userId, date } = req.query;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }

  // Default to today (YYYY-MM-DD)
  const targetDate = date || new Date().toISOString().slice(0, 10);

  try {
    const supabase = getSupabaseClient();

    // Fetch all education log entries for this user on this date
    // where Topic starts with "Calories Burned:" (case-insensitive)
    const startOfDay = `${targetDate} 00:00:00`;
    const endOfDay   = `${targetDate} 23:59:59`;

    const { data: rows, error } = await supabase
      .from('education_logs_table')
      .select('"Id", "Topic", "CreatedAt"')
      .eq('"UserId"', userId)
      .or('"IsDeleted".is.null,"IsDeleted".eq.0')
      .ilike('"Topic"', 'Calories Burned:%')
      .gte('"CreatedAt"', startOfDay)
      .lte('"CreatedAt"', endOfDay)
      .order('"CreatedAt"', { ascending: false });

    if (error) throw error;

    // Parse calories from each Topic: "Calories Burned: 2000 kcal" → 2000
    let totalCalories = 0;
    const entries = (rows || []).map(row => {
      const match = (row.Topic || '').match(/(\d+(?:\.\d+)?)\s*kcal/i);
      const kcal = match ? Math.round(parseFloat(match[1])) : 0;
      totalCalories += kcal;
      return { id: row.Id, topic: row.Topic, kcal, createdAt: row.CreatedAt };
    });

    // If multiple entries exist for the day, use the latest one (most recent upload)
    // rather than summing (avoid double-counting if user re-uploads same screenshot)
    const latestKcal = entries.length > 0 ? entries[0].kcal : 0;

    return res.status(200).json({
      success: true,
      date: targetDate,
      caloriesBurned: latestKcal,
      totalCaloriesBurned: totalCalories,
      entryCount: entries.length,
      entries,
    });

  } catch (err) {
    console.error('[get-watch-burned-calories] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
