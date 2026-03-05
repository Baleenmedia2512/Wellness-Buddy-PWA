import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  User,
  Users,
  Crown,
  Shield,
  Scale,
  BookOpen,
  Coffee,
  Utensils,
  Moon,
} from "lucide-react";
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

  // Activity icons matching DisciplineReport.js
  const activityIcons = {
    weight: <Scale className="w-4 h-4" />,
    education: <BookOpen className="w-4 h-4" />,
    breakfast: <Coffee className="w-4 h-4" />,
    lunch: <Utensils className="w-4 h-4" />,
    dinner: <Moon className="w-4 h-4" />,
  };

  const getScoreColorText = (score) => {
    if (score >= 80) return "text-green-700";
    if (score >= 60) return "text-yellow-700";
    return "text-red-700";
  };

  return (
    <div className="relative flex">
      {/* Tree Connector Lines */}
      {level > 0 && (
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
      <div className="flex-1 mb-3">
        {/* Node Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-lg sm:rounded-xl shadow-md border-2 border-gray-100 overflow-hidden hover:shadow-lg hover:border-blue-200 transition-all duration-200"
        >
          {/* Card Header */}
          <div
            className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 cursor-pointer active:bg-gray-50 transition-colors relative"
            onClick={handleCardClick}
          >
            {/* Avatar */}
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold border-2 shadow-sm flex-shrink-0 ${
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
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900 text-sm sm:text-[15px] truncate">
                  {node.userName}
                </h3>
                {/* Role Badge */}
                {level === 0 && node.role === "coach" && (
                  <span className="text-[9px] sm:text-[10px] bg-blue-100 text-blue-700 border border-blue-300 px-1.5 sm:px-2 py-0.5 rounded-full font-bold tracking-wide shadow-sm whitespace-nowrap">
                    COACH
                  </span>
                )}
                {level === 1 && node.role === "coach" && (
                  <span className="text-[9px] sm:text-[10px] bg-purple-100 text-purple-700 border border-purple-300 px-1.5 sm:px-2 py-0.5 rounded-full font-bold tracking-wide shadow-sm whitespace-nowrap">
                    CO-COACH
                  </span>
                )}
                {level >= 2 && (
                  <span className="text-[9px] sm:text-[10px] bg-gray-100 text-gray-700 border border-gray-300 px-1.5 sm:px-2 py-0.5 rounded-full font-bold tracking-wide shadow-sm whitespace-nowrap">
                    MEMBER
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 truncate">{node.email}</p>
              {(node.coachName || node.coCoachName) && (
                <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 sm:mt-1 hidden sm:block">
                  Reports to:{" "}
                  <span className="text-gray-600 font-medium">
                    {node.coachName}
                    {node.coachName && node.coCoachName && ", "}
                    {node.coCoachName}
                  </span>
                </p>
              )}
              {hasChildren && (
                <p className="text-[10px] sm:text-[11px] text-blue-600 font-medium mt-0.5 sm:mt-1 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {node.teamMembers?.length || 0} team member
                  {node.teamMembers?.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            {/* Score and Chevron */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {showDisciplineScores && (
                <div className="text-right">
                  <div
                    className={`text-xl sm:text-2xl font-bold ${
                      score !== undefined && score >= 80
                        ? "text-green-700"
                        : score !== undefined && score >= 60
                        ? "text-yellow-700"
                        : score !== undefined
                        ? "text-red-700"
                        : "text-gray-400"
                    }`}
                  >
                    {score !== undefined ? `${Math.round(score)}%` : "N/A"}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    Score
                  </div>
                </div>
              )}
              {showActivities ? (
                <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
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

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Hierarchy Tree */}
      <div className="px-2 sm:px-4">
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
        />
      </div>
    </div>
  );
};

export default HierarchicalTeamView;
