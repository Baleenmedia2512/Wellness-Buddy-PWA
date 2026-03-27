/**
 * GET /api/server-time
 * Returns the current server date (in IST, UTC+5:30) and timestamp.
 * Used by the frontend to detect if the device clock has been manually
 * set to a wrong date.
 *
 * Response: { date: "YYYY-MM-DD", ts: <epoch ms>, timezone: "Asia/Kolkata" }
 */
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const now    = Date.now();
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now + IST_OFFSET_MS).toISOString().split('T')[0];

  return res.status(200).json({
    date:     istDate,
    ts:       now,
    timezone: 'Asia/Kolkata'
  });
}
