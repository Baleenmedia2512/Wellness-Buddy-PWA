// src/services/disciplineReportService.js
import axios from "axios";
import { cacheManager } from "./cacheManager";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

/**
 * Generate cache key for report
 */
const getCacheKey = (type, userId, dateRange, customRange) => {
  const rangeStr = customRange
    ? `${customRange.start}_${customRange.end}`
    : dateRange;
  return cacheManager.generateKey("disciplineReport", type, userId, rangeStr);
};

/**
 * Clear all discipline report cache
 */
export const clearDisciplineReportCache = () => {
  cacheManager.clearPattern("disciplineReport");
  console.log("🗑️ [CACHE] Cleared discipline report cache");
};

export const disciplineReportService = {
  /**
   * Fetch discipline report for coach's team (with caching and deduplication)
   * @param {number} coachId - Coach's user ID
   * @param {string} dateRange - 'today' | 'yesterday' | 'last7days' | 'last30days' | 'custom'
   * @param {object} customRange - { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
   * @returns {Promise<object>} Discipline report data
   */
  async getDisciplineReport(coachId, dateRange, customRange = null) {
    const cacheKey = getCacheKey("team", coachId, dateRange, customRange);

    return cacheManager
      .execute(
        cacheKey,
        async () => {
          const params = {
            coachId,
            dateRange,
          };

          if (dateRange === "custom" && customRange) {
            params.startDate = customRange.start;
            params.endDate = customRange.end;
          }

          const response = await axios.get(
            `${API_BASE_URL}/api/coach/discipline-report`,
            {
              params,
            },
          );

          return response.data;
        },
        cacheManager.ttls.disciplineReport,
      )
      .catch((error) => {
        console.error("❌ Error fetching discipline report:", error);
        throw error;
      });
  },

  /**
   * Fetch ALL members discipline report (Admin Only) - with caching and deduplication
   * @param {number} userId - Admin's user ID
   * @param {string} dateRange - 'today' | 'yesterday' | 'last7days' | 'last30days' | 'custom'
   * @param {object} customRange - { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
   * @returns {Promise<object>} All members discipline report data
   */
  async getAllMembersDisciplineReport(userId, dateRange, customRange = null) {
    const cacheKey = getCacheKey("all", userId, dateRange, customRange);

    return cacheManager
      .execute(
        cacheKey,
        async () => {
          const params = {
            userId,
            dateRange,
          };

          if (dateRange === "custom" && customRange) {
            params.startDate = customRange.start;
            params.endDate = customRange.end;
          }

          const response = await axios.get(
            `${API_BASE_URL}/api/admin/all-members-discipline`,
            {
              params,
            },
          );

          return response.data;
        },
        cacheManager.ttls.disciplineReport,
      )
      .catch((error) => {
        console.error(
          "❌ Error fetching all members discipline report:",
          error,
        );
        throw error;
      });
  },

  /**
   * Export report to CSV
   * @param {object} teamData - Team discipline data
   * @param {string} dateRange - Date range label for filename
   */
  exportToCSV(teamData, dateRange) {
    const headers = [
      "Name",
      "Email",
      "Coach",
      "Co-Coach",
      "Period %",
      "Weight %",
      "Education %",
      "Breakfast %",
      "Lunch %",
      "Dinner %",
    ];

    const rows = teamData.teamMembers.map((member) => [
      member.userName,
      member.email,
      member.coachName || "-",
      member.coCoachName || "-",
      member.periodDiscipline.percentage,
      member.activities.weight.percentage,
      member.activities.education.percentage,
      member.activities.breakfast.percentage,
      member.activities.lunch.percentage,
      member.activities.dinner.percentage,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Use local date to prevent timezone shifting in filename
    const today = new Date();
    const dateStr =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");
    a.download = `discipline-report-${dateRange}-${dateStr}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  },
};
