/**
 * TeamMemberSearch.js — slice-level container.
 *
 * Coach-only searchable dropdown for switching the dashboard's "viewed
 * member". State + IO live in `useTeamSearch`; UI is composed from
 * `TeamSearchInput` and `TeamSearchResults`.
 */
import React, { useState } from 'react';
import { TeamMemberProfileModal } from '../../../shared/components/TeamMemberProfileModal';
import TeamSearchInput from './TeamSearchInput';
import TeamSearchResults from './TeamSearchResults';
import { useTeamSearch } from '../hooks/useTeamSearch';

const TeamMemberSearch = ({ user, userRole, selectedMember, onMemberSelect }) => {
  const vm = useTeamSearch({ user, userRole, selectedMember, onMemberSelect });
  const [showProfileModal, setShowProfileModal] = useState(false);

  if (!vm.isCoach) return null;

  return (
    <>
      <div className="relative w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl px-2 xxs:px-3 xs:px-4 py-2 xs:py-3 bg-white border-b border-gray-200">
        <div className="relative">
          <TeamSearchInput
            inputRef={vm.searchRef}
            value={vm.inputValue}
            searchQuery={vm.searchQuery}
            onChange={vm.handleQueryChange}
            onFocus={() => vm.setIsOpen(true)}
            onClear={vm.clearQuery}
            showViewMine={Boolean(selectedMember && !selectedMember.isSelf)}
            onClearSelection={vm.clearSelection}
          />

          {vm.isOpen && vm.searchQuery && (
            <TeamSearchResults
              dropdownRef={vm.dropdownRef}
              loading={vm.loading}
              suggestions={vm.suggestions}
              selectedMemberId={selectedMember?.userId}
              onSelect={vm.selectMember}
            />
          )}
        </div>
      </div>

      {selectedMember && !selectedMember.isSelf && (
        <TeamMemberProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          memberEmail={selectedMember.email}
        />
      )}
    </>
  );
};

export default TeamMemberSearch;
