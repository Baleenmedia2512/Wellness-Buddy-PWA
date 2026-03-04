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
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const { email, timeRange = 'month', operationType, model, startDate, endDate, userToday } = req.query;

    if (!email) {
      console.log('[get-token-usage] ERROR: No email provided');
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }

    console.log('[get-token-usage] Email:', email, '| TimeRange:', timeRange, '| UserToday:', userToday);

    const supabase = getSupabaseClient();
    console.log('[get-token-usage] Using Supabase REST API');

    // Verify user has admin or developer role
    const { data: user, error: userError } = await supabase
      .from('team_table')
      .select('Role, UserId')
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
      return;
    }

    const userRole = user.Role;
    if (userRole !== 'admin' && userRole !== 'developer') {
      console.log('[get-token-usage] ERROR: User role is not admin/developer:', userRole);
      res.status(403).json({ 
        success: false, 
        message: `Access denied. Admin or Developer role required. Current role: ${userRole}` 
      });
      return;
    }

    console.log('[get-token-usage] User authorized with role:', userRole);

    // Calculate date range using server's local timezone
    const now = new Date();
    
    // Helper function to parse date string in local timezone
    const parseLocalDate = (dateStr) => {
      if (dateStr instanceof Date) return dateStr;
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return new Date(
          parseInt(parts[0], 10),
          parseInt(parts[1], 10) - 1,
          parseInt(parts[2], 10)
        );
      }
      return new Date(dateStr);
    };
    
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

    console.log('[get-token-usage] Summary (calculated):', summary);

    // Check for saved correction for this time range
    // For custom date ranges, detect if they match a predefined range and apply its correction
    const isCustomDateRange = startDate && endDate;
    let effectiveTimeRange = timeRange;
    
    if (isCustomDateRange) {
      // Detect if custom date range matches a predefined range
      const todayStr = userToday || new Date().toISOString().split('T')[0];
      const todayDate = parseLocalDate(todayStr);
      const todayStart = getStartOfDay(todayDate);
      const todayEnd = getEndOfDay(todayDate);
      
      const customStart = startDateObj.getTime();
      const customEnd = endDateObj.getTime();
      const todayStartTime = todayStart.getTime();
      const todayEndTime = todayEnd.getTime();
      
      // Check if custom range matches "today"
      if (customStart === todayStartTime && customEnd === todayEndTime) {
        effectiveTimeRange = 'today';
        console.log('[get-token-usage] Custom date range matches TODAY - will apply "today" correction if available');
      } else {
        // Check if custom range matches "yesterday"
        const yesterdayDate = new Date(todayDate);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStart = getStartOfDay(yesterdayDate).getTime();
        const yesterdayEnd = getEndOfDay(yesterdayDate).getTime();
        
        if (customStart === yesterdayStart && customEnd === yesterdayEnd) {
          effectiveTimeRange = 'yesterday';
          console.log('[get-token-usage] Custom date range matches YESTERDAY - will apply "yesterday" correction if available');
        } else {
          // Check if custom range matches "week" (last 7 days)
          const weekStartDate = new Date(todayDate);
          weekStartDate.setDate(weekStartDate.getDate() - 6);
          const weekStart = getStartOfDay(weekStartDate).getTime();
          
          if (customStart === weekStart && customEnd === todayEndTime) {
            effectiveTimeRange = 'week';
            console.log('[get-token-usage] Custom date range matches WEEK - will apply "week" correction if available');
          } else {
            // Check if custom range matches "month" (last 30 days)
            const monthStartDate = new Date(todayDate);
            monthStartDate.setDate(monthStartDate.getDate() - 29);
            const monthStart = getStartOfDay(monthStartDate).getTime();
            
            if (customStart === monthStart && customEnd === todayEndTime) {
              effectiveTimeRange = 'month';
              console.log('[get-token-usage] Custom date range matches MONTH - will apply "month" correction if available');
            } else {
              console.log('[get-token-usage] Custom date range does not match any predefined range - using real calculated costs');
              effectiveTimeRange = null; // Don't apply any correction
            }
          }
        }
      }
    }
    
    if (user.UserId && effectiveTimeRange) {
      console.log('[get-token-usage] Checking for saved correction for timeRange:', effectiveTimeRange);
      const { data: correction, error: correctionError } = await supabase
        .from('token_correction_table')
        .select('InputTokenCost, OutputTokenCost, TotalTokenCost, TimeRange, CreatedAt')
        .eq('UserId', user.UserId)
        .eq('TimeRange', effectiveTimeRange)
        .maybeSingle();

      if (!correctionError && correction) {
        console.log('[get-token-usage] ✅ Found correction for timeRange:', effectiveTimeRange, {
          correctionTimestamp: correction.CreatedAt,
          inputCost: correction.InputTokenCost,
          outputCost: correction.OutputTokenCost,
          totalCost: correction.TotalTokenCost
        });
        
        // Check if any NEW token usage records have been added AFTER the correction
        const { data: newRecords, error: newRecordsError } = await supabase
          .from('ai_token_usage_table')
          .select('ID, CreatedAt')
          .gte('CreatedAt', startDateObj.toISOString())
          .lte('CreatedAt', endDateObj.toISOString())
          .gt('CreatedAt', correction.CreatedAt)
          .limit(1);

        if (!newRecordsError && newRecords && newRecords.length > 0) {
          console.log('[get-token-usage] ⚠️ New token usage detected after correction - using REAL calculated costs (dynamic)');
          console.log('[get-token-usage] Latest record timestamp:', newRecords[0].CreatedAt);
          console.log('[get-token-usage] Correction timestamp:', correction.CreatedAt);
          // Don't apply correction - use real calculated costs
        } else {
          console.log('[get-token-usage] ✅ No new usage after correction - applying CORRECTED costs');
          // Override the calculated costs with corrected costs
          summary.totalInputCost = Number(correction.InputTokenCost) || 0;
          summary.totalOutputCost = Number(correction.OutputTokenCost) || 0;
          summary.totalCost = Number(correction.TotalTokenCost) || 0;
          // Recalculate average with corrected total cost
          if (summary.requestCount > 0) {
            summary.averageCostPerRequest = summary.totalCost / summary.requestCount;
          }
          console.log('[get-token-usage] Summary (corrected):', summary);
        }
      } else {
        console.log('[get-token-usage] No correction found for timeRange:', effectiveTimeRange);
      }
    }

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
          inputCost: 0,
          outputCost: 0,
          totalCost: 0,
          requestCount: 0
        };
      }
      userSpendingMap[key].inputTokens += Number(r.InputTokens) || 0;
      userSpendingMap[key].outputTokens += Number(r.OutputTokens) || 0;
      userSpendingMap[key].totalTokens += Number(r.TotalTokens) || 0;
      userSpendingMap[key].inputCost += Number(r.InputTokenCost) || 0;
      userSpendingMap[key].outputCost += Number(r.OutputTokenCost) || 0;
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