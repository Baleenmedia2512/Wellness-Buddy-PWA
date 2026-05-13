/**
 * disciplineReportFormatter.js — pure helpers for DisciplineReport.
 *
 * Hosts filter/search/sort/team-view/summary helpers and the
 * status-driven row styling. Behavior preserved exactly from the
 * legacy `DisciplineReport.js`.
 */
import { TrendingUp, TrendingDown } from 'lucide-react';

export const filterOptions = [
  { value: 'all', label: 'All Scores', icon: null },
  { value: 'high', label: 'High (≥80%)', icon: TrendingUp },
  { value: 'medium', label: 'Medium (50-79%)', icon: null },
  { value: 'low', label: 'Low (<50%)', icon: TrendingDown },
];

export const matchesFilter = (node, filterValue) => {
  if (filterValue === 'all') return true;
  const score = node.periodDiscipline?.percentage || 0;
  if (filterValue === 'high') return score >= 80;
  if (filterValue === 'medium') return score >= 50 && score < 80;
  if (filterValue === 'low') return score < 50;
  return true;
};

export const matchesSearch = (node, query) => {
  if (!query) return true;
  const q = query.toLowerCase();
  if (node.userName?.toLowerCase().includes(q) || node.userEmail?.toLowerCase().includes(q)) return true;
  if (node.coCoachInfo) {
    if (node.coCoachInfo.userName?.toLowerCase().includes(q) ||
        node.coCoachInfo.email?.toLowerCase().includes(q)) return true;
  }
  if (node.teamMembers?.length > 0) return node.teamMembers.some((c) => matchesSearch(c, query));
  return false;
};

export const hasVisibleNodes = (node, { searchQuery, filter }) => {
  if (!node) return false;
  if (matchesSearch(node, searchQuery) && matchesFilter(node, filter)) return true;
  if (node.teamMembers?.length > 0) {
    return node.teamMembers.some((c) => hasVisibleNodes(c, { searchQuery, filter }));
  }
  return false;
};

const compareScore = (a, b, sortBy) => {
  if (sortBy === 'direct') return [a.directTeamDiscipline?.percentage || 0, b.directTeamDiscipline?.percentage || 0];
  if (sortBy === 'full') return [a.fullTeamDiscipline?.percentage || 0, b.fullTeamDiscipline?.percentage || 0];
  return [a.periodDiscipline?.percentage || 0, b.periodDiscipline?.percentage || 0];
};

export const sortHierarchy = (node, { sortBy, sortOrder }) => {
  const sorted = { ...node };
  if (!sorted.teamMembers?.length) return sorted;
  const members = sorted.teamMembers.map((m) => sortHierarchy(m, { sortBy, sortOrder }));
  const coaches = members.filter((m) => m.role === 'coach' || m.isCoach || m.isCoCoach);
  const regular = members.filter((m) => m.role !== 'coach' && !m.isCoach && !m.isCoCoach);
  regular.sort((a, b) => {
    if (sortBy === 'name') {
      const na = (a.userName || a.name || '').toLowerCase();
      const nb = (b.userName || b.name || '').toLowerCase();
      const cmp = na.localeCompare(nb);
      return sortOrder === 'desc' ? -cmp : cmp;
    }
    const [sa, sb] = compareScore(a, b, sortBy);
    return sortOrder === 'desc' ? sb - sa : sa - sb;
  });
  sorted.teamMembers = [...coaches, ...regular];
  return sorted;
};

export const applyTeamView = (hierarchy, teamView) => {
  if (!hierarchy) return null;
  if (teamView === 'full') return hierarchy;
  if (!hierarchy.teamMembers) return hierarchy;
  return {
    ...hierarchy,
    teamMembers: hierarchy.teamMembers.map((m) => ({ ...m, teamMembers: [] })),
  };
};

export const getTeamCounts = (node) => {
  if (!node) return { total: 0 };
  let count = 1;
  if (node.teamMembers) node.teamMembers.forEach((c) => { count += getTeamCounts(c).total; });
  return { total: count };
};

export const getStatusStyle = (node) => {
  const score = node.periodDiscipline?.percentage || 0;
  if (score >= 80) return {
    containerClass: 'bg-white border-green-200 shadow-sm',
    avatarClass: 'bg-green-100 border-green-400 text-green-700',
    nameClass: 'text-gray-900',
    statsBorderClass: 'border-green-100 divide-green-100',
  };
  if (score >= 50) return {
    containerClass: 'bg-white border-yellow-200',
    avatarClass: 'bg-yellow-100 border-yellow-400 text-yellow-700',
    nameClass: 'text-gray-900',
    statsBorderClass: 'border-yellow-100 divide-yellow-100',
  };
  return {
    containerClass: 'bg-white border-red-200',
    avatarClass: 'bg-red-100 border-red-400 text-red-700',
    nameClass: 'text-gray-900',
    statsBorderClass: 'border-red-100 divide-red-100',
  };
};

export const buildSummaryStats = (hierarchy) => {
  if (!hierarchy) return null;
  const all = [];
  const collect = (n) => { all.push(n); n.teamMembers?.forEach(collect); };
  collect(hierarchy);
  const total = all.reduce((s, m) => s + (m.periodDiscipline?.percentage || 0), 0);
  const avgScore = all.length ? Math.round(total / all.length) : 0;
  const top = all.reduce((t, m) => {
    const s = m.periodDiscipline?.percentage || 0;
    const ts = t.periodDiscipline?.percentage || 0;
    return s > ts ? m : t;
  }, all[0]);
  const atRiskCount = all.filter((m) => (m.periodDiscipline?.percentage || 0) < 60).length;
  const totalOnTime = all.reduce((s, m) => s + (m.periodDiscipline?.onTimePosts || 0), 0);
  const totalExpected = all.reduce((s, m) => s + (m.periodDiscipline?.expectedPosts || 0), 0);
  const onTimePercentage = totalExpected > 0 ? Math.round((totalOnTime / totalExpected) * 100) : 0;
  return {
    avgScore,
    onTimePercentage,
    topPerformer: top ? { name: top.userName, score: top.periodDiscipline?.percentage || 0 } : null,
    atRiskCount,
    totalMembers: all.length,
  };
};

export const buildHierarchySummaryStats = (hierarchy) => {
  if (!hierarchy) return null;
  const self = Math.round(hierarchy.periodDiscipline?.percentage || 0);
  const direct = Math.round(hierarchy.directTeamDiscipline?.percentage || 0);
  const full = Math.round(hierarchy.fullTeamDiscipline?.percentage || 0);
  return { note: `Self: ${self}% | Direct: ${direct}% | Full: ${full}%` };
};
