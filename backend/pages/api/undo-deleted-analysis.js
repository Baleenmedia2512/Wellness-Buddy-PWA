import mysql from 'mysql2/promise';

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
      message: 'Analysis ID is required'
    });
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });

    // OPTIONAL safety: ensure this row belongs to the user (if you store UserID)
    if (userId) {
      const [ownerCheck] = await connection.execute(
        'SELECT ID FROM food_nutrition_data_table WHERE ID = ? AND UserID = ? LIMIT 1',
        [id, userId]
      );
      if (!ownerCheck.length) {
        await connection.end();
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to restore this item.'
        });
      }
    }

    // Restore: flip IsDeleted back to 0
    const [result] = await connection.execute(
      'UPDATE food_nutrition_data_table SET IsDeleted = 0 WHERE ID = ?',
      [id]
    );

    await connection.end();

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Analysis not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Analysis restored successfully',
      restoredId: id
    });
  } catch (error) {
    if (connection) {
      try { await connection.end(); } catch {}
    }
    console.error('❌ Database undo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to restore analysis',
      error: error.message
    });
  }
}
