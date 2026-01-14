import { getSupabaseClient } from '../../utils/supabaseClient.js';

export default async function handler(req, res) {
  console.log('========== [get-token-usage] API Called ==========');
  console.log('[get-token-usage] Request query:', req.query);
  
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end(); return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { email, timeRange = 'month', operationType, model, startDate, endDate, userToday } = req.query;

    if (!email) {
      console.log('[get-token-usage] ERROR: No email provided');
      res.status(400).json({ success: false, message: 'Email is required' });
    }

    console.log('[get-token-usage] Email:', email, '| TimeRange:', timeRange, '| UserToday:', userToday);

    const supabase = getSupabaseClient();
    console.log('[get-token-usage] Using Supabase REST API');

    // Verify user has admin or developer role
    const { data: user, error: userError } = await supabase
      .from('team_table')
      .select('Role')
      .eq('Email', email)
      .maybeSingle();

    console.log('[get-token-usage] User lookup:', { 
      email, 
      found: !!user, 
      role: user?.Role || 'N/A' 
    });

    if (userError || !user) {
      console.log('[get-token-usage] ERROR: User not found in team_table');
      res.status(403).json({ 
        success: false, 
        message: `Access denied. User not found: ${email}` 
      });
    }

    const userRole = user.Role;
    if (userRole !== 'admin' && userRole !== 'developer') {
      console.log('[get-token-usage] ERROR: User role is not admin/developer:', userRole);
      res.status(403).json({ 
        success: false, 
        message: `Access denied. Admin or Developer role required. Current role: ${userRole}` 
      });
    }

    console.log('[get-token-usage] User authorized with role:', userRole);

    // Calculate date range using server's local timezone
    const now = new Date();
    
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
    
    // Helper to get start of day in local timezone
    const getStartOfDay = (date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };
    
    const getEndOfDay = (date) => {
      const d = new Date(date);
      d.setHours(23, 59, 59, 999);
      return d;
    };
    
    let startDateObj;
    let endDateObj = now;
    
    if (startDate && endDate) {
      startDateObj = getStartOfDay(parseLocalDate(startDate));
      endDateObj = getEndOfDay(parseLocalDate(endDate));
    } else {
      const todayStr = userToday || new Date().toISOString().split('T')[0];
      const todayDate = parseLocalDate(todayStr);
      
      switch (timeRange) {
        case 'today':
          startDateObj = getStartOfDay(todayDate);
          endDateObj = getEndOfDay(todayDate);
          break;
        case 'yesterday':
          const yesterdayDate = new Date(todayDate);
          yesterdayDate.setDate(yesterdayDate.getDate() - 1);
          startDateObj = getStartOfDay(yesterdayDate);
          endDateObj = getEndOfDay(yesterdayDate);
          break;
        case 'week':
          const weekStartDate = new Date(todayDate);
          weekStartDate.setDate(weekStartDate.getDate() - 6);
          startDateObj = getStartOfDay(weekStartDate);
          endDateObj = getEndOfDay(todayDate);
          break;
        case 'month':
          const monthStartDate = new Date(todayDate);
          monthStartDate.setDate(monthStartDate.getDate() - 29);
          startDateObj = getStartOfDay(monthStartDate);
          endDateObj = getEndOfDay(todayDate);
          break;
        case 'all':
        default:
          startDateObj = new Date(0);
          endDateObj = getEndOfDay(todayDate);
          break;
      }
    }

    console.log('[get-token-usage] Date range:', {
      timeRange,
      startDate: startDateObj.toISOString(),
      endDate: endDateObj.toISOString()
    });

    // Build Supabase query with filters
    let query = supabase
      .from('ai_token_usage_table')
      .select('*')
      .gte('CreatedAt', startDateObj.toISOString())
      .lte('CreatedAt', endDateObj.toISOString());

    if (operationType && operationType !== 'all') {
      query = query.eq('OperationType', operationType);
    }

    if (model && model !== 'all') {
      query = query.eq('ModelName', model);
    }

    const { data: allRecords, error: recordsError } = await query.order('CreatedAt', { ascending: false });

    if (recordsError) {
      console.error('[get-token-usage] Error fetching records:', recordsError);
      throw recordsError;
    }

    const records = allRecords || [];
    console.log('[get-token-usage] Fetched records:', records.length);

    // Calculate summary statistics in JavaScript
    const summary = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalInputCost: 0,
      totalOutputCost: 0,
      totalCost: 0,
      requestCount: records.length,
      averageCostPerRequest: 0
    };

    records.forEach(r => {
      summary.totalInputTokens += Number(r.InputTokens) || 0;
      summary.totalOutputTokens += Number(r.OutputTokens) || 0;
      summary.totalTokens += Number(r.TotalTokens) || 0;
      summary.totalInputCost += Number(r.InputTokenCost) || 0;
      summary.totalOutputCost += Number(r.OutputTokenCost) || 0;
      summary.totalCost += Number(r.TotalTokenCost) || 0;
    });

    if (summary.requestCount > 0) {
      summary.averageCostPerRequest = summary.totalCost / summary.requestCount;
    }

    console.log('[get-token-usage] Summary:', summary);

    // Group by operation type
    const byOperationMap = {};
    records.forEach(r => {
      const op = r.OperationType || 'Unknown';
      if (!byOperationMap[op]) {
        byOperationMap[op] = { 
          operationType: op, 
          totalTokens: 0, 
          totalCost: 0, 
          inputTokens: 0, 
          outputTokens: 0, 
          requestCount: 0 
        };
      }
      byOperationMap[op].totalTokens += Number(r.TotalTokens) || 0;
      byOperationMap[op].totalCost += Number(r.TotalTokenCost) || 0;
      byOperationMap[op].inputTokens += Number(r.InputTokens) || 0;
      byOperationMap[op].outputTokens += Number(r.OutputTokens) || 0;
      byOperationMap[op].requestCount += 1;
    });

    const byOperation = Object.values(byOperationMap)
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .map(op => ({
        ...op,
        percentage: ((op.totalTokens / (summary.totalTokens || 1)) * 100).toFixed(1)
      }));

    // Group by model
    const byModelMap = {};
    records.forEach(r => {
      const model = r.ModelName || 'Unknown';
      if (!byModelMap[model]) {
        byModelMap[model] = { 
          modelName: model, 
          totalTokens: 0, 
          totalCost: 0, 
          inputTokens: 0, 
          outputTokens: 0, 
          requestCount: 0 
        };
      }
      byModelMap[model].totalTokens += Number(r.TotalTokens) || 0;
      byModelMap[model].totalCost += Number(r.TotalTokenCost) || 0;
      byModelMap[model].inputTokens += Number(r.InputTokens) || 0;
      byModelMap[model].outputTokens += Number(r.OutputTokens) || 0;
      byModelMap[model].requestCount += 1;
    });

    const byModel = Object.values(byModelMap)
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .map(m => ({
        ...m,
        percentage: ((m.totalTokens / (summary.totalTokens || 1)) * 100).toFixed(1)
      }));

    // Recent usage (first 10 records, already sorted desc)
    const recentUsage = records.slice(0, 10).map(r => ({
      id: r.ID,
      userId: r.UserId,
      email: r.Email,
      operationType: r.OperationType,
      modelName: r.ModelName,
      inputTokens: Number(r.InputTokens) || 0,
      outputTokens: Number(r.OutputTokens) || 0,
      totalTokens: Number(r.TotalTokens) || 0,
      inputTokenCost: Number(r.InputTokenCost) || 0,
      outputTokenCost: Number(r.OutputTokenCost) || 0,
      totalTokenCost: Number(r.TotalTokenCost) || 0,
      createdAt: r.CreatedAt
    }));

    // Daily stats (last 30 days)
    const dailyMap = {};
    records.forEach(r => {
      const date = new Date(r.CreatedAt).toISOString().split('T')[0];
      if (!dailyMap[date]) {
        dailyMap[date] = { date, totalTokens: 0, totalCost: 0, requestCount: 0 };
      }
      dailyMap[date].totalTokens += Number(r.TotalTokens) || 0;
      dailyMap[date].totalCost += Number(r.TotalTokenCost) || 0;
      dailyMap[date].requestCount += 1;
    });

    const dailyStats = Object.values(dailyMap)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);

    // User spending aggregation
    const userSpendingMap = {};
    records.forEach(r => {
      const key = r.UserId || r.Email || 'Unknown';
      if (!userSpendingMap[key]) {
        userSpendingMap[key] = {
          userId: r.UserId,
          email: r.Email,
          userName: r.Email ? r.Email.split('@')[0] : 'Unknown',
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          totalCost: 0,
          requestCount: 0
        };
      }
      userSpendingMap[key].inputTokens += Number(r.InputTokens) || 0;
      userSpendingMap[key].outputTokens += Number(r.OutputTokens) || 0;
      userSpendingMap[key].totalTokens += Number(r.TotalTokens) || 0;
      userSpendingMap[key].totalCost += Number(r.TotalTokenCost) || 0;
      userSpendingMap[key].requestCount += 1;
    });

    const userSpending = Object.values(userSpendingMap)
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 50);

    // Get user names from team_table
    if (userSpending.length > 0) {
      const userIds = userSpending.map(u => u.userId).filter(id => id);
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('team_table')
          .select('UserId, UserName')
          .in('UserId', userIds);

        if (users) {
          const userNameMap = {};
          users.forEach(u => { userNameMap[u.UserId] = u.UserName; });
          userSpending.forEach(u => {
            if (u.userId && userNameMap[u.userId]) {
              u.userName = userNameMap[u.userId];
            }
          });
        }
      }
    }

    // Most used operation and model
    const mostUsedOperation = byOperation.length > 0 ? byOperation[0].operationType : 'N/A';
    const mostUsedModel = byModel.length > 0 ? byModel[0].modelName : 'N/A';

    const response = {
      success: true,
      data: {
        summary: {
          ...summary,
          mostUsedOperation,
          mostUsedModel
        },
        byOperation,
        byModel,
        recentUsage,
        dailyStats,
        userSpending,
        timeRange,
        generatedAt: new Date().toISOString()
      }
    };

    console.log('[get-token-usage] SUCCESS - Sending response');
    console.log('========== [get-token-usage] API Complete ==========');

    res.status(200).json(response);
    return;

  } catch (error) {
    console.error('[get-token-usage] ERROR:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch token usage data',
      error: error.message 
    });
    return;
  }
}
