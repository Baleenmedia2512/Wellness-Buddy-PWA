/**
 * useTeamSearch.js — slice-internal hook.
 *
 * Owns all state, async loading and filtering for the coach team-member
 * search. UI components consume the returned view-model and stay dumb.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchSavedSearchProfile, fetchTeamMembers, fetchHasTeamMembers,
  filterMembers, toSelectedUser, isCoachRole, canUseTeamSearch,
  resolveTeamSearchDisplayName, resolveTypedSearchQuery,
  invalidateHasTeamMembersCache,
} from '../services/teamSearchService';
import { getCachedProfileUserName } from '../../../shared/utils/shareUtils';
import { readNumericDbUserId } from '../../../shared/services/numericDbUserId';
import { getUserId } from '../../../shared/services/userIdentity';

export function useTeamSearch({
  user, userRole, selectedMember, onMemberSelect, viewKey, refreshKey = 0,
} = {}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [allTeamMembers, setAllTeamMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [coachDbId, setCoachDbId] = useState(() => readNumericDbUserId(user));
  const [hasCleared, setHasCleared] = useState(false);
  const [savedUserName, setSavedUserName] = useState(() => (
    resolveTeamSearchDisplayName(getCachedProfileUserName(user?.email), user) || ''
  ));
  const [coachCommunityId, setCoachCommunityId] = useState(
    () => (user?.communityId != null ? String(user.communityId).trim() || null : null),
  );
  const [hasTeamMembers, setHasTeamMembers] = useState(false);
  const coachCommunityIdRef = useRef(coachCommunityId);

  const searchRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  const isCoach = canUseTeamSearch(userRole, hasTeamMembers);

  // Firebase user may mount before numeric DB UserId is attached — resolve before team fetch.
  useEffect(() => {
    let cancelled = false;
    const known = readNumericDbUserId(user);
    if (known) {
      setCoachDbId(known);
      return undefined;
    }
    if (!user?.email && !user?.Email) return undefined;
    getUserId(user)
      .then((id) => {
        if (!cancelled && id) setCoachDbId(id);
      })
      .catch((err) => console.error('Error resolving coach user id for search:', err));
    return () => { cancelled = true; };
  }, [user?.id, user?.UserId, user?.userId, user?.email, user?.Email]);

  useEffect(() => {
    coachCommunityIdRef.current = coachCommunityId;
  }, [coachCommunityId]);

  // Reset hasCleared whenever a different member is selected externally.
  useEffect(() => { setHasCleared(false); }, [selectedMember]);

  // Nutrition ↔ Trend (and other shared search surfaces): drop in-progress
  // typing and show the selected member's name again so the same person
  // stays visible after a tab switch.
  useEffect(() => {
    if (viewKey == null) return undefined;
    setSearchQuery('');
    setIsOpen(false);
    setHasCleared(false);
    return undefined;
  }, [viewKey]);

  // Fetch saved profile name + Community ID (best-effort).
  useEffect(() => {
    let cancelled = false;
    fetchSavedSearchProfile(user?.email)
      .then(({ userName, communityId }) => {
        if (cancelled) return;
        if (userName) setSavedUserName(userName);
        if (communityId) setCoachCommunityId(communityId);
      })
      .catch((err) => console.error('Error fetching user profile for search:', err));
    return () => { cancelled = true; };
  }, [user?.email]);

  // Users with downline members in team_table are coaches regardless of Role.
  useEffect(() => {
    if (!coachDbId || isCoachRole(userRole)) {
      setHasTeamMembers(false);
      return undefined;
    }
    if (refreshKey > 0) {
      invalidateHasTeamMembersCache(coachDbId);
    }
    let cancelled = false;
    fetchHasTeamMembers(coachDbId)
      .then((has) => { if (!cancelled) setHasTeamMembers(has); })
      .catch((err) => {
        console.error('Error checking team membership:', err);
        if (!cancelled) setHasTeamMembers(false);
      });
    return () => { cancelled = true; };
  }, [coachDbId, userRole, refreshKey]);

  // Fetch the coach's flat team list once it becomes possible.
  // Intentionally omit savedUserName from deps — name is resolved at fetch time
  // so profile-name load does not re-download the full team-hierarchy payload.
  // Re-run when coachCommunityId arrives so direct-downline rows get Your CID.
  useEffect(() => {
    if (!isCoach || !coachDbId) return undefined;
    if (refreshKey > 0) {
      invalidateHasTeamMembersCache(coachDbId);
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetchTeamMembers({
      coachId: coachDbId,
      coachName: resolveTeamSearchDisplayName(savedUserName, user),
      coachEmail: user.email,
      coachRole: userRole,
      coachCommunityId: coachCommunityIdRef.current || coachCommunityId,
    })
      .then((members) => {
        if (cancelled) return;
        setAllTeamMembers(members);
        setLoadError(false);
      })
      .catch((err) => {
        console.error('Error loading team members:', err);
        if (!cancelled) {
          setAllTeamMembers([]);
          setLoadError(true);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- savedUserName intentionally excluded
  }, [coachDbId, user?.name, user?.email, isCoach, userRole, coachCommunityId, refreshKey]);

  const suggestions = useMemo(
    () => filterMembers(allTeamMembers, searchQuery),
    [allTeamMembers, searchQuery],
  );

  // Click-outside dismiss.
  useEffect(() => {
    const handler = (event) => {
      if (
        searchRef.current && !searchRef.current.contains(event.target)
        && dropdownRef.current && !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        if (!searchQueryRef.current) setHasCleared(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectMember = useCallback((member) => {
    onMemberSelect?.(toSelectedUser(member));
    setSearchQuery(''); setIsOpen(false); setHasCleared(false);
  }, [onMemberSelect]);

  const clearSelection = useCallback(() => {
    onMemberSelect?.(null);
    setSearchQuery(''); setIsOpen(false); setHasCleared(false);
  }, [onMemberSelect]);

  const handleQueryChange = useCallback((value) => {
    const displayName = selectedMember && !selectedMember.isSelf
      ? (selectedMember.userName || selectedMember.name || selectedMember.email || '')
      : resolveTeamSearchDisplayName(savedUserName, user);
    const next = resolveTypedSearchQuery({
      currentQuery: searchQuery,
      displayName,
      nextValue: value,
    });
    if (next === '') setHasCleared(true);
    setSearchQuery(next);
    setIsOpen(true);
  }, [searchQuery, selectedMember, savedUserName, user]);

  const handleFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  const clearQuery = useCallback(() => {
    setSearchQuery(''); setIsOpen(false); setHasCleared(true);
  }, []);

  const fallbackName = resolveTeamSearchDisplayName(savedUserName, user);
  const selectedLabel = selectedMember && !selectedMember.isSelf
    ? (selectedMember.userName || selectedMember.name || selectedMember.email || '')
    : fallbackName;
  const displayName = selectedMember ? selectedLabel : fallbackName;
  const inputValue = searchQuery || (hasCleared ? '' : displayName);

  const rosterReady = allTeamMembers.some((m) => !m.isSelf);

  return {
    isCoach,
    searchRef, dropdownRef,
    isOpen, setIsOpen,
    searchQuery, suggestions, loading, loadError, rosterReady,
    inputValue,
    handleQueryChange, handleFocus, clearQuery,
    selectMember, clearSelection,
  };
}
