import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { formatDateForMySQL } from '../../../utils/disciplineHelpers.js';
import { buildTeamHierarchy } from '../../../utils/teamHierarchyBuilder.js';
import logger from '../../../shared/lib/logger.js';

/**
 * API: Hierarchical Club Attendance Report
 *
 * Returns the SAME team hierarchy used by /api/coach/team-hierarchy
 * (the one that powers the Discipline Report), enriched with per-user
 * attendance metrics for the requested date.
 *
 * Why this matters:
 *   - Single source of truth for the tree shape → Attendance & Discipline
 *     reports always show the same members.
 *   - The shared builder already supports coach + co-coach partnerships
 *     (members under EITHER partner are merged once, with `coCoachInfo`
 *     attached at the root for the shared-tile UI).
 *   - The shared builder uses the proven `visited`-Set cycle guard, so it
 *     cannot produce a "Maximum call stack size exceeded" error.
 *
 * This file no longer builds its own tree — it only enriches the one
 * returned by `buildTeamHierarchy()`.
 */
export default async function handler(req, res) {
  // Prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const { userId, date, clubId } = req.query;

  logger.debug('🏢 [hierarchical-club-attendance] Request:', { userId, date, clubId });

  if (!userId) {
    res.status(400).json({ success: false, message: 'Missing required parameter: userId' });
    return;
  }

  try {
    const supabase = getSupabaseClient();
    const userIdNum = parseInt(userId);
    const clubIdNum = clubId ? parseInt(clubId) : null;

    const targetDate = date || formatDateForMySQL(new Date());
    const startOfDay = targetDate + 'T00:00:00';
    const endOfDay = targetDate + 'T23:59:59';

    logger.debug('📅 [hierarchical-club-attendance] Target date:', targetDate);

    // ─────────────────────────────────────────────────────────────────────
    // Step 0: Owned clubs (unchanged)
    // ─────────────────────────────────────────────────────────────────────
    const { data: userClubs, error: clubsError } = await supabase
      .from('nutrition_centers_table')
      .select('id, center_name, owner_user_id')
      .eq('owner_user_id', userIdNum)
      .eq('status', 'active')
      .eq('is_deleted', false)
      .order('center_name');
    if (clubsError) throw new Error(clubsError.message);
    const ownedClubs = userClubs || [];

    // ─────────────────────────────────────────────────────────────────────
    // Step 1: Build the SAME tree the Discipline Report uses.
    // ─────────────────────────────────────────────────────────────────────
    const { hierarchy, allMembers } = await buildTeamHierarchy(supabase, userIdNum);

    if (!hierarchy) {
      logger.debug('⚠️ [hierarchical-club-attendance] No team hierarchy found');
      return res.status(200).json({
        success: true,
        data: {
          hierarchy: null,
          date: targetDate,
          totalAttendees: 0,
          ownedClubs: ownedClubs.map(c => ({ id: c.id, name: c.center_name })),
          selectedClubId: clubIdNum,
          externalAttendees: [],
        },
      });
    }

    // Collect every userId that exists anywhere in the tree
    // (root + co-coach + all team members) — used for the bulk attendance query.
    const allUserIds = new Set();
    allUserIds.add(hierarchy.userId);
    if (hierarchy.coCoachInfo?.userId) allUserIds.add(hierarchy.coCoachInfo.userId);
    allMembers.forEach(m => allUserIds.add(m.UserId));

    logger.debug(
      `👥 [hierarchical-club-attendance] Tree from buildTeamHierarchy: ${allUserIds.size} unique users`
    );

    // ─────────────────────────────────────────────────────────────────────
    // Step 2: Bulk-fetch attendance logs for everyone in the tree
    // ─────────────────────────────────────────────────────────────────────
    let attendanceQuery = supabase
      .from('education_logs_table')
      .select(`
        "UserId",
        "CreatedAt",
        "Platform",
        attendance_type,
        nutrition_center_id,
        center_name
      `)
      .filter('"UserId"', 'in', `(${[...allUserIds].join(',')})`)
      .gte('"CreatedAt"', startOfDay)
      .lte('"CreatedAt"', endOfDay)
      .or('"IsDeleted".is.null,"IsDeleted".eq.false,"IsDeleted".eq.0');

    if (clubIdNum) {
      attendanceQuery = attendanceQuery.eq('nutrition_center_id', clubIdNum);
    }

    const { data: attendanceLogs, error: logsError } = await attendanceQuery;
    if (logsError) throw new Error(logsError.message);

    logger.debug('📊 [hierarchical-club-attendance] Found', attendanceLogs?.length || 0, 'attendance records (before dedup)');
    if (attendanceLogs && attendanceLogs.length > 0) {
      logger.debug('📊 [hierarchical-club-attendance] Records:', JSON.stringify(attendanceLogs));
    } else {
      logger.debug('📊 [hierarchical-club-attendance] NO records found. Params:', { startOfDay, endOfDay, allUserIds });
    }

    // Step 3a: Deduplicate attendance logs — keep only the LATEST entry per user
    let dedupedLogs = attendanceLogs || [];
    if (dedupedLogs.length > 0) {
      // Sort by CreatedAt ascending (earliest first, so latest overwrites)
      const sorted = [...dedupedLogs].sort((a, b) => {
        const timeA = new Date(a.CreatedAt);
        const timeB = new Date(b.CreatedAt);
        return timeA - timeB;
      });

      // Use Map to keep only the latest record per user
      const latestByUser = new Map();
      sorted.forEach(log => {
        const userId = parseInt(log.UserId, 10);
        latestByUser.set(userId, log); // Overwrites earlier records
      });
      
      // Create deduplicated array
      dedupedLogs = Array.from(latestByUser.values());
      
      logger.debug('🔁 [hierarchical-club-attendance] After dedup:', dedupedLogs.length, 'unique users (was', attendanceLogs?.length || 0, 'records)');
    }

    // Step 3b: Fetch external attendees (people NOT in team who attended the club)
    let externalAttendees = [];
    if (clubIdNum) {
      const { data: allClubAttendance } = await supabase
        .from('education_logs_table')
        .select('"UserId","CreatedAt"')
        .eq('nutrition_center_id', clubIdNum)
        .gte('"CreatedAt"', startOfDay)
        .lte('"CreatedAt"', endOfDay)
        .or('"IsDeleted".is.null,"IsDeleted".eq.false');

      if (allClubAttendance) {
        const teamUserIdsSet = new Set([...allUserIds].map(id => parseInt(id)));
        const externalUserIds = [...new Set(
          allClubAttendance
            .map(log => parseInt(log.UserId))
            .filter(uid => !teamUserIdsSet.has(uid))
        )];

        if (externalUserIds.length > 0) {
          const { data: externalUsersData } = await supabase
            .from('team_table')
            .select('UserId, UserName, Email, CoachId, ProfileImage')
            .in('UserId', externalUserIds);

          if (externalUsersData) {
            const externalCoachIds = [...new Set(
              externalUsersData.map(u => u.CoachId).filter(Boolean)
            )];
            const coachNameMap = {};
            if (externalCoachIds.length > 0) {
              const { data: coaches } = await supabase
                .from('team_table')
                .select('UserId, UserName')
                .in('UserId', externalCoachIds);
              if (coaches) coaches.forEach(c => { coachNameMap[c.UserId] = c.UserName; });
            }

            externalAttendees = externalUsersData.map(user => ({
              userId: user.UserId,
              userName: user.UserName,
              email: user.Email,
              coachName: user.CoachId ? (coachNameMap[user.CoachId] || 'Unknown') : 'No Coach',
              profileImage: user.ProfileImage || null,
            }));
          }
        }
      }
    }

    // Step 4: Fetch club information for all attended clubs
    const attendedClubIds = dedupedLogs 
      ? [...new Set(dedupedLogs.map(log => log.nutrition_center_id).filter(id => id))]
      : [];
    const clubsMap = {};
    if (attendedClubIds.length > 0) {
      const { data: clubsData } = await supabase
        .from('nutrition_centers_table')
        .select('id, center_name')
        .in('id', attendedClubIds)
        .eq('status', 'active')
        .eq('is_deleted', false);
      if (clubsData) clubsData.forEach(club => {
        clubsMap[club.id] = { id: club.id, name: club.center_name };
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Step 4: Build attendance map (userId → { attended, clubs[], remoteCount, ts })
    // ─────────────────────────────────────────────────────────────────────
    const attendanceMap = new Map();
    
    if (dedupedLogs) {
      dedupedLogs.forEach(log => {
        // education_logs_table.UserId is varchar — convert to number so it matches
        // team_table.UserId (int4) used as the Map key in hierarchyHelpers
        const userId = parseInt(log.UserId, 10);
        const clubId = log.nutrition_center_id;
        const clubInfo = clubId ? clubsMap[clubId] : null;
        // Determine if remote: check attendance_type first, then fall back to Platform column
        const platform = (log.Platform || '').toLowerCase();
        const attendanceType = (log.attendance_type || '').toLowerCase();
        const isClubVisit = attendanceType === 'club' || platform === 'club' || !!clubId;
        const isRemote = attendanceType === 'remote' || platform === 'zoom' || platform === 'online meeting' || (!isClubVisit && !clubId);

        if (!attendanceMap.has(userId)) {
          attendanceMap.set(userId, { attended: true, clubs: [], remoteCount: 0, timestamps: [] });
        }
        const ua = attendanceMap.get(userId);
        if (isClubVisit && !isRemote) {
          const clubName = clubInfo?.name || log.center_name || null;
          if (clubName && !ua.clubs.find(c => c.id === clubId && clubId)) {
            ua.clubs.push({ id: clubId, name: clubName });
          }
        } else {
          ua.remoteCount += 1;
        }
        ua.timestamps.push(log.CreatedAt);
      });
    }

    const getAttendanceMetrics = (uid) => {
      const a = attendanceMap.get(uid);
      return a
        ? {
            attended: true,
            clubs: a.clubs,
            count: a.clubs.length,
            remoteCount: a.remoteCount || 0,
            lastAttendance: a.timestamps[a.timestamps.length - 1],
          }
        : {
            attended: false,
            clubs: [],
            count: 0,
            remoteCount: 0,
            lastAttendance: null,
          };
    };

    // ─────────────────────────────────────────────────────────────────────
    // Step 5: ENRICH the proven tree with attendance metrics & team counts.
    // The tree shape comes from buildTeamHierarchy (with cycle guard) — we
    // only walk it once with our own `visited` Set + depth cap as belt-and-
    // braces protection.
    // ─────────────────────────────────────────────────────────────────────
    const MAX_DEPTH = 25;

    // Add `metrics` to every node (root + descendants).
    const attachMetrics = (node, visited = new Set(), depth = 0) => {
      if (!node || visited.has(node.userId) || depth > MAX_DEPTH) return;
      visited.add(node.userId);

      // Map a couple of fields so the UI can keep using the same prop names.
      node.userEmail = node.email || node.userEmail;
      node.metrics = getAttendanceMetrics(node.userId);
      node.hierarchyLevel = depth;

      if (node.teamMembers && node.teamMembers.length > 0) {
        node.teamMembers.forEach(child => attachMetrics(child, visited, depth + 1));
      }
    };
    attachMetrics(hierarchy);

    // Compute directTeamCount + fullTeamCount per node (cycle/depth-guarded).
    const computeCounts = (node, visited = new Set(), depth = 0) => {
      if (!node) return;
      if (visited.has(node.userId) || depth > MAX_DEPTH) {
        node.teamMembers = node.teamMembers || [];
        node.directTeamCount = { total: 0, qualified: 0, totalClubs: 0 };
        node.fullTeamCount = { total: 0, qualified: 0, totalClubs: 0 };
        return;
      }
      visited.add(node.userId);

      const children = node.teamMembers || [];
      children.forEach(child => computeCounts(child, visited, depth + 1));

      const directAttended = children.filter(m => m.metrics?.attended).length;
      const directClubs = children.reduce((sum, m) => sum + (m.metrics?.count || 0), 0);
      node.directTeamCount = {
        total: children.length,
        qualified: directAttended,
        totalClubs: directClubs,
      };

      let fullTotal = 0, fullQualified = 0, fullClubs = 0;
      const seen = new Set([node.userId]);
      const traverse = (n, d = 0) => {
        if (!n || seen.has(n.userId) || d > MAX_DEPTH) return;
        seen.add(n.userId);
        fullTotal++;
        if (n.metrics?.attended) fullQualified++;
        fullClubs += (n.metrics?.count || 0);
        (n.teamMembers || []).forEach(c => traverse(c, d + 1));
      };
      children.forEach(c => traverse(c, 1));

      node.fullTeamCount = {
        total: fullTotal,
        qualified: fullQualified,
        totalClubs: fullClubs,
      };
    };
    computeCounts(hierarchy);

    // Co-coach (shared tile) inherits the same metrics + team counts as root.
    if (hierarchy.coCoachInfo) {
      const partnerId = hierarchy.coCoachInfo.userId;
      hierarchy.coCoachInfo.metrics = getAttendanceMetrics(partnerId);
      hierarchy.coCoachInfo.userEmail =
        hierarchy.coCoachInfo.email || hierarchy.coCoachInfo.userEmail;
      hierarchy.coCoachInfo.directTeamCount = hierarchy.directTeamCount;
      hierarchy.coCoachInfo.fullTeamCount = hierarchy.fullTeamCount;
      logger.debug(
        `👥 [hierarchical-club-attendance] coCoachInfo enriched for ${hierarchy.coCoachInfo.userName}`
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // Step 6: Stats + response (shape unchanged)
    // ─────────────────────────────────────────────────────────────────────
    const totalTeamMembers = hierarchy.fullTeamCount?.total || 0;
    const totalAttendees = hierarchy.fullTeamCount?.qualified || 0;
    const attendanceRate = totalTeamMembers > 0
      ? ((totalAttendees / totalTeamMembers) * 100).toFixed(1)
      : '0.0';
    const directTeamMembers = hierarchy.directTeamCount?.total || 0;
    const directTeamAttendees = hierarchy.directTeamCount?.qualified || 0;

    logger.debug('✅ [hierarchical-club-attendance] Generated report:', {
      date: targetDate,
      clubFilter: clubIdNum || 'All clubs',
      totalTeamMembers,
      totalAttendees,
      attendanceRate: attendanceRate + '%',
      directTeamMembers,
      directTeamAttendees,
      externalAttendees: externalAttendees.length,
    });

    res.status(200).json({
      success: true,
      data: {
        hierarchy,
        date: targetDate,
        selectedClubId: clubIdNum,
        ownedClubs: ownedClubs.map(c => ({ id: c.id, name: c.center_name })),
        stats: {
          totalTeamMembers,
          totalAttendees,
          attendanceRate,
          directTeamMembers,
          directTeamAttendees,
          totalClubsVisited: attendedClubIds.length,
          externalAttendees: externalAttendees.length,
        },
        clubs: Object.values(clubsMap),
        externalAttendees,
      },
    });
  } catch (error) {
    console.error('❌ [hierarchical-club-attendance] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
