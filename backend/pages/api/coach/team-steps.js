import { getSupabaseClient } from "../../../utils/supabaseClient.js";

/**
 * API: Get Team Step Data for Hierarchical View
 * Returns step counts for all team members under a coach on a given date.
 * Used by StepCounter's "Team Steps" hierarchical view.
 *
 * GET /api/coach/team-steps?coachId=X&targetDate=YYYY-MM-DD
 */

const STEP_GOAL = 10000;

function toDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Recursively collect all descendant userIds under a coach node */
function collectAllMemberIds(userId, allUsers) {
  const ids = new Set();
  const queue = [userId];
  while (queue.length > 0) {
    const current = queue.shift();
    const reports = allUsers.filter(
      (u) =>
        (u.CoachId === current || u.CoCoachId === current) &&
        u.UserId !== current &&
        !ids.has(u.UserId)
    );
    reports.forEach((r) => {
      ids.add(r.UserId);
      queue.push(r.UserId);
    });
  }
  return Array.from(ids);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  try {
    const { coachId, targetDate } = req.query;

    if (!coachId) {
      res.status(400).json({ success: false, message: "coachId is required" });
      return;
    }

    const coachIdInt = parseInt(coachId, 10);
    if (isNaN(coachIdInt)) {
      res.status(400).json({ success: false, message: "coachId must be a number" });
      return;
    }

    const dateKey =
      targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)
        ? targetDate
        : toDateKey();

    const supabase = getSupabaseClient();

    // Fetch all active users to resolve hierarchy
    const { data: allUsers, error: usersError } = await supabase
      .from("team_table")
      .select("UserId, UserName, CoachId, CoCoachId, Status")
      .eq("Status", "Active");

    if (usersError) {
      console.error("[team-steps] Users fetch error:", usersError);
      res.status(500).json({ success: false, message: "Failed to fetch team data" });
      return;
    }

    // Collect the coach themselves + all descendant member IDs
    const memberIds = collectAllMemberIds(coachIdInt, allUsers || []);
    const allIds = [coachIdInt, ...memberIds];

    if (allIds.length === 0) {
      return res.status(200).json({ success: true, members: [] });
    }

    // Fetch step data for all members on the target date in a single query
    const { data: stepRows, error: stepError } = await supabase
      .from("daily_step_activity")
      .select("UserId, Steps, CaloriesBurned")
      .in("UserId", allIds)
      .gte("CreatedAt", `${dateKey}T00:00:00`)
      .lte("CreatedAt", `${dateKey}T23:59:59`)
      .eq("ActivityType", "walking");

    if (stepError) {
      console.error("[team-steps] Step data fetch error:", stepError);
      res.status(500).json({ success: false, message: "Failed to fetch step data" });
      return;
    }

    // Aggregate — take max steps per user (last save for the day wins)
    const stepMap = new Map();
    (stepRows || []).forEach((row) => {
      const existing = stepMap.get(row.UserId) || 0;
      const steps = parseInt(row.Steps ?? 0, 10) || 0;
      if (steps > existing) stepMap.set(row.UserId, steps);
    });

    // Build user name map for response
    const userNameMap = new Map();
    (allUsers || []).forEach((u) => userNameMap.set(u.UserId, u.UserName || ""));

    // Build response: one entry per member
    const members = allIds.map((uid) => {
      const steps = stepMap.get(uid) || 0;
      const stepPercent = Math.min(Math.round((steps / STEP_GOAL) * 100), 100);
      return {
        userId: uid,
        userName: userNameMap.get(uid) || String(uid),
        steps,
        stepPercent,
      };
    });

    res.status(200).json({
      success: true,
      date: dateKey,
      stepGoal: STEP_GOAL,
      members,
    });
  } catch (err) {
    console.error("[team-steps] Unexpected error:", err);
    res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
}
