// src/components/CoachScoreSummary.js
import React, { useState, useEffect } from "react";
import { Users, User } from "lucide-react";
import {
  SelfLogo,
  DirectLogo,
  FullTeamLogo,
} from "../../../components/common/DisciplineScoreLogos";

/**
 * CoachScoreSummary - Displays coach's performance summary on main page
 * Shows MY SCORE, DIRECT TEAM average, and FULL TEAM average
 */
const CoachScoreSummary = ({ apiBaseUrl, userId }) => {
  const [scores, setScores] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScores = async () => {
      if (!userId || !apiBaseUrl) {
        setLoading(false);
        return;
      }

      try {
        console.log(
          "📊 [CoachScoreSummary] Fetching scores for userId:",
          userId,
        );

        // Fetch discipline report (includes coach's score + team members)
        // Use "today" to match the Discipline Report default view
        // Add timestamp to prevent caching
        // Get user's timezone offset for proper discipline calculation
        const userTimezoneOffset = new Date().getTimezoneOffset();
        
        const disciplineResponse = await fetch(
          `${apiBaseUrl}/api/coach/discipline-report?coachId=${userId}&dateRange=today&userTimezoneOffset=${userTimezoneOffset}&t=${Date.now()}`,
          {
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
            },
          },
        );
        const disciplineResult = await disciplineResponse.json();

        console.log("📊 [CoachScoreSummary] API Response:", {
          success: disciplineResult.success,
          hasCoachPerformance: !!disciplineResult.coachPerformance,
          teamMembersCount: disciplineResult.teamMembers?.length || 0,
          coachScore: disciplineResult.coachPerformance?.periodDiscipline?.percentage
        });

        if (!disciplineResult.success) {
          console.log("📊 [CoachScoreSummary] API returned success=false");
          setScores(null);
          setLoading(false);
          return;
        }

        // Get coach's own score - ALWAYS show this even if no team members
        const myScore =
          disciplineResult.coachPerformance?.periodDiscipline?.percentage || 0;

        // Get all team members from the response
        const allMembers = disciplineResult.teamMembers || [];

        console.log("📊 [CoachScoreSummary] Team members data:", {
          count: allMembers.length,
          members: allMembers.map((m) => ({
            userName: m.userName,
            userId: m.userId,
            coachId: m.coachId,
            parentCoachId: m.parentCoachId,
            score: m.periodDiscipline?.percentage,
          })),
        });

        // Even if no team members, we should still show the coach's score
        if (allMembers.length === 0) {
          console.log("📊 [CoachScoreSummary] No team members - showing coach score only");
          setScores({
            myScore,
            directTeamAvg: 0,
            directTeamCount: 0,
            fullTeamAvg: 0,
            fullTeamCount: 0,
          });
          setLoading(false);
          return;
        }

        // Calculate DIRECT TEAM (Level 1) - members who report directly to this coach
        const directTeamMembers = allMembers.filter(
          (m) => m.coachId === userId || m.parentCoachId === userId,
        );

        console.log("📊 [CoachScoreSummary] Direct team members:", {
          count: directTeamMembers.length,
          members: directTeamMembers.map((m) => ({
            userName: m.userName,
            score: m.periodDiscipline?.percentage,
          })),
        });

        const directTeamAvg =
          directTeamMembers.length > 0
            ? Math.round(
                directTeamMembers.reduce(
                  (sum, m) => sum + (m.periodDiscipline?.percentage || 0),
                  0,
                ) / directTeamMembers.length,
              )
            : 0;

        // Calculate FULL TEAM (Level 1 + Level 2+)
        // Get all members under direct team
        const allMembersUnderDirectTeam = [];
        directTeamMembers.forEach((directMember) => {
          const underMembers = allMembers.filter(
            (m) =>
              (m.coachId === directMember.userId ||
                m.parentCoachId === directMember.userId) &&
              m.userId !== directMember.userId,
          );
          allMembersUnderDirectTeam.push(...underMembers);
        });

        // Combine direct + under for full team
        const allFullTeamMembers = [
          ...directTeamMembers,
          ...allMembersUnderDirectTeam,
        ];

        const fullTeamAvg =
          allFullTeamMembers.length > 0
            ? Math.round(
                allFullTeamMembers.reduce(
                  (sum, m) => sum + (m.periodDiscipline?.percentage || 0),
                  0,
                ) / allFullTeamMembers.length,
              )
            : 0;

        console.log("📊 [CoachScoreSummary] Calculated scores:", {
          myScore,
          directTeamAvg,
          directTeamCount: directTeamMembers.length,
          fullTeamAvg,
          fullTeamCount: allFullTeamMembers.length,
        });

        setScores({
          myScore,
          directTeamAvg,
          directTeamCount: directTeamMembers.length,
          fullTeamAvg,
          fullTeamCount: allFullTeamMembers.length,
        });
      } catch (error) {
        console.error("📊 [CoachScoreSummary] Error fetching scores:", error);
        // Still try to set scores even if there's an error
        setScores(null);
      } finally {
        setLoading(false);
      }
    };

    fetchScores();
  }, [apiBaseUrl, userId]);

  // Get color based on score
  const getScoreTextColor = (score) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  // Don't render if loading
  if (loading) {
    return null;
  }

  // Don't show if no scores at all (error case)
  if (!scores) {
    console.log("📊 [CoachScoreSummary] Not rendering - no scores available");
    return null;
  }

  console.log("📊 [CoachScoreSummary] Rendering with scores:", scores);

  // Always show coach's score, even if they have no team
  // This fixes the issue where dashboard doesn't show scores

  // If user has no team, show simplified view with just their score
  if (scores.directTeamCount === 0) {
    return (
      <div className="w-full bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-3 sm:p-4 md:p-5 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-blue-100 flex items-center justify-center mb-2 shadow-sm">
                <User className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-blue-600" />
              </div>
              <p className="text-xs sm:text-sm text-blue-600 font-bold uppercase tracking-wider mb-1">
                MY SCORE
              </p>
              <div
                className={`text-2xl sm:text-3xl md:text-4xl font-black ${getScoreTextColor(
                  scores.myScore,
                )}`}
              >
                {scores.myScore}%
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Today's Discipline Score
              </p>
            </div>
            <div className="h-1.5 bg-gray-100">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${scores.myScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-gray-200">
            {/* Column 1: My Score */}
            <div className="p-2 sm:p-3 md:p-4 flex flex-col items-center justify-center text-center min-h-[80px] sm:min-h-[100px]">
              <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full bg-blue-100 flex items-center justify-center mb-1 sm:mb-1.5 shadow-sm">
                <SelfLogo className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-blue-600" />
              </div>
              <p className="text-[7px] sm:text-[8px] md:text-[9px] text-blue-600 font-bold uppercase tracking-wider mb-0.5 leading-tight">
                MY SCORE
              </p>
              <div
                className={`text-base sm:text-lg md:text-xl font-black ${getScoreTextColor(
                  scores.myScore,
                )}`}
              >
                {scores.myScore}%
              </div>
            </div>

            {/* Column 2: Direct Team */}
            <div className="p-2 sm:p-3 md:p-4 flex flex-col items-center justify-center text-center min-h-[80px] sm:min-h-[100px] bg-blue-50/30">
              <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full bg-green-100 flex items-center justify-center mb-1 sm:mb-1.5 shadow-sm">
                <DirectLogo className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-green-600" />
              </div>
              <p className="text-[7px] sm:text-[8px] md:text-[9px] text-green-600 font-bold uppercase tracking-wider mb-0.5 leading-tight">
                DIRECT TEAM
              </p>
              <div
                className={`text-base sm:text-lg md:text-xl font-black ${getScoreTextColor(
                  scores.directTeamAvg,
                )}`}
              >
                {scores.directTeamAvg}%
              </div>
              <p className="text-[6px] sm:text-[7px] md:text-[8px] text-gray-400 mt-0.5">
                ({scores.directTeamCount} Member
                {scores.directTeamCount !== 1 ? "s" : ""})
              </p>
            </div>

            {/* Column 3: Full Team */}
            <div className="p-2 sm:p-3 md:p-4 flex flex-col items-center justify-center text-center min-h-[80px] sm:min-h-[100px]">
              <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full bg-purple-100 flex items-center justify-center mb-1 sm:mb-1.5 shadow-sm">
                <FullTeamLogo className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-purple-600" />
              </div>
              <p className="text-[7px] sm:text-[8px] md:text-[9px] text-purple-600 font-bold uppercase tracking-wider mb-0.5 leading-tight">
                FULL TEAM
              </p>
              <div
                className={`text-base sm:text-lg md:text-xl font-black ${getScoreTextColor(
                  scores.fullTeamAvg,
                )}`}
              >
                {scores.fullTeamAvg}%
              </div>
              <p className="text-[6px] sm:text-[7px] md:text-[8px] text-gray-400 mt-0.5">
                ({scores.fullTeamCount} Member
                {scores.fullTeamCount !== 1 ? "s" : ""})
              </p>
            </div>
          </div>

          {/* Progress indicator bar */}
          <div className="h-1 sm:h-1.5 bg-gray-100 grid grid-cols-3">
            <div
              className="bg-blue-500 transition-all duration-500"
              style={{ width: `${scores.myScore}%` }}
            />
            <div
              className="bg-blue-500 transition-all duration-500"
              style={{ width: `${scores.directTeamAvg}%` }}
            />
            <div
              className="bg-green-500 transition-all duration-500"
              style={{ width: `${scores.fullTeamAvg}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoachScoreSummary;
