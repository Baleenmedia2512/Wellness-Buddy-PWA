import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'wellness_buddy',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  let connection;

  try {
    const { email, timeRange = 'month', operationType, model } = req.query;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Create database connection
    connection = await mysql.createConnection(dbConfig);

    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'all':
      default:
        startDate = new Date(0); // Beginning of time
        break;
    }

    // Build WHERE clause
    let whereConditions = ['CreatedAt >= ?'];
    let queryParams = [startDate];

    if (operationType && operationType !== 'all') {
      whereConditions.push('OperationType = ?');
      queryParams.push(operationType);
    }

    if (model && model !== 'all') {
      whereConditions.push('ModelName = ?');
      queryParams.push(model);
    }

    const whereClause = whereConditions.join(' AND ');

    // Query 1: Summary statistics
    const [summaryRows] = await connection.execute(
      `SELECT 
        COALESCE(SUM(InputTokens), 0) as totalInputTokens,
        COALESCE(SUM(OutputTokens), 0) as totalOutputTokens,
        COALESCE(SUM(TotalTokens), 0) as totalTokens,
        COALESCE(SUM(InputTokenCost), 0) as totalInputCost,
        COALESCE(SUM(OutputTokenCost), 0) as totalOutputCost,
        COALESCE(SUM(TotalTokenCost), 0) as totalCost,
        COUNT(*) as requestCount,
        COALESCE(AVG(TotalTokenCost), 0) as averageCostPerRequest
      FROM ai_token_usage_table
      WHERE ${whereClause}`,
      queryParams
    );

    const summary = summaryRows[0];

    // Query 2: Most used operation type
    const [mostUsedOpRows] = await connection.execute(
      `SELECT OperationType, COUNT(*) as count
      FROM ai_token_usage_table
      WHERE ${whereClause}
      GROUP BY OperationType
      ORDER BY count DESC
      LIMIT 1`,
      queryParams
    );

    // Query 3: Most used model
    const [mostUsedModelRows] = await connection.execute(
      `SELECT ModelName, COUNT(*) as count
      FROM ai_token_usage_table
      WHERE ${whereClause}
      GROUP BY ModelName
      ORDER BY count DESC
      LIMIT 1`,
      queryParams
    );

    // Query 4: Usage by operation type
    const [byOperationRows] = await connection.execute(
      `SELECT 
        OperationType as operationType,
        COALESCE(SUM(TotalTokens), 0) as totalTokens,
        COALESCE(SUM(TotalTokenCost), 0) as totalCost,
        COALESCE(SUM(InputTokens), 0) as inputTokens,
        COALESCE(SUM(OutputTokens), 0) as outputTokens,
        COUNT(*) as requestCount
      FROM ai_token_usage_table
      WHERE ${whereClause}
      GROUP BY OperationType
      ORDER BY totalTokens DESC`,
      queryParams
    );

    // Query 5: Usage by model
    const [byModelRows] = await connection.execute(
      `SELECT 
        ModelName as modelName,
        COALESCE(SUM(TotalTokens), 0) as totalTokens,
        COALESCE(SUM(TotalTokenCost), 0) as totalCost,
        COALESCE(SUM(InputTokens), 0) as inputTokens,
        COALESCE(SUM(OutputTokens), 0) as outputTokens,
        COUNT(*) as requestCount
      FROM ai_token_usage_table
      WHERE ${whereClause}
      GROUP BY ModelName
      ORDER BY totalTokens DESC`,
      queryParams
    );

    // Query 6: Recent usage (last 10 records)
    const [recentUsageRows] = await connection.execute(
      `SELECT 
        ID as id,
        UserId as userId,
        Email as email,
        OperationType as operationType,
        ModelName as modelName,
        InputTokens as inputTokens,
        OutputTokens as outputTokens,
        TotalTokens as totalTokens,
        InputTokenCost as inputTokenCost,
        OutputTokenCost as outputTokenCost,
        TotalTokenCost as totalTokenCost,
        CreatedAt as createdAt
      FROM ai_token_usage_table
      WHERE ${whereClause}
      ORDER BY CreatedAt DESC
      LIMIT 10`,
      queryParams
    );

    // Query 7: Daily statistics (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dailyParams = [...queryParams];
    dailyParams[0] = thirtyDaysAgo > startDate ? thirtyDaysAgo : startDate;

    const [dailyStatsRows] = await connection.execute(
      `SELECT 
        DATE(CreatedAt) as date,
        COALESCE(SUM(TotalTokens), 0) as totalTokens,
        COALESCE(SUM(TotalTokenCost), 0) as totalCost,
        COUNT(*) as requestCount
      FROM ai_token_usage_table
      WHERE ${whereClause}
      GROUP BY DATE(CreatedAt)
      ORDER BY date DESC
      LIMIT 30`,
      dailyParams
    );

    // Calculate percentages for operation types
    const totalTokensForPercentage = Number(summary.totalTokens) || 1;
    const byOperationWithPercentage = byOperationRows.map(op => ({
      ...op,
      totalTokens: Number(op.totalTokens),
      totalCost: Number(op.totalCost),
      inputTokens: Number(op.inputTokens),
      outputTokens: Number(op.outputTokens),
      percentage: ((Number(op.totalTokens) / totalTokensForPercentage) * 100).toFixed(1)
    }));

    const byModelWithPercentage = byModelRows.map(model => ({
      ...model,
      totalTokens: Number(model.totalTokens),
      totalCost: Number(model.totalCost),
      inputTokens: Number(model.inputTokens),
      outputTokens: Number(model.outputTokens),
      percentage: ((Number(model.totalTokens) / totalTokensForPercentage) * 100).toFixed(1)
    }));

    // Format response
    const response = {
      success: true,
      data: {
        summary: {
          totalTokens: Number(summary.totalTokens),
          totalInputTokens: Number(summary.totalInputTokens),
          totalOutputTokens: Number(summary.totalOutputTokens),
          totalCost: Number(summary.totalCost),
          totalInputCost: Number(summary.totalInputCost),
          totalOutputCost: Number(summary.totalOutputCost),
          averageCostPerRequest: Number(summary.averageCostPerRequest),
          requestCount: Number(summary.requestCount),
          mostUsedOperation: mostUsedOpRows.length > 0 ? mostUsedOpRows[0].OperationType : 'N/A',
          mostUsedModel: mostUsedModelRows.length > 0 ? mostUsedModelRows[0].ModelName : 'N/A'
        },
        byOperation: byOperationWithPercentage,
        byModel: byModelWithPercentage,
        recentUsage: recentUsageRows.map(row => ({
          ...row,
          inputTokens: Number(row.inputTokens),
          outputTokens: Number(row.outputTokens),
          totalTokens: Number(row.totalTokens),
          inputTokenCost: Number(row.inputTokenCost),
          outputTokenCost: Number(row.outputTokenCost),
          totalTokenCost: Number(row.totalTokenCost)
        })),
        dailyStats: dailyStatsRows.map(row => ({
          date: row.date,
          totalTokens: Number(row.totalTokens),
          totalCost: Number(row.totalCost),
          requestCount: Number(row.requestCount)
        })),
        timeRange,
        generatedAt: new Date().toISOString()
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching token usage:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch token usage data',
      error: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
