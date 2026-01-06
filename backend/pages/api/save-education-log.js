import { getPool } from '../../utils/dbPool.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // CORS handling
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { userId, imageBase64, platform, topic, confidence, deviceInfo } = req.body;

  // Validation
  if (!userId || !platform || !topic) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: userId, platform, topic'
    });
  }

  
  try {
    // Database connection
    const pool = getPool();

    // If ImageBase64 is empty string, store as null
    const imageBase64ToSave = (imageBase64 && imageBase64.trim() !== '') ? imageBase64 : null;

    // Insert into education_logs_table
    const [result] = await pool.execute(
      `INSERT INTO education_logs_table (UserId, Platform, Topic, Confidence, DeviceInfo, ImageBase64)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, platform, topic, confidence || null, deviceInfo || null, imageBase64ToSave]
    );
return res.status(200).json({
      success: true,
      message: 'Education log saved successfully',
      id: result.insertId
    });

  } catch (error) {
    if (connection) {
      try {
} catch {}
    }
    console.error('❌ Save education log error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save education log',
      error: error.message
    });
  }
}
