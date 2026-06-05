import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SelfLogo, DirectLogo, FullTeamLogo } from "../shared/components/common/DisciplineScoreLogos";
import { TeamMemberProfileModal } from "../shared/components/TeamMemberProfileModal";
import { debugLog } from '../shared/utils/logger.js';

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

const PROGRAMS = [
  {
    id: "family-breakfast",
    name: "Family Healthy Breakfast Programme",
    icon: "🥗",
  },
  { id: "weight-loss", name: "Weight Loss", icon: "📉" },
  { id: "weight-gain", name: "Weight Gain", icon: "📈" },
  { id: "kids-nutrition", name: "Kids Nutrition", icon: "🧒" },
  { id: "sports-nutrition", name: "Sports Nutrition", icon: "⚽" },
  { id: "targeted-nutrition", name: "Targeted Nutrition", icon: "🎯" },
  { id: "earn-product-cost", name: "How to Earn My Product Cost", icon: "💰" },
  { id: "extra-income", name: "Extra Income Opportunity", icon: "💼" },
];

const WellnessUniversityReport = ({ onClose, user, userRole }) => {
  const [enrollments, setEnrollments] = useState([]);
  const [allTeamMembers, setAllTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState(""); // Search bar
  const [showSuggestions, setShowSuggestions] = useState(false); // Dropdown
  const [currentUserName, setCurrentUserName] = useState(""); // Logged-in user's name
  const [profileModalEmail, setProfileModalEmail] = useState(null); // Profile viewer modal
  
  // Track if this is the first load to only set search query once
  const isInitialLoad = useRef(true);
  
  // Everyone starts in edit mode by default
  const isRegularUser = !["admin", "coach", "developer"].includes(userRole);
  const [isEditMode, setIsEditMode] = useState(true); // Always start in edit mode
  const [selectedPrograms, setSelectedPrograms] = useState([]); // Selected programs during edit
  const [viewMode, setViewMode] = useState("own"); // 'own' or 'member'
  const [selectedMember, setSelectedMember] = useState(null); // Selected team member
  const [memberEnrollment, setMemberEnrollment] = useState(null); // Selected member's enrollment
  const [myEnrollment, setMyEnrollment] = useState(null); // Current user's enrollment
  const [isSaving, setIsSaving] = useState(false); // Saving state
  const [memberSelectedPrograms, setMemberSelectedPrograms] = useState([]); // For editing member's programs
  const [isSavingMember, setIsSavingMember] = useState(false); // Saving state for member

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
        
        // Only set search query on initial load, not on subsequent refreshes
        if (isInitialLoad.current) {
          setSearchQuery(name); // Pre-fill search with logged-in username
          isInitialLoad.current = false; // Mark as no longer initial load
        }
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

        debugLog("📡 Fetching team hierarchy:", teamUrl);

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
          debugLog(
            "✅ Team hierarchy loaded:",
            teamData.allMembers?.length,
            "members",
          );
          debugLog(
            "👥 All team members from API (detailed):",
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
          debugLog(
            "📊 Hierarchy structure:",
            JSON.stringify(teamData.hierarchy, null, 2),
          );

          // Get current user ID as number for filtering
          const currentUserIdNum = Number(userProfileData.data?.userId);
          debugLog("ðŸ” Current User ID:", currentUserIdNum);

          // Store ALL team members for building full hierarchy
          // Don't filter - we need everyone to calculate full team
          teamMembers = teamData.allMembers || [];

          debugLog("✅ Stored all team members:", teamMembers.length);
          debugLog(
            "👥 Team members:",
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

          debugLog("✅ Direct team IDs:", myDirectTeamIds);

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
        debugLog(
          "✅ Enrollments loaded:",
          data.enrollments?.length,
          "enrollments",
        );
        debugLog("Sample enrollment data:", data.enrollments[0]);
        setEnrollments(data.enrollments || []);

        // Store current user's own enrollment
        const myOwnEnrollment = data.enrollments?.find(e => e.UserId === userProfileData.data?.userId);
        setMyEnrollment(myOwnEnrollment || null);
        debugLog("✅ My enrollment:", myOwnEnrollment);

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

  // Auto-populate selected programs when enrollment data loads
  useEffect(() => {
    if (myEnrollment && isEditMode) {
      try {
        const parsed = JSON.parse(myEnrollment.EnrolledPrograms || "[]");
        const enrolledPrograms = Array.isArray(parsed) ? parsed : Object.keys(parsed);
        setSelectedPrograms(enrolledPrograms);
      } catch {
        setSelectedPrograms([]);
      }
    }
  }, [myEnrollment, isEditMode]);

  // Auto-populate member's selected programs when member enrollment changes
  useEffect(() => {
    if (memberEnrollment) {
      try {
        const parsed = JSON.parse(memberEnrollment.EnrolledPrograms || "[]");
        const enrolledPrograms = Array.isArray(parsed) ? parsed : Object.keys(parsed);
        setMemberSelectedPrograms(enrolledPrograms);
      } catch {
        setMemberSelectedPrograms([]);
      }
    } else {
      setMemberSelectedPrograms([]);
    }
  }, [memberEnrollment]);

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

      debugLog(
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
        debugLog(
          `[${programName}] Using team members path. Total members:`,
          allTeamMembers.length,
        );
        debugLog(
          `[${programName}] Current user ID:`,
          currentUserId,
          "Type:",
          typeof currentUserId,
        );
        debugLog(
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
            debugLog(
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
              "| ✅ IsDirect:",
              isDirect,
            );
          }

          return isDirect;
        });

        debugLog(
          `[${programName}] ✅ Direct members found:`,
          allDirectMembers.length,
        );
        debugLog(
          `[${programName}] ✅ Direct members:`,
          allDirectMembers.map((m) => m.UserName || m.Email),
        );

        // Build FULL TEAM recursively - all members in downline hierarchy
        // IMPORTANT: Use allTeamMembers (ALL team members) not just enrolled ones
        const buildFullTeam = (startMembers, allMembers) => {
          const fullTeam = new Map(); // Use Map to avoid duplicates
          const queue = [...startMembers];

          debugLog(
            `[${programName}] 🔧 Building full team from ${startMembers.length} direct members`,
          );
          debugLog(
            `[${programName}] 🔧 Using ${allMembers.length} total members for hierarchy traversal`,
          );
          debugLog(
            `[${programName}] 🔧 All members sample:`,
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
              debugLog(
                `[${programName}] ➕ Added to full team:`,
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
                  debugLog(
                    `[${programName}] 👤 Found sub-team member:`,
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

              debugLog(
                `[${programName}] 📋 ${current.UserName || current.Email} has ${
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
          debugLog(
            `[${programName}] ✅ Full team build complete: ${result.length} members`,
          );
          return result;
        };

        // Use allTeamMembers (from team-hierarchy API) for building full hierarchy
        // This includes ALL team members regardless of enrollment status
        const allFullMembers = buildFullTeam(allDirectMembers, allTeamMembers);

        debugLog(
          `[${programName}] 📊 Full team members (entire downline):`,
          allFullMembers.length,
        );
        debugLog(
          `[${programName}] 📊 Full team:`,
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

        debugLog(
          `[${programName}] ðŸ” Processing full team members:`,
          allFullMembers.length,
        );
        allFullMembers.forEach((member) => {
          debugLog(
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

        debugLog(
          `[${programName}] 📊 Full enrolled:`,
          fullEnrolled.length,
          fullEnrolled.map((m) => m.UserName),
        );
        debugLog(
          `[${programName}] 📊 Full unenrolled:`,
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
        debugLog(
          `[${programName}] Using fallback - CurrentUserId:`,
          currentUserId,
        );
        debugLog(
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
              debugLog(
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

        debugLog(
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

    debugLog("Program stats calculated:", stats);
    return stats;
  };

  const programStats = calculateProgramStats();

  // Render own enrollment view (default)
  const renderOwnEnrollment = () => {
    const enrolledPrograms = myEnrollment ? (() => {
      try {
        const parsed = JSON.parse(myEnrollment.EnrolledPrograms || "[]");
        return Array.isArray(parsed) ? parsed : Object.keys(parsed);
      } catch { return []; }
    })() : [];

    const enrollmentDate = myEnrollment 
      ? new Date(myEnrollment.EnrollmentDate).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    // Handle save enrollment
    const handleSaveEnrollment = async () => {
      setIsSaving(true);
      try {
        const response = await fetch(`${API_BASE}/api/wellness-university/update-enrollment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user?.email,
            programs: selectedPrograms,
          }),
        });

        const result = await response.json();
        if (result.success) {
          await fetchEnrollments(); // Refresh data
          // Stay in edit mode so user can make more changes immediately
        } else {
          alert("Failed to update enrollment: " + (result.message || "Unknown error"));
        }
      } catch (err) {
        alert("Error updating enrollment: " + err.message);
      } finally {
        setIsSaving(false);
      }
    };

    // Toggle program selection
    const toggleProgram = (programName) => {
      setSelectedPrograms(prev => 
        prev.includes(programName) 
          ? prev.filter(p => p !== programName)
          : [...prev, programName]
      );
    };

    // Extract first name from current user's name
    const getFirstName = (fullName) => {
      if (!fullName) return "Your";
      const parts = fullName.trim().split(/\s+/);
      return parts[0];
    };

    const firstName = getFirstName(currentUserName);

    return (
      <div className="space-y-4">
        {/* Header with user's name */}
        <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-4 border border-green-200">
          <h3 className="text-lg font-bold text-gray-800 mb-1">
            📚 {firstName}'s Programmes
          </h3>
          {/* <p className="text-sm text-gray-600">Select the programs you want to enroll in</p> */}
        </div>

        {/* Programs Selection */}
        <div className="space-y-2">
          {PROGRAMS.map((program) => {
                const isSelected = selectedPrograms.includes(program.name);
                return (
                  <div
                    key={program.id}
                    onClick={() => toggleProgram(program.name)}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "bg-green-50 border-green-400 shadow-md"
                        : "bg-white border-gray-200 hover:border-green-300"
                    }`}
                  >
                    <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl flex items-center justify-center text-2xl">
                      {program.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 text-sm">{program.name}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                        isSelected
                          ? "bg-green-500 border-green-500 text-white"
                          : "bg-white border-gray-300"
                      }`}>
                        {isSelected && "✓"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Button */}
            <button
              onClick={handleSaveEnrollment}
              disabled={isSaving}
              className="w-full bg-gradient-to-r from-green-400 to-green-500 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
      </div>
    );
  };

  // Render member enrollment view (when searching) - EDITABLE for coaches
  const renderMemberEnrollment = () => {
    if (!selectedMember) return null;

    // Handle save for member
    const handleSaveMemberEnrollment = async () => {
      setIsSavingMember(true);
      try {
        const response = await fetch(`${API_BASE}/api/wellness-university/update-enrollment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: selectedMember.email, // Update for the selected member
            programs: memberSelectedPrograms,
          }),
        });

        const result = await response.json();
        if (result.success) {
          await fetchEnrollments(); // Refresh data
          // Re-fetch member's enrollment
          try {
            const cacheBuster = Date.now();
            const response = await fetch(
              `${API_BASE}/api/wellness-university/get-enrollments?email=${encodeURIComponent(
                user.email
              )}&_t=${cacheBuster}`
            );
            const data = await response.json();
            if (data.success) {
              const memberEnroll = data.enrollments?.find(e => e.UserId === selectedMember.userId);
              setMemberEnrollment(memberEnroll || null);
            }
          } catch (err) {
            console.error("Error refreshing member enrollment:", err);
          }
        } else {
          alert("Failed to update enrollment: " + (result.message || "Unknown error"));
        }
      } catch (err) {
        alert("Error updating enrollment: " + err.message);
      } finally {
        setIsSavingMember(false);
      }
    };

    // Toggle program selection for member
    const toggleMemberProgram = (programName) => {
      setMemberSelectedPrograms(prev => 
        prev.includes(programName) 
          ? prev.filter(p => p !== programName)
          : [...prev, programName]
      );
    };

    // Extract first name from member's name
    const getFirstName = (fullName) => {
      if (!fullName) return "Member";
      const parts = fullName.trim().split(/\s+/);
      return parts[0];
    };

    const firstName = getFirstName(selectedMember.name);

    return (
      <div className="space-y-4">
        {/* Header with possessive name and member info */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg cursor-pointer hover:bg-blue-200 transition-colors"
              onClick={() => setProfileModalEmail(selectedMember.email)}
              title="View full profile"
            >
              {(selectedMember.name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h3 
                className="text-lg font-bold text-gray-800 cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => setProfileModalEmail(selectedMember.email)}
                title="View full profile"
              >
                📚 {firstName}'s Programmes
              </h3>
              <p className="text-sm text-gray-600">{selectedMember.email}</p>
            </div>
          </div>
        </div>

        {/* Programs Selection - EDITABLE */}
        <div className="space-y-2">
          {PROGRAMS.map((program) => {
            const isSelected = memberSelectedPrograms.includes(program.name);
            return (
              <div
                key={program.id}
                onClick={() => toggleMemberProgram(program.name)}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  isSelected
                    ? "bg-blue-50 border-blue-400 shadow-md"
                    : "bg-white border-gray-200 hover:border-blue-300"
                }`}
              >
                <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl flex items-center justify-center text-2xl">
                  {program.icon}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-sm">{program.name}</p>
                </div>
                <div className="flex-shrink-0">
                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                    isSelected
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "bg-white border-gray-300"
                  }`}>
                    {isSelected && "✓"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSaveMemberEnrollment}
          disabled={isSavingMember}
          className="w-full bg-gradient-to-r from-blue-400 to-blue-500 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
        >
          {isSavingMember ? "Saving..." : "Save"}
        </button>
      </div>
    );
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
                      ✓ Enrolled
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
                Wellness University
              </h1>
              <p className="text-gray-700 text-xs hidden sm:block">
                {isRegularUser ? "Manage your program enrollment" : "Your enrollment & team programs"}
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
        {/* Search Bar - Only for Coach/Admin/Developer */}
        {!isRegularUser && (
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
                onClick={() => { 
                  setSearchQuery(""); 
                  setShowSuggestions(false);
                  setViewMode("own");
                  setSelectedMember(null);
                  setMemberEnrollment(null);
                }}
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
                    onMouseDown={async () => {
                      setSearchQuery(s.name);
                      setShowSuggestions(false);
                      
                      if (s.isSelf) {
                        // Viewing own enrollment
                        setViewMode("own");
                        setSelectedMember(null);
                        setMemberEnrollment(null);
                      } else {
                        // Viewing team member enrollment
                        setViewMode("member");
                        setSelectedMember(s);
                        // Fetch member's enrollment
                        try {
                          const cacheBuster = Date.now();
                          const response = await fetch(
                            `${API_BASE}/api/wellness-university/get-enrollments?email=${encodeURIComponent(
                              user.email
                            )}&_t=${cacheBuster}`
                          );
                          const data = await response.json();
                          if (data.success) {
                            const memberEnroll = data.enrollments?.find(e => e.UserId === s.userId);
                            setMemberEnrollment(memberEnroll || null);
                          }
                        } catch (err) {
                          console.error("Error fetching member enrollment:", err);
                        }
                      }
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
        )}
        
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
            {/* Main Content - Simple View */}
            {viewMode === "own" ? renderOwnEnrollment() : renderMemberEnrollment()}
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
