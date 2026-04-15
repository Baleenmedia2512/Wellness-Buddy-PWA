/**
 * DEBUG ONLY - Remove before production
 * GET /api/debug/verify-team-structure?coachId=341
 *
 * Verifies that:
 * 1. Co-coach derivation works from coach_teams_table
 * 2. Team members are correctly assigned to coaches
 * 3. Dual-coach team shows both coaches' members
 */
import { getSupabaseClient } from "../../../utils/supabaseClient.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const { coachId } = req.query;
  if (!coachId) {
    return res.status(400).json({ error: "coachId query param required. e.g. ?coachId=341" });
  }

  const supabase = getSupabaseClient();
  const coachIdInt = parseInt(coachId);
  const results = {};

  // ── 1. Coach's own record ──────────────────────────────────────────────
  const { data: coach } = await supabase
    .from("team_table")
    .select("UserId, UserName, CoachId, CoachTeamId, TeamId, Role")
    .eq("UserId", coachIdInt)
    .maybeSingle();

  results.coach = coach;

  // ── 2. What coach_teams_table says about this coach's team ─────────────
  let coachTeamRecord = null;
  let derivedCoCoachId = null;
  let derivedCoCoach = null;

  if (coach?.TeamId) {
    const { data: teamRecord } = await supabase
      .from("coach_teams_table")
      .select("*")
      .eq("TeamId", coach.TeamId)
      .eq("Status", "active")
      .maybeSingle();

    coachTeamRecord = teamRecord;

    if (teamRecord) {
      // Derive co-coach: whichever coach isn't the one we queried
      derivedCoCoachId = teamRecord.CoachId === coachIdInt
        ? teamRecord.CoCoachId
        : teamRecord.CoachId;

      if (derivedCoCoachId) {
        const { data: partner } = await supabase
          .from("team_table")
          .select("UserId, UserName, Role")
          .eq("UserId", derivedCoCoachId)
          .maybeSingle();
        derivedCoCoach = partner;
      }
    }
  }

  results.coachTeamRecord = coachTeamRecord;
  results.derivedCoCoach = derivedCoCoach
    ? { ...derivedCoCoach, derivedHow: `Partner in coach_teams_table TeamId=${coach?.TeamId}` }
    : { message: "No co-coach found. Either solo coach or no team in coach_teams_table." };

  // ── 3. Direct members (CoachId = this coach) ──────────────────────────
  const { data: directMembers } = await supabase
    .from("team_table")
    .select("UserId, UserName, CoachId, CoachTeamId, Role")
    .eq("CoachId", coachIdInt)
    .eq("Status", "Active")
    .order("UserName");

  results.directMembers = {
    count: directMembers?.length || 0,
    members: directMembers?.map(m => ({
      userId: m.UserId,
      userName: m.UserName,
      coachTeamId: m.CoachTeamId,
    })) || []
  };

  // ── 4. If co-coach exists, show their direct members too ───────────────
  if (derivedCoCoachId) {
    const { data: coCoachMembers } = await supabase
      .from("team_table")
      .select("UserId, UserName, CoachId, CoachTeamId, Role")
      .eq("CoachId", derivedCoCoachId)
      .eq("Status", "Active")
      .order("UserName");

    results.coCoachDirectMembers = {
      count: coCoachMembers?.length || 0,
      coCoachId: derivedCoCoachId,
      members: coCoachMembers?.map(m => ({
        userId: m.UserId,
        userName: m.UserName,
        coachTeamId: m.CoachTeamId,
      })) || []
    };

    results.combinedTeamCount =
      (directMembers?.length || 0) + (coCoachMembers?.length || 0);
  }

  // ── 5. Check if CoachTeamId on members matches coach's TeamId ─────────
  const mismatched = (directMembers || []).filter(
    m => m.CoachTeamId && m.CoachTeamId !== coach?.TeamId
  );
  results.warnings = [];
  if (mismatched.length > 0) {
    results.warnings.push({
      issue: "Some members have CoachTeamId that doesn't match coach's TeamId",
      count: mismatched.length,
      members: mismatched.map(m => ({
        userId: m.UserId,
        userName: m.UserName,
        memberCoachTeamId: m.CoachTeamId,
        expectedCoachTeamId: coach?.TeamId,
      }))
    });
  }
  if (!coach?.TeamId) {
    results.warnings.push({ issue: "Coach has no TeamId — co-coach derivation won't work for this coach" });
  }
  if (!coachTeamRecord) {
    results.warnings.push({ issue: "No active record in coach_teams_table for this coach's TeamId" });
  }

  // ── Summary ───────────────────────────────────────────────────────────
  results.summary = {
    coachId: coachIdInt,
    coachName: coach?.UserName,
    hasTeam: !!coach?.TeamId,
    teamId: coach?.TeamId,
    hasCoachTeamRecord: !!coachTeamRecord,
    derivedCoCoachId,
    derivedCoCoachName: derivedCoCoach?.UserName || null,
    directMemberCount: results.directMembers.count,
    coCoachMemberCount: results.coCoachDirectMembers?.count || 0,
    warningCount: results.warnings.length,
    status: results.warnings.length === 0 ? "✅ All checks passed" : "⚠️ See warnings"
  };

  return res.status(200).json(results);
}
