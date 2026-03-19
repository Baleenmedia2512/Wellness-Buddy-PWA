import React, { useState, useEffect } from "react";
import { Monitor, Users, XCircle } from "lucide-react";
import HierarchicalReportLayout, {
  LoadingSkeleton,
} from "./common/HierarchicalReportLayout";
import HierarchicalNode from "./common/HierarchicalNode";

const ClubAttendanceReport = ({ user, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [dateRange, setDateRange] = useState("today");
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState("desc");
  const [teamView, setTeamView] = useState("direct"); // 'direct' or 'full'

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getTargetDate = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (dateRange === "yesterday") {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return formatDate(yesterday);
    }
    if (dateRange === "week") {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return formatDate(weekAgo);
    }
    if (dateRange === "month") {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return formatDate(monthAgo);
    }
    if (dateRange === "custom" && customStartDate) {
      return formatDate(customStartDate);
    }
    return formatDate(today);
  };

  const getUserId = async (email) => {
    const response = await fetch(
      `${apiBaseUrl}/api/lookup-user-id?email=${encodeURIComponent(email)}`,
    );
    const data = await response.json();
    if (!data.success) throw new Error("User not found");
    return data.userId;
  };

  const fetchData = async (isBackground = false) => {
    if (!user) return;

    if (!isBackground) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const userId = await getUserId(user.email);
      const date = getTargetDate();
      const response = await fetch(
        `${apiBaseUrl}/api/coach/hierarchical-club-attendance?userId=${userId}&date=${date}&type=remote`,
        { cache: "no-store", headers: { "Cache-Control": "no-cache" } },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to fetch remote attendance data",
        );
      }

      // Map field names for HierarchicalNode component
      const mapFields = (node) => {
        const mapped = { ...node };
        mapped.userEmail = node.email || node.userEmail;
        mapped.uplineCoachName = node.coachName || node.uplineCoachName;
        mapped.uplineCoCoachName = node.coCoachName || node.uplineCoCoachName;
        if (mapped.teamMembers && mapped.teamMembers.length > 0) {
          mapped.teamMembers = mapped.teamMembers.map(mapFields);
        }
        return mapped;
      };

      // Apply sorting to hierarchy
      const sortHierarchy = (node) => {
        const sorted = { ...node };
        if (sorted.teamMembers && sorted.teamMembers.length > 0) {
          sorted.teamMembers = [...sorted.teamMembers]
            .map(sortHierarchy)
            .sort((a, b) => {
              const remoteA = a.metrics?.remoteCount || 0;
              const remoteB = b.metrics?.remoteCount || 0;
              return sortOrder === "desc" ? remoteB - remoteA : remoteA - remoteB;
            });
        }
        return sorted;
      };

      setHierarchyData(sortHierarchy(mapFields(result.data.hierarchy)));
    } catch (err) {
      console.error("Error fetching club ownership:", err);
      setError(err.message);
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
    { value: "all", label: "All Members", icon: null },
    { value: "hasRemote", label: "Has Remote", icon: Monitor },
    { value: "noRemote", label: "No Remote", icon: XCircle },
  ];

  // Match filter logic
  const matchesFilter = (node, filterValue) => {
    if (filterValue === "all") return true;
    const hasRemote = (node.metrics?.remoteCount || 0) > 0;
    if (filterValue === "hasRemote") return hasRemote;
    if (filterValue === "noRemote") return !hasRemote;
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
    const remoteCount = node.metrics?.remoteCount || 0;
    if (remoteCount === 0) {
      return (
        <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-500">
          <XCircle className="h-2.5 w-2.5 flex-shrink-0" />
          <span className="text-[9px] font-semibold whitespace-nowrap">
            No Remote
          </span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 border border-blue-300 text-blue-700 shadow-sm">
        <Monitor className="h-3.5 w-3.5" />
        <span className="text-xs font-bold">
          {remoteCount} Remote
        </span>
      </div>
    );
  };

  // Render stats strip
  const renderStats = (node, level, isCurrentUser) => {
    const remoteCount = node.metrics?.remoteCount || 0;
    const directQualified = node.directTeamCount?.qualified || 0;
    const directTotal = node.directTeamCount?.total || 0;
    const fullQualified = node.fullTeamCount?.qualified || 0;
    const fullTotal = node.fullTeamCount?.total || 0;

    return (
      <>
        {/* Self */}
        <div className="flex-1 flex flex-col items-center pr-2">
          <div className="flex items-center gap-1">
            <span
              className={`text-base font-bold ${
                remoteCount > 0 ? "text-blue-600" : "text-gray-400"
              }`}
            >
              {remoteCount}
            </span>
            <Monitor className="h-3 w-3 text-gray-400" />
          </div>
          <span className="text-[9px] text-gray-500">sessions</span>
        </div>

        {/* Direct Team */}
        <div className="flex-1 flex flex-col items-center px-2">
          <div className="flex items-center gap-1">
            <span className="text-base font-bold text-gray-900">
              {directQualified}
            </span>
            <Users className="h-3 w-3 text-gray-400" />
          </div>
          <span className="text-[9px] text-gray-500">of {directTotal}</span>
        </div>

        {/* Full Team */}
        <div className="flex-1 flex flex-col items-center pl-2">
          <div className="flex items-center gap-1">
            <span className="text-base font-bold text-gray-900">
              {fullQualified}
            </span>
            <Users className="h-3 w-3 text-gray-400" />
          </div>
          <span className="text-[9px] text-gray-500">of {fullTotal}</span>
        </div>
      </>
    );
  };

  // Render expanded details section — nothing extra to show for remote attendance
  const renderExpandedDetails = (node, level, isCurrentUser) => {
    return null;
  };

  // Get status-based styling
  const getStatusStyle = (node, level, isCurrentUser) => {
    const hasRemote = (node.metrics?.remoteCount || 0) > 0;

    if (isCurrentUser && hasRemote) {
      return {
        containerClass:
          "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 shadow-md",
        avatarClass: "bg-yellow-400 border-yellow-500 text-white",
        nameClass: "text-yellow-900",
        statsBorderClass: "border-yellow-200 divide-yellow-200",
      };
    }

    if (hasRemote) {
      return {
        containerClass: "bg-white border-blue-200 shadow-sm",
        avatarClass: "bg-blue-50 border-blue-400 text-blue-700",
        nameClass: "text-gray-900",
        statsBorderClass: "border-blue-100 divide-blue-100",
      };
    }

    return {
      containerClass: "bg-gray-50 border-gray-200",
      avatarClass: "bg-gray-200 border-gray-400 text-gray-500",
      nameClass: "text-gray-500",
      statsBorderClass: "border-gray-100 divide-gray-100",
    };
  };

  // Calculate summary stats
  const myRemoteCount = hierarchyData?.metrics?.remoteCount || 0;
  const directRemoteCount = hierarchyData?.directTeamCount?.qualified || 0;
  const fullRemoteCount = hierarchyData?.fullTeamCount?.qualified || 0;

  const summaryStats = hierarchyData
    ? {
        note: `Self: ${myRemoteCount} | Direct: ${directRemoteCount} | Full: ${fullRemoteCount}`,
      }
    : null;

  // Filter hierarchy based on teamView
  const getFilteredHierarchy = () => {
    if (!hierarchyData) return null;
    if (teamView === "full") return hierarchyData;
    // Direct view - remove nested teams
    if (hierarchyData.teamMembers) {
      return {
        ...hierarchyData,
        teamMembers: hierarchyData.teamMembers.map((member) => ({
          ...member,
          teamMembers: [],
        })),
      };
    }
    return hierarchyData;
  };

  const filteredHierarchy = getFilteredHierarchy();

  // Get team counts
  const getTeamCounts = (node) => {
    if (!node) return { coaches: 0, members: 0 };

    let coaches = 0;
    let members = 0;

    const countNode = (n) => {
      if (n.teamMembers && n.teamMembers.length > 0) {
        coaches++;
        n.teamMembers.forEach((child) => countNode(child));
      } else {
        members++;
      }
    };

    countNode(node);
    return { coaches, members };
  };

  const teamCounts = hierarchyData
    ? getTeamCounts(hierarchyData)
    : { coaches: 0, members: 0 };

  const handleDateRangeSelect = (start, end) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setDateRange("custom");
  };

  const handleManualRefresh = () => {
    fetchData(true);
  };

  const handleDownload = () => {
    console.log("Download club ownership report");
    // Implement download logic here
  };

  const handleSortToggle = () => {
    setSortOrder(sortOrder === "desc" ? "asc" : "desc");
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <HierarchicalReportLayout
      title="Virtual Club Report"
      subtitle={`${
        teamCounts.coaches + teamCounts.members
      } Members • ${directRemoteCount} Attended Remote • Last updated ${new Date().toLocaleString(
        "en-US",
        {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        },
      )}`}
      onBack={onBack}
      onRefresh={handleManualRefresh}
      onDownload={handleDownload}
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
      allowedDateRanges={["today", "yesterday"]}
      summaryStats={summaryStats}
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
    </HierarchicalReportLayout>
  );
};

export default ClubAttendanceReport;
