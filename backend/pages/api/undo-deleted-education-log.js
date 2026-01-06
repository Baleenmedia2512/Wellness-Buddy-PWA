import { getPool } from '../../utils/dbPool.js';

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id, userId } = req.body;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Education log ID is required'
    });
  }

  
  try {
    const pool = getPool();

    // Optional safety check: ensure row belongs to user
    if (userId) {
      const [ownerCheck] = await pool.execute(
        'SELECT Id FROM education_logs_table WHERE Id = ? AND UserId = ? LIMIT 1',
        [id, userId]
      );
      if (!ownerCheck.length) {
return res.status(403).json({
          success: false,
          message: 'You do not have permission to restore this item.'
        });
      }
    }

    // Restore: set IsDeleted back to 0
    const [result] = await pool.execute(
      'UPDATE education_logs_table SET IsDeleted = 0 WHERE Id = ?',
      [id]
    );
if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Education log not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Education log restored successfully',
      restoredId: id
    });
  } catch (error) {
    console.error('❌ Database undo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to restore education log',
      error: error.message
    });
  }
}
