/**
 * disciplineReportEnricher.js — pure data transformation.
 *
 * Builds discipline score / activity maps from API responses and
 * enriches the team hierarchy tree with per-node discipline metrics
 * (self / direct / full / co-coach). Behavior preserved verbatim.
 */

const ACTIVITY_KEYS = ['weight', 'education', 'breakfast', 'lunch', 'dinner', 'water', 'caloriesBurned'];

const extractActivities = (m) => {
  const out = {};
  ACTIVITY_KEYS.forEach((k) => { out[k] = m.activities?.[k]?.percentage || 0; });
  out.onTimePosts = m.periodDiscipline?.onTimePosts || 0;
  out.expectedPosts = m.periodDiscipline?.expectedPosts || 0;
  return out;
};

const writeMember = (scores, activities, m) => {
  const pct = m.periodDiscipline?.percentage ?? 0;
  scores[m.userId] = pct;
  scores[String(m.userId)] = pct;
  const acts = extractActivities(m);
  activities[m.userId] = acts;
  activities[String(m.userId)] = acts;
};

export const buildDisciplineMaps = (allMembersResponse, teamDataResponse) => {
  const scores = {};
  const activities = {};
  allMembersResponse?.allMembers?.forEach((m) => writeMember(scores, activities, m));
  if (teamDataResponse?.coachPerformance) writeMember(scores, activities, teamDataResponse.coachPerformance);
  teamDataResponse?.teamMembers?.forEach((m) => writeMember(scores, activities, m));
  return { scores, activities };
};

const lookupScore = (scores, id) => scores[id] || scores[String(id)] || 0;
const lookupActs = (activities, id) => activities[id] || activities[String(id)] || {};

const computeDirectScore = (members) => {
  const arr = members.filter((m) => !m.isCoCoach).map((m) => m.periodDiscipline?.percentage || 0).filter((s) => s >= 0);
  if (!arr.length) return 0;
  return Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
};

const collectFullScores = (n) => {
  if (n.isCoCoach) return [];
  let arr = [n.periodDiscipline?.percentage || 0];
  n.teamMembers?.forEach((c) => { arr = arr.concat(collectFullScores(c)); });
  return arr;
};

const computeFullScore = (members) => {
  const arr = [];
  members.forEach((c) => arr.push(...collectFullScores(c)));
  if (!arr.length) return 0;
  return Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
};

const enrichCoCoach = (parent, scores, activities) => {
  if (!parent.coCoachInfo) return;
  const cc = parent.coCoachInfo;
  const ccScore = lookupScore(scores, cc.userId);
  const ccActs = lookupActs(activities, cc.userId);
  cc.periodDiscipline = {
    percentage: ccScore,
    activities: ccActs,
    onTimePosts: ccActs.onTimePosts || 0,
    expectedPosts: ccActs.expectedPosts || 0,
  };
  cc.directTeamDiscipline = parent.directTeamDiscipline;
  cc.fullTeamDiscipline = parent.fullTeamDiscipline;
};

export const enrichHierarchy = (node, { scores, activities }) => {
  const out = { ...node };
  const acts = lookupActs(activities, node.userId);
  out.periodDiscipline = {
    percentage: lookupScore(scores, node.userId),
    activities: acts,
    onTimePosts: acts.onTimePosts || 0,
    expectedPosts: acts.expectedPosts || 0,
  };
  out.userEmail = node.email || node.userEmail;
  const hasPartnership = node.coCoachInfo && Object.keys(node.coCoachInfo).length > 0 && node.coCoachInfo.userId;
  if (!hasPartnership) {
    out.uplineCoachName = node.coachName || node.uplineCoachName;
    out.uplineCoCoachName = node.coCoachName || node.uplineCoCoachName;
  }
  out.profileImage = node.profileImage;
  out.photoURL = node.photoURL;
  if (out.teamMembers?.length > 0) {
    out.teamMembers = out.teamMembers.map((m) => enrichHierarchy(m, { scores, activities }));
    out.directTeamDiscipline = { percentage: computeDirectScore(out.teamMembers) };
    out.fullTeamDiscipline = { percentage: computeFullScore(out.teamMembers) };
  } else {
    out.directTeamDiscipline = { percentage: 0 };
    out.fullTeamDiscipline = { percentage: 0 };
  }
  enrichCoCoach(out, scores, activities);
  return out;
};
