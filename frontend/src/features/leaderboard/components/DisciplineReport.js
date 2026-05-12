import React, { useState, useEffect, useMemo, useRef } from "react";
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
} from "../../../shared/components/common/HierarchicalReportLayout";
import HierarchicalNode from "../../../shared/components/common/HierarchicalNode";
import {
  SelfLogo,
  DirectLogo,
  FullTeamLogo,
} from "../../../shared/components/common/DisciplineScoreLogos";
import TimeWindowSettingsModal from "../../../shared/components/TimeWindowSettingsModal";
import {
  disciplineReportService,
  clearDisciplineReportCache,
} from "../services/disciplineReportService";
import { teamHierarchyService } from "../../../shared/services/teamHierarchyService";

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
  const [sortOrder, setSortOrder] = useState("asc"); // 'asc' = A-Z | 'desc' = Z-A
  const [sortBy, setSortBy] = useState("name"); // always name-based for A-Z / Z-A
  const [showSettings, setShowSettings] = useState(false);
  const [teamView, setTeamView] = useState("direct"); // 'direct' or 'full'
  const [expandOverride, setExpandOverride] = useState("collapsed"); // "expanded" | "collapsed" | null
  const lastExpandState = useRef("collapsed"); // remembers last expand/collapse for Direct â†” Full switch

  // Load data
  const fetchData = async (isBackground = false) => {
    if (!user?.id) {
      // Keep loading=true (show skeleton) â€” wait for user.id to be populated
      // useEffect will re-fire once user.id is available
      return;
    }

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
        
        // DON'T set upline properties if this is a root coach/co-coach with partnership
        // Check if coCoachInfo exists and has content (not just empty object)
        const hasPartnership = node.coCoachInfo && 
          Object.keys(node.coCoachInfo).length > 0 && 
          node.coCoachInfo.userId;
        
        if (!hasPartnership) {
          enrichedNode.uplineCoachName = node.coachName || node.uplineCoachName;
          enrichedNode.uplineCoCoachName =
            node.coCoachName || node.uplineCoCoachName;
        }
        
        // Profile image fields (these would need to come from user profile data)
        enrichedNode.profileImage = node.profileImage;
        enrichedNode.photoURL = node.photoURL;

        // Calculate team averages (excluding co-coach from calculations)
        if (enrichedNode.teamMembers && enrichedNode.teamMembers.length > 0) {
          enrichedNode.teamMembers =
            enrichedNode.teamMembers.map(enrichHierarchy);

          // Direct team score (excludes co-coach)
          const directScores = enrichedNode.teamMembers
            .filter((m) => !m.isCoCoach) // Exclude co-coach from calculation
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

          // Full team score (recursive, excludes co-coach)
          const getAllDescendantScores = (n) => {
            // Skip co-coach in score calculation
            if (n.isCoCoach) return [];
            
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

        // If this node has a co-coach, enrich co-coach with SAME team scores
        if (enrichedNode.coCoachInfo) {
          const coCoachScore = scores[enrichedNode.coCoachInfo.userId] || 
                               scores[String(enrichedNode.coCoachInfo.userId)] || 0;
          const coCoachActs = activities[enrichedNode.coCoachInfo.userId] || 
                              activities[String(enrichedNode.coCoachInfo.userId)] || {};
          
          enrichedNode.coCoachInfo.periodDiscipline = {
            percentage: coCoachScore,
            activities: coCoachActs,
            onTimePosts: coCoachActs.onTimePosts || 0,
            expectedPosts: coCoachActs.expectedPosts || 0,
          };
          
          // Co-coach shares the SAME team scores as coach
          enrichedNode.coCoachInfo.directTeamDiscipline = enrichedNode.directTeamDiscipline;
          enrichedNode.coCoachInfo.fullTeamDiscipline = enrichedNode.fullTeamDiscipline;
          enrichedNode.coCoachInfo.profileImage = enrichedNode.coCoachInfo.profileImage;
          enrichedNode.coCoachInfo.photoURL = enrichedNode.coCoachInfo.photoURL;
        }

        return enrichedNode;
      };

      const enriched = enrichHierarchy(hierarchyResponse.hierarchy);

      setHierarchyData(enriched);
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
  }, [user?.id, dateRange, customStartDate, customEndDate]);

  // Sort hierarchy client-side so it reacts instantly to sortBy/sortOrder changes
  const sortedHierarchyData = useMemo(() => {
    if (!hierarchyData) return null;
    const sortNode = (node) => {
      const sorted = { ...node };
      if (sorted.teamMembers && sorted.teamMembers.length > 0) {
        const members = sorted.teamMembers.map(sortNode);
        const coaches = members.filter((m) => m.role === "coach" || m.isCoach || m.isCoCoach);
        const regular = members.filter((m) => m.role !== "coach" && !m.isCoach && !m.isCoCoach);
        regular.sort((a, b) => {
          // A-Z / Z-A name sort
          if (sortBy === "name") {
            const nameA = (a.userName || a.name || "").toLowerCase();
            const nameB = (b.userName || b.name || "").toLowerCase();
            const cmp = nameA.localeCompare(nameB);
            return sortOrder === "desc" ? -cmp : cmp;
          }
          let sa, sb;
          if (sortBy === "direct") {
            sa = a.directTeamDiscipline?.percentage || 0;
            sb = b.directTeamDiscipline?.percentage || 0;
          } else if (sortBy === "full") {
            sa = a.fullTeamDiscipline?.percentage || 0;
            sb = b.fullTeamDiscipline?.percentage || 0;
          } else {
            // 'self' or 'all' â†’ sort by self score
            sa = a.periodDiscipline?.percentage || 0;
            sb = b.periodDiscipline?.percentage || 0;
          }
          return sortOrder === "desc" ? sb - sa : sa - sb;
        });
        sorted.teamMembers = [...coaches, ...regular];
      }
      return sorted;
    };
    return sortNode(hierarchyData);
  }, [hierarchyData, sortBy, sortOrder]);

  // Filter options
  const filterOptions = [
    { value: "all", label: "All Scores", icon: null },
    { value: "high", label: "High (â‰¥80%)", icon: TrendingUp },
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

    // Check co-coach if it exists (for co-coach partnership)
    if (node.coCoachInfo) {
      if (
        node.coCoachInfo.userName?.toLowerCase().includes(lowerQuery) ||
        node.coCoachInfo.email?.toLowerCase().includes(lowerQuery)
      ) {
        return true;
      }
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

    const ALL_COLS = [
      { key: "self",   score: selfScore,   Logo: SelfLogo,     color: "text-blue-500",   label: "Self",   padding: "pr-2" },
      { key: "direct", score: directScore, Logo: DirectLogo,   color: "text-green-500",  label: "Direct", padding: "px-2" },
      { key: "full",   score: fullScore,   Logo: FullTeamLogo, color: "text-purple-500", label: "Full",   padding: "pl-2" },
    ];

    const isSingle = sortBy !== "all";
    const cols = isSingle ? ALL_COLS.filter((c) => c.key === sortBy) : ALL_COLS;

    return (
      <>
        {cols.map((col) => (
          <div
            key={col.key}
            className={`flex-1 flex flex-col items-center gap-0.5 ${
              isSingle ? "" : col.padding
            }`}
          >
            <col.Logo className={`${isSingle ? "w-5 h-5" : "w-4 h-4"} ${col.color}`} />
            <span
              className={`text-[8px] font-semibold ${col.color} uppercase tracking-wide leading-none`}
            >
              {col.label}
            </span>
            <span
              className={`${
                isSingle ? "text-base sm:text-lg" : "text-sm sm:text-base"
              } font-bold text-gray-900`}
            >
              {col.score}%
            </span>
          </div>
        ))}
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
  const hierarchySummaryStats = sortedHierarchyData
    ? {
        note: `Self: ${Math.round(
          sortedHierarchyData.periodDiscipline?.percentage || 0,
        )}% | Direct: ${Math.round(
          sortedHierarchyData.directTeamDiscipline?.percentage || 0,
        )}% | Full: ${Math.round(
          sortedHierarchyData.fullTeamDiscipline?.percentage || 0,
        )}%`,
      }
    : null;

  // Filter hierarchy data based on team view
  const getFilteredHierarchy = () => {
    if (!sortedHierarchyData) return null;

    // Full view - show complete hierarchy
    if (teamView === "full") return sortedHierarchyData;

    // Default "direct" view - only show direct team members (remove nested teams)
    if (sortedHierarchyData.teamMembers) {
      return {
        ...sortedHierarchyData,
        teamMembers: sortedHierarchyData.teamMembers.map((member) => ({
          ...member,
          teamMembers: [], // Remove nested team members
        })),
      };
    }

    return sortedHierarchyData;
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

  const teamCounts = sortedHierarchyData
    ? getTeamCounts(sortedHierarchyData)
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

  const handleSortChange = (newSortBy, newSortOrder) => {
    setSortBy("name"); // A-Z / Z-A always sorts by name
    setSortOrder(newSortOrder);
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
      subtitle={`${teamCounts.total} member â€¢ ${new Date()
        .toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
        .replace(/\s?(AM|PM)/i, "")}`}
      onBack={onBack}
      onRefresh={handleManualRefresh}
      onDownload={handleDownload}
      onSettings={handleSettings}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSortChange={handleSortChange}
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
      onExpandAll={() => { lastExpandState.current = "expanded"; setExpandOverride("expanded"); }}
      onCollapseAll={() => { lastExpandState.current = "collapsed"; setExpandOverride("collapsed"); }}
      expandedState={expandOverride}
      onTeamViewChange={setTeamView}
      teamView={teamView}
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
          forceExpandedState={expandOverride}
          defaultExpanded={expandOverride === "expanded"}
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
        onUpdate={() => {
          clearDisciplineReportCache();
          fetchData(true);
        }}
        userEmail={user?.email}
      />
    </HierarchicalReportLayout>
  );
};

export default DisciplineReport;
