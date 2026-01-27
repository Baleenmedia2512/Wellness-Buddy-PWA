import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  User,
  Users,
  Crown,
  Shield,
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
}) => {
  const isExpanded = expandedNodes.has(node.userId);
  const hasChildren = node.teamMembers && node.teamMembers.length > 0;
  const indentWidth = level * 24; // 24px per level

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
    if (hasChildren) {
      handleToggle();
    }
  };

  const score = disciplineScores[node.userId];

  return (
    <div className="relative">
      {/* Node Card */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={`
          flex items-center gap-3 p-3 rounded-xl border-2 mb-2
          transition-all hover:shadow-md
          ${roleColor[node.role] || roleColor.user}
          ${node.isCoCoach ? "border-l-4 border-l-purple-500" : ""}
          ${hasChildren ? "cursor-pointer" : ""}
        `}
        style={{ marginLeft: `${indentWidth}px` }}
        onClick={handleCardClick}
      >
        {/* Expand/Collapse Button */}
        {hasChildren && (
          <div className="p-1">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-600" />
            )}
          </div>
        )}

        {/* Placeholder for alignment when no children */}
        {!hasChildren && <div className="w-7"></div>}

        {/* Avatar/Icon */}
        <div
          className={`
          w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
          ${
            node.role === "coach"
              ? "bg-blue-100 text-blue-700 border-2 border-blue-300"
              : node.role === "admin"
              ? "bg-yellow-100 text-yellow-700 border-2 border-yellow-300"
              : "bg-gray-100 text-gray-700"
          }
        `}
        >
          {node.userName.charAt(0).toUpperCase()}
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate text-sm">
              {node.userName}
            </h3>
            {roleIcon[node.role]}
            {node.isCoCoach && (
              <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                CO-COACH
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span className="truncate">{node.email}</span>
            {hasChildren && (
              <span className="flex items-center gap-1 text-blue-600 font-medium">
                <Users className="w-3 h-3" />
                {node.directMemberCount}
              </span>
            )}
          </div>
        </div>

        {/* Discipline Score (Optional) */}
        {showDisciplineScores && score !== undefined && (
          <div className="text-right">
            <div
              className={`
              text-lg font-bold
              ${
                score >= 80
                  ? "text-green-600"
                  : score >= 60
                  ? "text-yellow-600"
                  : "text-red-600"
              }
            `}
            >
              {score}%
            </div>
            <div className="text-[10px] text-gray-400 uppercase font-bold">
              Score
            </div>
          </div>
        )}
      </motion.div>

      {/* Children (Recursive) */}
      <AnimatePresence>
        {isExpanded && hasChildren && (
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
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
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
        />
      </div>
    </div>
  );
};

export default HierarchicalTeamView;
