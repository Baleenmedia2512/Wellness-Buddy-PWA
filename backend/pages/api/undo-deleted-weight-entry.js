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

  const { id, userId } = req.body; // userId optional but recommended for safety

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Weight entry ID is required'
    });
  }

  
  try {
    const pool = getPool();

    // OPTIONAL safety: ensure this row belongs to the user
    if (userId) {
      const [ownerCheck] = await pool.execute(
        'SELECT ID FROM weight_records_table WHERE ID = ? AND UserId = ? LIMIT 1',
        [id, userId]
      );
      if (!ownerCheck.length) {
return res.status(403).json({
          success: false,
          message: 'You do not have permission to restore this item.'
        });
      }
    }

    // Restore: flip IsDeleted back to 0
    const [result] = await pool.execute(
      'UPDATE weight_records_table SET IsDeleted = 0 WHERE ID = ?',
      [id]
    );
if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Weight entry not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Weight entry restored successfully',
      restoredId: id
    });
  } catch (error) {
    console.error('❌ Database undo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to restore weight entry',
      error: error.message
    });
  }
}
