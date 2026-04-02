import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import TouchFeedbackButton from "../TouchFeedbackButton";

/**
 * Common Hierarchical Node Component
 * Reusable tree node for all hierarchy-based reports
 *
 * @param {Object} props
 * @param {Object} props.node - Node data
 * @param {number} props.level - Tree depth level
 * @param {boolean} props.isLastChild - Is this the last child in siblings
 * @param {Function} props.renderStatus - Function to render node status (e.g., score badge, attendance badge)
 * @param {Function} props.renderStats - Function to render stats strip (Self/Direct/Full Team)
 * @param {Function} props.renderExpandedDetails - Optional function to render expanded details section
 * @param {boolean} props.isCurrentUser - Is this node the logged-in user
 * @param {boolean} props.showTeamCount - Show team member count
 * @param {boolean} props.showFullTeam - Show full hierarchy (true) or only direct reports (false)
 * @param {Function} props.getStatusStyle - Function to get status-based styling
 * @param {string} props.searchQuery - Search query for filtering
 * @param {string} props.filter - Current filter value
 * @param {Function} props.matchesFilter - Function to check if node matches filter
 * @param {Function} props.matchesSearch - Function to check if node/descendant matches search
 * @param {string|null} props.forceExpandedState - "expanded" | "collapsed" | null (global override)
 * @param {boolean} props.defaultExpanded - Whether children start expanded by default (default: false)
 */
