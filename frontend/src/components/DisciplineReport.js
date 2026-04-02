import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Scale,
  BookOpen,
  Coffee,
  Utensils,
  Moon,
  Droplets,
  Flame,
  Settings,
  ArrowUpDown,
  Users,
} from "lucide-react";
import HierarchicalReportLayout, {
  LoadingSkeleton,
} from "./common/HierarchicalReportLayout";
import HierarchicalNode from "./common/HierarchicalNode";
import {
  SelfLogo,
  DirectLogo,
  FullTeamLogo,
} from "./common/DisciplineScoreLogos";
import TimeWindowSettingsModal from "./TimeWindowSettingsModal";
import {
  disciplineReportService,
  clearDisciplineReportCache,
} from "../services/disciplineReportService";
import { teamHierarchyService } from "../services/teamHierarchyService";

const DisciplineReport = ({ user, onBack, userRole }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [disciplineScores, setDisciplineScores] = useState({});
  const [memberActivities, setMemberActivities] = useState({});
  const [dateRange, setDateRange] = useState("today");
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState("desc"); // 'asc' or 'desc'
  const [showSettings, setShowSettings] = useState(false);
  const [teamView, setTeamView] = useState("direct"); // 'direct' or 'full'

  // Load data
  const fetchData = async (isBackground = false) => {
    if (!user?.id) return;

    if (!isBackground) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      // Format custom dates if available
      let customRange = null;
      if (dateRange === "custom" && customStartDate && customEndDate) {
        customRange = {
          start:
            customStartDate.getFullYear() +
            "-" +
            String(customStartDate.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(customStartDate.getDate()).padStart(2, "0"),
          end:
            customEndDate.getFullYear() +
            "-" +
            String(customEndDate.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(customEndDate.getDate()).padStart(2, "0"),
        };
      }

      // Fetch hierarchy and discipline data in parallel
      const [hierarchyResponse, teamDataResponse, allMembersResponse] =
        await Promise.all([
          teamHierarchyService.getTeamHierarchy(user.id, false),
          disciplineReportService.getDisciplineReport(
            user.id,
            dateRange,
            customRange,
          ),
          disciplineReportService.getAllMembersDisciplineReport(
            user.id,
            dateRange,
            customRange,
          ),
        ]);

      // Build discipline scores map
      const scores = {};
      const activities = {};

      // Add scores from allMembersData
      if (allMembersResponse?.allMembers) {
        allMembersResponse.allMembers.forEach((m) => {
          const percentage = m.periodDiscipline?.percentage ?? 0;
          scores[m.userId] = percentage;
          scores[String(m.userId)] = percentage;

          // Add activities (all 7: weight, education, breakfast, lunch, dinner, water, caloriesBurned)
          activities[m.userId] = {
            weight: m.activities?.weight?.percentage || 0,
            education: m.activities?.education?.percentage || 0,
            breakfast: m.activities?.breakfast?.percentage || 0,
            lunch: m.activities?.lunch?.percentage || 0,
            dinner: m.activities?.dinner?.percentage || 0,
            water: m.activities?.water?.percentage || 0,
            caloriesBurned: m.activities?.caloriesBurned?.percentage || 0,
            onTimePosts: m.periodDiscipline?.onTimePosts || 0,
            expectedPosts: m.periodDiscipline?.expectedPosts || 0,
          };
          activities[String(m.userId)] = activities[m.userId];
        });
      }

      // Add scores from teamData
      if (teamDataResponse) {
        if (teamDataResponse.coachPerformance) {
          const percentage =
            teamDataResponse.coachPerformance.periodDiscipline?.percentage ?? 0;
          scores[teamDataResponse.coachPerformance.userId] = percentage;
          scores[String(teamDataResponse.coachPerformance.userId)] = percentage;

          activities[teamDataResponse.coachPerformance.userId] = {
            weight:
              teamDataResponse.coachPerformance.activities?.weight
                ?.percentage || 0,
            education:
              teamDataResponse.coachPerformance.activities?.education
                ?.percentage || 0,
            breakfast:
              teamDataResponse.coachPerformance.activities?.breakfast
                ?.percentage || 0,
            lunch:
              teamDataResponse.coachPerformance.activities?.lunch?.percentage ||
              0,
            dinner:
              teamDataResponse.coachPerformance.activities?.dinner
                ?.percentage || 0,
            water:
              teamDataResponse.coachPerformance.activities?.water?.percentage ||
              0,
            caloriesBurned:
              teamDataResponse.coachPerformance.activities?.caloriesBurned
                ?.percentage || 0,
            onTimePosts:
              teamDataResponse.coachPerformance.periodDiscipline?.onTimePosts ||
              0,
            expectedPosts:
              teamDataResponse.coachPerformance.periodDiscipline
                ?.expectedPosts || 0,
          };
        }

        if (teamDataResponse.teamMembers) {
          teamDataResponse.teamMembers.forEach((m) => {
            const percentage = m.periodDiscipline?.percentage ?? 0;
            scores[m.userId] = percentage;
            scores[String(m.userId)] = percentage;

            activities[m.userId] = {
              weight: m.activities?.weight?.percentage || 0,
              education: m.activities?.education?.percentage || 0,
              breakfast: m.activities?.breakfast?.percentage || 0,
              lunch: m.activities?.lunch?.percentage || 0,
              dinner: m.activities?.dinner?.percentage || 0,
              water: m.activities?.water?.percentage || 0,
              caloriesBurned: m.activities?.caloriesBurned?.percentage || 0,
              onTimePosts: m.periodDiscipline?.onTimePosts || 0,
              expectedPosts: m.periodDiscipline?.expectedPosts || 0,
            };
          });
        }
      }

      // Enrich hierarchy with discipline scores
      const enrichHierarchy = (node) => {
        const enrichedNode = { ...node };
        const score = scores[node.userId] || scores[String(node.userId)] || 0;
        const acts =
          activities[node.userId] || activities[String(node.userId)] || {};

        enrichedNode.periodDiscipline = {
          percentage: score,
          activities: acts,
          onTimePosts: acts.onTimePosts || 0,
          expectedPosts: acts.expectedPosts || 0,
        };
        // Map field names for HierarchicalNode component
        enrichedNode.userEmail = node.email || node.userEmail;
        enrichedNode.uplineCoachName = node.coachName || node.uplineCoachName;
        enrichedNode.uplineCoCoachName =
          node.coCoachName || node.uplineCoCoachName;
        // Profile image fields (these would need to come from user profile data)
        enrichedNode.profileImage = node.profileImage;
        enrichedNode.photoURL = node.photoURL;

        // Calculate team averages
        if (enrichedNode.teamMembers && enrichedNode.teamMembers.length > 0) {
          enrichedNode.teamMembers =
            enrichedNode.teamMembers.map(enrichHierarchy);

          // Direct team score
          const directScores = enrichedNode.teamMembers
            .map((m) => m.periodDiscipline?.percentage || 0)
            .filter((s) => s >= 0);
          enrichedNode.directTeamDiscipline = {
            percentage:
              directScores.length > 0
                ? Math.round(
                    directScores.reduce((sum, s) => sum + s, 0) /
                      directScores.length,
                  )
                : 0,
          };

          // Full team score (recursive)
          const getAllDescendantScores = (n) => {
            let scores = [n.periodDiscipline?.percentage || 0];
            if (n.teamMembers) {
              n.teamMembers.forEach((child) => {
                scores = scores.concat(getAllDescendantScores(child));
              });
            }
            return scores;
          };

          const fullScores = [];
          enrichedNode.teamMembers.forEach((child) => {
            fullScores.push(...getAllDescendantScores(child));
          });

          enrichedNode.fullTeamDiscipline = {
            percentage:
              fullScores.length > 0
                ? Math.round(
                    fullScores.reduce((sum, s) => sum + s, 0) /
                      fullScores.length,
                  )
                : 0,
          };
        } else {
          enrichedNode.directTeamDiscipline = { percentage: 0 };
          enrichedNode.fullTeamDiscipline = { percentage: 0 };
        }

        return enrichedNode;
      };

      const enriched = enrichHierarchy(hierarchyResponse.hierarchy);

      // Apply sorting to hierarchy - keep coaches/co-coaches fixed at top
      const sortHierarchy = (node) => {
        const sorted = { ...node };
        if (sorted.teamMembers && sorted.teamMembers.length > 0) {
          // Recursively sort children first
          const members = sorted.teamMembers.map(sortHierarchy);
          
          // Separate coaches/co-coaches from regular members
          const coaches = members.filter(m => 
            m.role === "coach" || m.isCoach || m.isCoCoach
          );
          const regularMembers = members.filter(m => 
            m.role !== "coach" && !m.isCoach && !m.isCoCoach
          );
          
          // Sort only regular members by score
          regularMembers.sort((a, b) => {
            const scoreA = a.periodDiscipline?.percentage || 0;
            const scoreB = b.periodDiscipline?.percentage || 0;
            return sortOrder === "desc" ? scoreB - scoreA : scoreA - scoreB;
          });
          
          // Keep coaches at top, then sorted regular members
          sorted.teamMembers = [...coaches, ...regularMembers];
        }
        return sorted;
      };

      setHierarchyData(sortHierarchy(enriched));
      setDisciplineScores(scores);
      setMemberActivities(activities);
    } catch (err) {
      console.error("Failed to load discipline report:", err);
      setError(
        `Failed to load report: ${err.response?.data?.message || err.message}`,
      );
    } finally {
      if (!isBackground) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, dateRange, customStartDate, customEndDate, sortOrder]);

  // Filter options
  const filterOptions = [
    { value: "all", label: "All Scores", icon: null },
    { value: "high", label: "High (≥80%)", icon: TrendingUp },
    { value: "medium", label: "Medium (50-79%)", icon: null },
    { value: "low", label: "Low (<50%)", icon: TrendingDown },
  ];

  // Match filter logic
  const matchesFilter = (node, filterValue) => {
    if (filterValue === "all") return true;
    const score = node.periodDiscipline?.percentage || 0;
    if (filterValue === "high") return score >= 80;
    if (filterValue === "medium") return score >= 50 && score < 80;
    if (filterValue === "low") return score < 50;
    return true;
  };

  // Match search logic
  const matchesSearch = (node, query) => {
    if (!query) return true;
    const lowerQuery = query.toLowerCase();

    if (
      node.userName?.toLowerCase().includes(lowerQuery) ||
      node.userEmail?.toLowerCase().includes(lowerQuery)
    ) {
      return true;
    }

    if (node.teamMembers && node.teamMembers.length > 0) {
      return node.teamMembers.some((child) => matchesSearch(child, query));
    }

    return false;
  };

  // Check if hierarchy has any visible nodes after filtering
  const hasVisibleNodes = (node) => {
    if (!node) return false;

    // Check if current node matches
    const nodeMatchesSearch = matchesSearch(node, searchQuery);
    const nodeMatchesFilter = matchesFilter(node, filter);

    if (nodeMatchesSearch && nodeMatchesFilter) {
      return true;
    }

    // Check children recursively
    if (node.teamMembers && node.teamMembers.length > 0) {
      return node.teamMembers.some((child) => hasVisibleNodes(child));
    }

    return false;
  };

  // Render status badge
  const renderStatus = (node, showDetails) => {
    const score = node.periodDiscipline?.percentage || 0;
    let bgColor = "bg-red-50";
    let borderColor = "border-red-200";
    let textColor = "text-red-600";

    if (score >= 80) {
      bgColor = "bg-green-50";
      borderColor = "border-green-300";
      textColor = "text-green-700";
    } else if (score >= 50) {
      bgColor = "bg-yellow-50";
      borderColor = "border-yellow-300";
      textColor = "text-yellow-700";
    }

    return (
      <div
        className={`px-3 py-1.5 rounded-full ${bgColor} border ${borderColor}`}
      >
        <span className={`text-sm font-bold ${textColor}`}>{score}%</span>
      </div>
    );
  };

  // Render stats strip
  const renderStats = (node, level, isCurrentUser) => {
    const selfScore = node.periodDiscipline?.percentage || 0;
    const directScore = node.directTeamDiscipline?.percentage || 0;
    const fullScore = node.fullTeamDiscipline?.percentage || 0;

    return (
      <>
        {/* Self */}
        <div className="flex-1 flex flex-col items-center gap-0.5 pr-2">
          <SelfLogo className="w-4 h-4 text-blue-500" />
          <span className="text-[8px] font-semibold text-blue-500 uppercase tracking-wide leading-none">
            Self
          </span>
          <span className="text-sm sm:text-base font-bold text-gray-900">
            {selfScore}%
          </span>
        </div>
        {/* Direct */}
        <div className="flex-1 flex flex-col items-center gap-0.5 px-2">
          <DirectLogo className="w-4 h-4 text-green-500" />
          <span className="text-[8px] font-semibold text-green-500 uppercase tracking-wide leading-none">
            Direct
          </span>
          <span className="text-sm sm:text-base font-bold text-gray-900">
            {directScore}%
          </span>
        </div>
        {/* Full Team */}
        <div className="flex-1 flex flex-col items-center gap-0.5 pl-2">
          <FullTeamLogo className="w-4 h-4 text-purple-500" />
          <span className="text-[8px] font-semibold text-purple-500 uppercase tracking-wide leading-none">
            Full
          </span>
          <span className="text-sm sm:text-base font-bold text-gray-900">
            {fullScore}%
          </span>
        </div>
      </>
    );
  };

  // Render expanded activity details
  const renderExpandedDetails = (node) => {
    const activities = node.periodDiscipline?.activities || {};
    const weight = activities.weight || 0;
    const education = activities.education || 0;
    const breakfast = activities.breakfast || 0;
    const lunch = activities.lunch || 0;
    const dinner = activities.dinner || 0;
    const water = activities.water || 0;
    const caloriesBurned = activities.caloriesBurned || 0;
    const onTimePosts =
      node.periodDiscipline?.onTimePosts || activities.onTimePosts || 0;
    const expectedPosts =
      node.periodDiscipline?.expectedPosts || activities.expectedPosts || 0;

    // Get color class based on percentage
    const getScoreColor = (percentage) => {
      if (percentage >= 80) return "text-green-600";
      if (percentage >= 50) return "text-yellow-600";
      return "text-red-600";
    };

    // Get activity box styling based on completion
    const getActivityBoxStyle = (percentage) => {
      if (percentage > 0) {
        return "bg-green-50 border-green-300";
      }
      return "bg-white border-gray-100";
    };

    // Get icon color based on completion
    const getIconColor = (percentage) => {
      if (percentage > 0) {
        return "text-green-600";
      }
      return "text-gray-400";
    };

    return (
      <div className="border-t border-gray-100 bg-gray-50/50">
        <div className="p-2 sm:p-4">
          <h4 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 sm:mb-3">
            Activity Breakdown
          </h4>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {[
              {
                icon: (
                  <Scale
                    className={`h-3.5 w-3.5 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 ${getIconColor(
                      weight,
                    )}`}
                  />
                ),
                val: weight,
                label: "WEI",
              },
              {
                icon: (
                  <BookOpen
                    className={`h-3.5 w-3.5 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 ${getIconColor(
                      education,
                    )}`}
                  />
                ),
                val: education,
                label: "EDU",
              },
              {
                icon: (
                  <Coffee
                    className={`h-3.5 w-3.5 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 ${getIconColor(
                      breakfast,
                    )}`}
                  />
                ),
                val: breakfast,
                label: "BRE",
              },
              {
                icon: (
                  <Utensils
                    className={`h-3.5 w-3.5 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 ${getIconColor(
                      lunch,
                    )}`}
                  />
                ),
                val: lunch,
                label: "LUN",
              },
              {
                icon: (
                  <Moon
                    className={`h-3.5 w-3.5 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 ${getIconColor(
                      dinner,
                    )}`}
                  />
                ),
                val: dinner,
                label: "DIN",
              },
              {
                icon: (
                  <Droplets
                    className={`h-3.5 w-3.5 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 ${getIconColor(
                      water,
                    )}`}
                  />
                ),
                val: water,
                label: "WAT",
              },
              {
                icon: (
                  <Flame
                    className={`h-3.5 w-3.5 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 ${getIconColor(
                      caloriesBurned,
                    )}`}
                  />
                ),
                val: caloriesBurned,
                label: "CAL",
              },
            ].map(({ icon, val, label }) => (
              <div
                key={label}
                className={`flex flex-col items-center p-1.5 sm:p-2 rounded-lg border ${getActivityBoxStyle(
                  val,
                )}`}
              >
                {icon}
                <span
                  className={`text-xs sm:text-sm font-bold ${getScoreColor(
                    val,
                  )}`}
                >
                  {val}%
                </span>
                <span className="text-[8px] sm:text-[9px] text-gray-400 capitalize">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="px-4 pb-4 pt-0 text-center">
          <p className="text-xs text-gray-400 font-medium">
            {onTimePosts} on-time posts out of {expectedPosts} expected
          </p>
        </div>
      </div>
    );
  };

  // Get status-based styling
  const getStatusStyle = (node, level, isCurrentUser) => {
    const score = node.periodDiscipline?.percentage || 0;

    if (score >= 80) {
      return {
        containerClass: "bg-white border-green-200 shadow-sm",
        avatarClass: "bg-green-100 border-green-400 text-green-700",
        nameClass: "text-gray-900",
        statsBorderClass: "border-green-100 divide-green-100",
      };
    } else if (score >= 50) {
      return {
        containerClass: "bg-white border-yellow-200",
        avatarClass: "bg-yellow-100 border-yellow-400 text-yellow-700",
        nameClass: "text-gray-900",
        statsBorderClass: "border-yellow-100 divide-yellow-100",
      };
    }

    return {
      containerClass: "bg-white border-red-200",
      avatarClass: "bg-red-100 border-red-400 text-red-700",
      nameClass: "text-gray-900",
      statsBorderClass: "border-red-100 divide-red-100",
    };
  };

  // Calculate summary stats
  const summaryStats = hierarchyData
    ? (() => {
        // Collect all team members
        const allTeamMembers = [];
        const collectMembers = (node) => {
          allTeamMembers.push(node);
          if (node.teamMembers && node.teamMembers.length > 0) {
            node.teamMembers.forEach(collectMembers);
          }
        };
        collectMembers(hierarchyData);

        // Calculate average score
        const totalScore = allTeamMembers.reduce(
          (sum, m) => sum + (m.periodDiscipline?.percentage || 0),
          0,
        );
        const avgScore =
          allTeamMembers.length > 0
            ? Math.round(totalScore / allTeamMembers.length)
            : 0;

        // Find top performer
        const topPerformer = allTeamMembers.reduce((top, member) => {
          const score = member.periodDiscipline?.percentage || 0;
          const topScore = top.periodDiscipline?.percentage || 0;
          return score > topScore ? member : top;
        }, allTeamMembers[0]);

        // Count at-risk members (< 60%)
        const atRiskCount = allTeamMembers.filter(
          (m) => (m.periodDiscipline?.percentage || 0) < 60,
        ).length;

        // Calculate on-time posts percentage
        const totalOnTime = allTeamMembers.reduce(
          (sum, m) => sum + (m.periodDiscipline?.onTimePosts || 0),
          0,
        );
        const totalExpected = allTeamMembers.reduce(
          (sum, m) => sum + (m.periodDiscipline?.expectedPosts || 0),
          0,
        );
        const onTimePercentage =
          totalExpected > 0
            ? Math.round((totalOnTime / totalExpected) * 100)
            : 0;

        return {
          avgScore,
          onTimePercentage,
          topPerformer: topPerformer
            ? {
                name: topPerformer.userName,
                score: topPerformer.periodDiscipline?.percentage || 0,
              }
            : null,
          atRiskCount,
          totalMembers: allTeamMembers.length,
        };
      })()
    : null;

  // Team Hierarchy summary tiles (My Score / Direct Team / Full Team)
  const hierarchySummaryStats = hierarchyData
    ? {
        note: `Self: ${Math.round(
          hierarchyData.periodDiscipline?.percentage || 0,
        )}% | Direct: ${Math.round(
          hierarchyData.directTeamDiscipline?.percentage || 0,
        )}% | Full: ${Math.round(
          hierarchyData.fullTeamDiscipline?.percentage || 0,
        )}%`,
      }
    : null;

  // Filter hierarchy data based on team view
  const getFilteredHierarchy = () => {
    if (!hierarchyData) return null;

    // Full view - show complete hierarchy
    if (teamView === "full") return hierarchyData;

    // Default "direct" view - only show direct team members (remove nested teams)
    if (hierarchyData.teamMembers) {
      return {
        ...hierarchyData,
        teamMembers: hierarchyData.teamMembers.map((member) => ({
          ...member,
          teamMembers: [], // Remove nested team members
        })),
      };
    }

    return hierarchyData;
  };

  const filteredHierarchy = getFilteredHierarchy();

  // Get team counts
  const getTeamCounts = (node) => {
    if (!node) return { total: 0 };
    let count = 1;
    if (node.teamMembers) {
      node.teamMembers.forEach((child) => {
        count += getTeamCounts(child).total;
      });
    }
    return { total: count };
  };

  const teamCounts = hierarchyData
    ? getTeamCounts(hierarchyData)
    : { total: 0 };

  const handleDateRangeSelect = (start, end) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setDateRange("custom");
  };

  const handleManualRefresh = () => {
    clearDisciplineReportCache();
    fetchData(true);
  };

  const handleDownload = () => {
    console.log("Download discipline report");
    // Implement download logic here
  };

  const handleSortToggle = () => {
    setSortOrder(sortOrder === "desc" ? "asc" : "desc");
  };

  const handleSettings = () => {
    setShowSettings(!showSettings);
    // Implement settings modal/drawer here
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <HierarchicalReportLayout
      title="Discipline Report"
      subtitle={`${teamCounts.total} member • ${new Date()
        .toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
        .replace(/\s?(AM|PM)/i, "")}`}
      onBack={onBack}
      onRefresh={handleManualRefresh}
      onDownload={handleDownload}
      onSettings={handleSettings}
      sortOrder={sortOrder}
      onSortChange={handleSortToggle}
      loading={refreshing}
      error={error}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      customStartDate={customStartDate}
      customEndDate={customEndDate}
      onCustomDateSelect={handleDateRangeSelect}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      filter={filter}
      onFilterChange={setFilter}
      filterOptions={filterOptions}
      summaryStats={hierarchySummaryStats}
      topContent={
        <>
          {/* Summary Stats Card */}
          {summaryStats && (
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-3 sm:mb-4">
              <div className="grid grid-cols-3 divide-x divide-gray-50">
                {/* Average & Posts */}
                <div className="p-2 sm:p-3 md:p-4 flex flex-col items-center justify-between text-center min-h-[90px] sm:min-h-[110px]">
                  <div className="text-[8px] sm:text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Avg Score
                  </div>
                  <div className="flex items-baseline justify-center gap-0.5 my-0.5 sm:my-1">
                    <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                      {summaryStats.avgScore}
                    </span>
                    <span className="text-[10px] sm:text-xs text-gray-400">
                      %
                    </span>
                  </div>
                  <div className="text-[8px] sm:text-[10px] md:text-xs text-green-600 font-medium bg-green-50 px-1.5 sm:px-2 py-0.5 rounded-full">
                    {summaryStats.onTimePercentage}% Posts
                  </div>
                </div>

                {/* Top Performer */}
                <div className="p-2 sm:p-3 md:p-4 flex flex-col items-center justify-between text-center min-h-[90px] sm:min-h-[110px]">
                  <div className="text-[8px] sm:text-[10px] md:text-xs font-bold text-green-600 uppercase tracking-wider">
                    Top Star
                  </div>
                  {summaryStats.topPerformer ? (
                    <>
                      <div className="flex items-baseline justify-center gap-0.5 my-0.5 sm:my-1">
                        <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                          {summaryStats.topPerformer.score}
                        </span>
                        <span className="text-[10px] sm:text-xs text-gray-400">
                          %
                        </span>
                      </div>
                      <div className="text-[8px] sm:text-[10px] md:text-xs text-gray-500 font-medium truncate max-w-[90%]">
                        {summaryStats.topPerformer.name.split(" ")[0]}
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-300">-</div>
                  )}
                </div>

                {/* At Risk */}
                <div className="p-2 sm:p-3 md:p-4 flex flex-col items-center justify-between text-center min-h-[90px] sm:min-h-[110px]">
                  <div className="text-[8px] sm:text-[10px] md:text-xs font-bold text-red-400 uppercase tracking-wider">
                    At Risk
                  </div>
                  <div className="flex items-baseline justify-center gap-0.5 my-0.5 sm:my-1">
                    <span className="text-lg sm:text-xl md:text-2xl font-bold text-red-600">
                      {summaryStats.atRiskCount}
                    </span>
                  </div>
                  <div className="text-[8px] sm:text-[10px] md:text-xs text-gray-400 font-medium">
                    of {summaryStats.totalMembers} Members
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-1 w-full bg-gray-50">
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${summaryStats.avgScore}%` }}
                />
              </div>
            </div>
          )}
        </>
      }
    >
      {/* Team View Toggle */}
      {hierarchyData && (
        <div className="flex justify-end mb-3 sm:mb-4">
          <div className="inline-flex bg-green-50 border border-green-200 rounded-full p-0.5">
            <button
              onClick={() => setTeamView("direct")}
              className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-semibold transition-all ${
                teamView === "direct"
                  ? "bg-green-600 text-white shadow-sm"
                  : "text-green-700 hover:text-green-800"
              }`}
            >
              Direct
            </button>
            <button
              onClick={() => setTeamView("full")}
              className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-semibold transition-all ${
                teamView === "full"
                  ? "bg-green-600 text-white shadow-sm"
                  : "text-green-700 hover:text-green-800"
              }`}
            >
              Full
            </button>
          </div>
        </div>
      )}

      {filteredHierarchy && hasVisibleNodes(filteredHierarchy) ? (
        <HierarchicalNode
          key={`hierarchy-${teamView}`}
          node={filteredHierarchy}
          level={0}
          isLastChild={true}
          renderStatus={renderStatus}
          renderStats={renderStats}
          renderExpandedDetails={renderExpandedDetails}
          isCurrentUser={true}
          showTeamCount={true}
          getStatusStyle={getStatusStyle}
          searchQuery={searchQuery}
          filter={filter}
          matchesFilter={matchesFilter}
          matchesSearch={matchesSearch}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No members found
          </h3>
          <p className="text-sm text-gray-500 max-w-sm">
            {filter !== "all"
              ? `No members match the "${
                  filterOptions.find((f) => f.value === filter)?.label
                }" filter.`
              : searchQuery
              ? `No members match "${searchQuery}".`
              : "No team members to display."}
          </p>
        </div>
      )}

      {/* Time Window Settings Modal */}
      <TimeWindowSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onUpdate={() => fetchData(true)}
        userEmail={user?.email}
      />
    </HierarchicalReportLayout>
  );
};

export default DisciplineReport;
