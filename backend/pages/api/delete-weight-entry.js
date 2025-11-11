import mysql from 'mysql2/promise';

/**
 * API Endpoint: Delete Weight Entry
 * DELETE /api/delete-weight-entry
 * 
 * Soft deletes a weight entry
 */
export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    const { id, userId } = req.body;

    // Validation
    if (!id || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Entry ID and User ID are required'
      });
    }

    console.log('🗑️ Deleting weight entry:', { id, userId });

    // Connect to database
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });

    // Soft delete (set IsDeleted flag)
    const [result] = await connection.execute(
      'UPDATE weight_entries_table SET IsDeleted = 1 WHERE ID = ? AND UserID = ?',
      [id, userId]
    );

    await connection.end();

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Weight entry not found or already deleted'
      });
    }

    console.log('✅ Weight entry deleted successfully');

    res.status(200).json({
      success: true,
      message: 'Weight entry deleted successfully',
      entryId: id
    });

  } catch (error) {
    console.error('❌ Error deleting weight entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete weight entry',
      error: error.message
    });
  }
}
