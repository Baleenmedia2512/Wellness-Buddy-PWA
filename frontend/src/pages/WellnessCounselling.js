// src/pages/WellnessCounselling.js
import React, { useState, useEffect, useMemo, useRef } from "react";
import { FileHeart, CheckCircle, Clock, Users, Plus } from "lucide-react";
import { SelfLogo, DirectLogo, FullTeamLogo } from "../shared/components/common/DisciplineScoreLogos";
import { CapacitorHttp } from '@capacitor/core';
import HierarchicalReportLayout, {
  LoadingSkeleton,
} from "../shared/components/common/HierarchicalReportLayout";
import HierarchicalNode from "../shared/components/common/HierarchicalNode";
import WellnessCounsellingForm from "../features/counselling/components/WellnessCounsellingForm";
import TouchFeedbackButton from "../shared/components/TouchFeedbackButton";
/**
 * Wellness Counselling Page
 * Shows team hierarchy with counselling status and allows starting new assessments
 */
const WellnessCounselling = ({ user, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [teamView, setTeamView] = useState("direct");
  const [sortBy, setSortBy] = useState("name"); // always name-based for A-Z / Z-A
  const [sortOrder, setSortOrder] = useState("asc"); // 'asc' = A-Z | 'desc' = Z-A
  
  const [expandOverride, setExpandOverride] = useState("collapsed"); // "expanded" | "collapsed" | null
  const lastExpandState = useRef(null); // remembers last expand/collapse for Direct â†” Full switch

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [viewingAssessment, setViewingAssessment] = useState(null);
  
  // Mock assessment data - replace with API call
  const [assessmentData, setAssessmentData] = useState({});

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

  const getUserId = async (email) => {
    if (!email) {
      throw new Error("User email is required but not provided");
    }
    
    console.log('ðŸ” [WellnessCounselling] Looking up user ID for:', email);
    
    const response = await CapacitorHttp.get({
      url: `${apiBaseUrl}/api/user/lookup?email=${encodeURIComponent(email)}`
    });
    const data = response.data;
    
    console.log('ðŸ“‹ [WellnessCounselling] Lookup response:', data);
    
    if (!data.success) {
      throw new Error(data.message || "User not found");
    }
    return data.userId;
  };

  const fetchData = async (isBackground = false) => {
    if (!user) {
      console.warn('âš ï¸ [WellnessCounselling] No user object provided');
      setError("User information not available. Please log in again.");
      return;    }

    if (!user.email) {
      console.warn('âš ï¸ [WellnessCounselling] User object missing email:', user);
      setError("User email not available. Please log in again.");
      return;
    }

    console.log('ðŸ‘¤ [WellnessCounselling] User object:', { 
      email: user.email, 
      name: user.name,
      id: user.id 
    });

    if (!isBackground) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const userId = await getUserId(user.email);
      
      // Use new dual coaching hierarchy endpoint that fetches both hierarchy and assessments
      console.log('ðŸ“‹ [WellnessCounselling] Fetching hierarchical assessments...');
      const response = await CapacitorHttp.get({
        url: `${apiBaseUrl}/api/counselling/hierarchical-assessments?userId=${userId}`,
        headers: { "Cache-Control": "no-cache" }
      });
      
      if (response.status !== 200) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const result = response.data;
      
      console.log('ðŸ“‹ [WellnessCounselling] Full API response:', result);
      
      if (!result.success) {
        throw new Error(result.message || "Failed to fetch team data");
      }
      
      // Extract hierarchy and assessments from response
      const hierarchyData = result.data;
      const assessments = result.assessments || {};
      
      console.log('âœ… [WellnessCounselling] Fetched assessments:', Object.keys(assessments).length);
      console.log('ðŸ” [WellnessCounselling] Assessment userIds (types):', 
        Object.keys(assessments).map(k => `${k} (${typeof k})`).join(', '));
      
      // IMPORTANT: Ensure assessment keys are numbers to match node.userId
      const normalizedAssessments = {};
      Object.keys(assessments).forEach(key => {
        const numKey = parseInt(key);
        normalizedAssessments[numKey] = assessments[key];
      });
      
      console.log('ðŸ”§ [WellnessCounselling] Normalized assessment keys:', Object.keys(normalizedAssessments));
      
      // Set assessment data first
      setAssessmentData(normalizedAssessments);
      
      if (!hierarchyData) {
        console.warn('âš ï¸ [WellnessCounselling] No hierarchy data returned');
        setHierarchyData(null);
        return;
      }
      
      console.log('ðŸ“‹ [WellnessCounselling] Raw hierarchy data:', hierarchyData);

      // Map field names for HierarchicalNode component
      const mapFields = (node) => {
        if (!node) {
          console.warn('âš ï¸ [WellnessCounselling] mapFields received null/undefined node');
          return null;
        }
        
        const mapped = { ...node };
        mapped.userEmail = node.email || node.userEmail;
        
        // Metrics already added by backend, but ensure consistency
        if (!mapped.metrics) {
          const hasCounselling = normalizedAssessments[node.userId];
          console.log(`ðŸ” [WellnessCounselling] Checking userId ${node.userId} (${typeof node.userId}):`, hasCounselling ? 'HAS assessment' : 'NO assessment');
          mapped.metrics = {
            hasCounselling: !!hasCounselling,
            counsellingDate: hasCounselling?.submittedAt,
            counsellorName: hasCounselling?.counsellorName,
          };
        }
        
        if (mapped.teamMembers && mapped.teamMembers.length > 0) {
          mapped.teamMembers = mapped.teamMembers
            .map(mapFields)
            .filter(child => child !== null);
        }
        return mapped;
      };

      const mappedData = mapFields(hierarchyData);
      
      if (!mappedData) {
        throw new Error("Failed to process team hierarchy data");
      }
      
      console.log('âœ… [WellnessCounselling] Mapped hierarchy:', mappedData);
      
      setHierarchyData(mappedData);
      
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load data. Please try again.");
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
  }, [user]);

  const handleManualRefresh = () => {
    fetchData(true);
  };

  // Filter options
  const filterOptions = [
    { value: "all", label: "All Members", icon: null },
    { value: "counselled", label: "Counselled", icon: CheckCircle },
    { value: "pending", label: "Pending", icon: Clock },
  ];

  // Match filter logic
  const matchesFilter = (node, filterValue) => {
    if (filterValue === "all") return true;
    const hasCounselling = !!assessmentData[node.userId];
    if (filterValue === "counselled") return hasCounselling;
    if (filterValue === "pending") return !hasCounselling;
    return true;
  };

  // Match search logic
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
    
    // Check co-coach if it exists (for co-coach partnership)
    if (node.coCoachInfo) {
      if (
        node.coCoachInfo.userName?.toLowerCase().includes(lowerQuery) ||
        node.coCoachInfo.email?.toLowerCase().includes(lowerQuery)
      ) {
        return true;
      }
    }
    
    return false;
  };

  // Render status badge
  const renderStatus = (node) => {
    const assessment = assessmentData[node.userId];
    if (assessment) {
      return (
        <div className="flex items-center gap-1.5 bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
          <CheckCircle size={14} />
          <span className="text-xs font-semibold">Counselled</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
        <Clock size={14} />
        <span className="text-xs font-semibold">Pending</span>
      </div>
    );
  };

  // Calculate counselling counts for a node (self, direct, full team)
  const calculateCounsellingCounts = (node) => {
    let selfCounselled = assessmentData[node.userId] ? 1 : 0;
    let directCounselled = 0;
    let directTotal = 0;
    let fullCounselled = 0;
    let fullTotal = 0;

    // Count direct reports
    if (node.teamMembers && node.teamMembers.length > 0) {
      directTotal = node.teamMembers.length;
      directCounselled = node.teamMembers.filter(child => 
        assessmentData[child.userId]
      ).length;

      // Count full team recursively
      const countFullTeam = (n) => {
        fullTotal++;
        if (assessmentData[n.userId]) {
          fullCounselled++;
        }
        if (n.teamMembers && n.teamMembers.length > 0) {
          n.teamMembers.forEach(countFullTeam);
        }
      };

      node.teamMembers.forEach(countFullTeam);
    }

    return {
      self: { counselled: selfCounselled, total: 1 },
      direct: { counselled: directCounselled, total: directTotal },
      full: { counselled: fullCounselled, total: fullTotal }
    };
  };

  // Render stats strip with counselling counts
  const renderStats = (node) => {
    const counts = calculateCounsellingCounts(node);

    const ALL_COLS = [
      {
        key: "self",
        Logo: SelfLogo,
        color: "text-blue-600",
        label: "Individual",
        padding: "pr-2",
        counselled: counts.self.counselled,
        total: counts.self.total,
      },
      {
        key: "direct",
        Logo: DirectLogo,
        color: "text-green-600",
        label: "DIRECT",
        padding: "px-2",
        counselled: counts.direct.counselled,
        total: counts.direct.total,
      },
      {
        key: "full",
        Logo: FullTeamLogo,
        color: "text-purple-600",
        label: "FULL",
        padding: "pl-2",
        counselled: counts.full.counselled,
        total: counts.full.total,
      },
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
            <span className={`text-[8px] font-semibold uppercase tracking-wide leading-none ${col.color}`}>
              {col.label}
            </span>
            <span
              className={`${
                isSingle ? "text-base sm:text-lg" : "text-sm sm:text-base"
              } font-bold ${
                col.counselled === col.total && col.total > 0
                  ? "text-green-600"
                  : col.counselled > 0
                  ? "text-orange-600"
                  : "text-gray-400"
              }`}
            >
              {col.counselled}/{col.total}
            </span>
          </div>
        ))}
      </>
    );
  };

  // Render expanded details when clicking on a node
  const renderExpandedDetails = (node) => {
    const assessment = assessmentData[node.userId];
    
    return (
      <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
        {assessment ? (
          <>
            {/* Assessment info */}
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
              <span>Counselled by: <span className="font-medium text-gray-800">{assessment.counsellorName}</span></span>
              <span className="text-gray-400">â€¢</span>
              <span>{new Date(assessment.submittedAt).toLocaleDateString()}</span>
            </div>
            <TouchFeedbackButton
              onClick={() => setViewingAssessment({ node, assessment })}
              className="w-full bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              View Assessment Details
            </TouchFeedbackButton>
          </>
        ) : (
          <>
            {/* Info note when starting assessment */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
              <p className="text-xs text-blue-800">
                ðŸ’¡ Start a wellness counselling assessment for this member. You can assess yourself, direct reports, or full team members.
              </p>
            </div>
            <TouchFeedbackButton
              onClick={() => {
                setSelectedMember(node);
                setIsFormOpen(true);
              }}
              className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Start Assessment
            </TouchFeedbackButton>
          </>
        )}
      </div>
    );
  };

  // Get status styling
  const getStatusStyle = (node, level, isCurrentUser) => {
    const assessment = assessmentData[node.userId];
    
    if (assessment) {
      return {
        containerClass: "bg-green-50 border-green-200",
        avatarClass: "bg-green-100 border-green-300 text-green-600",
        nameClass: "text-gray-900",
        statsBorderClass: "border-green-100 divide-green-100",
      };
    }
    
    return {
      containerClass: "bg-white border-gray-200",
      avatarClass: "bg-gray-100 border-gray-300 text-gray-600",
      nameClass: "text-gray-900",
      statsBorderClass: "border-gray-100 divide-gray-100",
    };
  };

  // Check if hierarchy has visible nodes
  const hasVisibleNodes = (node) => {
    if (!node) return false;
    if (matchesFilter(node, filter) && matchesSearch(node, searchQuery)) {
      return true;
    }
    if (node.teamMembers && node.teamMembers.length > 0) {
      return node.teamMembers.some(hasVisibleNodes);
    }
    return false;
  };

  // Calculate summary stats
  const calculateStats = (node) => {
    let total = 0;
    let counselled = 0;
    
    const count = (n) => {
      total++;
      if (assessmentData[n.userId]) {
        counselled++;
      }
      if (n.teamMembers && n.teamMembers.length > 0) {
        n.teamMembers.forEach(count);
      }
    };
    
    if (node) count(node);
    
    return { total, counselled, pending: total - counselled };
  };

  const stats = hierarchyData ? calculateStats(hierarchyData) : { total: 0, counselled: 0, pending: 0 };

  const sortedHierarchyData = useMemo(() => {
    if (!hierarchyData) return null;
    const computeScore = (node, by) => {
      if (by === "all" || by === "self") return assessmentData[node.userId] ? 1 : 0;
      const countTeam = (n, deep) => {
        let counselled = 0, total = 0;
        (n.teamMembers || []).forEach((m) => {
          total++;
          if (assessmentData[m.userId]) counselled++;
          if (deep) {
            const s = countTeam(m, true);
            counselled += s.counselled;
            total += s.total;
          }
        });
        return { counselled, total };
      };
      const { counselled, total } = countTeam(node, by === "full");
      return total === 0 ? 0 : counselled / total;
    };
    const sortNode = (node) => ({
      ...node,
      teamMembers: [...(node.teamMembers || [])]
        .sort((a, b) => {
          // A-Z / Z-A name sort
          if (sortBy === "name") {
            const nameA = (a.userName || a.name || "").toLowerCase();
            const nameB = (b.userName || b.name || "").toLowerCase();
            const cmp = nameA.localeCompare(nameB);
            return sortOrder === "desc" ? -cmp : cmp;
          }
          const ka = computeScore(a, sortBy);
          const kb = computeScore(b, sortBy);
          return sortOrder === "desc" ? kb - ka : ka - kb;
        })
        .map(sortNode),
    });
    return sortNode(hierarchyData);
  }, [hierarchyData, assessmentData, sortBy, sortOrder]);

  const summaryStats = {
    note: true, // Enables the common note display
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="h-screen bg-gradient-to-br from-green-50 to-blue-50 overflow-hidden flex flex-col">
      <HierarchicalReportLayout
        title="Wellness Counselling"
        subtitle={`${stats.total} Members â€¢ ${stats.counselled} Counselled`}
        onBack={onBack}
        onRefresh={handleManualRefresh}
        loading={refreshing}
        error={error}
        onRetry={fetchData}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filter={filter}
        onFilterChange={setFilter}
        filterOptions={filterOptions}
        summaryStats={summaryStats}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(newSortBy, newSortOrder) => { setSortBy("name"); setSortOrder(newSortOrder); }}
        onExpandAll={() => { lastExpandState.current = "expanded"; setExpandOverride("expanded"); }}
        onCollapseAll={() => { lastExpandState.current = "collapsed"; setExpandOverride("collapsed"); }}
        expandedState={expandOverride}
        teamView={teamView}
        onTeamViewChange={setTeamView}
      >
        {hierarchyData && hasVisibleNodes(hierarchyData) ? (
          <HierarchicalNode
            key={`hierarchy-${teamView}-${sortBy}-${sortOrder}`}
            node={sortedHierarchyData}
            level={0}
            isLastChild={true}
            renderStatus={renderStatus}
            renderStats={renderStats}
            renderExpandedDetails={renderExpandedDetails}
            isCurrentUser={true}
            showTeamCount={true}
            showFullTeam={teamView === "full"}
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
      </HierarchicalReportLayout>

      {/* Wellness Counselling Form Modal */}
      <WellnessCounsellingForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedMember(null);
        }}
        user={user}
        selectedMember={selectedMember}
        onSaveSuccess={async () => {
          // Refresh data from API first, THEN close form
          console.log('ðŸ’¾ [WellnessCounselling] Assessment saved, refreshing data...');
          await fetchData(true);
          console.log('âœ… [WellnessCounselling] Data refreshed, closing form');
          setIsFormOpen(false);
          setSelectedMember(null);
        }}
      />

      {/* Assessment View Modal */}
      {viewingAssessment && (
        <AssessmentViewModal
          assessment={viewingAssessment.assessment}
          member={viewingAssessment.node}
          onClose={() => setViewingAssessment(null)}
        />
      )}
    </div>
  );
};

