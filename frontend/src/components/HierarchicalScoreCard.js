// src/components/HierarchicalScoreCard.js
import React from "react";
import { ChevronDown, ChevronUp, Users, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Hierarchical Score Card - Shows coach's hierarchy with scores
 * Level 0: Coach's own score
 * Level 1: Direct team coaches average
 * Level 2: Members under each direct coach
 */
const HierarchicalScoreCard = ({ teamData, coachPerformance }) => {
  const [expandedCoaches, setExpandedCoaches] = React.useState({});

  if (!teamData || !coachPerformance) return null;

  // Debug: Log the data to understand structure
  console.log("🎯 HierarchicalScoreCard Data:", {
    coachPerformance,
    teamMembers: teamData.teamMembers,
    teamMembersCount: teamData.teamMembers?.length,
  });

  // Get coach's own score
  const myScore = coachPerformance.periodDiscipline?.percentage || 0;

  // Get ALL direct team members (Level 1) - both coaches and regular members
  const allTeamMembers = teamData.teamMembers || [];

  // DIRECT TEAM: All members who report directly to the coach (Level 1)
  // This includes both coaches and regular members at Level 1
  const directTeamMembers = allTeamMembers.filter(
    (m) =>
      m.coachId === coachPerformance.userId ||
      m.parentCoachId === coachPerformance.userId,
  );

  console.log(
    "🔍 Direct Team Members Found:",
    directTeamMembers.length,
    directTeamMembers,
  );

  // Separate direct coaches from direct regular members
  const directCoaches = directTeamMembers.filter(
    (m) => m.role === "coach" || m.isCoach,
  );

  const directRegularMembers = directTeamMembers.filter(
    (m) => m.role !== "coach" && !m.isCoach,
  );

  console.log("👥 Direct Coaches:", directCoaches.length);
  console.log("👤 Direct Regular Members:", directRegularMembers.length);

  // Calculate DIRECT TEAM average (ALL Level 1 members)
  const directTeamAvg =
    directTeamMembers.length > 0
      ? Math.round(
          directTeamMembers.reduce(
            (sum, m) => sum + (m.periodDiscipline?.percentage || 0),
            0,
          ) / directTeamMembers.length,
        )
      : 0;

  // UNDER TEAM: Members who report to the direct team members (Level 2+)
  // These are members whose coachId/parentCoachId matches a direct team member's userId
  const membersByCoach = {};
  const allMembersUnderDirectTeam = [];

  directTeamMembers.forEach((directMember) => {
    const underMembers = allTeamMembers.filter(
      (m) =>
        (m.coachId === directMember.userId ||
          m.parentCoachId === directMember.userId) &&
        m.userId !== directMember.userId, // Don't count the direct member themselves
    );
    membersByCoach[directMember.userId] = underMembers;
    allMembersUnderDirectTeam.push(...underMembers);
  });

  // Calculate average of members under direct team (Level 2+)
  const membersUnderTeamAvg =
    allMembersUnderDirectTeam.length > 0
      ? Math.round(
          allMembersUnderDirectTeam.reduce(
            (sum, m) => sum + (m.periodDiscipline?.percentage || 0),
            0,
          ) / allMembersUnderDirectTeam.length,
        )
      : 0;

  console.log("📊 Calculated Scores:", {
    myScore,
    directTeamAvg,
    membersUnderTeamAvg,
    directTeamCount: directTeamMembers.length,
    membersUnderTeamCount: allMembersUnderDirectTeam.length,
  });

  // Get color based on score
  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 60) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getScoreTextColor = (score) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const toggleCoach = (coachId) => {
    setExpandedCoaches((prev) => ({
      ...prev,
      [coachId]: !prev[coachId],
    }));
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-purple-600" />
        <h3 className="text-sm sm:text-base font-bold text-gray-800">
          Team Hierarchy Performance
        </h3>
      </div>

      {/* Three-Column Score Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
        <div className="grid grid-cols-3 divide-x divide-gray-200">
          {/* Column 1: My Score (Yasheer J - 20%) */}
          <div className="p-3 sm:p-4 flex flex-col items-center justify-center text-center min-h-[120px]">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-500 flex items-center justify-center mb-2 shadow-md">
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <p className="text-[9px] sm:text-[10px] text-purple-600 font-bold uppercase tracking-wider mb-1">
              MY SCORE
            </p>
            <div
              className={`text-3xl sm:text-4xl font-black ${getScoreTextColor(
                myScore,
              )}`}
            >
              {myScore}%
            </div>
            <p className="text-[8px] sm:text-[9px] text-gray-400 mt-1">
              (Coach)
            </p>
          </div>

          {/* Column 2: Direct Team (All Level 1 members - coaches + regular members) */}
          <div className="p-3 sm:p-4 flex flex-col items-center justify-center text-center min-h-[120px] bg-blue-50/30">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-500 flex items-center justify-center mb-2 shadow-md">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <p className="text-[9px] sm:text-[10px] text-blue-600 font-bold uppercase tracking-wider mb-1 leading-tight">
              DIRECT TEAM
            </p>
            <div
              className={`text-3xl sm:text-4xl font-black ${getScoreTextColor(
                directTeamAvg,
              )}`}
            >
              {directTeamAvg}%
            </div>
            <p className="text-[8px] sm:text-[9px] text-gray-400 mt-1">
              ({directTeamMembers.length} Member
              {directTeamMembers.length !== 1 ? "s" : ""})
            </p>
          </div>

          {/* Column 3: Members Under Team (Level 2+) */}
          <div className="p-3 sm:p-4 flex flex-col items-center justify-center text-center min-h-[120px]">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-500 flex items-center justify-center mb-2 shadow-md">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <p className="text-[9px] sm:text-[10px] text-green-600 font-bold uppercase tracking-wider mb-1 leading-tight">
              UNDER TEAM
            </p>
            <div
              className={`text-3xl sm:text-4xl font-black ${getScoreTextColor(
                membersUnderTeamAvg,
              )}`}
            >
              {membersUnderTeamAvg}%
            </div>
            <p className="text-[8px] sm:text-[9px] text-gray-400 mt-1">
              ({allMembersUnderDirectTeam.length} Member
              {allMembersUnderDirectTeam.length !== 1 ? "s" : ""})
            </p>
          </div>
        </div>

        {/* Progress indicator bar */}
        <div className="h-1.5 bg-gray-100 grid grid-cols-3">
          <div
            className="bg-purple-500 transition-all duration-500"
            style={{ width: `${myScore}%` }}
          />
          <div
            className="bg-blue-500 transition-all duration-500"
            style={{ width: `${directTeamAvg}%` }}
          />
          <div
            className="bg-green-500 transition-all duration-500"
            style={{ width: `${membersUnderTeamAvg}%` }}
          />
        </div>
      </div>

      {/* Expandable Details: Only show members who have sub-members */}
      {directTeamMembers.some(
        (tm) => (membersByCoach[tm.userId] || []).length > 0,
      ) && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">
                DIRECT TEAM BREAKDOWN
              </p>
              <p className="text-[10px] text-gray-400">
                Members and their sub-teams
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {directTeamMembers
              .filter((tm) => (membersByCoach[tm.userId] || []).length > 0)
              .map((teamMember) => {
                const underMembers = membersByCoach[teamMember.userId] || [];
                const memberScore =
                  teamMember.periodDiscipline?.percentage || 0;
                const isExpanded = expandedCoaches[teamMember.userId];

                return (
                  <div
                    key={teamMember.userId}
                    className="border-2 border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-colors"
                  >
                    {/* Team Member Header */}
                    <div
                      onClick={() => toggleCoach(teamMember.userId)}
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-blue-50 transition-colors bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 shadow-sm ${getScoreColor(
                            memberScore,
                          )}`}
                        >
                          {teamMember.userName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">
                            {teamMember.userName}
                          </p>
                          <p className="text-[10px] text-gray-500 font-medium">
                            {underMembers.length} member
                            {underMembers.length !== 1 ? "s" : ""} under{" "}
                            {teamMember.userName.split(" ")[0]}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div
                            className={`text-2xl font-black ${getScoreTextColor(
                              memberScore,
                            )}`}
                          >
                            {memberScore}%
                          </div>
                          <p className="text-[8px] text-gray-400 uppercase">
                            {teamMember.role === "coach" || teamMember.isCoach
                              ? "COACH"
                              : "MEMBER"}
                          </p>
                        </div>
                        {underMembers.length > 0 &&
                          (isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-600" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-600" />
                          ))}
                      </div>
                    </div>

                    {/* Sub-Members List (Level 2+) */}
                    <AnimatePresence>
                      {isExpanded && underMembers.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t-2 border-gray-200 bg-gradient-to-b from-green-50/30 to-white"
                        >
                          <div className="p-3 space-y-2">
                            {underMembers.map((subMember) => {
                              const subMemberScore =
                                subMember.periodDiscipline?.percentage || 0;
                              return (
                                <div
                                  key={subMember.userId}
                                  className="flex items-center justify-between bg-white rounded-lg p-3 border-2 border-gray-100 hover:border-green-200 hover:shadow-sm transition-all"
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-sm ${getScoreColor(
                                        subMemberScore,
                                      )}`}
                                    >
                                      {subMember.userName
                                        .charAt(0)
                                        .toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-gray-800">
                                        {subMember.userName}
                                      </p>
                                      <p className="text-[10px] text-gray-400">
                                        {subMember.email}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div
                                      className={`text-2xl font-black ${getScoreTextColor(
                                        subMemberScore,
                                      )}`}
                                    >
                                      {subMemberScore}%
                                    </div>
                                    <p className="text-[8px] text-gray-400 uppercase">
                                      {subMemberScore >= 80
                                        ? "⭐ GREAT"
                                        : subMemberScore >= 60
                                        ? "GOOD"
                                        : "⚠️ RISK"}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

export default HierarchicalScoreCard;
