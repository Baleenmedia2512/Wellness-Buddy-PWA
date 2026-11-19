/**
 * ReportsMemberSearch — per-tab team downline search.
 * Reuses useTeamSearch (recursive getFlatTeamList) so each Reports tab can
 * pick a member independently from the same Active hierarchy.
 */
import React, { useState } from 'react';
import { UserRound } from 'lucide-react';
import { TeamSearchInput, TeamSearchResults, useTeamSearch } from '../../team';
import TeamMemberProfileModal from '../../../shared/components/TeamMemberProfileModal';
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
  const [profileMember, setProfileMember] = useState(null);

  if (!vm.isCoach) {
    return (
      <p className="text-xs text-gray-600">
        Selected User: <span className="font-semibold text-gray-900">My Profile</span>
      </p>
    );
  }

  return (
    <>
      <div className="relative flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
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
              loadError={vm.loadError}
              rosterReady={vm.rosterReady}
              suggestions={vm.suggestions}
              selectedMemberId={selectedMember?.userId || selectedMember?.id || user?.id}
              onSelect={vm.selectMember}
              onViewProfile={setProfileMember}
            />
          )}
        </div>
        {selectedMember && !selectedMember.isSelf && (
          <button
            type="button"
            onClick={() => setProfileMember(selectedMember)}
            className="shrink-0 rounded-full border border-teal-200 p-2 text-teal-700 hover:bg-teal-50"
            aria-label={`View ${reportsSelectedUserLabel(selectedMember)}'s profile`}
            title="View profile"
          >
            <UserRound className="h-5 w-5" />
          </button>
        )}
      </div>
      {/* <p className="mt-2 text-xs text-gray-600">
        Selected User:{' '}
        <span className="font-semibold text-gray-900">
          {reportsSelectedUserLabel(selectedMember)}
        </span>
      </p> */}
      <TeamMemberProfileModal
        isOpen={Boolean(profileMember)}
        onClose={() => setProfileMember(null)}
        memberEmail={profileMember?.email}
        memberUserId={profileMember?.userId || profileMember?.id}
      />
    </>
  );
}