const HierarchicalNode = ({
  node,
  level,
  isLastChild,
  renderStatus,
  renderStats,
  renderExpandedDetails,
  isCurrentUser,
  showTeamCount = true,
  showFullTeam = true,
  getStatusStyle,
  searchQuery,
  filter,
  matchesFilter,
  matchesSearch,
  forceExpandedState = null,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showDetails, setShowDetails] = useState(false);

  // Sync local expanded state when global forceExpandedState changes
  useEffect(() => {
    if (forceExpandedState === "expanded") {
      setExpanded(true);
    } else if (forceExpandedState === "collapsed") {
      setExpanded(false);
    }
  }, [forceExpandedState]);

  const hasChildren = node.teamMembers && node.teamMembers.length > 0;

  // Recursive function to check if this node or ANY descendant matches filters
  const hasMatchingDescendant = (currentNode) => {
    // Check current node
    const nodeMatchesSearch = matchesSearch
      ? matchesSearch(currentNode, searchQuery)
      : true;
    const nodeMatchesFilter = matchesFilter
      ? matchesFilter(currentNode, filter)
      : true;

    if (nodeMatchesSearch && nodeMatchesFilter) {
      return true;
    }

    // Check children recursively
    if (currentNode.teamMembers && currentNode.teamMembers.length > 0) {
      return currentNode.teamMembers.some((child) =>
        hasMatchingDescendant(child)
      );
    }

    return false;
  };

  // If this node or any descendant matches, show this node
  if (!hasMatchingDescendant(node)) {
    return null;
  }

  // Get styling based on status
  const statusStyle = getStatusStyle
    ? getStatusStyle(node, level, isCurrentUser)
    : {};
  let {
    containerClass = "bg-white border-gray-200",
    avatarClass = "bg-gray-200 border-gray-300 text-gray-500",
    nameClass = "text-gray-900",
    statsBorderClass = "border-gray-100 divide-gray-100",
  } = statusStyle;

  // Override styling for co-coach nodes
  if (node.isCoCoach) {
    containerClass = "bg-purple-50/60 border-purple-300 shadow-md ring-1 ring-purple-200";
    avatarClass = "bg-purple-100 border-purple-400 text-purple-700";
    nameClass = "text-purple-900";
    statsBorderClass = "border-purple-100 divide-purple-100";
  }

  return (
    <div className="relative flex" style={{ marginLeft: level > 0 ? 0 : 0 }}>
      {/* Tree lines - width shrinks with depth to prevent card squishing */}
      {level > 0 && (
        <div
          className="relative flex-shrink-0"
          style={{ width: `${Math.max(10, 24 - (level - 1) * 3)}px` }}
        >
          <div className="absolute top-[22px] left-0 h-[2px] bg-gray-400 w-full" />
          <div
            className="absolute left-0 top-0 w-[2px] bg-gray-400"
            style={{ height: isLastChild ? "22px" : "calc(100% + 12px)" }}
          />
        </div>
      )}

      {/* Node body */}
      <div className="flex-1 mb-2 min-w-0">
        <div
          className={`rounded-xl border-2 overflow-hidden transition-all shadow-sm ${containerClass}`}
        >
          {/* Main Row */}
          <div
            className={`flex flex-col px-3 pt-2.5 pb-1`}
            onClick={() => {
              if (renderExpandedDetails) {
                setShowDetails(!showDetails);
              }
            }}
          >
            {/* Top row: Avatar + Name/Info + Status Badge */}
            <div className="flex items-start gap-2">
              {/* Avatar */}
              <div className="relative w-9 h-9 flex-shrink-0 mt-0.5">
                {node.profileImage || node.photoURL ? (
                  <>
                    <img
                      src={node.profileImage || node.photoURL}
                      alt={node.userName || node.name}
                      className={`w-9 h-9 rounded-full object-cover border-2 ${avatarClass}`}
                      style={{ display: "block" }}
                      onError={(e) => {
                        e.target.style.display = "none";
                        if (e.target.nextSibling) {
                          e.target.nextSibling.style.display = "flex";
                        }
                      }}
                    />
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 ${avatarClass}`}
                      style={{ display: "none" }}
                    >
                      {node.userName?.charAt(0).toUpperCase() ||
                        node.name?.charAt(0).toUpperCase() ||
                        "?"}
                    </div>
                  </>
                ) : (
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 ${avatarClass}`}
                  >
                    {node.userName?.charAt(0).toUpperCase() ||
                      node.name?.charAt(0).toUpperCase() ||
                      "?"}
                  </div>
                )}
              </div>

              {/* Name + Info */}
              <div className="flex-1 min-w-0">
                {/* Name row with status badge on right */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Name and YOU badge */}
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className={`text-sm font-bold break-words ${nameClass}`}>
                        {node.userName || node.name}
                      </span>
                      {isCurrentUser && (
                        <span className="text-[9px] bg-yellow-300 text-yellow-900 border border-yellow-400 px-1.5 py-0.5 rounded-full font-bold uppercase">
                          YOU
                        </span>
                      )}
                      {node.isCoCoach && (
                        <span className="text-[9px] bg-purple-200 text-purple-800 border border-purple-400 px-1.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-0.5">
                          <Users className="w-2.5 h-2.5" />
                          CO-COACH
                        </span>
                      )}
                      {/* Shared Team Badge - when viewing yourself as a co-coach */}
                      {isCurrentUser && node.uplineCoachName && node.uplineCoCoachName && (
                        <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-400 px-1.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-0.5">
                          <Users className="w-2 h-2" />
                          SHARED TEAM
                        </span>
                      )}
                    </div>
                    {/* Reports to - Coach and Co-Coach */}
                    {(node.uplineCoachName || node.uplineCoCoachName) && (
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {isCurrentUser && node.uplineCoachName && node.uplineCoCoachName ? (
                          <>
                            <span className="text-amber-600 font-semibold">Co-Coach Partnership:</span>{" "}
                            <span className="font-medium text-gray-700">
                              {node.uplineCoachName}
                            </span>
                            <span className="text-gray-400"> & </span>
                            <span className="font-medium text-gray-700">
                              {node.uplineCoCoachName}
                            </span>
                          </>
                        ) : (
                          <>
                            Reports to:{" "}
                            {node.uplineCoachName && (
                              <span className="font-medium text-gray-700">
                                {node.uplineCoachName}
                              </span>
                            )}
                            {node.uplineCoachName && node.uplineCoCoachName && (
                              <span className="text-gray-400"> & </span>
                            )}
                            {node.uplineCoCoachName && (
                              <span className="font-medium text-gray-700">
                                {node.uplineCoCoachName}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {/* Team member count */}
                    {hasChildren && showTeamCount && (
                      <div className="flex items-center gap-1 mt-1">
                        <Users className="h-3 w-3 text-blue-600" />
                        <span className="text-[10px] text-blue-600 font-medium">
                          {node.teamMembers.length} team member
                          {node.teamMembers.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Status Badge - right side */}
                  {renderStatus && (
                    <div className="flex-shrink-0 mt-0.5">
                      {renderStatus(node, showDetails)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Expanded Details Section */}
          {renderExpandedDetails && (
            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t overflow-hidden"
                >
                  {renderExpandedDetails(node, level, isCurrentUser)}
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Stats Strip */}
          {renderStats && (
            <div
              className={`flex items-center divide-x px-3 py-2 border-t ${statsBorderClass}`}
            >
              {renderStats(node, level, isCurrentUser)}
            </div>
          )}

          {/* Expand/Collapse Children Button */}
          {hasChildren && (
            <div className="border-t border-gray-100">
              <TouchFeedbackButton
                onClick={() => setExpanded(!expanded)}
                className="w-full py-2 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <span className="text-xs font-medium text-gray-600">
                  {expanded ? "Hide" : "Show"} {node.teamMembers.length} team
                  member
                  {node.teamMembers.length !== 1 ? "s" : ""}
                </span>
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
                )}
              </TouchFeedbackButton>
            </div>
          )}
        </div>

        {/* Children Nodes */}
        {hasChildren && expanded && (
          <div className="mt-2 space-y-0">
            {node.teamMembers
              .filter((child, index) => {
                // If showFullTeam is true, show all children
                // If showFullTeam is false, only show if we're at level 0 (direct reports)
                return showFullTeam || level === 0;
              })
              .map((child, index, filteredArray) => (
                <HierarchicalNode
                  key={child.userId || child.id || index}
                  node={child}
                  level={level + 1}
                  isLastChild={index === filteredArray.length - 1}
                  renderStatus={renderStatus}
                  renderStats={renderStats}
                  renderExpandedDetails={renderExpandedDetails}
                  isCurrentUser={false}
                  showTeamCount={showTeamCount}
                  showFullTeam={showFullTeam}
                  getStatusStyle={getStatusStyle}
                  searchQuery={searchQuery}
                  filter={filter}
                  matchesFilter={matchesFilter}
                  matchesSearch={matchesSearch}
                  forceExpandedState={forceExpandedState}
                  defaultExpanded={defaultExpanded}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HierarchicalNode;
