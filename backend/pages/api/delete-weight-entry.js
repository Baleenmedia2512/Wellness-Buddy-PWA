import { getPool } from '../../utils/dbPool.js';

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { userId, entryId } = req.body;

  if (!userId || !entryId) {
    return res.status(400).json({ 
      message: 'Missing required fields: userId, entryId' 
    });
  }

  try {
    // Database connection . //
    const pool = getPool();

    // Soft delete the entry (set IsDeleted = 1)
    const deleteQuery = `
      UPDATE weight_records_table 
      SET IsDeleted = 1 
      WHERE ID = ? AND UserId = ?
    `;

    const [result] = await pool.execute(deleteQuery, [entryId, userId]);
if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Weight entry not found or unauthorized'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Weight entry deleted successfully',
      deletedId: entryId
    });

  } catch (error) {
    console.error('❌ Database delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete weight entry',
      error: error.message
    });
  }
}