/**
 * Assessment View Modal
 * Shows details of a completed assessment
 */
const AssessmentViewModal = ({ assessment, member, onClose }) => {
  if (!assessment) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-t-xl flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold">Assessment Details</h2>
            <p className="text-xs sm:text-sm text-green-100 truncate">{member.userName || member.userEmail}</p>
          </div>
          <TouchFeedbackButton
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            ariaLabel="Close"
          >
            âœ•
          </TouchFeedbackButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Metadata */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
              <div>
                <span className="text-gray-500">Counselled by:</span>
                <span className="ml-2 font-medium break-words">{assessment.counsellorName}</span>
              </div>
              <div>
                <span className="text-gray-500">Date:</span>
                <span className="ml-2 font-medium">
                  {new Date(assessment.submittedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Health Problems */}
          {assessment.healthProblems && assessment.healthProblems.length > 0 && (
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">Health Issues</h3>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {assessment.healthProblems.map((problem, idx) => (
                  <span
                    key={idx}
                    className="bg-red-50 text-red-700 text-xs px-2 sm:px-3 py-1 rounded-full border border-red-200"
                  >
                    {problem}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Eating Habits */}
          {assessment.eatingHabits && (
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">Eating Habits</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                {Object.entries(assessment.eatingHabits).map(([key, value]) => (
                  value && (
                    <div key={key} className="flex justify-between gap-2">
                      <span className="text-gray-600 capitalize flex-shrink-0">
                        {key.replace(/([A-Z])/g, ' $1').trim()}:
                      </span>
                      <span className="font-medium text-right break-words">{value}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Sleep Data */}
          {assessment.sleepData && (
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">Sleep Quality</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-600">Quality:</span>
                  <span className="font-medium break-words">{assessment.sleepData.quality}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium break-words">{assessment.sleepData.duration}</span>
                </div>
              </div>
            </div>
          )}

          {/* Medication */}
          {assessment.medicationDetails && (
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">Medication Details</h3>
              <p className="text-xs sm:text-sm text-gray-600 bg-gray-50 p-2.5 sm:p-3 rounded-lg break-words">
                {assessment.medicationDetails}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t p-3 sm:p-4 flex justify-end">
          <TouchFeedbackButton
            onClick={onClose}
            className="px-4 sm:px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm sm:text-base font-medium transition-colors"
          >
            Close
          </TouchFeedbackButton>
        </div>
      </div>
    </div>
  );
};

export default WellnessCounselling;
