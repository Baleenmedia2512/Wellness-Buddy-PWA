// src/components/HierarchicalScoreCard.js
import React from "react";
import { ChevronDown, ChevronUp, Users, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Hierarchical Score Card - Shows coach's hierarchy with scores
 * Level 0: Coach's own score
 * Level 1: Direct team coaches average
 * Level 2: Members under each direct coach // This includes all members who report to the direct coaches, regardless of their role
 *
 * Data
 */
const HierarchicalScoreCard = ({ teamData, coachPerformance, hierarchyData, allMembersData }) => {
  const [expandedCoaches, setExpandedCoaches] = React.useState({});

  if (!teamData || !coachPerformance) return null;

  // Debug: Log the data to understand structure
  console.log("🎯 HierarchicalScoreCard Data:", {
    coachPerformance,
    teamMembers: teamData.teamMembers,
    teamMembersCount: teamData.teamMembers?.length,
    hierarchyData: hierarchyData,
    hierarchyTeamMembers: hierarchyData?.hierarchy?.teamMembers,
  });

  // Get coach's own score
  const myScore = coachPerformance.periodDiscipline?.percentage || 0;

  // Use hierarchyData if available (has nested structure), otherwise use teamData
  const sourceTeamMembers = hierarchyData?.hierarchy?.teamMembers || teamData.teamMembers || [];
  
  console.log("📦 Using teamMembers from:", hierarchyData?.hierarchy?.teamMembers ? "hierarchyData" : "teamData");
  console.log("📦 Source teamMembers structure:", sourceTeamMembers);
  if (sourceTeamMembers && sourceTeamMembers[0]) {
    console.log("📦 First member has teamMembers?", sourceTeamMembers[0].teamMembers);
  }

  // Flatten the hierarchy to get ALL team members at all levels
  const flattenHierarchy = (members) => {
    const flat = [];
    const flatten = (member) => {
      flat.push(member);
      console.log(`  Flattening ${member.userName}, has teamMembers: ${member.teamMembers ? member.teamMembers.length : 0}`);
      if (member.teamMembers && member.teamMembers.length > 0) {
        member.teamMembers.forEach(child => flatten(child));
      }
    };
    members.forEach(member => flatten(member));
    return flat;
  };

  // Get ALL team members (all levels flattened)
  const allTeamMembersFromHierarchy = flattenHierarchy(sourceTeamMembers);

  console.log("🔄 Flattened all team members:", allTeamMembersFromHierarchy.length, allTeamMembersFromHierarchy.map(m => m.userName));
  console.log("🔄 First hierarchy member data:", allTeamMembersFromHierarchy[0]);
  console.log("🔄 Second hierarchy member data:", allTeamMembersFromHierarchy[1]);

  // Check if hierarchy members already have periodDiscipline scores
  const hierarchyHasScores = allTeamMembersFromHierarchy.some(m => m.periodDiscipline);
  console.log("📊 Hierarchy already has scores?", hierarchyHasScores);

  // Merge scores: Use allMembersData if available (has ALL members), otherwise teamData.teamMembers
  const scoreDataSource = allMembersData?.allMembers || teamData.teamMembers || [];
  console.log("📊 Score data source count:", scoreDataSource.length, "Members:", scoreDataSource.map(m => m.userName));
  
  const allTeamMembers = allTeamMembersFromHierarchy.map(hierarchyMember => {
    // First check if hierarchy member already has score
    if (hierarchyMember.periodDiscipline) {
      console.log(`  ✅ Hierarchy member ${hierarchyMember.userName} already has score: ${hierarchyMember.periodDiscipline?.percentage || 0}%`);
      return hierarchyMember;
    }
    
    // Otherwise try to merge from score data source
    const scoreData = scoreDataSource.find(td => 
      td.userId === hierarchyMember.userId || 
      td.email === hierarchyMember.email
    );
    
    if (scoreData) {
      console.log(`  ✅ Merged score for ${hierarchyMember.userName}: ${scoreData.periodDiscipline?.percentage || 0}%`);
      return { ...hierarchyMember, ...scoreData };
    }
    
    console.log(`  ⚠️ No score data found for ${hierarchyMember.userName}`);
    return hierarchyMember;
  });

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
    console.log(`🔎 Checking underMembers for ${directMember.userName} (userId: ${directMember.userId})`);
    
    const underMembers = allTeamMembers.filter(
      (m) => {
        const matches = (m.coachId === directMember.userId ||
          m.parentCoachId === directMember.userId) &&
        m.userId !== directMember.userId;
        
        console.log(`  - ${m.userName} (userId: ${m.userId}, coachId: ${m.coachId}, parentCoachId: ${m.parentCoachId}) → ${matches ? '✅ MATCH' : '❌ NO MATCH'}`);
        
        return matches;
      }
    );
    
    console.log(`  → Found ${underMembers.length} under members for ${directMember.userName}`);
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
    </div>
  );
};

export default HierarchicalScoreCard;
