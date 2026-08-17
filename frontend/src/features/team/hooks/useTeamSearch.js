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
  resolveTeamSearchDisplayName,
} from '../services/teamSearchService';
import { getCachedProfileUserName } from '../../../shared/utils/shareUtils';

export function useTeamSearch({ user, userRole, selectedMember, onMemberSelect } = {}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [allTeamMembers, setAllTeamMembers] = useState([]);
  const [loading, setLoading] = useState(false);
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

  const isCoach = canUseTeamSearch(userRole, hasTeamMembers);

  useEffect(() => {
    coachCommunityIdRef.current = coachCommunityId;
  }, [coachCommunityId]);

  // Reset hasCleared whenever a different member is selected externally.
  useEffect(() => { setHasCleared(false); }, [selectedMember]);

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
    if (!user?.id || isCoachRole(userRole)) {
      setHasTeamMembers(false);
      return undefined;
    }
    let cancelled = false;
    fetchHasTeamMembers(user.id)
      .then((has) => { if (!cancelled) setHasTeamMembers(has); })
      .catch((err) => {
        console.error('Error checking team membership:', err);
        if (!cancelled) setHasTeamMembers(false);
      });
    return () => { cancelled = true; };
  }, [user?.id, userRole]);

  // Fetch the coach's flat team list once it becomes possible.
  // Intentionally omit savedUserName from deps — name is resolved at fetch time
  // so profile-name load does not re-download the full team-hierarchy payload.
  // Re-run when coachCommunityId arrives so direct-downline rows get Your CID.
  useEffect(() => {
    if (!isCoach || !user?.id) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchTeamMembers({
      coachId: user.id,
      coachName: resolveTeamSearchDisplayName(savedUserName, user),
      coachEmail: user.email,
      coachRole: userRole,
      coachCommunityId: coachCommunityIdRef.current || coachCommunityId,
    })
      .then((members) => { if (!cancelled) setAllTeamMembers(members); })
      .catch((err) => console.error('Error loading team members:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- savedUserName intentionally excluded
  }, [user?.id, user?.name, user?.email, isCoach, userRole, coachCommunityId]);

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
    if (value === '') setHasCleared(true);
    setSearchQuery(value); setIsOpen(true);
  }, []);

  const clearQuery = useCallback(() => {
    setSearchQuery(''); setIsOpen(false); setHasCleared(true);
  }, []);

  const fallbackName = resolveTeamSearchDisplayName(savedUserName, user);
  const displayName = selectedMember
    ? (selectedMember.isSelf ? fallbackName : (selectedMember.userName || ''))
    : fallbackName;
  const inputValue = searchQuery || (hasCleared ? '' : displayName);

  return {
    isCoach,
    searchRef, dropdownRef,
    isOpen, setIsOpen,
    searchQuery, suggestions, loading,
    inputValue,
    handleQueryChange, clearQuery,
    selectMember, clearSelection,
  };
}
