import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
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
    const { email, timeRange = 'month', operationType, model, startDate, endDate } = req.query;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Create database connection
    connection = await mysql.createConnection(dbConfig);

    // Verify user has admin or developer role
    const [userRows] = await connection.execute(
      'SELECT Role FROM team_table WHERE Email = ? LIMIT 1',
      [email]
    );

    if (!userRows.length) {
      await connection.end();
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. User not found.' 
      });
    }

    const userRole = userRows[0].Role;
    if (userRole !== 'admin' && userRole !== 'developer') {
      await connection.end();
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin or Developer role required.' 
      });
    }

    // Calculate date range using IST (UTC+5:30) for consistency across local and production
    // This ensures Vercel (UTC) and local (IST) servers calculate the same date ranges
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.getTime() + IST_OFFSET_MS);
    
    // Helper function to parse date string in local timezone (prevents date shifting)
    const parseLocalDate = (dateStr) => {
      // If already a Date object, return it
      if (dateStr instanceof Date) return dateStr;
      
      // Parse YYYY-MM-DD format in local timezone
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return new Date(
          parseInt(parts[0], 10),      // year
          parseInt(parts[1], 10) - 1,  // month (0-indexed)
          parseInt(parts[2], 10)       // day
        );
      }
      // Fallback to standard parsing
      return new Date(dateStr);
    };
    
    let startDateObj;
    let endDateObj = nowUTC; // Use UTC for database queries
    
    // If custom date range provided, use it
    if (startDate && endDate) {
      // Parse dates in local timezone to prevent date shifting
      startDateObj = parseLocalDate(startDate);
      startDateObj.setHours(0, 0, 0, 0); // Start of day
      
      endDateObj = parseLocalDate(endDate);
      endDateObj.setHours(23, 59, 59, 999); // End of day
      
      console.log('[Token Usage] Custom date range:', {
        inputStart: startDate,
        inputEnd: endDate,
        parsedStart: startDateObj.toISOString(),
        parsedEnd: endDateObj.toISOString()
      });
    } else {
      // Use predefined time ranges based on IST
      switch (timeRange) {
        case 'today':
          // Start of today in IST (midnight IST = 18:30 previous day UTC)
          const todayIST = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate());
          startDateObj = new Date(todayIST.getTime() - IST_OFFSET_MS);
          break;
        case 'yesterday':
          // Yesterday in IST (start of yesterday to end of yesterday)
          const yesterdayStartIST = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate() - 1);
          const yesterdayEndIST = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate() - 1, 23, 59, 59, 999);
          startDateObj = new Date(yesterdayStartIST.getTime() - IST_OFFSET_MS);
          endDateObj = new Date(yesterdayEndIST.getTime() - IST_OFFSET_MS);
          break;
        case 'week':
          startDateObj = new Date(nowUTC.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          // Rolling 30-day range from now
          startDateObj = new Date(nowUTC.getTime() - 30 * 24 * 60 * 60 * 1000);
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
    const thirtyDaysAgo = new Date(nowUTC.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dailyParams = [...queryParams];
    dailyParams[0] = thirtyDaysAgo > startDateObj ? thirtyDaysAgo : startDateObj;

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

    // Query 8: User spending aggregation (with user names from team_table)
    const [userSpendingRows] = await connection.execute(
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
      await connection.end();
    }
  }
}
