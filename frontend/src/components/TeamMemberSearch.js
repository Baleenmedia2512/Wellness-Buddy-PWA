// src/components/TeamMemberSearch.js
import React, { useState, useEffect, useRef } from 'react';
import { X, User, Search, Info } from 'lucide-react';
import { teamHierarchyService } from '../services/teamHierarchyService';
import TeamMemberProfileModal from './TeamMemberProfileModal';

/**
 * TeamMemberSearch Component
 * Provides a searchable dropdown for coaches to select team members
 * Only visible for users with coach or coCoach roles
 * 
 * @param {Object} user - Current logged-in user
 * @param {string} userRole - User's role (coach, coCoach, admin, user)
 * @param {Object} selectedMember - Currently selected team member
 * @param {Function} onMemberSelect - Callback when a member is selected
 */
const TeamMemberSearch = ({ user, userRole, selectedMember, onMemberSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allTeamMembers, setAllTeamMembers] = useState([]);
  const [hasCleared, setHasCleared] = useState(false);
  const [savedUserName, setSavedUserName] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  // Reset hasCleared when selectedMember changes (including on mount)
  useEffect(() => {
    setHasCleared(false);
  }, [selectedMember]);

  // Check if user is a coach or coCoach
  const isCoach = userRole === 'coach' || userRole === 'coCoach' || userRole === 'admin' || userRole === 'developer';

  // Fetch user's saved profile name
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.email) return;
      
      try {
        const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
        const cacheBuster = Date.now();
        const response = await fetch(
          `${apiBaseUrl}/api/get-user-profile?email=${encodeURIComponent(user.email)}&_t=${cacheBuster}`,
          {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.userName) {
            setSavedUserName(data.data.userName);
          }
        }
      } catch (err) {
        console.error('Error fetching user profile for search:', err);
      }
    };

    fetchUserProfile();
  }, [user?.email]);

  // Load all team members on mount
  useEffect(() => {
    const loadTeamMembers = async () => {
      if (!isCoach || !user?.id) return;

      const coachId = user.id;

      try {
        setLoading(true);
        const flatList = await teamHierarchyService.getFlatTeamList(coachId);

        // Filter coach out of flatList to prevent isSelf flag being lost in dedup
        const filteredList = flatList.filter(m => m.userId !== coachId);

        // Add the coach themselves at the top with isSelf: true
        const membersWithCoach = [
          {
            userId: coachId,
            userName: savedUserName || user.name || user.email,
            email: user.email,
            role: userRole,
            isSelf: true,
          },
          ...filteredList,
        ];

        // Deduplicate by userId to prevent duplicate keys
        const uniqueMembers = Array.from(
          new Map(membersWithCoach.map(member => [member.userId, member])).values()
        );

        setAllTeamMembers(uniqueMembers);
      } catch (error) {
        console.error('Error loading team members:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeamMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isCoach, userRole, savedUserName]);

  // Filter suggestions based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    const filtered = allTeamMembers.filter((member) => {
      const query = searchQuery.toLowerCase();
      return (
        member.userName.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query)
      );
    });

    setSuggestions(filtered);
  }, [searchQuery, allTeamMembers]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle member selection
  const handleSelectMember = (member) => {
    // Map userId to id for consistency with user object structure
    const selectedUser = {
      id: member.userId,
      userId: member.userId,
      name: member.userName,
      userName: member.userName,
      email: member.email,
      role: member.role,
      isSelf: member.isSelf,
    };
    onMemberSelect(selectedUser);
    setSearchQuery('');
    setIsOpen(false);
    setSuggestions([]);
    setHasCleared(false); // Show the selected member's name
  };

  // Handle clear selection
  const handleClearSelection = () => {
    onMemberSelect(null);
    setSearchQuery('');
    setIsOpen(false);
    setHasCleared(false); // Show own name again after clearing
  };

  // Don't render if user is not a coach
  if (!isCoach) {
    return null;
  }

  const displayName = selectedMember 
    ? selectedMember.isSelf 
      ? savedUserName || user?.name || user?.email?.split('@')[0] || 'Me'
      : selectedMember.userName
    : savedUserName || user?.name || user?.email?.split('@')[0] || 'Me';

  // Show own name by default; show selected member name when one is picked; empty only when user clears manually
  const inputValue = searchQuery || (hasCleared ? '' : displayName);

  // Console logs for debugging
  console.log('TeamMemberSearch Debug:', {
    selectedMember: selectedMember,
    displayName: displayName,
    inputValue: inputValue,
    hasCleared: hasCleared,
    searchQuery: searchQuery,
    userName: user?.name,
    userEmail: user?.email
  });

  return (
    <>
    <div className="relative w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl px-4 py-3 bg-white border-b border-gray-200">
      {/* Label */}
      {/* <p className="text-xs text-gray-400 font-medium mb-1.5 pl-1">Viewing member</p> */}
      {/* Search Input with User Display */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-4 w-4 text-gray-400" />
            </div>
            <input
              ref={searchRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                const newValue = e.target.value;
                // Mark as cleared if user is deleting
                if (newValue === '') {
                  setHasCleared(true);
                }
                // Always update search — no guard that blocks keystrokes
                setSearchQuery(newValue);
                setIsOpen(true);
              }}
              onFocus={(e) => {
                setIsOpen(true);
              }}
              onClick={(e) => {
                // When clicking, if showing displayName, select all for easy editing
                if (!searchQuery && !hasCleared) {
                  e.target.select();
                }
              }}
              placeholder={"Type a name to search members..."}
              className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all cursor-pointer"
            />
            {/* Right icon: X when typing, Search when not */}
            {searchQuery ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSuggestions([]);
                  setIsOpen(false);
                  setHasCleared(true);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
            )}
          </div>
          {selectedMember && !selectedMember.isSelf && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => setShowProfileModal(true)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-2 border border-blue-200 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1"
                title="View member profile"
              >
                <Info className="h-3.5 w-3.5" />
                Profile
              </button>
              <button
                onClick={handleClearSelection}
                className="flex-shrink-0 text-xs text-green-600 hover:text-green-700 font-medium px-3 py-2 border border-green-200 rounded-lg bg-green-50 hover:bg-green-100 transition-colors"
                title="View my dashboard"
              >
                View Mine
              </button>
            </div>
          )}
        </div>

        {/* Dropdown Suggestions */}
        {isOpen && searchQuery && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto"
          >
            {loading ? (
              <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-500 border-t-transparent"></div>
                Loading team members...
              </div>
            ) : suggestions.length > 0 ? (
              <ul className="py-1">
                {suggestions.map((member, index) => (
                  <li key={`${member.userId}-${index}`}>
                    <button
                      onClick={() => handleSelectMember(member)}
                      className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
                    >
                      <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {member.userName}
                          {member.isSelf && (
                            <span className="ml-2 text-xs text-green-600">(Me)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{member.email}</p>
                      </div>
                      {selectedMember?.userId === member.userId && (
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : searchQuery ? (
              <div className="px-4 py-3 text-sm text-gray-500">
                No team members found matching "{searchQuery}"
              </div>
            ) : null}
          </div>
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
