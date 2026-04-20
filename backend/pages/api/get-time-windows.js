import { getTimeWindows } from '../../utils/disciplineCalculationsSupabase.js';


export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // No caching — always serve live DB values
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Fetch all time windows from activity_time_windows_table
    const windows = await getTimeWindows();

    // windows shape: { education: { start, end }, weight: { start, end }, ... }
    return res.status(200).json({
      success: true,
      windows
    });
  } catch (error) {
    console.error('❌ [get-time-windows] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch time windows',
      error: error.message
    });
  }
}
