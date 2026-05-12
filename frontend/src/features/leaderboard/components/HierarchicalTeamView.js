import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  User,
  Users,
  Crown,
  Shield,
  BookOpen,
  Coffee,
  Utensils,
  Moon,
  Droplets,
  Flame,
} from "lucide-react";
import BathroomScaleIcon from "../../../shared/components/icons/BathroomScaleIcon";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Hierarchical Team Node Component
 * Displays a single node in the team hierarchy with expand/collapse and tree connectors
 */
const TeamNode = ({
  node,
  level = 0,
  onNodeClick,
  expandedNodes,
  onToggleExpand,
  showDisciplineScores = false,
  disciplineScores = {},
  memberActivities = {},
  isLastChild = false,
  allTeamMembers = [], // All team members for calculating team scores
}) => {
  const [showActivities, setShowActivities] = useState(false);
  const isExpanded = expandedNodes.has(node.userId);
  const hasChildren = node.teamMembers && node.teamMembers.length > 0;

  // Debug logging
  console.log("TeamNode render:", {
    name: node.userName,
    userId: node.userId,
    hasChildren,
    childCount: node.teamMembers?.length || 0,
    isExpanded,
    level,
  });

  const handleToggle = (e) => {
    if (e) e.stopPropagation();
    if (hasChildren) {
      onToggleExpand(node.userId);
    }
  };

  const handleCardClick = () => {
    setShowActivities(!showActivities);
  };

  const score = disciplineScores[node.userId];
  const activities = memberActivities[node.userId];

  // Debug logging for scores
  console.log("TeamNode score check:", {
    name: node.userName,
    userId: node.userId,
    userIdType: typeof node.userId,
    score,
    scoreType: typeof score,
    hasDisciplineScores: Object.keys(disciplineScores).length > 0,
    disciplineScoresKeys: Object.keys(disciplineScores).slice(0, 5),
    disciplineScoresSample: Object.entries(disciplineScores).slice(0, 3)
  });

  // Calculate team scores for any node with team members
  let directTeamScore = null;
  let underTeamScore = null;

  // Get direct reports (children of current node)
  const directReports = node.teamMembers || [];

  if (directReports.length > 0) {
    // Calculate direct team average
    const directScores = directReports
      .map((member) => disciplineScores[member.userId])
      .filter((s) => s !== undefined && s !== null);

    if (directScores.length > 0) {
      directTeamScore = Math.round(
        directScores.reduce((sum, s) => sum + s, 0) / directScores.length,
      );
    }

    // Calculate full team average (direct reports + all descendants)
    // This includes all team members under this node
    const flattenDescendants = (parentNode) => {
      const descendants = [];
      const flatten = (n) => {
        if (n.teamMembers && n.teamMembers.length > 0) {
          n.teamMembers.forEach((child) => {
            descendants.push(child);
            flatten(child);
          });
        }
      };
      flatten(parentNode);
      return descendants;
    };

    const allDescendants = flattenDescendants(node);

    if (allDescendants.length > 0) {
      const allScores = allDescendants
        .map((member) => disciplineScores[member.userId])
        .filter((s) => s !== undefined && s !== null);

      if (allScores.length > 0) {
        underTeamScore = Math.round(
          allScores.reduce((sum, s) => sum + s, 0) / allScores.length,
        );
      }
    }
  }

  // Activity icons matching DisciplineReport.js
  const activityIcons = {
    weight: <BathroomScaleIcon className="w-4 h-4" />,
    education: <BookOpen className="w-4 h-4" />,
    breakfast: <Coffee className="w-4 h-4" />,
    lunch: <Utensils className="w-4 h-4" />,
    dinner: <Moon className="w-4 h-4" />,
    water: <Droplets className="w-4 h-4" />,
    caloriesBurned: <Flame className="w-4 h-4" />,
  };

  const getScoreColorText = (score) => {
    if (score >= 80) return "text-green-700";
    if (score >= 60) return "text-yellow-700";
    return "text-red-700";
  };

  return (
    <div className="relative flex">
      {/* Tree Connector Lines */}
      {/* Co-coach has no line to show they're at same level as coach */}
      {level > 0 && !node.isCoCoach && (
        <div className="relative flex-shrink-0" style={{ width: "32px" }}>
          {/* Horizontal line to card */}
          <div
            className="absolute top-[32px] sm:top-[40px] left-0 h-[3px] bg-gray-600"
            style={{ width: "32px" }}
          />
          {/* Vertical line from parent */}
          {!isLastChild && (
            <div
              className="absolute left-0 top-0 w-[3px] bg-gray-600"
              style={{ height: "calc(100% + 12px)" }}
            />
          )}
          {isLastChild && (
            <div
              className="absolute left-0 top-0 w-[3px] bg-gray-600"
              style={{ height: "32px" }}
            />
          )}
        </div>
      )}

      {/* Node Content */}
      <div className="flex-1 mb-2 sm:mb-3 w-full overflow-hidden">
        {/* Node Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`rounded-lg sm:rounded-xl shadow-md border-2 overflow-hidden hover:shadow-lg transition-all duration-200 w-full max-w-full ${
            node.isCoCoach
              ? "bg-purple-50/40 border-purple-300 hover:border-purple-400 ring-1 ring-purple-200"
              : "bg-white border-gray-100 hover:border-blue-200"
          }`}
        >
          {/* Card Header */}
          <div
            className={`flex items-center gap-1 xs:gap-1.5 sm:gap-2 p-1.5 xs:p-2 sm:p-2.5 cursor-pointer active:bg-gray-50 transition-colors relative w-full overflow-hidden ${
              node.isCoCoach ? "bg-purple-50/50" : ""
            }`}
            onClick={handleCardClick}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 xs:w-9 xs:h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center text-[10px] xs:text-xs sm:text-sm font-bold border-2 shadow-sm flex-shrink-0 ${
                score >= 80
                  ? "bg-green-50 border-green-300 text-green-700"
                  : score >= 60
                  ? "bg-yellow-50 border-yellow-300 text-yellow-700"
                  : "bg-red-50 border-red-300 text-red-700"
              }`}
            >
              {node.userName.charAt(0).toUpperCase()}
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-0.5 xs:gap-1 sm:gap-1.5 flex-wrap">
                <h3 className="font-bold text-gray-900 text-[11px] xs:text-xs sm:text-sm truncate max-w-[120px] xs:max-w-[150px] sm:max-w-none">
                  {node.userName}
                </h3>
                {/* Role Badge */}
                {level === 0 && node.role === "coach" && !node.isCoCoach && (
                  <span className="text-[8px] xs:text-[9px] sm:text-[10px] bg-blue-100 text-blue-700 border border-blue-300 px-1 xs:px-1.5 sm:px-2 py-0.5 rounded-full font-bold tracking-wide shadow-sm whitespace-nowrap flex-shrink-0">
                    COACH
                  </span>
                )}
                {(node.isCoCoach || (level === 1 && node.role === "coach" && !node.isCoCoach)) && (
                  <span className="text-[8px] xs:text-[9px] sm:text-[10px] bg-purple-100 text-purple-700 border border-purple-300 px-1 xs:px-1.5 sm:px-2 py-0.5 rounded-full font-bold tracking-wide shadow-sm whitespace-nowrap flex-shrink-0">
                    CO-COACH
                  </span>
                )}
                {level >= 1 && !node.isCoCoach && node.role !== "coach" && (
                  <span className="text-[8px] xs:text-[9px] sm:text-[10px] bg-gray-100 text-gray-700 border border-gray-300 px-1 xs:px-1.5 sm:px-2 py-0.5 rounded-full font-bold tracking-wide shadow-sm whitespace-nowrap flex-shrink-0">
                    MEMBER
                  </span>
                )}
                {/* Shared Team Badge - when viewing yourself as a co-coach */}
                {level === 0 && node.coachName && node.coCoachName && (
                  <span className="text-[8px] xs:text-[9px] sm:text-[10px] bg-amber-50 text-amber-700 border border-amber-300 px-1 xs:px-1.5 sm:px-2 py-0.5 rounded-full font-bold tracking-wide shadow-sm whitespace-nowrap flex-shrink-0 flex items-center gap-0.5">
                    <Users className="w-2 h-2 xs:w-2.5 xs:h-2.5" />
                    SHARED TEAM
                  </span>
                )}
              </div>
              <p className="text-[9px] xs:text-[10px] sm:text-xs text-gray-500 mt-0.5 truncate">
                {node.email}
              </p>
              {(node.coachName || node.coCoachName) && (
                <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 sm:mt-1 hidden sm:block">
                  {level === 0 && node.coachName && node.coCoachName ? (
                    <>
                      <span className="text-amber-600 font-semibold">Co-Coach Partnership:</span>{" "}
                      <span className="text-gray-600 font-medium">
                        {node.coachName}
                        {node.coachName && node.coCoachName && " & "}
                        {node.coCoachName}
                      </span>
                    </>
                  ) : (
                    <>
                      Reports to:{" "}
                      <span className="text-gray-600 font-medium">
                        {node.coachName}
                        {node.coachName && node.coCoachName && ", "}
                        {node.coCoachName}
                      </span>
                    </>
                  )}
                </p>
              )}
              {hasChildren && (
                <p className="text-[9px] xs:text-[10px] sm:text-[11px] text-blue-600 font-medium mt-0.5 sm:mt-1 flex items-center gap-0.5 xs:gap-1">
                  <Users className="w-2.5 h-2.5 xs:w-3 xs:h-3" />
                  {node.teamMembers?.length || 0} team member
                  {node.teamMembers?.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            {/* Score and Chevron */}
            <div className="flex items-center gap-0.5 xs:gap-1 sm:gap-1.5 flex-shrink-0">
              {showDisciplineScores && (
                <>
                  {/* All nodes: Show three metrics horizontally */}
                  <div className="flex flex-row gap-[2px] xs:gap-0.5 sm:gap-1 md:gap-1.5">
                    {/* My Score */}
                    <div className="flex flex-col items-center w-[20px] xs:w-[24px] sm:w-[36px] md:w-[42px]">
                      <div
                        className={`text-[10px] sm:text-sm md:text-base font-extrabold leading-none ${
                          score !== undefined && score >= 80
                            ? "text-blue-700"
                            : score !== undefined && score >= 60
                            ? "text-blue-600"
                            : score !== undefined
                            ? "text-blue-500"
                            : "text-gray-400"
                        }`}
                      >
                        {score !== undefined ? `${Math.round(score)}%` : "N/A"}
                      </div>
                      <div className="text-[4.5px] xs:text-[5px] sm:text-[6px] md:text-[7px] text-blue-600 font-semibold uppercase tracking-[-0.05em] xs:tracking-[-0.04em] sm:tracking-tighter text-center leading-[1.1] mt-[1px] xs:mt-[2px] sm:mt-1">
                        MY SCORE
                      </div>
                    </div>

                    {/* Direct Team */}
                    <div className="flex flex-col items-center w-[20px] xs:w-[24px] sm:w-[36px] md:w-[42px]">
                      <div
                        className={`text-[8px] xs:text-[9px] sm:text-xs md:text-sm font-extrabold leading-none ${
                          directTeamScore !== null && directTeamScore >= 80
                            ? "text-green-700"
                            : directTeamScore !== null && directTeamScore >= 60
                            ? "text-yellow-700"
                            : directTeamScore !== null
                            ? "text-red-700"
                            : "text-gray-400"
                        }`}
                      >
                        {directTeamScore !== null
                          ? `${directTeamScore}%`
                          : "N/A"}
                      </div>
                      <div className="text-[4.5px] xs:text-[5px] sm:text-[6px] md:text-[7px] text-green-600 font-semibold uppercase tracking-[-0.05em] xs:tracking-[-0.04em] sm:tracking-tighter text-center leading-[1.1] mt-[1px] xs:mt-[2px] sm:mt-1">
                        DIRECT TEAM
                      </div>
                    </div>

                    {/* Full Team */}
                    <div className="flex flex-col items-center w-[20px] xs:w-[24px] sm:w-[36px] md:w-[42px]">
                      <div
                        className={`text-[8px] xs:text-[9px] sm:text-xs md:text-sm font-extrabold leading-none ${
                          underTeamScore !== null && underTeamScore >= 80
                            ? "text-green-700"
                            : underTeamScore !== null && underTeamScore >= 60
                            ? "text-yellow-700"
                            : underTeamScore !== null
                            ? "text-red-700"
                            : "text-gray-400"
                        }`}
                      >
                        {underTeamScore !== null ? `${underTeamScore}%` : "N/A"}
                      </div>
                      <div className="text-[4.5px] xs:text-[5px] sm:text-[6px] md:text-[7px] text-green-600 font-semibold uppercase tracking-[-0.05em] xs:tracking-[-0.04em] sm:tracking-tighter text-center leading-[1.1] mt-[1px] xs:mt-[2px] sm:mt-1">
                        FULL TEAM
                      </div>
                    </div>
                  </div>
                </>
              )}
              {showActivities ? (
                <ChevronUp className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 text-gray-400" />
              )}
            </div>
          </div>

          {/* Expanded Activities */}
          <AnimatePresence>
            {showActivities && activities && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-gray-100 bg-gradient-to-b from-gray-50 to-white"
              >
                <div className="p-3 sm:p-4 grid grid-cols-5 gap-2 sm:gap-3">
                  {["weight", "education", "breakfast", "lunch", "dinner"].map(
                    (activityKey) => {
                      const activity = activities[activityKey];
                      if (!activity) return null;
                      return (
                        <div
                          key={activityKey}
                          className="flex flex-col items-center gap-1 sm:gap-2"
                        >
                          <div
                            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md border-2 transition-transform hover:scale-110 ${
                              activity.percentage >= 80
                                ? "bg-green-50 border-green-300 text-green-700"
                                : activity.percentage >= 60
                                ? "bg-yellow-50 border-yellow-300 text-yellow-700"
                                : "bg-red-50 border-red-300 text-red-700"
                            }`}
                          >
                            {activityIcons[activityKey]}
                          </div>
                          <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                            {activityKey.slice(0, 3)}
                          </span>
                          <span
                            className={`text-[11px] sm:text-xs font-bold ${getScoreColorText(
                              activity.percentage,
                            )}`}
                          >
                            {activity.percentage}%
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0 text-center">
                  <p className="text-[10px] sm:text-xs text-gray-500 font-medium">
                    {(() => {
                      const totalOnTime = Object.values(activities).reduce(
                        (sum, act) => sum + (act.onTimePosts || 0),
                        0,
                      );
                      const totalExpected = Object.values(activities).reduce(
                        (sum, act) => sum + (act.expectedPosts || 0),
                        0,
                      );
                      return `${totalOnTime} on-time posts out of ${totalExpected} expected`;
                    })()}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Children (Recursive Tree Structure) */}
        <AnimatePresence>
          {hasChildren && (
            <motion.div
              initial={{ opacity: 1, height: "auto" }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 sm:mt-3 ml-0 pl-0"
            >
              {node.teamMembers.map((child, index) => (
                <TeamNode
                  key={child.userId}
                  node={child}
                  level={level + 1}
                  onNodeClick={onNodeClick}
                  expandedNodes={expandedNodes}
                  onToggleExpand={onToggleExpand}
                  showDisciplineScores={showDisciplineScores}
                  disciplineScores={disciplineScores}
                  memberActivities={memberActivities}
                  isLastChild={index === node.teamMembers.length - 1}
                  allTeamMembers={allTeamMembers}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

/**
 * Hierarchical Team View Component
 * Main container for displaying team hierarchy
 */
const HierarchicalTeamView = ({
  hierarchy,
  onNodeClick,
  showDisciplineScores = false,
  disciplineScores = {},
  memberActivities = {},
  emptyMessage = "No team members found",
}) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Auto-expand first level on initial load (root coach + direct reports)
  React.useEffect(() => {
    if (hierarchy) {
      console.log("Auto-expanding first level:", hierarchy);
      const firstLevelIds = new Set();

      // Expand root node
      firstLevelIds.add(hierarchy.userId);

      // Optionally expand direct reports (Level 1 - Co-Coaches)
      if (hierarchy.teamMembers && hierarchy.teamMembers.length > 0) {
        hierarchy.teamMembers.forEach((child) => {
          firstLevelIds.add(child.userId);
        });
      }

      console.log("First level expanded IDs:", Array.from(firstLevelIds));
      setExpandedNodes(firstLevelIds);
    }
  }, [hierarchy]);

  const handleToggleExpand = (nodeId) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  if (!hierarchy) {
    return (
      <div className="text-center py-12">
        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  // Flatten the hierarchy to get all team members for score calculations
  const flattenHierarchy = (node) => {
    const members = [];
    const flatten = (n) => {
      if (n.teamMembers && n.teamMembers.length > 0) {
        n.teamMembers.forEach((child) => {
          members.push(child);
          flatten(child);
        });
      }
    };
    flatten(node);
    return members;
  };

  const allTeamMembers = flattenHierarchy(hierarchy);

  return (
    <div className="space-y-3 sm:space-y-4 w-full">
      {/* Hierarchy Tree */}
      <div className="px-1 sm:px-2 md:px-3">
        <TeamNode
          node={hierarchy}
          level={0}
          onNodeClick={onNodeClick}
          expandedNodes={expandedNodes}
          onToggleExpand={handleToggleExpand}
          showDisciplineScores={showDisciplineScores}
          disciplineScores={disciplineScores}
          memberActivities={memberActivities}
          isLastChild={true}
          allTeamMembers={allTeamMembers}
        />
      </div>
    </div>
  );
};

export default HierarchicalTeamView;
