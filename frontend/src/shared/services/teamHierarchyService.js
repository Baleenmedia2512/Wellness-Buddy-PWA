import axios from "axios";
import { cacheManager } from "./cacheManager";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

/**
 * Team Hierarchy Service
 * Handles all team hierarchy-related API calls
 */
export const teamHierarchyService = {
  /**
   * Fetch hierarchical team structure
   * @param {number} coachId - ID of the coach requesting the hierarchy
   * @param {boolean} includeInactive - Whether to include inactive users
   * @returns {Promise<Object>} - Hierarchical team data
   */
  async getTeamHierarchy(coachId, includeInactive = false) {
    const cacheKey = cacheManager.generateKey("teamHierarchy", coachId, includeInactive);
    return cacheManager.execute(
      cacheKey,
      async () => {
        const response = await axios.get(
          `${API_BASE_URL}/api/coach/team-hierarchy`,
          {
            params: {
              coachId,
              includeInactive: includeInactive ? "true" : "false",
            },
          },
        );
        return response.data;
      },
      cacheManager.ttls.teamHierarchy,
    ).catch((error) => {
      console.error("Team hierarchy fetch error:", error);
      throw error;
    });
  },

  /**
   * Get flat list of all team members under a coach
   * @param {number} coachId - ID of the coach
   * @returns {Promise<Array>} - Flat array of team members
   */
  async getFlatTeamList(coachId) {
    try {
      const hierarchyData = await this.getTeamHierarchy(coachId);

      // ✅ Use backend's pre-built flat array — already deduplicated and complete
      // Avoids members being dropped by broken nested tree walk
      if (hierarchyData.allMembers && hierarchyData.allMembers.length > 0) {
        return hierarchyData.allMembers.map((member) => ({
          userId: member.UserId,
          userName: member.UserName,
          email: member.Email || "",
          role: member.Role || "user",
          coachId: member.CoachId,
          coCoachId: member.CoCoachId,
          coachName: null,
          coCoachName: null,
          parentCoachId: null,
          isCoachRelationship: true,
          level: 0,
          phoneNumber: member.phoneNumber || member.PhoneNumber || null,
          heightCm: member.height != null ? member.height : (member.heightCm != null ? member.heightCm : null),
          bmr: member.bmr != null ? member.bmr : null,
        }));
      }

      // Fallback: walk hierarchy tree if allMembers not available
      const flatList = [];
      const flatten = (node) => {
        flatList.push({
          userId: node.userId,
          userName: node.userName,
          email: node.email,
          role: node.role,
          coachId: node.coachId,
          coCoachId: node.coCoachId,
          coachName: node.coachName,
          coCoachName: node.coCoachName,
          parentCoachId: node.parentCoachId,
          isCoachRelationship: node.isCoachRelationship,
          level: 0,
          phoneNumber: node.phoneNumber || null,
          heightCm: node.height != null ? node.height : (node.heightCm != null ? node.heightCm : null),
          bmr: node.bmr != null ? node.bmr : null,
        });
        if (node.teamMembers && node.teamMembers.length > 0) {
          node.teamMembers.forEach((member) => flatten(member));
        }
      };
      if (hierarchyData.hierarchy) {
        flatten(hierarchyData.hierarchy);
      }
      return flatList;
    } catch (error) {
      console.error("Flat team list error:", error);
      throw error;
    }
  },

  /**
   * Search for a specific user in the hierarchy
   * @param {number} coachId - ID of the coach
   * @param {string} searchTerm - Search query (name or email)
   * @returns {Promise<Array>} - Matching users with their path in hierarchy
   */
  async searchInHierarchy(coachId, searchTerm) {
    try {
      const hierarchyData = await this.getTeamHierarchy(coachId);
      const results = [];

      const search = (node, path = []) => {
        const currentPath = [...path, node.userName];

        if (
          node.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          node.email.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          results.push({
            ...node,
            path: currentPath.join(" > "),
          });
        }

        if (node.teamMembers && node.teamMembers.length > 0) {
          node.teamMembers.forEach((member) => search(member, currentPath));
        }
      };

      if (hierarchyData.hierarchy) {
        search(hierarchyData.hierarchy);
      }

      return results;
    } catch (error) {
      console.error("Hierarchy search error:", error);
      throw error;
    }
  },
};
