/**
 * ReportsMemberSearch — per-tab team downline search.
 * Reuses useTeamSearch (recursive getFlatTeamList) so each Reports tab can
 * pick a member independently from the same Active hierarchy.
 */
import React from 'react';
import { TeamSearchInput, TeamSearchResults, useTeamSearch } from '../../team';
import { reportsSelectedUserLabel } from '../utils/reportsViewedMember.js';

export default function ReportsMemberSearch({
  user,
  userRole,
  selectedMember,
  onMemberSelect,
  refreshKey = 0,
}) {
  const vm = useTeamSearch({
    user, userRole, selectedMember, onMemberSelect, refreshKey,
  });

  if (!vm.isCoach) {
    return (
      <p className="text-xs text-gray-600">
        Selected User: <span className="font-semibold text-gray-900">My Profile</span>
      </p>
    );
  }

  return (
    <div className="relative">
      <TeamSearchInput
        inputRef={vm.searchRef}
        value={vm.inputValue}
        searchQuery={vm.searchQuery}
        onChange={vm.handleQueryChange}
        onFocus={vm.handleFocus}
        onClear={vm.clearQuery}
        showViewMine={Boolean(selectedMember && !selectedMember.isSelf)}
        onClearSelection={vm.clearSelection}
        placeholder="Search team member..."
      />
      {vm.isOpen && vm.searchQuery && (
        <TeamSearchResults
          dropdownRef={vm.dropdownRef}
          loading={vm.loading}
          suggestions={vm.suggestions}
          selectedMemberId={selectedMember?.userId || selectedMember?.id || user?.id}
          onSelect={vm.selectMember}
        />
      )}
      {/* <p className="mt-2 text-xs text-gray-600">
        Selected User:{' '}
        <span className="font-semibold text-gray-900">
          {reportsSelectedUserLabel(selectedMember)}
        </span>
      </p> */}
    </div>
  );
}
