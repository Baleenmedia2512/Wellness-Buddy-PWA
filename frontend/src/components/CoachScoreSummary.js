// src/components/CoachScoreSummary.js
import React, { useState, useEffect } from "react";
import { Users, User } from "lucide-react";

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
        const disciplineResponse = await fetch(
          `${apiBaseUrl}/api/coach/discipline-report?coachId=${userId}&dateRange=today&t=${Date.now()}`,
          {
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
            },
          },
        );
        const disciplineResult = await disciplineResponse.json();

        if (!disciplineResult.success) {
          console.log("📊 [CoachScoreSummary] No discipline data");
          setLoading(false);
          return;
        }

        // Get coach's own score
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

        if (allMembers.length === 0) {
          console.log("📊 [CoachScoreSummary] No team members found");
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

  // Don't render if loading or no scores
  if (loading || !scores) {
    return null;
  }

  // Don't show if user has no team
  if (scores.directTeamCount === 0) {
    return null;
  }

  return (
    <div className="w-full bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-gray-200">
            {/* Column 1: My Score */}
            <div className="p-2 sm:p-3 md:p-4 flex flex-col items-center justify-center text-center min-h-[80px] sm:min-h-[100px]">
              <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full bg-blue-100 flex items-center justify-center mb-1 sm:mb-1.5 shadow-sm">
                <User className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-blue-600" />
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
                <Users className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-green-600" />
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
              <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full bg-green-100 flex items-center justify-center mb-1 sm:mb-1.5 shadow-sm">
                <Users className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-green-600" />
              </div>
              <p className="text-[7px] sm:text-[8px] md:text-[9px] text-green-600 font-bold uppercase tracking-wider mb-0.5 leading-tight">
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
