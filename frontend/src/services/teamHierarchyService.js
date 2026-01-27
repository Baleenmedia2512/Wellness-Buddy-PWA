import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://wellness-buddy-pwa.vercel.app/api';

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
    try {
      const response = await axios.get(`${API_BASE_URL}/coach/team-hierarchy`, {
        params: {
          coachId,
          includeInactive: includeInactive ? 'true' : 'false'
        },
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Team hierarchy fetch error:', error);
      throw error;
    }
  },

  /**
   * Get flat list of all team members under a coach
   * @param {number} coachId - ID of the coach
   * @returns {Promise<Array>} - Flat array of team members
   */
  async getFlatTeamList(coachId) {
    try {
      const hierarchyData = await this.getTeamHierarchy(coachId);
      const flatList = [];
      
      const flatten = (node) => {
        flatList.push({
          userId: node.userId,
          userName: node.userName,
          email: node.email,
          role: node.role,
          uplineCoachId: node.uplineCoachId,
          isCoCoach: node.isCoCoach,
          level: 0 // Will be calculated based on depth
        });
        
        if (node.teamMembers && node.teamMembers.length > 0) {
          node.teamMembers.forEach(member => flatten(member));
        }
      };
      
      if (hierarchyData.hierarchy) {
        flatten(hierarchyData.hierarchy);
      }
      
      return flatList;
    } catch (error) {
      console.error('Flat team list error:', error);
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
            path: currentPath.join(' > ')
          });
        }
        
        if (node.teamMembers && node.teamMembers.length > 0) {
          node.teamMembers.forEach(member => search(member, currentPath));
        }
      };
      
      if (hierarchyData.hierarchy) {
        search(hierarchyData.hierarchy);
      }
      
      return results;
    } catch (error) {
      console.error('Hierarchy search error:', error);
      throw error;
    }
  }
};
