import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Scale, BookOpen, Coffee, Utensils, Moon, Settings, ArrowUpDown } from 'lucide-react';
import HierarchicalReportLayout, { LoadingSkeleton } from './common/HierarchicalReportLayout';
import HierarchicalNode from './common/HierarchicalNode';
import TimeWindowSettingsModal from './TimeWindowSettingsModal';
import {
  disciplineReportService,
  clearDisciplineReportCache,
} from '../services/disciplineReportService';
import { teamHierarchyService } from '../services/teamHierarchyService';

const DisciplineReport = ({ user, onBack, userRole }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [disciplineScores, setDisciplineScores] = useState({});
  const [memberActivities, setMemberActivities] = useState({});
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  const [showSettings, setShowSettings] = useState(false);

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
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        customRange = {
          start:
            customStartDate.getFullYear() +
            '-' +
            String(customStartDate.getMonth() + 1).padStart(2, '0') +
            '-' +
            String(customStartDate.getDate()).padStart(2, '0'),
          end:
            customEndDate.getFullYear() +
            '-' +
            String(customEndDate.getMonth() + 1).padStart(2, '0') +
            '-' +
            String(customEndDate.getDate()).padStart(2, '0'),
        };
      }

      // Fetch hierarchy and discipline data in parallel
      const [hierarchyResponse, teamDataResponse, allMembersResponse] = await Promise.all([
        teamHierarchyService.getTeamHierarchy(user.id, false),
        disciplineReportService.getDisciplineReport(user.id, dateRange, customRange),
        disciplineReportService.getAllMembersDisciplineReport(user.id, dateRange, customRange),
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

          // Add activities (all 5: weight, education, breakfast, lunch, dinner)
          activities[m.userId] = {
            weight: m.activities?.weight?.percentage || 0,
            education: m.activities?.education?.percentage || 0,
            breakfast: m.activities?.breakfast?.percentage || 0,
            lunch: m.activities?.lunch?.percentage || 0,
            dinner: m.activities?.dinner?.percentage || 0,
            onTimePosts: m.periodDiscipline?.onTimePosts || 0,
            expectedPosts: m.periodDiscipline?.expectedPosts || 0,
          };
          activities[String(m.userId)] = activities[m.userId];
        });
      }

      // Add scores from teamData
      if (teamDataResponse) {
        if (teamDataResponse.coachPerformance) {
          const percentage = teamDataResponse.coachPerformance.periodDiscipline?.percentage ?? 0;
          scores[teamDataResponse.coachPerformance.userId] = percentage;
          scores[String(teamDataResponse.coachPerformance.userId)] = percentage;

          activities[teamDataResponse.coachPerformance.userId] = {
            weight: teamDataResponse.coachPerformance.activities?.weight?.percentage || 0,
            education: teamDataResponse.coachPerformance.activities?.education?.percentage || 0,
            breakfast: teamDataResponse.coachPerformance.activities?.breakfast?.percentage || 0,
            lunch: teamDataResponse.coachPerformance.activities?.lunch?.percentage || 0,
            dinner: teamDataResponse.coachPerformance.activities?.dinner?.percentage || 0,
            onTimePosts: teamDataResponse.coachPerformance.periodDiscipline?.onTimePosts || 0,
            expectedPosts: teamDataResponse.coachPerformance.periodDiscipline?.expectedPosts || 0,
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
        const acts = activities[node.userId] || activities[String(node.userId)] || {};

        enrichedNode.periodDiscipline = { percentage: score };
        enrichedNode.mealActivities = acts;
        
        // Map field names for HierarchicalNode component
        enrichedNode.userEmail = node.email || node.userEmail;
        enrichedNode.uplineCoachName = node.coachName || node.uplineCoachName;
        enrichedNode.uplineCoCoachName = node.coCoachName || node.uplineCoCoachName;
        // Profile image fields (these would need to come from user profile data)
        enrichedNode.profileImage = node.profileImage;
        enrichedNode.photoURL = node.photoURL;

        // Calculate team averages
        if (enrichedNode.teamMembers && enrichedNode.teamMembers.length > 0) {
          enrichedNode.teamMembers = enrichedNode.teamMembers.map(enrichHierarchy);

          // Direct team score
          const directScores = enrichedNode.teamMembers
            .map((m) => m.periodDiscipline?.percentage || 0)
            .filter((s) => s >= 0);
          enrichedNode.directTeamDiscipline = {
            percentage:
              directScores.length > 0
                ? Math.round(directScores.reduce((sum, s) => sum + s, 0) / directScores.length)
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
                ? Math.round(fullScores.reduce((sum, s) => sum + s, 0) / fullScores.length)
                : 0,
          };
        } else {
          enrichedNode.directTeamDiscipline = { percentage: 0 };
          enrichedNode.fullTeamDiscipline = { percentage: 0 };
        }

        return enrichedNode;
      };

      const enriched = enrichHierarchy(hierarchyResponse.hierarchy);
      
      // Apply sorting to hierarchy
      const sortHierarchy = (node) => {
        const sorted = { ...node };
        if (sorted.teamMembers && sorted.teamMembers.length > 0) {
          sorted.teamMembers = [...sorted.teamMembers]
            .map(sortHierarchy)
            .sort((a, b) => {
              const scoreA = a.periodDiscipline?.percentage || 0;
              const scoreB = b.periodDiscipline?.percentage || 0;
              return sortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
            });
        }
        return sorted;
      };
      
      setHierarchyData(sortHierarchy(enriched));
      setDisciplineScores(scores);
      setMemberActivities(activities);
    } catch (err) {
      console.error('Failed to load discipline report:', err);
      setError(`Failed to load report: ${err.response?.data?.message || err.message}`);
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
    { value: 'all', label: 'All Scores', icon: null },
    { value: 'high', label: 'High (≥80%)', icon: TrendingUp },
    { value: 'medium', label: 'Medium (50-79%)', icon: null },
    { value: 'low', label: 'Low (<50%)', icon: TrendingDown },
  ];

  // Match filter logic
  const matchesFilter = (node, filterValue) => {
    if (filterValue === 'all') return true;
    const score = node.periodDiscipline?.percentage || 0;
    if (filterValue === 'high') return score >= 80;
    if (filterValue === 'medium') return score >= 50 && score < 80;
    if (filterValue === 'low') return score < 50;
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

  // Render status badge
  const renderStatus = (node, showDetails) => {
    const score = node.periodDiscipline?.percentage || 0;
    let bgColor = 'bg-red-50';
    let borderColor = 'border-red-200';
    let textColor = 'text-red-600';

    if (score >= 80) {
      bgColor = 'bg-green-50';
      borderColor = 'border-green-300';
      textColor = 'text-green-700';
    } else if (score >= 50) {
      bgColor = 'bg-yellow-50';
      borderColor = 'border-yellow-300';
      textColor = 'text-yellow-700';
    }

    return (
      <div className={`px-3 py-1.5 rounded-full ${bgColor} border ${borderColor}`}>
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
        <div className="flex-1 flex flex-col items-center pr-2">
          <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">
            {isCurrentUser ? 'You' : 'Self'}
          </span>
          <span className="text-base font-bold text-gray-900">{selfScore}%</span>
        </div>
        <div className="flex-1 flex flex-col items-center px-2">
          <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">
            Direct
          </span>
          <span className="text-base font-bold text-gray-900">{directScore}%</span>
        </div>
        <div className="flex-1 flex flex-col items-center pl-2">
          <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">
            Full Team
          </span>
          <span className="text-base font-bold text-gray-900">{fullScore}%</span>
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
    const onTimePosts = activities.onTimePosts || 0;
    const expectedPosts = activities.expectedPosts || 0;

    // Get color class based on percentage
    const getScoreColor = (percentage) => {
      if (percentage >= 80) return 'text-green-600';
      if (percentage >= 50) return 'text-yellow-600';
      return 'text-red-600';
    };

    return (
      <div className="border-t border-gray-100 bg-gray-50/50">
        <div className="p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Activity Breakdown
          </h4>
          <div className="grid grid-cols-5 gap-2">
            <div className="flex flex-col items-center p-2 rounded-lg bg-white border border-gray-100">
              <Scale className="h-4 w-4 text-gray-500 mb-1" />
              <span className={`text-sm font-bold ${getScoreColor(weight)}`}>
                {weight}%
              </span>
              <span className="text-[9px] text-gray-400 capitalize">WEI</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-white border border-gray-100">
              <BookOpen className="h-4 w-4 text-gray-500 mb-1" />
              <span className={`text-sm font-bold ${getScoreColor(education)}`}>
                {education}%
              </span>
              <span className="text-[9px] text-gray-400 capitalize">EDU</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-white border border-gray-100">
              <Coffee className="h-4 w-4 text-gray-500 mb-1" />
              <span className={`text-sm font-bold ${getScoreColor(breakfast)}`}>
                {breakfast}%
              </span>
              <span className="text-[9px] text-gray-400 capitalize">BRE</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-white border border-gray-100">
              <Utensils className="h-4 w-4 text-gray-500 mb-1" />
              <span className={`text-sm font-bold ${getScoreColor(lunch)}`}>
                {lunch}%
              </span>
              <span className="text-[9px] text-gray-400 capitalize">LUN</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-white border border-gray-100">
              <Moon className="h-4 w-4 text-gray-500 mb-1" />
              <span className={`text-sm font-bold ${getScoreColor(dinner)}`}>
                {dinner}%
              </span>
              <span className="text-[9px] text-gray-400 capitalize">DIN</span>
            </div>
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
        containerClass: 'bg-white border-green-200 shadow-sm',
        avatarClass: 'bg-green-100 border-green-400 text-green-700',
        nameClass: 'text-gray-900',
        statsBorderClass: 'border-green-100 divide-green-100',
      };
    } else if (score >= 50) {
      return {
        containerClass: 'bg-white border-yellow-200',
        avatarClass: 'bg-yellow-100 border-yellow-400 text-yellow-700',
        nameClass: 'text-gray-900',
        statsBorderClass: 'border-yellow-100 divide-yellow-100',
      };
    }

    return {
      containerClass: 'bg-white border-red-200',
      avatarClass: 'bg-red-100 border-red-400 text-red-700',
      nameClass: 'text-gray-900',
      statsBorderClass: 'border-red-100 divide-red-100',
    };
  };

  // Calculate summary stats
  const summaryStats = hierarchyData
    ? {
        total: hierarchyData.fullTeamDiscipline?.count || 0,
        qualified: 0, // Not applicable for discipline
        percentage: hierarchyData.fullTeamDiscipline?.percentage || 0,
      }
    : null;

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

  const teamCounts = hierarchyData ? getTeamCounts(hierarchyData) : { total: 0 };

  const handleDateRangeSelect = (start, end) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setDateRange('custom');
  };

  const handleManualRefresh = () => {
    clearDisciplineReportCache();
    fetchData(true);
  };

  const handleDownload = () => {
    console.log('Download discipline report');
    // Implement download logic here
  };

  const handleSortToggle = () => {
    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
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
      subtitle={`${teamCounts.total} Members • Last updated ${new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}`}
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
      summaryStats={summaryStats}
    >
      {hierarchyData && (
        <HierarchicalNode
          node={hierarchyData}
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
