import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { formatDateForMySQL } from '../../utils/disciplineHelpers.js';

export default async function handler(req, res) {
  // Prevent browser/service worker caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { userId, startDate, endDate } = req.query;

  console.log('👤 [get-my-club-attendance] Request:', { userId, startDate, endDate });

  if (!userId) {
    res.status(400).json({
      success: false,
      message: 'Missing required parameter: userId',
    });
    return;
  }

  try {
    const supabase = getSupabaseClient();
    const userIdNum = parseInt(userId);

    // Calculate date range
    const start = (startDate || formatDateForMySQL(new Date())) + 'T00:00:00';
    const end = (endDate || formatDateForMySQL(new Date())) + 'T23:59:59';

    console.log('📅 [get-my-club-attendance] Date range:', { start, end });

    // Fetch ALL education logs (club + remote) for this user
    const { data: educationLogs, error: logsError } = await supabase
      .from('education_logs_table')
      .select(`
        "Id",
        "CreatedAt",
        attendance_type,
        nutrition_center_id,
        center_name
      `)
      .eq('"UserId"', userIdNum)
      .gte('"CreatedAt"', start)
      .lte('"CreatedAt"', end)
      .eq('"IsDeleted"', false)
      .order('"CreatedAt"', { ascending: false });

    if (logsError) {
      console.error('❌ [get-my-club-attendance] Error fetching education logs:', logsError);
      throw new Error(logsError.message);
    }

    console.log('📊 [get-my-club-attendance] Found', educationLogs?.length || 0, 'club attendance records');

    if (!educationLogs || educationLogs.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          attendanceRecords: [],
          clubSummary: [],
          dateRange: { start, end },
          totalAttendance: 0,
        },
      });
    }

    // Get unique club IDs
    const clubIds = [...new Set(educationLogs.map(log => log.nutrition_center_id).filter(id => id))];
    
    // Fetch club details
    let clubsMap = {};
    if (clubIds.length > 0) {
      const { data: clubs, error: clubsError } = await supabase
        .from('nutrition_centers_table')
        .select('id, center_name, latitude, longitude, owner_user_id')
        .in('id', clubIds)
        .eq('status', 'active')
        .eq('is_deleted', false);

      if (!clubsError && clubs) {
        // Get owner user IDs
        const ownerIds = [...new Set(clubs.map(club => club.owner_user_id).filter(id => id))];
        
        // Fetch owner names from team_table
        let ownersMap = {};
        if (ownerIds.length > 0) {
          const { data: owners, error: ownersError } = await supabase
            .from('team_table')
            .select('UserId, UserName')
            .in('UserId', ownerIds);

          if (!ownersError && owners) {
            owners.forEach(owner => {
              ownersMap[owner.UserId] = owner.UserName;
            });
          }
        }

        clubs.forEach(club => {
          clubsMap[club.id] = {
            ...club,
            ownerName: ownersMap[club.owner_user_id] || 'Unknown Owner'
          };
        });
      }
    }

    // Build attendance records with club info
    const attendanceRecords = educationLogs.map(log => {
      const club = clubsMap[log.nutrition_center_id];
      return {
        id: log.Id,
        date: log.CreatedAt.split('T')[0],
        time: new Date(log.CreatedAt).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        }),
        clubId: log.nutrition_center_id,
        clubName: log.center_name || club?.center_name || 'Unknown Club',
        clubOwnerName: club?.ownerName || 'Unknown Owner',
      };
    });

    // Build club summary (group by club)
    const clubSummaryMap = {};
    attendanceRecords.forEach(record => {
      const key = record.clubId || record.clubName;
      if (!clubSummaryMap[key]) {
        clubSummaryMap[key] = {
          clubId: record.clubId,
          clubName: record.clubName,
          clubOwnerName: record.clubOwnerName,
          attendanceCount: 0,
          dates: [],
        };
      }
      clubSummaryMap[key].attendanceCount++;
      if (!clubSummaryMap[key].dates.includes(record.date)) {
        clubSummaryMap[key].dates.push(record.date);
      }
    });

    const clubSummary = Object.values(clubSummaryMap).sort((a, b) => 
      b.attendanceCount - a.attendanceCount
    );

    console.log('✅ [get-my-club-attendance] Generated report:', {
      totalRecords: attendanceRecords.length,
      uniqueClubs: clubSummary.length,
      dateRange: { start, end },
    });

    res.status(200).json({
      success: true,
      data: {
        attendanceRecords,
        clubSummary,
        dateRange: { start, end },
        totalAttendance: attendanceRecords.length,
      },
    });

  } catch (error) {
    console.error('❌ [get-my-club-attendance] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
