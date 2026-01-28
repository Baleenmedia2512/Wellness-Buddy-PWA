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
 * Displays a single node in the team hierarchy with expand/collapse
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
}) => {
  const [showActivities, setShowActivities] = useState(false);
  const isExpanded = expandedNodes.has(node.userId);
  const hasChildren = node.teamMembers && node.teamMembers.length > 0;
  const indentWidth = level * 24; // 24px per level

  // Debug logging
  console.log('TeamNode render:', {
    name: node.userName,
    userId: node.userId,
    hasChildren,
    childCount: node.teamMembers?.length || 0,
    isExpanded,
    level
  });

  const roleIcon = {
    admin: <Crown className="w-4 h-4 text-yellow-600" />,
    coach: <Shield className="w-4 h-4 text-blue-600" />,
    user: <User className="w-4 h-4 text-gray-600" />,
  };

  const roleColor = {
    admin: "border-yellow-200 bg-yellow-50",
    coach: "border-blue-200 bg-blue-50",
    user: "border-gray-200 bg-white",
  };

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
    <div className="relative">
      {/* Node Card */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={`
          bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow
        `}
        style={{ marginLeft: `${indentWidth}px`, marginBottom: '12px' }}
      >
        {/* Card Header */}
        <div
          className="flex items-center gap-3 p-4 cursor-pointer active:bg-gray-50 transition-colors"
          onClick={handleCardClick}
        >
          {/* Avatar */}
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
              score >= 80
                ? "bg-opacity-10 bg-green-50 border-green-200 text-green-700"
                : score >= 60
                ? "bg-opacity-10 bg-yellow-50 border-yellow-200 text-yellow-700"
                : "bg-opacity-10 bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {node.userName.charAt(0).toUpperCase()}
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 text-[15px]">
                {node.userName}
              </h3>
              {node.role === "coach" && (
                <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-bold tracking-wide">
                  COACH
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{node.email}</p>
            {hasChildren && !isExpanded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand(node.userId);
                }}
                className="text-[11px] text-blue-600 font-medium mt-1 flex items-center gap-1 hover:text-blue-700"
              >
                <Users className="w-3 h-3" />
                View {node.directMemberCount} team members
              </button>
            )}
            {hasChildren && isExpanded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand(node.userId);
                }}
                className="text-[11px] text-blue-600 font-medium mt-1 flex items-center gap-1 hover:text-blue-700"
              >
                <ChevronUp className="w-3 h-3" />
                Hide {node.directMemberCount} team members
              </button>
            )}
          </div>

          {/* Score and Chevron */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div
                className={`text-xl font-bold ${
                  score >= 80
                    ? "text-green-700"
                    : score >= 60
                    ? "text-yellow-700"
                    : "text-red-700"
                }`}
              >
                {score}%
              </div>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                Score
              </div>
            </div>
            {showActivities ? (
              <ChevronUp className="h-5 w-5 text-gray-300" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-300" />
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
              className="border-t border-gray-50 bg-gray-50/30"
            >
              <div className="p-4 grid grid-cols-5 gap-2">
                {['weight', 'education', 'breakfast', 'lunch', 'dinner'].map((activityKey) => {
                  const activity = activities[activityKey];
                  if (!activity) return null;
                  return (
                    <div
                      key={activityKey}
                      className="flex flex-col items-center gap-2"
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border ${
                          activity.percentage >= 80
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : activity.percentage >= 60
                            ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                            : 'bg-red-50 border-red-200 text-red-700'
                        }`}
                      >
                        {activityIcons[activityKey]}
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                        {activityKey.slice(0, 3)}
                      </span>
                      <span
                        className={`text-xs font-bold ${getScoreColorText(activity.percentage)}`}
                      >
                        {activity.percentage}%
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="px-4 pb-4 pt-0 text-center">
                <p className="text-xs text-gray-400 font-medium">
                  {(() => {
                    const totalOnTime = Object.values(activities).reduce((sum, act) => sum + (act.onTimePosts || 0), 0);
                    const totalExpected = Object.values(activities).reduce((sum, act) => sum + (act.expectedPosts || 0), 0);
                    return `${totalOnTime} on-time posts out of ${totalExpected} expected`;
                  })()}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Children (Recursive) - Team members shown below */}
      {hasChildren && (
        <div style={{ marginLeft: `${Math.max(0, level * 16)}px` }}>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {node.teamMembers.map((child) => (
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
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
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

  const expandAll = () => {
    const allNodeIds = new Set();

    const collectIds = (node) => {
      if (node.teamMembers && node.teamMembers.length > 0) {
        allNodeIds.add(node.userId);
        node.teamMembers.forEach((child) => collectIds(child));
      }
    };

    if (hierarchy) {
      collectIds(hierarchy);
    }

    setExpandedNodes(allNodeIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
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
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex justify-end gap-2 px-4">
        <button
          onClick={expandAll}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 hover:bg-blue-50 rounded-lg transition-colors"
        >
          Expand All
        </button>
        <button
          onClick={collapseAll}
          className="text-xs text-gray-600 hover:text-gray-700 font-medium px-3 py-1.5 hover:bg-gray-50 rounded-lg transition-colors"
        >
          Collapse All
        </button>
      </div>

      {/* Hierarchy Tree */}
      <div className="px-4">
        <TeamNode
          node={hierarchy}
          level={0}
          onNodeClick={onNodeClick}
          expandedNodes={expandedNodes}
          onToggleExpand={handleToggleExpand}
          showDisciplineScores={showDisciplineScores}
          disciplineScores={disciplineScores}
          memberActivities={memberActivities}
        />
      </div>
    </div>
  );
};

export default HierarchicalTeamView;
