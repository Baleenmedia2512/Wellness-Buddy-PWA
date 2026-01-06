import { getPool } from '../../utils/dbPool.js';

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

  

  try {
    const { email, timeRange = 'month', operationType, model, startDate, endDate } = req.query;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Create database connection
    const pool = getPool();

    // Verify user has admin or developer role
    const [userRows] = await pool.execute(
      'SELECT Role FROM team_table WHERE Email = ? LIMIT 1',
      [email]
    );

    if (!userRows.length) {
return res.status(403).json({ 
        success: false, 
        message: 'Access denied. User not found.' 
      });
    }

    const userRole = userRows[0].Role;
    if (userRole !== 'admin' && userRole !== 'developer') {
return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin or Developer role required.' 
      });
    }

    // Calculate date range
    const now = new Date();
    let startDateObj;
    let endDateObj = now;
    
    // If custom date range provided, use it
    if (startDate && endDate) {
      startDateObj = new Date(startDate);
      endDateObj = new Date(endDate);
      // Set end date to end of day
      endDateObj.setHours(23, 59, 59, 999);
    } else {
      // Use predefined time ranges
      switch (timeRange) {
        case 'today':
          startDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDateObj = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDateObj = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'all':
        default:
          startDateObj = new Date(0); // Beginning of time
          break;
      }
    }

    // Build WHERE clause
    let whereConditions = ['CreatedAt >= ?', 'CreatedAt <= ?'];
    let queryParams = [startDateObj, endDateObj];

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
    const [summaryRows] = await pool.execute(
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
    const [mostUsedOpRows] = await pool.execute(
      `SELECT OperationType, COUNT(*) as count
      FROM ai_token_usage_table
      WHERE ${whereClause}
      GROUP BY OperationType
      ORDER BY count DESC
      LIMIT 1`,
      queryParams
    );

    // Query 3: Most used model
    const [mostUsedModelRows] = await pool.execute(
      `SELECT ModelName, COUNT(*) as count
      FROM ai_token_usage_table
      WHERE ${whereClause}
      GROUP BY ModelName
      ORDER BY count DESC
      LIMIT 1`,
      queryParams
    );

    // Query 4: Usage by operation type
    const [byOperationRows] = await pool.execute(
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
    const [byModelRows] = await pool.execute(
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
    const [recentUsageRows] = await pool.execute(
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
    dailyParams[0] = thirtyDaysAgo > startDateObj ? thirtyDaysAgo : startDateObj;

    const [dailyStatsRows] = await pool.execute(
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

    // Query 8: User spending aggregation (with user names from team_table)
    const [userSpendingRows] = await pool.execute(
      `SELECT 
        a.UserId as userId,
        a.Email as email,
        COALESCE(t.UserName, SUBSTRING_INDEX(a.Email, '@', 1)) as userName,
        COALESCE(SUM(a.InputTokens), 0) as inputTokens,
        COALESCE(SUM(a.OutputTokens), 0) as outputTokens,
        COALESCE(SUM(a.TotalTokens), 0) as totalTokens,
        COALESCE(SUM(a.TotalTokenCost), 0) as totalCost,
        COUNT(*) as requestCount
      FROM ai_token_usage_table a
      LEFT JOIN team_table t ON a.UserId = t.UserId
      WHERE ${whereClause}
      GROUP BY a.UserId, a.Email, t.UserName
      ORDER BY totalCost DESC
      LIMIT 50`,
      queryParams
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
        userSpending: userSpendingRows.map(row => ({
          userId: row.userId,
          email: row.email,
          userName: row.userName,
          inputTokens: Number(row.inputTokens),
          outputTokens: Number(row.outputTokens),
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
}
  }
}
