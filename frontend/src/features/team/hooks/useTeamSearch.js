/**
 * useTeamSearch.js — slice-internal hook.
 *
 * Owns all state, async loading and filtering for the coach team-member
 * search. UI components consume the returned view-model and stay dumb.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchSavedUserName, fetchTeamMembers,
  filterMembers, toSelectedUser, isCoachRole,
} from '../services/teamSearchService';

export function useTeamSearch({ user, userRole, selectedMember, onMemberSelect } = {}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [allTeamMembers, setAllTeamMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasCleared, setHasCleared] = useState(false);
  const [savedUserName, setSavedUserName] = useState('');

  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  const isCoach = isCoachRole(userRole);

  // Reset hasCleared whenever a different member is selected externally.
  useEffect(() => { setHasCleared(false); }, [selectedMember]);

  // Fetch saved profile name (best-effort).
  useEffect(() => {
    let cancelled = false;
    fetchSavedUserName(user?.email)
      .then((name) => { if (!cancelled && name) setSavedUserName(name); })
      .catch((err) => console.error('Error fetching user profile for search:', err));
    return () => { cancelled = true; };
  }, [user?.email]);

  // Fetch the coach's flat team list once it becomes possible.
  useEffect(() => {
    if (!isCoach || !user?.id) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchTeamMembers({
      coachId: user.id,
      coachName: savedUserName || user.name || user.email,
      coachEmail: user.email,
      coachRole: userRole,
    })
      .then((members) => { if (!cancelled) setAllTeamMembers(members); })
      .catch((err) => console.error('Error loading team members:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id, user?.name, user?.email, isCoach, userRole, savedUserName]);

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

  const fallbackName = savedUserName || user?.name || user?.email?.split('@')[0] || 'Me';
  const displayName = selectedMember
    ? (selectedMember.isSelf ? fallbackName : selectedMember.userName)
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
