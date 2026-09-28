import {
  getDirectReportingMembers,
  getFullReportingMembers,
  getUplineMembers,
} from './reportingHierarchyService.js';

function getPartnerRootIds(context, rootCoachId) {
  const rootId = Number(rootCoachId);
  const partners = Array.isArray(context?.partnerRootIds) ? context.partnerRootIds : [];
  return partners
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id !== rootId);
}

/**
 * Same-community independent coaches (not Sponsor/Co-Sponsor partners).
 * Their downlines are unioned for Team visibility only — peer nodes themselves
 * are not Direct/Full Team members.
 *
 * @param {object} context
 * @param {number} rootCoachId
 * @returns {number[]}
 */
function getCommunityPeerRootIds(context, rootCoachId) {
  const rootId = Number(rootCoachId);
  const peers = Array.isArray(context?.communityPeerRootIds)
    ? context.communityPeerRootIds
    : [];
  return peers
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id !== rootId);
}

export function getSharedTeamDirectMembers(coachId, context) {
  const rootId = Number(coachId);
  const byId = new Map();

  for (const member of getDirectReportingMembers(rootId, context)) {
    byId.set(Number(member.UserId), member);
  }

  // Sponsor ↔ Co-Sponsor: include partner lead + partner directs.
  for (const partnerId of getPartnerRootIds(context, rootId)) {
    const partner = context.userById?.get(partnerId);
    if (partner && Number(partner.UserId) !== rootId) {
      byId.set(Number(partner.UserId), partner);
    }
    for (const member of getDirectReportingMembers(partnerId, context)) {
      const id = Number(member.UserId);
      if (id === rootId) continue;
      byId.set(id, member);
    }
  }

  // Same Community ID: merge peer coaches' directs only (never the peer coaches).
  for (const peerId of getCommunityPeerRootIds(context, rootId)) {
    for (const member of getDirectReportingMembers(peerId, context)) {
      const id = Number(member.UserId);
      if (id === rootId || id === peerId) continue;
      byId.set(id, member);
    }
  }

  return [...byId.values()];
}

export function getSharedTeamFullMembers(coachId, context) {
  const rootId = Number(coachId);
  const byId = new Map();

  for (const member of getFullReportingMembers(rootId, context)) {
    byId.set(Number(member.UserId), member);
  }

  for (const partnerId of getPartnerRootIds(context, rootId)) {
    const partner = context.userById?.get(partnerId);
    if (partner && Number(partner.UserId) !== rootId) {
      byId.set(Number(partner.UserId), partner);
    }
    for (const member of getFullReportingMembers(partnerId, context)) {
      const id = Number(member.UserId);
      if (id === rootId) continue;
      byId.set(id, member);
    }
  }

  for (const peerId of getCommunityPeerRootIds(context, rootId)) {
    for (const member of getFullReportingMembers(peerId, context)) {
      const id = Number(member.UserId);
      if (id === rootId || id === peerId) continue;
      byId.set(id, member);
    }
  }

  return [...byId.values()];
}

/**
 * Full shared-team downline plus every upline on the CoachId chain.
 * Used by testimonials Full Team scope (view uplines' transformation photos).
 * @param {number} coachId
 * @param {import('./reportingHierarchyService.js').ReportingContext} context
 */
export function getSharedTeamFullMembersWithUplines(coachId, context) {
  const rootId = Number(coachId);
  const byId = new Map();

  for (const member of getSharedTeamFullMembers(rootId, context)) {
    byId.set(Number(member.UserId), member);
  }

  for (const upline of getUplineMembers(rootId, context)) {
    const id = Number(upline.UserId);
    if (id !== rootId) byId.set(id, upline);
  }

  return [...byId.values()];
}
