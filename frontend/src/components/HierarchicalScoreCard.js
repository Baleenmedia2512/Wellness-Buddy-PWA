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
  console.log('🎯 HierarchicalScoreCard Data:', {
    coachPerformance,
    teamMembers: teamData.teamMembers,
    teamMembersCount: teamData.teamMembers?.length
  });

  // Get coach's own score
  const myScore = coachPerformance.periodDiscipline?.percentage || 0;

  // Identify coaches in the team (direct sub-coaches)
  const directCoaches = teamData.teamMembers?.filter(
    (m) => m.role === "coach" || m.isCoach
  ) || [];

  console.log('🔍 Direct Coaches Found:', directCoaches.length, directCoaches);

  // If no coaches found, try to get all team members who are coaches by checking their properties
  const allTeamMembers = teamData.teamMembers || [];
  const regularMembers = allTeamMembers.filter(m => m.role !== "coach" && !m.isCoach);
  
  console.log('👥 All Team Members:', allTeamMembers.length);
  console.log('👤 Regular Members:', regularMembers.length);

  // Calculate direct coaches average
  const directCoachesAvg =
    directCoaches.length > 0
      ? Math.round(
          directCoaches.reduce(
            (sum, c) => sum + (c.periodDiscipline?.percentage || 0),
            0
          ) / directCoaches.length
        )
      : 0;

  // Group members by their coach and calculate members under team average
  const membersByCoach = {};
  const allMembersUnderCoaches = [];
  
  directCoaches.forEach((coach) => {
    const coachMembers = teamData.teamMembers?.filter(
      (m) =>
        (m.coachId === coach.userId || m.parentCoachId === coach.userId) &&
        !m.isCoach &&
        m.role !== "coach"
    ) || [];
    membersByCoach[coach.userId] = coachMembers;
    allMembersUnderCoaches.push(...coachMembers);
  });

  // Calculate average of members under direct team coaches
  const membersUnderTeamAvg =
    allMembersUnderCoaches.length > 0
      ? Math.round(
          allMembersUnderCoaches.reduce(
            (sum, m) => sum + (m.periodDiscipline?.percentage || 0),
            0
          ) / allMembersUnderCoaches.length
        )
      : 0;

  console.log('📊 Calculated Scores:', {
    myScore,
    directCoachesAvg,
    membersUnderTeamAvg,
    directCoachesCount: directCoaches.length,
    membersUnderCoachesCount: allMembersUnderCoaches.length
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
            <div className={`text-3xl sm:text-4xl font-black ${getScoreTextColor(myScore)}`}>
              {myScore}%
            </div>
            <p className="text-[8px] sm:text-[9px] text-gray-400 mt-1">
              (Coach)
            </p>
          </div>

          {/* Column 2: Direct Team Coaches (Balaji K S - 40%) */}
          <div className="p-3 sm:p-4 flex flex-col items-center justify-center text-center min-h-[120px] bg-blue-50/30">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-500 flex items-center justify-center mb-2 shadow-md">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <p className="text-[9px] sm:text-[10px] text-blue-600 font-bold uppercase tracking-wider mb-1 leading-tight">
              DIRECT TEAM
            </p>
            <div className={`text-3xl sm:text-4xl font-black ${getScoreTextColor(directCoachesAvg)}`}>
              {directCoachesAvg}%
            </div>
            <p className="text-[8px] sm:text-[9px] text-gray-400 mt-1">
              ({directCoaches.length} Coach{directCoaches.length !== 1 ? "es" : ""})
            </p>
          </div>

          {/* Column 3: Members Under Team (Susmitha, Leenah, etc.) */}
          <div className="p-3 sm:p-4 flex flex-col items-center justify-center text-center min-h-[120px]">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-500 flex items-center justify-center mb-2 shadow-md">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <p className="text-[9px] sm:text-[10px] text-green-600 font-bold uppercase tracking-wider mb-1 leading-tight">
              UNDER TEAM
            </p>
            <div className={`text-3xl sm:text-4xl font-black ${getScoreTextColor(membersUnderTeamAvg)}`}>
              {membersUnderTeamAvg}%
            </div>
            <p className="text-[8px] sm:text-[9px] text-gray-400 mt-1">
              ({allMembersUnderCoaches.length} Member{allMembersUnderCoaches.length !== 1 ? "s" : ""})
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
            style={{ width: `${directCoachesAvg}%` }}
          />
          <div 
            className="bg-green-500 transition-all duration-500"
            style={{ width: `${membersUnderTeamAvg}%` }}
          />
        </div>
      </div>

      {/* Expandable Details: Members under each direct coach */}
      {directCoaches.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">
                UNDER THE DIRECT TEAM
              </p>
              <p className="text-[10px] text-gray-400">
                Members grouped by coach
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {directCoaches.map((coach) => {
              const members = membersByCoach[coach.userId] || [];
              const coachScore = coach.periodDiscipline?.percentage || 0;
              const isExpanded = expandedCoaches[coach.userId];

              return (
                <div
                  key={coach.userId}
                  className="border-2 border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-colors"
                >
                  {/* Coach Header */}
                  <div
                    onClick={() => toggleCoach(coach.userId)}
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-blue-50 transition-colors bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 shadow-sm ${getScoreColor(
                          coachScore
                        )}`}
                      >
                        {coach.userName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          {coach.userName}
                        </p>
                        <p className="text-[10px] text-gray-500 font-medium">
                          {members.length} member{members.length !== 1 ? "s" : ""} under this coach
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div
                          className={`text-2xl font-black ${getScoreTextColor(
                            coachScore
                          )}`}
                        >
                          {coachScore}%
                        </div>
                        <p className="text-[8px] text-gray-400 uppercase">COACH</p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      )}
                    </div>
                  </div>

                  {/* Members List */}
                  <AnimatePresence>
                    {isExpanded && members.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t-2 border-gray-200 bg-gradient-to-b from-blue-50/30 to-white"
                      >
                        <div className="p-3 space-y-2">
                          {members.map((member) => {
                            const memberScore =
                              member.periodDiscipline?.percentage || 0;
                            return (
                              <div
                                key={member.userId}
                                className="flex items-center justify-between bg-white rounded-lg p-3 border-2 border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all"
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-sm ${getScoreColor(
                                      memberScore
                                    )}`}
                                  >
                                    {member.userName.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-800">
                                      {member.userName}
                                    </p>
                                    <p className="text-[10px] text-gray-400">
                                      {member.email}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div
                                    className={`text-2xl font-black ${getScoreTextColor(
                                      memberScore
                                    )}`}
                                  >
                                    {memberScore}%
                                  </div>
                                  <p className="text-[8px] text-gray-400 uppercase">
                                    {memberScore >= 80 ? "⭐ GREAT" : memberScore >= 60 ? "GOOD" : "⚠️ RISK"}
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
