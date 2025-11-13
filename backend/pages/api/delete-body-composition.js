/**
 * API Endpoint: Delete Body Composition Entry
 * DELETE /api/delete-body-composition
 * 
 * Soft deletes a body composition entry
 */

import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  // Only allow DELETE requests
  if (req.method !== 'DELETE') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Use DELETE.' 
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

    // Create database connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'wellness_buddy'
    });

    // Soft delete (set DeletedAt timestamp)
    const [result] = await connection.execute(
      `UPDATE body_composition_entries 
       SET DeletedAt = CURRENT_TIMESTAMP
       WHERE ID = ? AND UserID = ? AND DeletedAt IS NULL`,
      [id, userId]
    );

    await connection.end();

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found or already deleted'
      });
    }

    console.log('✅ Body composition entry deleted:', id);

    return res.status(200).json({
      success: true,
      message: 'Body composition entry deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting body composition:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete body composition entry',
      error: error.message
    });
  }
}
