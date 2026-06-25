/**
 * attendanceReportFormatter.js — pure helpers for AttendanceReport.
 *
 * Date math, hierarchy field mapping, search/filter predicates, sort,
 * team-view projection, count summarisation and status-driven styling.
 * Behavior preserved exactly from the legacy `AttendanceReport.js`.
 */
import { Check, XCircle } from 'lucide-react';

export const filterOptions = [
  { value: 'all', label: 'All Members', icon: null },
  { value: 'attended', label: 'Attended', icon: Check },
  { value: 'notAttended', label: 'Not Attended', icon: XCircle },
];

export const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function getTargetDate({ dateRange, customStartDate }) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dateRange === 'yesterday') {
    const d = new Date(today); d.setDate(d.getDate() - 1); return formatDate(d);
  }
  if (dateRange === 'week') {
    const d = new Date(today); d.setDate(d.getDate() - 7); return formatDate(d);
  }
  if (dateRange === 'month') {
    const d = new Date(today); d.setMonth(d.getMonth() - 1); return formatDate(d);
  }
  if (dateRange === 'custom' && customStartDate) return formatDate(customStartDate);
  return formatDate(today);
}

export function mapHierarchyFields(node) {
  const mapped = { ...node };
  mapped.userEmail = node.email || node.userEmail;
  const hasPartnership = node.coCoachInfo
    && Object.keys(node.coCoachInfo).length > 0
    && node.coCoachInfo.userId;
  if (!hasPartnership) {
    mapped.uplineCoachName = node.coachName || node.uplineCoachName;
    mapped.uplineCoCoachName = node.coCoachName || node.uplineCoCoachName;
  }
  if (mapped.teamMembers && mapped.teamMembers.length > 0) {
    mapped.teamMembers = mapped.teamMembers.map(mapHierarchyFields);
  }
  return mapped;
}

export const matchesFilter = (node, filterValue) => {
  if (filterValue === 'all') return true;
  const attended = node.metrics?.attended === true;
  if (filterValue === 'attended') return attended;
  if (filterValue === 'notAttended') return !attended;
  return true;
};

export function matchesSearch(node, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  if (node.userName?.toLowerCase().includes(q)
    || node.userEmail?.toLowerCase().includes(q)) return true;
  if (node.coCoachInfo
    && (node.coCoachInfo.userName?.toLowerCase().includes(q)
      || node.coCoachInfo.email?.toLowerCase().includes(q))) return true;
  if (node.teamMembers?.length > 0) {
    return node.teamMembers.some((c) => matchesSearch(c, query));
  }
  return false;
}

export function hasVisibleNodes(node, { searchQuery, filter }) {
  if (!node) return false;
  if (matchesSearch(node, searchQuery) && matchesFilter(node, filter)) return true;
  return node.teamMembers?.some((c) => hasVisibleNodes(c, { searchQuery, filter })) || false;
}

const compareScore = (a, b, sortBy) => {
  if (sortBy === 'direct') {
    const ta = a.directTeamCount?.total || 0;
    const tb = b.directTeamCount?.total || 0;
    return [ta ? (a.directTeamCount?.qualified || 0) / ta : 0,
      tb ? (b.directTeamCount?.qualified || 0) / tb : 0];
  }
  if (sortBy === 'full') {
    const ta = a.fullTeamCount?.total || 0;
    const tb = b.fullTeamCount?.total || 0;
    return [ta ? (a.fullTeamCount?.qualified || 0) / ta : 0,
      tb ? (b.fullTeamCount?.qualified || 0) / tb : 0];
  }
  return [a.metrics?.attended ? 1 : 0, b.metrics?.attended ? 1 : 0];
};export function sortHierarchy(node, { sortBy, sortOrder }) {
  if (!node) return null;
  const sorted = { ...node };
  if (!sorted.teamMembers?.length) return sorted;
  const members = sorted.teamMembers.map((m) => sortHierarchy(m, { sortBy, sortOrder }));
  const isCoach = (m) => m.role === 'coach' || m.isCoach || m.isCoCoach;
  const coaches = members.filter(isCoach);
  const regular = members.filter((m) => !isCoach(m));
  regular.sort((a, b) => {
    if (sortBy === 'name') {
      const na = (a.userName || a.name || '').toLowerCase();
      const nb = (b.userName || b.name || '').toLowerCase();
      return sortOrder === 'desc' ? -na.localeCompare(nb) : na.localeCompare(nb);
    }
    const [sa, sb] = compareScore(a, b, sortBy);
    return sortOrder === 'desc' ? sb - sa : sa - sb;
  });
  sorted.teamMembers = [...coaches, ...regular];
  return sorted;
}

export function applyTeamView(hierarchy, teamView) {
  if (!hierarchy) return null;
  if (teamView === 'full' || !hierarchy.teamMembers) return hierarchy;
  return {
    ...hierarchy,
    teamMembers: hierarchy.teamMembers.map((m) => ({ ...m, teamMembers: [] })),
  };
}

export function getTeamCounts(node) {
  if (!node) return { coaches: 0, members: 0 };
  let coaches = 0; let members = 0;
  const walk = (n) => {
    if (n.teamMembers?.length > 0) {
      coaches += 1;
      n.teamMembers.forEach(walk);
    } else members += 1;
  };
  walk(node);
  return { coaches, members };
}

export function buildSummaryStats(hierarchyData) {
  if (!hierarchyData) return null;
  const mySelfAttended = hierarchyData.metrics?.attended === true;
  const directAttended = hierarchyData.directTeamCount?.qualified || 0;
  const directTotal = hierarchyData.directTeamCount?.total || 0;
  const fullAttended = hierarchyData.fullTeamCount?.qualified || 0;
  const fullTotal = hierarchyData.fullTeamCount?.total || 0;
  return {
    note: `Self: ${mySelfAttended ? '?' : '?'} | Direct: ${directAttended}/${directTotal} | Full: ${fullAttended}/${fullTotal}`,
  };
}
