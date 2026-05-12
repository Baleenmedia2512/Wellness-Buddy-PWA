import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SelfLogo, DirectLogo, FullTeamLogo } from "../shared/components/common/DisciplineScoreLogos";
import { TeamMemberProfileModal } from "../features/user";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

const PROGRAMS = [
  {
    id: "family-breakfast",
    name: "Family Healthy Breakfast Programme",
    icon: "ðŸ¥—",
  },
  { id: "weight-loss", name: "Weight Loss", icon: "ðŸ“‰" },
  { id: "weight-gain", name: "Weight Gain", icon: "ðŸ“ˆ" },
  { id: "kids-nutrition", name: "Kids Nutrition", icon: "ðŸ§’" },
  { id: "sports-nutrition", name: "Sports Nutrition", icon: "ðŸƒ" },
  { id: "targeted-nutrition", name: "Targeted Nutrition", icon: "ðŸŽ¯" },
  { id: "earn-product-cost", name: "How to Earn My Product Cost", icon: "ðŸ’°" },
  { id: "extra-income", name: "Extra Income Opportunity", icon: "ðŸ’¼" },
];

const WellnessUniversityReport = ({ onClose, user, userRole }) => {
  const [enrollments, setEnrollments] = useState([]);
  const [allTeamMembers, setAllTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedProgram, setExpandedProgram] = useState(null);
  const [viewType, setViewType] = useState(null); // 'mine', 'direct', 'full'
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showNotEnrolled, setShowNotEnrolled] = useState(true); // Toggle for showing non-enrolled members
  const [expandedNodes, setExpandedNodes] = useState(new Set()); // For hierarchy expansion
  const [searchQuery, setSearchQuery] = useState(""); // Search bar
  const [showSuggestions, setShowSuggestions] = useState(false); // Dropdown
  const [currentUserName, setCurrentUserName] = useState(""); // Logged-in user's name
  const [profileModalEmail, setProfileModalEmail] = useState(null); // Profile viewer modal

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const cacheBuster = Date.now();

      // Get current user ID first
      const userProfileResponse = await fetch(
        `${API_BASE}/api/user/profile?email=${encodeURIComponent(
          user.email,
        )}&_t=${cacheBuster}`,
      );
      const userProfileData = await userProfileResponse.json();

      if (userProfileData.success && userProfileData.data?.userId) {
        setCurrentUserId(userProfileData.data.userId);
        const name = userProfileData.data?.UserName || userProfileData.data?.userName || user?.displayName || "";
        setCurrentUserName(name);
        setSearchQuery(name); // Pre-fill search with logged-in username
      }

      // Fetch team hierarchy FIRST to get proper CoachId/CoCoachId relationships
      let teamMembers = [];
      let myDirectTeamIds = []; // Track who reports directly to you

      try {
        // Use coachId if available, otherwise fall back to email
        const userId = userProfileData.data?.userId;
        const teamUrl = userId
          ? `${API_BASE}/api/coach/team-hierarchy?coachId=${userId}&includeInactive=true&_t=${cacheBuster}`
          : `${API_BASE}/api/coach/team-hierarchy?email=${encodeURIComponent(
              user.email,
            )}&includeInactive=true&_t=${cacheBuster}`;

        console.log("ðŸ“¡ Fetching team hierarchy:", teamUrl);

        const teamResponse = await fetch(teamUrl);

        if (!teamResponse.ok) {
          const errorText = await teamResponse.text();
          console.error(
            "âŒ Team hierarchy API failed:",
            teamResponse.status,
            errorText,
          );
          throw new Error(`API returned ${teamResponse.status}: ${errorText}`);
        }

        const teamData = await teamResponse.json();

        if (
          teamData.success &&
          teamData.allMembers &&
          teamData.allMembers.length > 0
        ) {
          console.log(
            "âœ… Team hierarchy loaded:",
            teamData.allMembers?.length,
            "members",
          );
          console.log(
            "ðŸ‘¥ All team members from API (detailed):",
            teamData.allMembers.map((m) => ({
              name: m.UserName || m.Email,
              userId: m.UserId,
              coachId: m.CoachId,
              coCoachId: m.CoCoachId,
              coachName: m.coachName,
              coCoachName: m.coCoachName,
              status: m.Status,
            })),
          );
          console.log(
            "ðŸ“Š Hierarchy structure:",
            JSON.stringify(teamData.hierarchy, null, 2),
          );

          // Get current user ID as number for filtering
          const currentUserIdNum = Number(userProfileData.data?.userId);
          console.log("ðŸ” Current User ID:", currentUserIdNum);

          // Store ALL team members for building full hierarchy
          // Don't filter - we need everyone to calculate full team
          teamMembers = teamData.allMembers || [];

          console.log("âœ… Stored all team members:", teamMembers.length);
          console.log(
            "ðŸ‘¥ Team members:",
            teamMembers.map((m) => ({
              name: m.UserName,
              userId: m.UserId,
              coachId: m.CoachId,
              reportsTo: m.coachName,
            })),
          );

          // Track direct reports separately (for di...rect team calculation)
          myDirectTeamIds = teamMembers
            .filter((member) => {
              const memberUserId = Number(member.UserId);
              const memberCoachId = Number(member.CoachId);
              const memberCoCoachId = Number(member.CoCoachId);

              return (
                (memberCoachId === currentUserIdNum ||
                  memberCoCoachId === currentUserIdNum) &&
                memberUserId !== currentUserIdNum
              );
            })
            .map((m) => Number(m.UserId));

          console.log("âœ… Direct team IDs:", myDirectTeamIds);

          setAllTeamMembers(teamMembers);
        } else {
          console.warn("âš ï¸ Team hierarchy returned no members");
        }
      } catch (teamErr) {
        console.error("âŒ Team hierarchy API failed:", teamErr);
      }

      // Fetch enrollments
      const response = await fetch(
        `${API_BASE}/api/wellness-university/get-enrollments?email=${encodeURIComponent(
          user.email,
        )}&_t=${cacheBuster}`,
      );
      const data = await response.json();

      if (data.success) {
        console.log(
          "âœ… Enrollments loaded:",
          data.enrollments?.length,
          "enrollments",
        );
        console.log("Sample enrollment data:", data.enrollments[0]);
        setEnrollments(data.enrollments || []);

        // If team hierarchy failed, use enrollments as fallback
        if (teamMembers.length === 0) {
          console.warn("âš ï¸ Using enrollments as team members (fallback)");
          setAllTeamMembers(data.enrollments || []);
        }
      } else {
        setError(data.message || "Failed to load enrollments");
      }
    } catch (err) {
      console.error("Error fetching enrollments:", err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  // Calculate program statistics
  const calculateProgramStats = () => {
    const stats = {};

    PROGRAMS.forEach((program) => {
      const programName = program.name;

      // Filter enrollments for this program
      const programEnrollments = enrollments.filter((enrollment) => {
        const raw = JSON.parse(enrollment.EnrolledPrograms || "[]");
        const programs = Array.isArray(raw) ? raw : Object.keys(raw);
        return programs.includes(programName);
      });

      console.log(
        `[${programName}] Program enrollments:`,
        programEnrollments.length,
      );

      // Mine: Check if current user enrolled
      const myEnrollment = programEnrollments.find(
        (e) => e.UserId === currentUserId,
      );
      const mine = myEnrollment ? 1 : 0;

      // If we have team hierarchy data, use it
      if (allTeamMembers.length > 0) {
        console.log(
          `[${programName}] Using team members path. Total members:`,
          allTeamMembers.length,
        );
        console.log(
          `[${programName}] Current user ID:`,
          currentUserId,
          "Type:",
          typeof currentUserId,
        );
        console.log(
          `[${programName}] All team members in data:`,
          allTeamMembers.map((m) => ({
            UserId: m.UserId,
            UserName: m.UserName,
            CoachId: m.CoachId,
            CoCoachId: m.CoCoachId,
          })),
        );

        // Convert currentUserId to number for comparison
        const currentUserIdNum = Number(currentUserId);

        // Get all direct team members (CoachId or CoCoachId = currentUserId)
        const allDirectMembers = allTeamMembers.filter((member) => {
          const memberUserId = Number(member.UserId);
          const memberCoachId = Number(member.CoachId);
          const memberCoCoachId = Number(member.CoCoachId);

          const coachIdMatch = memberCoachId === currentUserIdNum;
          const coCoachIdMatch = memberCoCoachId === currentUserIdNum;
          const notSelf = memberUserId !== currentUserIdNum;
          const isDirect = (coachIdMatch || coCoachIdMatch) && notSelf;

          if (!notSelf || isDirect) {
            console.log(
              `[${programName}] Member:`,
              member.UserName || member.Email,
              "| UserId:",
              memberUserId,
              "| CoachId:",
              memberCoachId,
              "| CoCoachId:",
              memberCoCoachId,
              "| CoachMatch:",
              coachIdMatch,
              "| CoCoachMatch:",
              coCoachIdMatch,
              "| NotSelf:",
              notSelf,
              "| âœ… IsDirect:",
              isDirect,
            );
          }

          return isDirect;
        });

        console.log(
          `[${programName}] âœ… Direct members found:`,
          allDirectMembers.length,
        );
        console.log(
          `[${programName}] âœ… Direct members:`,
          allDirectMembers.map((m) => m.UserName || m.Email),
        );

        // Build FULL TEAM recursively - all members in downline hierarchy
        // IMPORTANT: Use allTeamMembers (ALL team members) not just enrolled ones
        const buildFullTeam = (startMembers, allMembers) => {
          const fullTeam = new Map(); // Use Map to avoid duplicates
          const queue = [...startMembers];

          console.log(
            `[${programName}] ðŸ”§ Building full team from ${startMembers.length} direct members`,
          );
          console.log(
            `[${programName}] ðŸ”§ Using ${allMembers.length} total members for hierarchy traversal`,
          );
          console.log(
            `[${programName}] ðŸ”§ All members sample:`,
            allMembers.slice(0, 5).map((m) => ({
              UserId: m.UserId,
              UserName: m.UserName,
              CoachId: m.CoachId,
              CoCoachId: m.CoCoachId,
            })),
          );

          while (queue.length > 0) {
            const current = queue.shift();
            const currentUserId = Number(current.UserId);

            // Add current member to full team
            if (!fullTeam.has(currentUserId)) {
              fullTeam.set(currentUserId, current);
              console.log(
                `[${programName}] âž• Added to full team:`,
                current.UserName || current.Email,
                "(UserId:",
                currentUserId,
                ")",
              );

              // Find all members who report to this person
              const subTeam = allMembers.filter((m) => {
                const mCoachId = Number(m.CoachId);
                const mCoCoachId = Number(m.CoCoachId);
                const mUserId = Number(m.UserId);

                // Check if this member reports to current user
                const reportsToAsPrimaryCoach =
                  mCoachId === currentUserId && mUserId !== currentUserId;
                const reportsToAsCoCoach =
                  mCoCoachId === currentUserId &&
                  mUserId !== currentUserId &&
                  mCoachId !== currentUserId;
                const isSubTeamMember =
                  reportsToAsPrimaryCoach || reportsToAsCoCoach;

                if (isSubTeamMember) {
                  console.log(
                    `[${programName}] ðŸ‘¤ Found sub-team member:`,
                    m.UserName || m.Email,
                    "(UserId:",
                    mUserId,
                    "CoachId:",
                    mCoachId,
                    "CoCoachId:",
                    mCoCoachId,
                    ")",
                    "reports to",
                    current.UserName || current.Email,
                    "(UserId:",
                    currentUserId,
                    ")",
                  );
                }

                return isSubTeamMember;
              });

              console.log(
                `[${programName}] ðŸ“‹ ${current.UserName || current.Email} has ${
                  subTeam.length
                } direct reports`,
              );

              // Add sub-team members to queue for processing
              subTeam.forEach((member) => {
                if (!fullTeam.has(Number(member.UserId))) {
                  queue.push(member);
                }
              });
            }
          }

          const result = Array.from(fullTeam.values());
          console.log(
            `[${programName}] âœ… Full team build complete: ${result.length} members`,
          );
          return result;
        };

        // Use allTeamMembers (from team-hierarchy API) for building full hierarchy
        // This includes ALL team members regardless of enrollment status
        const allFullMembers = buildFullTeam(allDirectMembers, allTeamMembers);

        console.log(
          `[${programName}] ðŸ“Š Full team members (entire downline):`,
          allFullMembers.length,
        );
        console.log(
          `[${programName}] ðŸ“Š Full team:`,
          allFullMembers.map((m) => m.UserName || m.Email),
        );

        // Split into enrolled and unenrolled for direct team
        const directEnrolled = [];
        const directNotEnrolled = [];

        allDirectMembers.forEach((member) => {
          const enrollment = programEnrollments.find(
            (e) => e.UserId === member.UserId,
          );
          if (enrollment) {
            directEnrolled.push({
              ...member,
              ...enrollment,
              isEnrolled: true,
              CoachName: enrollment.CoachName || member.coachName || "",
            });
          } else {
            directNotEnrolled.push({
              ...member,
              isEnrolled: false,
              CoachName: member.coachName || "",
              UserName: member.UserName || "Unknown",
            });
          }
        });

        // Split into enrolled and unenrolled for full team
        const fullEnrolled = [];
        const fullNotEnrolled = [];

        console.log(
          `[${programName}] ðŸ” Processing full team members:`,
          allFullMembers.length,
        );
        allFullMembers.forEach((member) => {
          console.log(
            `[${programName}] Full team member:`,
            member.UserName,
            "| UserId:",
            member.UserId,
            "| CoachId:",
            member.CoachId,
          );
          const enrollment = programEnrollments.find(
            (e) => e.UserId === member.UserId,
          );
          if (enrollment) {
            fullEnrolled.push({
              ...member,
              ...enrollment,
              isEnrolled: true,
              CoachName: enrollment.CoachName || member.coachName || "",
            });
          } else {
            fullNotEnrolled.push({
              ...member,
              isEnrolled: false,
              CoachName: member.coachName || "",
              UserName: member.UserName || "Unknown",
            });
          }
        });

        console.log(
          `[${programName}] ðŸ“Š Full enrolled:`,
          fullEnrolled.length,
          fullEnrolled.map((m) => m.UserName),
        );
        console.log(
          `[${programName}] ðŸ“Š Full unenrolled:`,
          fullNotEnrolled.length,
          fullNotEnrolled.map((m) => m.UserName),
        );

        // Combine: enrolled first, then unenrolled
        const directTeamMembers = [...directEnrolled, ...directNotEnrolled];
        const fullTeamMembers = [...fullEnrolled, ...fullNotEnrolled];

        stats[programName] = {
          mine,
          directTeam: directEnrolled.length,
          fullTeam: fullEnrolled.length,
          directTeamMembers,
          fullTeamMembers,
          directEnrolledCount: directEnrolled.length,
          fullEnrolledCount: fullEnrolled.length,
        };
      } else {
        // Fallback: Use enrollment data with CoachId/CoCoachId to determine hierarchy
        console.log(
          `[${programName}] Using fallback - CurrentUserId:`,
          currentUserId,
        );
        console.log(
          `[${programName}] Sample enrollment:`,
          programEnrollments[0],
        );

        // Convert to numbers for comparison
        const currentUserIdNum = Number(currentUserId);

        const directEnrolledMembers = programEnrollments
          .filter((e) => {
            const memberUserId = Number(e.UserId);
            const memberCoachId = Number(e.CoachId);
            const memberCoCoachId = Number(e.CoCoachId);

            const isDirect =
              memberUserId !== currentUserIdNum &&
              (memberCoachId === currentUserIdNum ||
                memberCoCoachId === currentUserIdNum);
            if (isDirect) {
              console.log(
                `[${programName}] Direct member found:`,
                e.UserName,
                "CoachId:",
                memberCoachId,
                "CoCoachId:",
                memberCoCoachId,
              );
            }
            return isDirect;
          })
          .map((e) => ({
            ...e,
            isEnrolled: true,
            CoachName: e.CoachName || "",
            UserName: e.UserName || "Unknown",
          }));

        const fullEnrolledMembers = programEnrollments
          .filter((e) => Number(e.UserId) !== currentUserIdNum)
          .map((e) => ({
            ...e,
            isEnrolled: true,
            CoachName: e.CoachName || "",
            UserName: e.UserName || "Unknown",
          }));

        console.log(
          `[${programName}] Direct enrolled:`,
          directEnrolledMembers.length,
          "Full enrolled:",
          fullEnrolledMembers.length,
        );

        stats[programName] = {
          mine,
          directTeam: directEnrolledMembers.length,
          fullTeam: fullEnrolledMembers.length,
          directTeamMembers: directEnrolledMembers,
          fullTeamMembers: fullEnrolledMembers,
          directEnrolledCount: directEnrolledMembers.length,
          fullEnrolledCount: fullEnrolledMembers.length,
        };
      }
    });

    console.log("Program stats calculated:", stats);
    return stats;
  };

  const programStats = calculateProgramStats();

  // Always show individual view â€” for self when empty, for searched member when typed
  const q = searchQuery.toLowerCase().trim();
  const isSearchingAnyone = true;
  const isSearchingOther = q.length > 0 && !currentUserName.toLowerCase().includes(q);

  // Find the member to show â€” logged-in user by default, searched member if typed
  const searchedMember = isSearchingOther
    ? allTeamMembers.find(
        (m) =>
          (m.UserName || "").toLowerCase().includes(q) ||
          (m.Email || "").toLowerCase().includes(q)
      )
    : { UserId: currentUserId, UserName: currentUserName, Email: user?.email || "" };

  const searchedMemberRec = searchedMember
    ? enrollments.find((e) => e.UserId === searchedMember.UserId)
    : null;

  const searchedMemberEnrolledPrograms = (() => {
    if (!searchedMemberRec) return [];
    try {
      const parsed = JSON.parse(searchedMemberRec.EnrolledPrograms || "[]");
      return Array.isArray(parsed) ? parsed : Object.keys(parsed);
    } catch { return []; }
  })();

  // Returns per-program date if map format, otherwise falls back to record-level date
  const getSearchedMemberProgramDate = (programName) => {
    if (!searchedMemberRec) return null;
    try {
      const parsed = JSON.parse(searchedMemberRec.EnrolledPrograms || "[]");
      if (!Array.isArray(parsed) && parsed[programName]) return parsed[programName];
    } catch {}
    return searchedMemberRec.EnrollmentDate || searchedMemberRec.LastUpdated || searchedMemberRec.CreatedAt || null;
  };

  // When a name search is active, filter counts to only show that member's data
  const getFilteredStats = (stats) => {
    if (!searchQuery.trim()) return stats;
    const q = searchQuery.toLowerCase();

    // Always filter team members by search
    const filteredDirect = (stats.directTeamMembers || []).filter((m) =>
      (m.UserName || m.name || "").toLowerCase().includes(q) ||
      (m.Email || m.email || "").toLowerCase().includes(q)
    );
    const filteredFull = (stats.fullTeamMembers || []).filter((m) =>
      (m.UserName || m.name || "").toLowerCase().includes(q) ||
      (m.Email || m.email || "").toLowerCase().includes(q)
    );

    // Keep "mine" tick only if the logged-in user's own name matches the search
    const selfMatches = currentUserName.toLowerCase().includes(q);

    return {
      ...stats,
      mine: selfMatches ? stats.mine : 0,
      directTeam: filteredDirect.filter((m) => m.isEnrolled).length,
      fullTeam: filteredFull.filter((m) => m.isEnrolled).length,
      directTeamMembers: filteredDirect,
      fullTeamMembers: filteredFull,
    };
  };
  const collectAllNodeIds = (nodes) => {
    const ids = [];
    const traverse = (nodeList) => {
      nodeList.forEach((node) => {
        ids.push(node.userId);
        if (node.teamMembers && node.teamMembers.length > 0) {
          traverse(node.teamMembers);
        }
      });
    };
    traverse(nodes);
    return ids;
  };

  // Handle view type click
  const handleViewClick = (programName, type) => {
    if (expandedProgram === programName && viewType === type) {
      // Close if clicking the same view
      setExpandedProgram(null);
      setViewType(null);
      setExpandedNodes(new Set());
    } else {
      setExpandedProgram(programName);
      setViewType(type);

      // Auto-expand all nodes when viewing FULL TEAM
      if (type === "full") {
        const stats = programStats[programName];
        if (stats && stats.fullTeamMembers) {
          const hierarchy = buildHierarchy(stats.fullTeamMembers);
          if (hierarchy) {
            const allIds = collectAllNodeIds(hierarchy);
            setExpandedNodes(new Set(allIds));
          }
        }
      } else {
        setExpandedNodes(new Set());
      }
    }
  };

  // Build hierarchical structure from flat member list
  const buildHierarchy = (members) => {
    if (!members || members.length === 0) return null;

    // Create a map of userId to member
    const memberMap = new Map();
    members.forEach((member) => {
      memberMap.set(member.UserId, {
        userId: member.UserId,
        userName: member.UserName || "Unknown",
        email: member.Email,
        role: member.Role || "member",
        coachId: member.CoachId,
        coCoachId: member.CoCoachId,
        coachName: member.CoachName || "",
        coCoachName: member.CoCoachName || "",
        isEnrolled: member.isEnrolled !== false,
        isCoCoach: member.isCoCoach || false,
        teamMembers: [],
      });
    });

    // Build parent-child relationships
    const rootNodes = [];
    memberMap.forEach((member) => {
      const hasCoach = member.coachId && memberMap.has(member.coachId);
      const hasCoCoach = member.coCoachId && memberMap.has(member.coCoachId);

      if (hasCoach) {
        // Add to coach's team
        const coach = memberMap.get(member.coachId);
        if (!coach.teamMembers.some((m) => m.userId === member.userId)) {
          coach.teamMembers.push(member);
        }
      } else if (hasCoCoach) {
        // Add to co-coach's team
        const coCoach = memberMap.get(member.coCoachId);
        if (!coCoach.teamMembers.some((m) => m.userId === member.userId)) {
          coCoach.teamMembers.push(member);
        }
      } else {
        // This is a root node (direct report of current user)
        rootNodes.push(member);
      }
    });

    return rootNodes;
  };

  // Render hierarchical tree view
  const renderHierarchyView = (members, programName) => {
    if (!members || members.length === 0) {
      return (
        <div className="text-center py-6 sm:py-8 text-gray-500 text-sm sm:text-base">
          No members found
        </div>
      );
    }

    const hierarchy = buildHierarchy(members);

    if (!hierarchy || hierarchy.length === 0) {
      return (
        <div className="text-center py-6 sm:py-8 text-gray-500 text-sm sm:text-base">
          No team hierarchy available
        </div>
      );
    }

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

    const handleExpandAll = () => {
      const allIds = collectAllNodeIds(hierarchy);
      setExpandedNodes(new Set(allIds));
    };

    const handleCollapseAll = () => {
      setExpandedNodes(new Set());
    };

    const allIds = collectAllNodeIds(hierarchy);
    const isAllExpanded = allIds.length > 0 && allIds.every((id) => expandedNodes.has(id));
    const isAllCollapsed = expandedNodes.size === 0;

    // Recursive component to render tree node
    const TreeNode = ({ node, level = 0, isLastChild = false }) => {
      const isExpanded = expandedNodes.has(node.userId);
      const hasChildren = node.teamMembers && node.teamMembers.length > 0;
      const isEnrolled = node.isEnrolled !== false;

      return (
        <div className="relative flex">
          {/* Tree Connector Lines */}
          {/* Co-coach has no line to show they're at same level as coach */}
          {level > 0 && !node.isCoCoach && (
            <div className="relative flex-shrink-0" style={{ width: "24px" }}>
              <div
                className="absolute top-[28px] left-0 h-[2px] bg-gray-400"
                style={{ width: "24px" }}
              />
              {!isLastChild && (
                <div
                  className="absolute left-0 top-0 w-[2px] bg-gray-400"
                  style={{ height: "calc(100% + 8px)" }}
                />
              )}
              {isLastChild && (
                <div
                  className="absolute left-0 top-0 w-[2px] bg-gray-400"
                  style={{ height: "28px" }}
                />
              )}
            </div>
          )}

          {/* Node Content */}
          <div className="flex-1 mb-2 w-full">
            <div
              className={`rounded-lg p-2.5 border shadow-sm transition-all ${
                node.isCoCoach
                  ? "bg-purple-50/60 border-purple-300 ring-1 ring-purple-200"
                  : isEnrolled
                  ? "bg-white border-green-200"
                  : "bg-gray-50 border-gray-300 opacity-60"
              }`}
            >
              <div className="flex items-center gap-2">
                {/* Expand/Collapse Button */}
                {hasChildren && (
                  <button
                    onClick={() => handleToggleExpand(node.userId)}
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100"
                  >
                    <svg
                      className="w-4 h-4 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {isExpanded ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      ) : (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      )}
                    </svg>
                  </button>
                )}
                {!hasChildren && <div className="w-6" />}

                {/* Avatar */}
                <div
                  className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    isEnrolled
                      ? "bg-gradient-to-br from-green-400 to-teal-400"
                      : "bg-gray-400"
                  }`}
                >
                  {node.userName?.charAt(0).toUpperCase() || "U"}
                </div>

                {/* Member Info */}
                <div className="flex-1 min-w-0">
                  <h4
                    className={`font-semibold text-xs sm:text-sm truncate ${
                      isEnrolled ? "text-gray-800" : "text-gray-500"
                    }`}
                  >
                    {node.userName}
                    {node.isCoCoach && (
                      <span className="ml-1.5 text-[9px] bg-purple-100 text-purple-700 border border-purple-300 px-1.5 py-0.5 rounded-full font-bold">
                        CO-COACH
                      </span>
                    )}
                    {level === 0 && !node.isCoCoach && (
                      <span className="ml-1.5 text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">
                        DIRECT
                      </span>
                    )}
                  </h4>
                  <p
                    className={`text-[10px] sm:text-xs truncate ${
                      isEnrolled ? "text-gray-600" : "text-gray-400"
                    }`}
                  >
                    {node.email}
                  </p>
                  {hasChildren && (
                    <p className="text-[10px] text-blue-600 font-medium mt-0.5">
                      {node.teamMembers.length} team member
                      {node.teamMembers.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                {/* Enrollment Status. */}
                <div className="flex-shrink-0">
                  {isEnrolled ? (
                    <div className="bg-green-100 text-green-700 text-[10px] sm:text-xs font-medium px-2 py-1 rounded whitespace-nowrap">
                      âœ“ Enrolled
                    </div>
                  ) : (
                    <div className="bg-gray-200 text-gray-500 text-[10px] sm:text-xs font-medium px-2 py-1 rounded whitespace-nowrap">
                      Unenrolled
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Render Children */}
            {isExpanded && hasChildren && (
              <div className="mt-1 ml-0">
                {node.teamMembers.map((child, index) => (
                  <TreeNode
                    key={child.userId}
                    node={child}
                    level={level + 1}
                    isLastChild={index === node.teamMembers.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-3">
        {/* Expand All / Collapse All toolbar */}
        <div className="flex justify-end gap-2 mb-1">
          <button
            onClick={handleExpandAll}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isAllExpanded
                ? "bg-green-600 text-white border-green-600 shadow-sm"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 3l-7 7-7-7" />
            </svg>
            Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isAllCollapsed
                ? "bg-green-600 text-white border-green-600 shadow-sm"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 21l7-7 7 7" />
            </svg>
            Collapse All
          </button>
        </div>

        {hierarchy.map((node, index) => (
          <TreeNode
            key={node.userId}
            node={node}
            level={0}
            isLastChild={index === hierarchy.length - 1}
          />
        ))}
      </div>
    );
  };

  // Render member list
  const renderMemberList = (members) => {
    if (!members || members.length === 0) {
      return (
        <div className="text-center py-6 sm:py-8 text-gray-500 text-sm sm:text-base">
          No members found
        </div>
      );
    }

    // Filter members based on showNotEnrolled toggle
    const filteredMembers = showNotEnrolled
      ? members
      : members.filter((m) => m.isEnrolled !== false);

    if (filteredMembers.length === 0) {
      return (
        <div className="text-center py-6 sm:py-8 text-gray-500 text-sm sm:text-base">
          No enrolled members found
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {filteredMembers.map((member, index) => {
          const isEnrolled = member.isEnrolled !== false;

          return (
            <div
              key={`${member.Email}-${index}`}
              className={`rounded-lg p-2.5 sm:p-3 border shadow-sm transition-all ${
                isEnrolled
                  ? "bg-white border-gray-200"
                  : "bg-gray-50 border-gray-300 opacity-50"
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base ${
                    isEnrolled
                      ? "bg-gradient-to-br from-green-400 to-teal-400"
                      : "bg-gray-400"
                  }`}
                >
                  {member.UserName?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <h4
                    className={`font-semibold text-xs sm:text-sm truncate ${
                      isEnrolled ? "text-gray-800" : "text-gray-500"
                    }`}
                  >
                    {member.UserName}
                  </h4>
                  <p
                    className={`text-[10px] sm:text-xs truncate ${
                      isEnrolled ? "text-gray-600" : "text-gray-400"
                    }`}
                  >
                    {member.Email}
                  </p>
                  {member.CoachName && (
                    <p
                      className={`text-[10px] sm:text-xs ${
                        isEnrolled ? "text-gray-500" : "text-gray-400"
                      }`}
                    >
                      Reports to: {member.CoachName}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {isEnrolled && member.LastUpdated && (
                    <div className="text-[10px] sm:text-xs text-gray-500">
                      {new Date(
                        member.LastUpdated || member.EnrollmentDate,
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  )}
                  {!isEnrolled && (
                    <div className="text-[10px] sm:text-xs text-gray-400 font-medium px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-200 rounded whitespace-nowrap">
                      Unenrolled
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
    <div className="fixed inset-0 bg-gray-50 z-50 overflow-y-auto">
      {/* Header */}
      <div className="bg-green-200 sticky top-0 z-10 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={onClose}
              className="text-gray-700 hover:bg-white hover:bg-opacity-50 rounded-full p-1.5 sm:p-2 transition-colors flex-shrink-0"
            >
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-gray-800 truncate">
                Wellness University Reprorts
              </h1>
              <p className="text-gray-700 text-xs hidden sm:block">
                Track program enrollments across your team
              </p>
            </div>
            <button
              onClick={fetchEnrollments}
              className="text-gray-700 hover:bg-white hover:bg-opacity-50 rounded-full p-1.5 sm:p-2 transition-colors flex-shrink-0"
              title="Refresh"
            >
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Search Bar */}
        <div className="mb-4 relative">
          <div className={`relative flex items-center bg-white border shadow-sm px-3 py-2.5 ${showSuggestions && searchQuery.trim() ? "rounded-t-2xl border-green-400 border-b-0" : "rounded-2xl border-gray-200"}`}>
            {/* Person icon - left */}
            <svg
              className="w-5 h-5 text-gray-400 flex-shrink-0 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Search by name or email..."
              className="flex-1 text-sm text-gray-700 placeholder-gray-400 bg-transparent focus:outline-none"
            />
            {searchQuery ? (
              <button
                onClick={() => { setSearchQuery(""); setShowSuggestions(false); }}
                className="ml-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && (() => {
            const q = searchQuery.toLowerCase().trim();
            const suggestions = [
              // Always include logged-in user at top if name matches (or no query)
              ...(!q || currentUserName.toLowerCase().includes(q) ? [{
                userId: currentUserId,
                name: currentUserName,
                email: user?.email || "",
                isSelf: true,
              }] : []),
              // Team members matching the query
              ...allTeamMembers
                .filter((m) =>
                  (!q ||
                    (m.UserName || "").toLowerCase().includes(q) ||
                    (m.Email || "").toLowerCase().includes(q))
                )
                .map((m) => ({
                  userId: m.UserId,
                  name: m.UserName || m.Email,
                  email: m.Email || "",
                  isSelf: false,
                }))
            ];

            if (suggestions.length === 0) return null;

            return (
              <div className="absolute left-0 right-0 bg-white border border-green-400 border-t-0 rounded-b-2xl shadow-lg z-50 max-h-56 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <button
                    key={s.userId || i}
                    onMouseDown={() => {
                      setSearchQuery(s.name);
                      setShowSuggestions(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate flex items-center gap-2">
                        {s.name}
                        {s.isSelf && (
                          <span className="text-xs font-semibold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">Me</span>
                        )}
                      </p>
                      {s.email && <p className="text-xs text-gray-400 truncate">{s.email}</p>}
                    </div>
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-20">
            <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-2 border-green-500 mb-4"></div>
            <p className="text-gray-600 text-sm sm:text-base">
              Loading enrollments...
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 sm:p-6 text-center">
            <p className="text-red-700 text-sm sm:text-base">{error}</p>
            <button
              onClick={fetchEnrollments}
              className="mt-4 bg-red-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-red-700 text-sm sm:text-base"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Programs List */}
            <div className="space-y-3 sm:space-y-4">
              {/* â”€â”€ INDIVIDUAL VIEW: any name is searched â”€â”€ */}
              {isSearchingAnyone ? (
                !searchedMember ? (
                  <div className="bg-gray-50 rounded-xl p-8 sm:p-12 text-center">
                    <div className="text-5xl sm:text-6xl mb-4">ðŸ”</div>
                    <p className="text-gray-600 text-base sm:text-lg">No member found</p>
                    <p className="text-gray-500 text-xs sm:text-sm mt-2">Try searching by a different name or email.</p>
                  </div>
                ) : (
                  <>
                    {/* Member Profile Card — only shown when searching for someone else */}
                    {isSearchingOther && (
                    <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-3 sm:p-4 flex items-center gap-3 mb-1">
                      <div
                        className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg cursor-pointer active:opacity-70"
                        onClick={() => setProfileModalEmail(searchedMember.Email)}
                        title="View full profile"
                      >
                        {(searchedMember.UserName || searchedMember.Email || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => setProfileModalEmail(searchedMember.Email)}
                          className="font-semibold text-blue-600 active:text-green-600 text-sm sm:text-base truncate block hover:underline transition-colors"
                          title="View full profile"
                        >
                          {searchedMember.UserName || searchedMember.Email}
                        </button>
                        <p className="text-xs text-gray-400 truncate">{searchedMember.Email}</p>
                      </div>
                    </div>
                    )}

                    {[...PROGRAMS]
                      .sort((a, b) => {
                        const aEnrolled = searchedMemberEnrolledPrograms.includes(a.name) ? 1 : 0;
                        const bEnrolled = searchedMemberEnrolledPrograms.includes(b.name) ? 1 : 0;
                        return bEnrolled - aEnrolled; // enrolled first
                      })
                      .map((program) => {
                      const isEnrolled = searchedMemberEnrolledPrograms.includes(program.name);
                      return (
                        <div key={program.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                          <div className="p-3 sm:p-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl flex items-center justify-center text-2xl sm:text-3xl">
                                {program.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-800 text-sm sm:text-base truncate">
                                  {program.name}
                                </h3>
                                {isEnrolled && (() => { const d = getSearchedMemberProgramDate(program.name); return d ? (
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" })}
                                    {" Â· "}
                                    {new Date(d).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                ) : null; })()}
                              </div>
                            </div>
                            <div className={`flex flex-col items-center px-4 py-2 rounded-xl border ${
                              isEnrolled
                                ? "bg-blue-50 border-blue-200"
                                : "bg-gray-50 border-gray-200"
                            }`}>
                              <SelfLogo className={`w-4 h-4 ${isEnrolled ? "text-blue-600" : "text-gray-400"}`} />
                              <div className={`text-[10px] font-bold mt-0.5 ${isEnrolled ? "text-blue-600" : "text-gray-400"}`}>Individual</div>
                              <div className={`text-xl font-bold ${isEnrolled ? "text-blue-600" : "text-gray-400"}`}>
                                {isEnrolled ? "âœ“" : "âœ—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )
              ) : (
              /* â”€â”€ NORMAL HIERARCHICAL VIEW â”€â”€ */
              <>
              {PROGRAMS.filter((program) => {
                const rawStats = programStats[program.name] || {
                  mine: 0, directTeam: 0, fullTeam: 0,
                  directTeamMembers: [], fullTeamMembers: [],
                };
                const stats = getFilteredStats(rawStats);
                const hasEnrollments = stats.mine > 0 || stats.directTeam > 0 || stats.fullTeam > 0;
                return hasEnrollments;
              }).length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-8 sm:p-12 text-center">
                  <div className="text-5xl sm:text-6xl mb-4">ðŸ“‹</div>
                  <p className="text-gray-600 text-base sm:text-lg">
                    No enrollments found
                  </p>
                  <p className="text-gray-500 text-xs sm:text-sm mt-2">
                    Be the first to enroll in a program!
                  </p>
                </div>
              ) : (
                <>
                  {PROGRAMS.map((program) => {
                    const stats = getFilteredStats(programStats[program.name] || {
                      mine: 0,
                      directTeam: 0,
                      fullTeam: 0,
                      directTeamMembers: [],
                      fullTeamMembers: [],
                    });
                    // Hide programs with no enrollments
                    if (
                      stats.mine === 0 &&
                      stats.directTeam === 0 &&
                      stats.fullTeam === 0
                    ) {
                      return null;
                    }

                    const isExpanded = expandedProgram === program.name;

                    return (
                      <div
                        key={program.id}
                        className="bg-white rounded-xl shadow-md overflow-hidden"
                      >
                        {/* Program Header - Responsive Layout */}
                        <div className="p-3 sm:p-4">
                          {/* Mobile: Stacked Layout (< 640px) */}
                          <div className="sm:hidden space-y-3">
                            {/* Program Name */}
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl flex items-center justify-center text-2xl">
                                {program.icon}
                              </div>
                              <h3 className="font-semibold text-gray-800 text-sm flex-1 min-w-0">
                                {program.name}
                              </h3>
                            </div>

                            {/* Metrics in 3 columns */}
                            <div className="grid grid-cols-3 gap-2">
                              {/* Mine - Mobile */}
                              <div
                                onClick={() =>
                                  stats.mine > 0 &&
                                  handleViewClick(program.name, "mine")
                                }
                                className={`px-2 py-2 rounded-lg border transition-all ${
                                  stats.mine > 0
                                    ? "bg-blue-50 border-blue-200 cursor-pointer active:bg-blue-100"
                                    : "bg-gray-50 border-gray-200"
                                } ${
                                  isExpanded && viewType === "mine"
                                    ? "ring-2 ring-blue-400"
                                    : ""
                                }`}
                              >
                                <div className="flex flex-col items-center gap-0.5">
                                  <SelfLogo className="w-4 h-4 text-blue-600" />
                                  <div className="text-[10px] font-bold text-blue-600">Individual</div>
                                  <div className={`text-lg font-bold ${
                                    stats.mine > 0 ? "text-blue-600" : "text-gray-400"
                                  }`}>
                                    {stats.mine > 0 ? "âœ“" : "âœ—"}
                                  </div>
                                </div>
                              </div>

                              {/* Direct Team - Mobile */}
                              <div
                                onClick={() =>
                                  stats.directTeamMembers.length > 0 &&
                                  handleViewClick(program.name, "direct")
                                }
                                className={`px-2 py-2 rounded-lg border transition-all ${
                                  stats.directTeamMembers.length > 0
                                    ? "bg-green-50 border-green-200 cursor-pointer active:bg-green-100"
                                    : "bg-gray-50 border-gray-200"
                                } ${
                                  isExpanded && viewType === "direct"
                                    ? "ring-2 ring-green-400"
                                    : ""
                                }`}
                              >
                                <div className="flex flex-col items-center gap-0.5">
                                  <DirectLogo className="w-4 h-4 text-green-600" />
                                  <div className="text-[10px] font-bold text-green-600">DIRECT</div>
                                  <div className={`text-lg font-bold ${
                                    stats.directTeamMembers.length > 0 ? "text-green-600" : "text-gray-400"
                                  }`}>
                                    {stats.directTeam}
                                  </div>
                                </div>
                              </div>

                              {/* Full Team - Mobile */}
                              <div
                                onClick={() =>
                                  stats.fullTeamMembers.length > 0 &&
                                  handleViewClick(program.name, "full")
                                }
                                className={`px-2 py-2 rounded-lg border transition-all ${
                                  stats.fullTeamMembers.length > 0
                                    ? "bg-purple-50 border-purple-200 cursor-pointer active:bg-purple-100"
                                    : "bg-gray-50 border-gray-200"
                                } ${
                                  isExpanded && viewType === "full"
                                    ? "ring-2 ring-purple-400"
                                    : ""
                                }`}
                              >
                                <div className="flex flex-col items-center gap-0.5">
                                  <FullTeamLogo className="w-4 h-4 text-purple-600" />
                                  <div className="text-[10px] font-bold text-purple-600">FULL</div>
                                  <div className={`text-lg font-bold ${
                                    stats.fullTeamMembers.length > 0 ? "text-purple-600" : "text-gray-400"
                                  }`}>
                                    {stats.fullTeam}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Desktop: One Row Layout (>= 640px) */}
                          <div className="hidden sm:flex items-center justify-between gap-4">
                            {/* Left: Icon + Name */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-12 h-12 flex-shrink-0 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl flex items-center justify-center text-3xl">
                                {program.icon}
                              </div>
                              <h3 className="font-semibold text-gray-800 text-base truncate">
                                {program.name}
                              </h3>
                            </div>

                            {/* Right: Metrics in horizontal row */}
                            <div className="flex items-center gap-2">
                              {/* Mine - Desktop */}
                              <div
                                onClick={() =>
                                  stats.mine > 0 &&
                                  handleViewClick(program.name, "mine")
                                }
                                className={`px-3 py-2 rounded-lg border transition-all ${
                                  stats.mine > 0
                                    ? "bg-blue-50 border-blue-200 cursor-pointer hover:bg-blue-100"
                                    : "bg-gray-50 border-gray-200"
                                } ${
                                  isExpanded && viewType === "mine"
                                    ? "ring-2 ring-blue-400"
                                    : ""
                                }`}
                              >
                                <div className="flex flex-col items-center gap-0.5">
                                  <SelfLogo className="w-4 h-4 text-blue-600" />
                                  <div className="text-xs font-bold text-blue-600 whitespace-nowrap">Individual</div>
                                  <div className={`text-lg font-bold ${
                                    stats.mine > 0 ? "text-blue-600" : "text-gray-400"
                                  }`}>
                                    {stats.mine > 0 ? "âœ“" : "âœ—"}
                                  </div>
                                </div>
                              </div>

                              {/* Direct Team - Desktop */}
                              <div
                                onClick={() =>
                                  stats.directTeamMembers.length > 0 &&
                                  handleViewClick(program.name, "direct")
                                }
                                className={`px-3 py-2 rounded-lg border transition-all ${
                                  stats.directTeamMembers.length > 0
                                    ? "bg-green-50 border-green-200 cursor-pointer hover:bg-green-100"
                                    : "bg-gray-50 border-gray-200"
                                } ${
                                  isExpanded && viewType === "direct"
                                    ? "ring-2 ring-green-400"
                                    : ""
                                }`}
                              >
                                <div className="flex flex-col items-center gap-0.5">
                                  <DirectLogo className="w-4 h-4 text-green-600" />
                                  <div className="text-xs font-bold text-green-600 whitespace-nowrap">DIRECT</div>
                                  <div className={`text-lg font-bold ${
                                    stats.directTeamMembers.length > 0 ? "text-green-600" : "text-gray-400"
                                  }`}>
                                    {stats.directTeam}
                                  </div>
                                </div>
                              </div>

                              {/* Full Team - Desktop */}
                              <div
                                onClick={() =>
                                  stats.fullTeamMembers.length > 0 &&
                                  handleViewClick(program.name, "full")
                                }
                                className={`px-3 py-2 rounded-lg border transition-all ${
                                  stats.fullTeamMembers.length > 0
                                    ? "bg-purple-50 border-purple-200 cursor-pointer hover:bg-purple-100"
                                    : "bg-gray-50 border-gray-200"
                                } ${
                                  isExpanded && viewType === "full"
                                    ? "ring-2 ring-purple-400"
                                    : ""
                                }`}
                              >
                                <div className="flex flex-col items-center gap-0.5">
                                  <FullTeamLogo className="w-4 h-4 text-purple-600" />
                                  <div className="text-xs font-bold text-purple-600 whitespace-nowrap">FULL</div>
                                  <div className={`text-lg font-bold ${
                                    stats.fullTeamMembers.length > 0 ? "text-purple-600" : "text-gray-400"
                                  }`}>
                                    {stats.fullTeam}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Member List */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="border-t border-gray-200 bg-gray-50 p-3 sm:p-4">
                                {/* Header with Toggles */}
                                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                                  <h4 className="text-xs sm:text-sm font-semibold text-gray-700">
                                    {viewType === "mine" && "My Enrollment"}
                                    {viewType === "direct" &&
                                      `Direct Team (${stats.directEnrolledCount} / ${stats.directTeamMembers.length})`}
                                    {viewType === "full" &&
                                      `Full Team - Hierarchy View (${stats.fullEnrolledCount} / ${stats.fullTeamMembers.length})`}
                                  </h4>

                                  {/* Toggle button for non-enrolled members (only show for non-hierarchy views) */}
                                  {viewType === "direct" && (
                                    <button
                                      onClick={() =>
                                        setShowNotEnrolled(!showNotEnrolled)
                                      }
                                      className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all ${
                                        showNotEnrolled
                                          ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                          : "bg-green-100 text-green-700 hover:bg-green-200"
                                      }`}
                                    >
                                      {showNotEnrolled ? (
                                        <>
                                          <svg
                                            className="w-3 h-3 sm:w-4 sm:h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                                            />
                                          </svg>
                                          <span className="hidden sm:inline">
                                            Hide
                                          </span>{" "}
                                          Unenrolled
                                        </>
                                      ) : (
                                        <>
                                          <svg
                                            className="w-3 h-3 sm:w-4 sm:h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                            />
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                            />
                                          </svg>
                                          <span className="hidden sm:inline">
                                            Show
                                          </span>{" "}
                                          Unenrolled
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>

                                {viewType === "mine" && stats.mine > 0 && (
                                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 text-center">
                                    <div className="text-3xl sm:text-4xl mb-2">
                                      âœ…
                                    </div>
                                    <p className="text-blue-800 font-semibold text-sm sm:text-base">
                                      You're enrolled in this program!
                                    </p>
                                  </div>
                                )}
                                {viewType === "mine" && stats.mine === 0 && (
                                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 text-center">
                                    <div className="text-3xl sm:text-4xl mb-2">
                                      ðŸ“‹
                                    </div>
                                    <p className="text-gray-600 font-semibold text-sm sm:text-base">
                                      You're unenrolled in this program
                                    </p>
                                  </div>
                                )}
                                {viewType === "direct" &&
                                  renderMemberList(stats.directTeamMembers)}
                                {viewType === "full" &&
                                  renderHierarchyView(
                                    stats.fullTeamMembers,
                                    program.name,
                                  )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </>
              )}
              </> /* end normal hierarchical view */
              )} {/* end isSearchingAnyone ternary */}
            </div>
          </>
        )}
      </div>
    </div>

    {/* Member Profile Viewer Modal */}
    <TeamMemberProfileModal
      isOpen={!!profileModalEmail}
      onClose={() => setProfileModalEmail(null)}
      memberEmail={profileModalEmail}
    />
    </>
  );
};

export default WellnessUniversityReport;
