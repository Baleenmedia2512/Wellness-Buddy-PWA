import React, { useState, useEffect } from "react";
import { Check, XCircle, MapPin, Wifi } from "lucide-react";
import HierarchicalReportLayout, {
  LoadingSkeleton,
} from "./common/HierarchicalReportLayout";
import HierarchicalNode from "./common/HierarchicalNode";

const AttendanceReport = ({ user, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [dateRange, setDateRange] = useState("today");
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState('desc');
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
        `${apiBaseUrl}/api/coach/hierarchical-club-attendance?userId=${userId}&date=${date}`,
        { cache: "no-store", headers: { "Cache-Control": "no-cache" } },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch attendance data");
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

      setHierarchyData(mapFields(result.data.hierarchy));
    } catch (err) {
      console.error("Error fetching attendance:", err);
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
    { value: "attended", label: "Attended", icon: Check },
    { value: "notAttended", label: "Not Attended", icon: XCircle },
  ];

  // Match filter logic
  const matchesFilter = (node, filterValue) => {
    if (filterValue === "all") return true;
    const attended = node.metrics?.attended === true;
    if (filterValue === "attended") return attended;
    if (filterValue === "notAttended") return !attended;
    return true;
  };

  // Match search logic with recursive check for descendants
  const matchesSearch = (node, query) => {
    if (!query) return true;
    const lowerQuery = query.toLowerCase();

    // Check current node
    if (
      node.userName?.toLowerCase().includes(lowerQuery) ||
      node.userEmail?.toLowerCase().includes(lowerQuery)
    ) {
      return true;
    }

    // Check descendants
    if (node.teamMembers && node.teamMembers.length > 0) {
      return node.teamMembers.some((child) => matchesSearch(child, query));
    }

    return false;
  };

  // Render status badge
  const renderStatus = (node, showDetails) => {
    const attended = node.metrics?.attended === true;
    const clubs = node.metrics?.clubs || [];
    const remoteCount = node.metrics?.remoteCount || 0;
    const hasMultipleLocations = attended && clubs.length + remoteCount > 1;

    if (!attended) {
      return (
        <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-500">
          <XCircle className="h-2.5 w-2.5 flex-shrink-0" />
          <span className="text-[9px] font-semibold whitespace-nowrap">
            Not Attended
          </span>
        </div>
      );
    }

    if (hasMultipleLocations) {
      return (
        <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-50 border border-green-300 text-green-700">
          <MapPin className="h-2.5 w-2.5" />
          <span className="text-[9px] font-semibold">
            {clubs.length + remoteCount} locations
          </span>
        </div>
      );
    }

    if (clubs.length === 1) {
      return (
        <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-50 border border-green-300 text-green-700">
          <MapPin className="h-2.5 w-2.5" />
          <span className="text-[9px] font-semibold">{clubs[0].name}</span>
        </div>
      );
    }

    if (remoteCount === 1) {
      return (
        <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-300 text-blue-600">
          <Wifi className="h-2.5 w-2.5" />
          <span className="text-[9px] font-semibold">Remote</span>
        </div>
      );
    }

    return (
      <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-50 border border-green-300 text-green-700">
        <Check className="h-2.5 w-2.5" />
        <span className="text-[9px] font-semibold">Attended</span>
      </div>
    );
  };

  // Render stats strip
  const renderStats = (node, level, isCurrentUser) => {
    const attended = node.metrics?.attended === true;
    const clubs = node.metrics?.clubs || [];
    const remoteCount = node.metrics?.remoteCount || 0;

    const attendedDirect = node.directTeamCount?.qualified || 0;
    const totalDirect = node.directTeamCount?.total || 0;
    const attendedFull = node.fullTeamCount?.qualified || 0;
    const totalFull = node.fullTeamCount?.total || 0;

    return (
      <>
        {/* Self */}
        <div className="flex-1 flex flex-col items-center pr-2">
          <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">
            {isCurrentUser ? "You" : "Self"}
          </span>
          {attended ? (
            <div className="flex flex-wrap gap-1 justify-center mt-0.5">
              {clubs.length > 0 && (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 border border-green-300">
                  <MapPin className="h-2.5 w-2.5 text-green-700" />
                  <span className="text-[9px] font-semibold text-green-700">
                    {clubs.length}
                  </span>
                </div>
              )}
              {remoteCount > 0 && (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-100 border border-blue-300">
                  <Wifi className="h-2.5 w-2.5 text-blue-700" />
                  <span className="text-[9px] font-semibold text-blue-700">
                    {remoteCount}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-lg font-bold text-red-500">0%</span>
          )}
        </div>

        {/* Direct Team */}
        <div className="flex-1 flex flex-col items-center px-2">
          <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">
            Direct
          </span>
          <div className="flex items-baseline gap-0.5">
            <span className="text-base font-bold text-gray-900">
              {totalDirect > 0
                ? Math.round((attendedDirect / totalDirect) * 100)
                : 0}
              %
            </span>
          </div>
          <span className="text-[9px] text-gray-500">
            {attendedDirect}/{totalDirect}
          </span>
        </div>

        {/* Full Team */}
        <div className="flex-1 flex flex-col items-center pl-2">
          <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">
            Full Team
          </span>
          <div className="flex items-baseline gap-0.5">
            <span className="text-base font-bold text-gray-900">
              {totalFull > 0 ? Math.round((attendedFull / totalFull) * 100) : 0}
              %
            </span>
          </div>
          <span className="text-[9px] text-gray-500">
            {attendedFull}/{totalFull}
          </span>
        </div>
      </>
    );
  };

  // Render expanded details section
  const renderExpandedDetails = (node, level, isCurrentUser) => {
    const clubs = node.metrics?.clubs || [];
    const remoteCount = node.metrics?.remoteCount || 0;
    const hasMultipleLocations = clubs.length + remoteCount > 1;

    if (!hasMultipleLocations) return null;

    return (
      <div
        className={`px-3 py-2 space-y-1.5 ${
          isCurrentUser ? "bg-yellow-50" : "bg-green-50"
        }`}
      >
        {clubs.map((club, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border border-green-200"
          >
            <MapPin className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
            <span className="text-xs font-medium text-gray-800">
              {club.name}
            </span>
          </div>
        ))}
        {remoteCount > 0 && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border border-blue-200">
            <Wifi className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
            <span className="text-xs font-medium text-gray-800">Remote</span>
          </div>
        )}
      </div>
    );
  };

  // Get status-based styling
  const getStatusStyle = (node, level, isCurrentUser) => {
    const attended = node.metrics?.attended === true;

    if (isCurrentUser && attended) {
      return {
        containerClass:
          "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 shadow-md",
        avatarClass: "bg-yellow-400 border-yellow-500 text-white",
        nameClass: "text-yellow-900",
        statsBorderClass: "border-yellow-200 divide-yellow-200",
      };
    }

    if (attended) {
      return {
        containerClass: "bg-white border-green-200 shadow-sm",
        avatarClass: "bg-green-100 border-green-400 text-green-700",
        nameClass: "text-gray-900",
        statsBorderClass: "border-green-100 divide-green-100",
      };
    }

    return {
      containerClass: "bg-gray-50 border-gray-200",
      avatarClass: "bg-gray-200 border-gray-300 text-gray-500",
      nameClass: "text-gray-500",
      statsBorderClass: "border-gray-100 divide-gray-100",
    };
  };

  // Calculate summary stats
  const mySelfAttended = hierarchyData?.metrics?.attended === true;
  const directAttended = hierarchyData?.directTeamCount?.qualified || 0;
  const directTotal = hierarchyData?.directTeamCount?.total || 0;
  const fullAttended = hierarchyData?.fullTeamCount?.qualified || 0;
  const fullTotal = hierarchyData?.fullTeamCount?.total || 0;

  const summaryStats = hierarchyData
    ? {
        title: "Team Hierarchy",
        items: [
          {
            label: "My Score",
            value: mySelfAttended ? "✓" : "✗",
            icon: null,
            onClick: null,
            isActive: false,
          },
          {
            label: "Direct Team",
            value:
              directTotal > 0
                ? `${Math.round((directAttended / directTotal) * 100)}%`
                : "0%",
            icon: null,
            onClick: () => setTeamView("direct"),
            isActive: teamView === "direct",
          },
          {
            label: "Full Team",
            value:
              fullTotal > 0
                ? `${Math.round((fullAttended / fullTotal) * 100)}%`
                : "0%",
            icon: null,
            onClick: () => setTeamView("full"),
            isActive: teamView === "full",
          },
        ],
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
    console.log("Download attendance report");
    // Implement download logic here
  };

  const handleSortToggle = () => {
    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <HierarchicalReportLayout
      title="Attendance Report"
      subtitle={`${
        teamCounts.coaches + teamCounts.members
      } Members • Last updated ${new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`}
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
      summaryStats={summaryStats}
    >
      {filteredHierarchy && (
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
      )}
    </HierarchicalReportLayout>
  );
};

export default AttendanceReport;
