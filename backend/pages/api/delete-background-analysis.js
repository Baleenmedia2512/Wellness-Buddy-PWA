import mysql from 'mysql2/promise';

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

  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ 
      success: false,
      message: 'Analysis ID is required' 
    });
  }

  try {
    // Database connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });

    // Delete the analysis record
    const [result] = await connection.execute(
      'UPDATE food_nutrition_data_table SET IsDeleted = 1 WHERE ID = ?',
      [id]
    );

    await connection.end();

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Analysis not found'
      });
    }

    console.log(`✅ Background analysis deleted, ID: ${id}`);

    res.status(200).json({
      success: true,
      message: 'Analysis deleted successfully',
      deletedId: id
    });

  } catch (error) {
    console.error('❌ Database delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete analysis',
      error: error.message
    });
  }
}
